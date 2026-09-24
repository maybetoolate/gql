import { describe, expect, test, beforeAll, afterEach } from "bun:test";
import { app } from "../src/index";
import {
  buildAuthUrl,
  findOrCreateOAuthUser,
  makeOAuthState,
  verifyOAuthState,
} from "../src/oauth";
import { createTestUser } from "./helpers";

const realFetch = globalThis.fetch;

function stubFetch(handler: (url: string) => Record<string, unknown>) {
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = typeof input === "string" ? input : input.toString();
    return Response.json(handler(url));
  }) as typeof fetch;
}

afterEach(() => {
  globalThis.fetch = realFetch;
  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_SECRET;
});

describe("oauth", () => {
  beforeAll(() => {
    process.env.JWT_SECRET = "test-secret";
  });

  test("state round-trips and rejects tampering", async () => {
    const state = await makeOAuthState("google");
    expect(await verifyOAuthState(state, "google")).toBe(true);
    expect(await verifyOAuthState(state, "github")).toBe(false);
    expect(await verifyOAuthState(`${state}x`, "google")).toBe(false);
    expect(await verifyOAuthState("garbage", "google")).toBe(false);
  });

  test("auth URL points at the provider", async () => {
    process.env.GOOGLE_CLIENT_ID = "test-id";
    process.env.GOOGLE_CLIENT_SECRET = "test-secret";
    const url = buildAuthUrl("google", "s123");
    expect(url.startsWith("https://accounts.google.com/")).toBe(true);
    expect(url).toContain("client_id=test-id");
    expect(url).toContain("state=s123");
  });

  test("unconfigured provider is rejected", async () => {
    const res = await app.request("/auth/google");
    expect(res.status).toBe(400);
    const nope = await app.request("/auth/nope/callback?code=x&state=y");
    expect(nope.status).toBe(400);
  });

  test("link-or-create: new, email match, and relogin", async () => {
    const first = await findOrCreateOAuthUser("github", {
      id: "gh-1",
      email: "oauth-new@example.com",
      name: "Oscar",
    });
    expect(first.created).toBe(true);

    const { user } = await createTestUser("oauthpwd");
    const linked = await findOrCreateOAuthUser("google", {
      id: "g-9",
      email: user.email,
      name: "Ignored",
    });
    expect(linked).toEqual({ userId: user.id, created: false });

    const again = await findOrCreateOAuthUser("github", {
      id: "gh-1",
      email: "oauth-new@example.com",
      name: "Oscar",
    });
    expect(again).toEqual({ userId: first.userId, created: false });
  });

  test("full callback flow with stubbed provider", async () => {
    process.env.GOOGLE_CLIENT_ID = "test-id";
    process.env.GOOGLE_CLIENT_SECRET = "test-secret";
    stubFetch((url) => {
      if (url.includes("oauth2.googleapis.com/token")) return { access_token: "at-1" };
      if (url.includes("googleapis.com/oauth2/v3/userinfo")) {
        return { sub: "google-sub-7", email: "g7@example.com", name: "G Seven" };
      }
      throw new Error(`unexpected fetch: ${url}`);
    });

    const start = await app.request("/auth/google");
    expect(start.status).toBe(302);
    expect(start.headers.get("location") ?? "").toContain("accounts.google.com");
    const setCookie = start.headers.get("set-cookie") ?? "";
    const stateCookie = setCookie.split(";")[0] ?? "";
    const state = new URL(start.headers.get("location") ?? "").searchParams.get("state");
    expect(state).toBeTruthy();

    const cb = await app.request(
      `/auth/google/callback?code=authcode&state=${state}`,
      { headers: { cookie: stateCookie } },
    );
    expect(cb.status).toBe(302);
    const location = cb.headers.get("location") ?? "";
    expect(location).toContain("/auth/callback#");
    const fragment = new URLSearchParams(location.split("#")[1] ?? "");
    expect(fragment.get("token")).toBeTruthy();
    expect(fragment.get("refresh")).toBeTruthy();

    // Issued tokens authenticate GraphQL.
    const me = await app.request("/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${fragment.get("token")}`,
      },
      body: JSON.stringify({ query: "{ me { email } }" }),
    });
    const meBody = (await me.json()) as { data: { me: { email: string } } };
    expect(meBody.data.me.email).toBe("g7@example.com");
  });

  test("callback rejects bad state and exchange failures", async () => {
    process.env.GOOGLE_CLIENT_ID = "test-id";
    process.env.GOOGLE_CLIENT_SECRET = "test-secret";

    const bad = await app.request("/auth/google/callback?code=x&state=y", {
      headers: { cookie: "oauth_state=z" },
    });
    expect(bad.status).toBe(302);
    expect(bad.headers.get("location") ?? "").toContain("error=");

    stubFetch(() => {
      throw new Error("provider down");
    });
    const state = await makeOAuthState("google");
    const fail = await app.request(
      `/auth/google/callback?code=x&state=${encodeURIComponent(state)}`,
      { headers: { cookie: `oauth_state=${state}` } },
    );
    expect(fail.status).toBe(302);
    expect(fail.headers.get("location") ?? "").toContain("error=");
  });
});
