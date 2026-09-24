import { describe, expect, test, beforeAll } from "bun:test";
import type { ApolloServer } from "@apollo/server";
import { makeServer, exec, expectOk, createTestUser } from "./helpers";
import type { GraphQLContext } from "../src/schema";

describe("batched hydration", () => {
  let server: ApolloServer<GraphQLContext>;
  let hubId: string;
  const fanIds: string[] = [];
  let bookId: string;
  beforeAll(async () => {
    server = makeServer();
    hubId = (await createTestUser("hydrahub")).user.id;
    for (const p of ["hydraa", "hydrab", "hydrac"]) {
      const id = (await createTestUser(p)).user.id;
      fanIds.push(id);
      await exec(server, `mutation($id: ID!) { followUser(userId: $id) { id } }`, { id: hubId }, id);
    }
    bookId = expectOk<{ id: string }>(
      await exec(server, `mutation { addBook(title: "Hydra Book (hydra)", author: "H") { id } }`, {}, hubId),
      "addBook",
    ).id;
    await exec(server, `mutation($id: ID!) { addTagToBook(bookId: $id, name: "hydratag") { id } }`, { id: bookId }, hubId);
    const reviewId = expectOk<{ id: string }>(
      await exec(server, `mutation($id: ID!) { upsertReview(bookId: $id, rating: 5, text: "Hydra (hydra)") { id } }`, { id: bookId }, hubId),
      "upsertReview",
    ).id;
    await exec(server, `mutation($id: ID!) { addComment(reviewId: $id, text: "Nice (hydra)") { id } }`, { id: reviewId }, fanIds[0]!);
    await exec(server, `mutation($id: ID!) { setShelfStatus(bookId: $id, status: finished) { id } }`, { id: bookId }, fanIds[1]!);
  });

  test("followers list hydrates every member", async () => {
    const rows = expectOk<{ name: string; followersCount: number }[]>(
      await exec(server, `query($id: ID!) { followers(userId: $id) { name followersCount } }`, { id: hubId }, hubId),
      "followers",
    );
    expect(rows).toHaveLength(3);
    const names = rows.map((r) => r.name).sort();
    expect(names).toEqual([
      expect.stringContaining("hydraa"),
      expect.stringContaining("hydrab"),
      expect.stringContaining("hydrac"),
    ]);
    for (const r of rows) expect(r.followersCount).toBe(0);
  });

  test("following list hydrates", async () => {
    const rows = expectOk<{ name: string }[]>(
      await exec(server, `query($id: ID!) { following(userId: $id) { name } }`, { id: fanIds[0]! }, hubId),
      "following",
    );
    expect(rows.map((r) => r.name)).toEqual([expect.stringContaining("hydrahub")]);
  });

  test("tag counts, shelf books, review authors, feed items", async () => {
    const tags = expectOk<{ name: string; booksCount: number }[]>(
      await exec(server, `{ tags { name booksCount } }`, {}, hubId),
      "tags",
    );
    const hydra = tags.find((t) => t.name === "hydratag")!;
    expect(hydra.booksCount).toBe(1);

    const shelf = expectOk<{ book: { title: string }; progress: number }[]>(
      await exec(server, `{ myShelf { progress book { title } } }`, {}, fanIds[1]!),
      "myShelf",
    );
    expect(shelf).toHaveLength(1);
    expect(shelf[0]?.book.title).toBe("Hydra Book (hydra)");

    const book = expectOk<{ reviews: { user: { name: string }; comments: { user: { name: string } }[] }[] }>(
      await exec(server, `query($id: ID!) { book(id: $id) { reviews { user { name } comments { user { name } } } } }`, { id: bookId }, hubId),
      "book",
    );
    expect(book.reviews[0]?.user.name).toContain("hydrahub");
    expect(book.reviews[0]?.comments[0]?.user.name).toContain("hydraa");

    const feed = expectOk<{ type: string; user: { name: string }; book: { title: string } }[]>(
      await exec(server, `{ activityFeed(limit: 10) { type user { name } book { title } } }`, {}, fanIds[0]!),
      "activityFeed",
    );
    // fanIds[0] follows hub; hub has review + book activity.
    expect(feed.length).toBeGreaterThan(0);
    expect(feed.every((i) => i.user.name && i.book.title)).toBe(true);
  });
});
