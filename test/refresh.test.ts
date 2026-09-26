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

  test("expired access tokens are rejected", async () => {    const { db } = await import("../src/db");
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

  test("background pruner removes dead sessions", async () => {
    const { db } = await import("../src/db");
    const { refreshTokens } = await import("../src/db/schema");
    const { eq } = await import("drizzle-orm");
    const { startSessionPruner } = await import("../src/auth");
    const staleHash = `stale-${Date.now()}`;
    await db.insert(refreshTokens).values({
      userId,
      tokenHash: staleHash,
      expiresAt: Date.now() - 8 * 24 * 60 * 60 * 1000,
    });
    const stop = startSessionPruner(20);
    try {
      const deadline = Date.now() + 2000;
      for (;;) {
        const rows = await db
          .select({ id: refreshTokens.id })
          .from(refreshTokens)
          .where(eq(refreshTokens.tokenHash, staleHash));
        if (rows.length === 0) break;
        if (Date.now() > deadline) throw new Error("pruner did not run in time");
        await Bun.sleep(25);
      }
    } finally {
      stop();
    }
  });

  test("password reset flow", async () => {
    // Unknown emails still return true (no enumeration).
    expect(
      expectOk<boolean>(
        await exec(server, `mutation { requestPasswordReset(email: "nobody@example.com") }`),
        "requestPasswordReset",
      ),
    ).toBe(true);

    const { requestPasswordReset } = await import("../src/auth");
    const created = await createTestUser("resetme");
    const token = await requestPasswordReset(created.user.email);
    expect(token).toBeTruthy();

    expectCode(
      await exec(server, `mutation { resetPassword(token: "junk", newPassword: "newpass123") { token } }`),
      "UNAUTHENTICATED",
    );
    expectCode(
      await exec(
        server,
        `mutation($t: String!) { resetPassword(token: $t, newPassword: "123") { token } }`,
        { t: token! },
      ),
      "BAD_USER_INPUT",
    );

    const done = expectOk<{ token: string; refreshToken: string }>(
      await exec(
        server,
        `mutation($t: String!) { resetPassword(token: $t, newPassword: "newpass123") { token refreshToken } }`,
        { t: token! },
      ),
      "resetPassword",
    );
    expect(done.refreshToken).toBeTruthy();

    // Single-use: reuse is rejected.
    expectCode(
      await exec(
        server,
        `mutation($t: String!) { resetPassword(token: $t, newPassword: "newpass123") { token } }`,
        { t: token! },
      ),
      "UNAUTHENTICATED",
    );

    // Old password dead, new one works.
    expectCode(
      await exec(
        server,
        `mutation($e: String!) { login(email: $e, password: "password123") { token } }`,
        { e: created.user.email },
      ),
      "UNAUTHENTICATED",
    );
    expectOk(
      await exec(
        server,
        `mutation($e: String!) { login(email: $e, password: "newpass123") { token } }`,
        { e: created.user.email },
      ),
      "login",
    );
  });
});
