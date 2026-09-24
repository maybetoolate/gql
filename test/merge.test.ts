import { describe, expect, test, beforeAll } from "bun:test";
import type { ApolloServer } from "@apollo/server";
import { makeServer, exec, expectOk, expectCode, createTestUser } from "./helpers";
import type { GraphQLContext } from "../src/schema";

describe("mergeBooks", () => {
  let server: ApolloServer<GraphQLContext>;
  let adminId: string;
  let aliceId: string;
  let bobId: string;
  beforeAll(async () => {
    server = makeServer();
    const { db } = await import("../src/db");
    const { users } = await import("../src/db/schema");
    const { eq } = await import("drizzle-orm");
    adminId = (await createTestUser("mergeadmin")).user.id;
    await db.update(users).set({ role: "admin" }).where(eq(users.id, adminId));
    aliceId = (await createTestUser("mergealice")).user.id;
    bobId = (await createTestUser("mergebob")).user.id;
  });

  async function makeBook(title: string, by: string) {
    return expectOk<{ id: string }>(
      await exec(server, `mutation($t: String!) { addBook(title: $t, author: "M") { id } }`, { t: title }, by),
      "addBook",
    ).id;
  }

  test("guards", async () => {
    const id = await makeBook("Guard Book (merge)", adminId);
    expectCode(
      await exec(server, `mutation($a: ID!, $b: ID!) { mergeBooks(sourceId: $a, targetId: $b) { id } }`, { a: id, b: id }, adminId),
      "BAD_USER_INPUT",
    );
    expectCode(
      await exec(server, `mutation($a: ID!) { mergeBooks(sourceId: $a, targetId: "missing") { id } }`, { a: id }, adminId),
      "NOT_FOUND",
    );
    expectCode(
      await exec(server, `mutation($a: ID!, $b: ID!) { mergeBooks(sourceId: $a, targetId: $b) { id } }`, { a: id, b: id }, aliceId),
      "FORBIDDEN",
    );
  });

  test("merges duplicates with conflict rules", async () => {
    const source = await makeBook("Dune Messiah (merge-src)", adminId);
    const target = await makeBook("Dune Messiah (merge-dst)", adminId);

    // Alice reviewed + shelved + favorited + tagged both.
    for (const [id, text, rating, status] of [
      [source, "Source review (merge)", 3, "want_to_read"],
      [target, null, 5, "finished"],
    ] as const) {
      if (text) {
        await exec(server, `mutation($id: ID!) { upsertReview(bookId: $id, rating: ${rating}, text: "${text}") { id } }`, { id }, aliceId);
      } else {
        await exec(server, `mutation($id: ID!) { upsertReview(bookId: $id, rating: ${rating}) { id } }`, { id }, aliceId);
      }
      await exec(server, `mutation($id: ID!) { setShelfStatus(bookId: $id, status: ${status}) { id } }`, { id }, aliceId);
      await exec(server, `mutation($id: ID!) { toggleFavorite(bookId: $id) { id } }`, { id }, aliceId);
    }
    await exec(server, `mutation($id: ID!) { addTagToBook(bookId: $id, name: "mergetag") { id } }`, { id: source }, adminId);
    await exec(server, `mutation($id: ID!) { addTagToBook(bookId: $id, name: "mergetag") { id } }`, { id: target }, adminId);
    // Bob only touched the source.
    await exec(server, `mutation($id: ID!) { upsertReview(bookId: $id, rating: 4, text: "Bob (merge)") { id } }`, { id: source }, bobId);

    const merged = expectOk<{ id: string; title: string }>(
      await exec(
        server,
        `mutation($s: ID!, $t: ID!) { mergeBooks(sourceId: $s, targetId: $t) { id title } }`,
        { s: source, t: target },
        adminId,
      ),
      "mergeBooks",
    );
    expect(merged.id).toBe(target);

    // Source is gone.
    const gone = await exec(server, `query($id: ID!) { book(id: $id) { id } }`, { id: source }, adminId);
    expect(gone.data?.book).toBeNull();

    // Alice: source review had text (wins over target's textless 5★)… verify single review kept.
    const book = expectOk<{ reviews: { rating: number; text: string | null }[] }>(
      await exec(server, `query($id: ID!) { book(id: $id) { reviews { rating text } } }`, { id: target }, adminId),
      "book",
    );
    const reviews = book.reviews;
    const aliceReview = reviews.find((r) => r.text === "Source review (merge)");
    expect(aliceReview?.rating).toBe(3);
    expect(reviews.filter((r) => r.text === "Bob (merge)")[0]?.rating).toBe(4);

    // Shelf: finished wins, tags deduped, favorite single.
    const shelf = expectOk<{ status: string; book: { id: string } }[]>(
      await exec(server, `{ myShelf { status book { id } } }`, {}, aliceId),
      "myShelf",
    );
    const kept = shelf.filter((s) => s.book.id === target);
    expect(kept).toHaveLength(1);
    expect(kept[0]?.status).toBe("finished");

    const detail = expectOk<{ tags: { name: string }[] }>(
      await exec(server, `query($id: ID!) { book(id: $id) { tags { name } } }`, { id: target }, adminId),
      "book",
    );
    expect(detail.tags.filter((t) => t.name === "mergetag")).toHaveLength(1);

    // Audit trail.
    const entries = expectOk<{ action: string; targetId: string }[]>(
      await exec(server, `{ auditLog(limit: 5) { action targetId } }`, {}, adminId),
      "auditLog",
    );
    expect(entries.some((e) => e.action === "BOOK_MERGE" && e.targetId === target)).toBe(true);
  });
});
