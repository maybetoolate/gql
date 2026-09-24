import { describe, expect, test, beforeAll } from "bun:test";
import type { ApolloServer } from "@apollo/server";
import { makeServer, exec, expectOk, expectCode, createTestUser } from "./helpers";
import type { GraphQLContext } from "../src/schema";

describe("admin", () => {
  let server: ApolloServer<GraphQLContext>;
  let adminId: string;
  let memberId: string;
  beforeAll(async () => {
    server = makeServer();
    const { db } = await import("../src/db");
    const { users } = await import("../src/db/schema");
    const { eq } = await import("drizzle-orm");
    adminId = (await createTestUser("adminone")).user.id;
    await db.update(users).set({ role: "admin" }).where(eq(users.id, adminId));
    memberId = (await createTestUser("adminmember")).user.id;
  });

  test("guards", async () => {
    expectCode(await exec(server, `{ adminStats { userCount } }`), "UNAUTHENTICATED");
    expectCode(await exec(server, `{ adminStats { userCount } }`, {}, memberId), "FORBIDDEN");
    expectCode(await exec(server, `{ users { id } }`, {}, memberId), "FORBIDDEN");
    expectCode(
      await exec(server, `mutation($id: ID!) { setUserRole(userId: $id, role: admin) { id } }`, { id: memberId }, memberId),
      "FORBIDDEN",
    );
  });

  test("stats, search, and role payloads", async () => {
    const stats = expectOk<Record<string, number>>(
      await exec(
        server,
        `{ adminStats { userCount bookCount reviewCount commentCount shelfCount favoriteCount followCount tagCount } }`,
        {},
        adminId,
      ),
      "adminStats",
    );
    expect(stats.userCount).toBeGreaterThanOrEqual(2);
    for (const v of Object.values(stats)) expect(v).toBeGreaterThanOrEqual(0);

    const found = expectOk<{ email: string }[]>(
      await exec(server, `{ users(search: "adminmember") { email } }`, {}, adminId),
      "users",
    );
    expect(found.map((u) => u.email)).toEqual(
      expect.arrayContaining([expect.stringContaining("adminmember")]),
    );

    const me = expectOk<{ role: string }>(
      await exec(server, `{ me { role } }`, {}, adminId),
      "me",
    );
    expect(me.role).toBe("admin");
  });

  test("promote, self-demote blocked, delete cascades", async () => {
    const promoted = expectOk<{ role: string }>(
      await exec(
        server,
        `mutation($id: ID!) { setUserRole(userId: $id, role: admin) { role } }`,
        { id: memberId },
        adminId,
      ),
      "setUserRole",
    );
    expect(promoted.role).toBe("admin");

    expectCode(
      await exec(
        server,
        `mutation($id: ID!) { setUserRole(userId: $id, role: member) { id } }`,
        { id: adminId },
        adminId,
      ),
      "BAD_USER_INPUT",
    );
    expectCode(
      await exec(
        server,
        `mutation($id: ID!) { deleteUser(userId: $id) }`,
        { id: adminId },
        adminId,
      ),
      "BAD_USER_INPUT",
    );

    // Member creates content, then is deleted: content goes with them.
    const bookId = expectOk<{ id: string }>(
      await exec(server, `mutation { addBook(title: "Doomed (admin)", author: "D") { id } }`, {}, memberId),
      "addBook",
    ).id;
    const deleted = expectOk<boolean>(
      await exec(server, `mutation($id: ID!) { deleteUser(userId: $id) }`, { id: memberId }, adminId),
      "deleteUser",
    );
    expect(deleted).toBe(true);
    const gone = await exec(
      server,
      `query($id: ID!) { book(id: $id) { id } }`,
      { id: bookId },
      adminId,
    );
    expect(gone.data?.book).toBeNull();
  });
});
