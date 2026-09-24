import { describe, expect, test, beforeAll } from "bun:test";
import type { ApolloServer } from "@apollo/server";
import { verifyPassword, hashPassword } from "../src/auth";
import { makeServer, exec, expectOk, expectCode, createTestUser } from "./helpers";
import type { GraphQLContext } from "../src/schema";

describe("auth", () => {
  let server: ApolloServer<GraphQLContext>;
  beforeAll(() => {
    server = makeServer();
  });

  test("password hashing round-trips", async () => {
    const hash = await hashPassword("s3cret!");
    expect(await verifyPassword("s3cret!", hash)).toBe(true);
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });

  test("register + login + me", async () => {
    const reg = await exec(
      server,
      `mutation($e: String!, $p: String!, $n: String!) {
        register(email: $e, password: $p, name: $n) { token user { email name } }
      }`,
      { e: "auth-flow@example.com", p: "password123", n: "Auth Flow" },
    );
    const payload = expectOk<{ token: string; user: { email: string } }>(reg, "register");
    expect(payload.token.length).toBeGreaterThan(10);
    expect(payload.user.email).toBe("auth-flow@example.com");

    const login = await exec(
      server,
      `mutation { login(email: "auth-flow@example.com", password: "password123") { token } }`,
    );
    expectOk(login, "login.token");

    const bad = await exec(
      server,
      `mutation { login(email: "auth-flow@example.com", password: "nope-nope") { token } }`,
    );
    expectCode(bad, "UNAUTHENTICATED");
  });

  test("register validation", async () => {
    const dup = await exec(
      server,
      `mutation { register(email: "auth-flow@example.com", password: "password123", name: "X") { token } }`,
    );
    expectCode(dup, "BAD_USER_INPUT");

    const badEmail = await exec(
      server,
      `mutation { register(email: "not-an-email", password: "password123", name: "X") { token } }`,
    );
    expectCode(badEmail, "BAD_USER_INPUT");

    const short = await exec(
      server,
      `mutation { register(email: "short-x@example.com", password: "123", name: "X") { token } }`,
    );
    expectCode(short, "BAD_USER_INPUT");
  });

  test("me requires auth", async () => {
    const anon = await exec(server, `{ me { id } }`);
    expectCode(anon, "UNAUTHENTICATED");

    const { user } = await createTestUser("authme");
    const authed = await exec(server, `{ me { email } }`, {}, user.id);
    expect(expectOk<{ email: string }>(authed, "me").email).toContain("authme");
  });
});
