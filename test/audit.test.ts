import { describe, expect, test, beforeAll } from "bun:test";
import type { ApolloServer } from "@apollo/server";
import { makeServer, exec, expectOk, expectCode, createTestUser } from "./helpers";
import type { GraphQLContext } from "../src/schema";

const LIST = `{ auditLog(limit: 20) { action targetType targetId detail actor { email } } }`;

describe("audit log", () => {
  let server: ApolloServer<GraphQLContext>;
  let adminId: string;
  let memberId: string;
  beforeAll(async () => {
    server = makeServer();
    const { db } = await import("../src/db");
    const { users } = await import("../src/db/schema");
    const { eq } = await import("drizzle-orm");
    adminId = (await createTestUser("auditadmin")).user.id;
    await db.update(users).set({ role: "admin" }).where(eq(users.id, adminId));
    memberId = (await createTestUser("auditmember")).user.id;
  });

  test("guards", async () => {
    expectCode(await exec(server, `{ auditLog { id } }`), "UNAUTHENTICATED");
    expectCode(await exec(server, `{ auditLog { id } }`, {}, memberId), "FORBIDDEN");
  });

  test("role change, book delete, and user delete are recorded", async () => {
    const bookId = expectOk<{ id: string }>(
      await exec(server, `mutation { addBook(title: "Audit Book (audit)", author: "A") { id } }`, {}, memberId),
      "addBook",
    ).id;

    await exec(
      server,
      `mutation($id: ID!) { setUserRole(userId: $id, role: admin) { id } }`,
      { id: memberId },
      adminId,
    );
    await exec(
      server,
      `mutation($id: ID!) { deleteBook(id: $id) }`,
      { id: bookId },
      memberId,
    );
    await exec(
      server,
      `mutation($id: ID!) { deleteUser(userId: $id) }`,
      { id: memberId },
      adminId,
    );

    const entries = expectOk<{ action: string; targetType: string; targetId: string; detail: string | null; actor: { email: string } | null }[]>(
      await exec(server, LIST, {}, adminId),
      "auditLog",
    );
    // Other test files share the in-memory DB, so match our own rows.
    const mine = entries.filter((e) => e.targetId === memberId || e.targetId === bookId);
    const byAction = new Map(mine.map((e) => [e.action, e]));
    expect(byAction.get("ROLE_CHANGE")).toMatchObject({
      targetType: "user",
      targetId: memberId,
      detail: "role=admin",
    });
    expect(byAction.get("BOOK_DELETE")).toMatchObject({
      targetType: "book",
      targetId: bookId,
    });
    expect(byAction.get("USER_DELETE")).toMatchObject({
      targetType: "user",
      targetId: memberId,
    });
    for (const e of [byAction.get("ROLE_CHANGE")!, byAction.get("USER_DELETE")!]) {
      expect(e.actor?.email).toContain("audit");
    }
    // The member authored BOOK_DELETE, but deleting the member nulls the
    // reference (ON DELETE SET NULL) — the entry itself survives.
    expect(byAction.get("BOOK_DELETE")!.actor).toBeNull();
  });
});
