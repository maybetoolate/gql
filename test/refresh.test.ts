import { describe, expect, test, beforeAll } from "bun:test";
import type { ApolloServer } from "@apollo/server";
import { verify } from "hono/jwt";
import { makeServer, exec, expectOk, expectCode, createTestUser } from "./helpers";
import { getJwtSecret, signToken } from "../src/auth";
import type { GraphQLContext } from "../src/schema";

const PAIR = `{ token refreshToken user { id } }`;

describe("refresh sessions", () => {
  let server: ApolloServer<GraphQLContext>;
  let userId: string;
  let email: string;
  beforeAll(async () => {
    server = makeServer();
    const created = await createTestUser("sessioner");
    userId = created.user.id;
    email = created.user.email;
  });

  async function login() {
    return expectOk<{ token: string; refreshToken: string }>(
      await exec(
        server,
        `mutation($e: String!) { login(email: $e, password: "password123") { token refreshToken } }`,
        { e: email },
      ),
      "login",
    );
  }

  test("rotate invalidates the old token", async () => {
    const first = await login();
    expect(first.refreshToken.length).toBeGreaterThanOrEqual(64);

    const second = expectOk<{ token: string; refreshToken: string }>(
      await exec(
        server,
        `mutation($t: String!) { refreshToken(token: $t) ${PAIR} }`,
        { t: first.refreshToken },
      ),
      "refreshToken",
    );
    expect(second.refreshToken).not.toBe(first.refreshToken);

    // Reuse of the rotated token is rejected.
    expectCode(
      await exec(server, `mutation($t: String!) { refreshToken(token: $t) ${PAIR} }`, {
        t: first.refreshToken,
      }),
      "UNAUTHENTICATED",
    );

    // Garbage is rejected too.
    expectCode(
      await exec(server, `mutation { refreshToken(token: "nope") ${PAIR} }`),
      "UNAUTHENTICATED",
    );
  });

  test("logout revokes a single session", async () => {
    const a = await login();
    const b = await login();

    const out = expectOk<boolean>(
      await exec(server, `mutation($t: String!) { logout(token: $t) }`, { t: a.refreshToken }),
      "logout",
    );
    expect(out).toBe(true);

    expectCode(
      await exec(server, `mutation($t: String!) { refreshToken(token: $t) ${PAIR} }`, {
        t: a.refreshToken,
      }),
      "UNAUTHENTICATED",
    );
    // The other session still works.
    expectOk(
      await exec(server, `mutation($t: String!) { refreshToken(token: $t) ${PAIR} }`, {
        t: b.refreshToken,
      }),
      "refreshToken",
    );
  });

  test("logoutAll revokes everything", async () => {
    const a = await login();
    const b = await login();

    expectCode(await exec(server, `mutation { logoutAll }`), "UNAUTHENTICATED");
    const done = expectOk<boolean>(
      await exec(server, `mutation { logoutAll }`, {}, userId),
      "logoutAll",
    );
    expect(done).toBe(true);

    for (const t of [a.refreshToken, b.refreshToken]) {
      expectCode(
        await exec(server, `mutation($t: String!) { refreshToken(token: $t) ${PAIR} }`, { t }),
        "UNAUTHENTICATED",
      );
    }
  });

  test("expired access tokens are rejected", async () => {
    const { db } = await import("../src/db");
    const { users } = await import("../src/db/schema");
    const { eq } = await import("drizzle-orm");
    const rows = await db.select().from(users).where(eq(users.id, userId));
    const expired = await signToken(rows[0]!, -10);
    let rejected = false;
    try {
      await verify(expired, getJwtSecret(), "HS256");
    } catch {
      rejected = true;
    }
    expect(rejected).toBe(true);
  });
});
