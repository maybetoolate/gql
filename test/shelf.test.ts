import { describe, expect, test, beforeAll } from "bun:test";
import type { ApolloServer } from "@apollo/server";
import { makeServer, exec, expectOk, expectCode, createTestUser } from "./helpers";
import type { GraphQLContext } from "../src/schema";

describe("shelf and favorites", () => {
  let server: ApolloServer<GraphQLContext>;
  let userId: string;
  let bookId: string;
  beforeAll(async () => {
    server = makeServer();
    userId = (await createTestUser("shelver")).user.id;
    bookId = expectOk<{ id: string }>(
      await exec(
        server,
        `mutation { addBook(title: "Shelf Book (shelf)", author: "S") { id } }`,
        {},
        userId,
      ),
      "addBook",
    ).id;
  });

  test("shelf lifecycle with progress", async () => {
    expectCode(
      await exec(server, `mutation($id: ID!) { setShelfStatus(bookId: $id, status: reading) { id } }`, {
        id: bookId,
      }),
      "UNAUTHENTICATED",
    );

    const set = expectOk<{ status: string; progress: number }>(
      await exec(
        server,
        `mutation($id: ID!) { setShelfStatus(bookId: $id, status: reading) { status progress } }`,
        { id: bookId },
        userId,
      ),
      "setShelfStatus",
    );
    expect(set.status).toBe("reading");
    expect(set.progress).toBe(0);

    const prog = expectOk<{ status: string; progress: number }>(
      await exec(
        server,
        `mutation($id: ID!) { updateShelfProgress(bookId: $id, progress: 100) { status progress } }`,
        { id: bookId },
        userId,
      ),
      "updateShelfProgress",
    );
    expect(prog).toEqual({ status: "finished", progress: 100 });

    const shelf = expectOk<{ status: string; progress: number }[]>(
      await exec(server, `{ myShelf { status progress } }`, {}, userId),
      "myShelf",
    );
    expect(shelf).toEqual([{ status: "finished", progress: 100 }]);

    expectCode(
      await exec(
        server,
        `mutation($id: ID!) { updateShelfProgress(bookId: $id, progress: 101) { status } }`,
        { id: bookId },
        userId,
      ),
      "BAD_USER_INPUT",
    );

    const removed = expectOk<boolean>(
      await exec(server, `mutation($id: ID!) { removeFromShelf(bookId: $id) }`, { id: bookId }, userId),
      "removeFromShelf",
    );
    expect(removed).toBe(true);
  });

  test("favorites toggle round-trips", async () => {
    const on = expectOk<{ isFavorite: boolean }>(
      await exec(server, `mutation($id: ID!) { toggleFavorite(bookId: $id) { isFavorite } }`, {
        id: bookId,
      }, userId),
      "toggleFavorite",
    );
    expect(on.isFavorite).toBe(true);

    const favs = expectOk<{ title: string }[]>(
      await exec(server, `{ myFavorites { title } }`, {}, userId),
      "myFavorites",
    );
    expect(favs.map((b) => b.title)).toContain("Shelf Book (shelf)");

    const off = expectOk<{ isFavorite: boolean }>(
      await exec(server, `mutation($id: ID!) { toggleFavorite(bookId: $id) { isFavorite } }`, {
        id: bookId,
      }, userId),
      "toggleFavorite",
    );
    expect(off.isFavorite).toBe(false);
  });
});
