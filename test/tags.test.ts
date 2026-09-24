import { describe, expect, test, beforeAll } from "bun:test";
import type { ApolloServer } from "@apollo/server";
import { makeServer, exec, expectOk, expectCode, createTestUser } from "./helpers";
import type { GraphQLContext } from "../src/schema";

describe("tags", () => {
  let server: ApolloServer<GraphQLContext>;
  let userId: string;
  let bookId: string;
  beforeAll(async () => {
    server = makeServer();
    userId = (await createTestUser("tagger")).user.id;
    bookId = expectOk<{ id: string }>(
      await exec(
        server,
        `mutation { addBook(title: "Tagged Book (tags)", author: "T") { id } }`,
        {},
        userId,
      ),
      "addBook",
    ).id;
  });

  test("add, filter, and remove tags", async () => {
    const added = expectOk<{ tags: { name: string }[] }>(
      await exec(
        server,
        `mutation($id: ID!) { addTagToBook(bookId: $id, name: "  Epic  ") { tags { name } } }`,
        { id: bookId },
        userId,
      ),
      "addTagToBook",
    );
    expect(added.tags.map((t) => t.name)).toEqual(["epic"]);

    const filtered = expectOk<{ title: string }[]>(
      await exec(server, `{ books(tags: ["epic"]) { title } }`),
      "books",
    );
    expect(filtered.map((b) => b.title)).toContain("Tagged Book (tags)");

    const tagged = expectOk<{ name: string }[]>(
      await exec(server, `{ tags { name } }`),
      "tags",
    );
    expect(tagged.map((t) => t.name)).toContain("epic");

    const removed = expectOk<{ tags: unknown[] }>(
      await exec(
        server,
        `mutation($id: ID!) { removeTagFromBook(bookId: $id, name: "epic") { tags { name } } }`,
        { id: bookId },
        userId,
      ),
      "removeTagFromBook",
    );
    expect(removed.tags).toEqual([]);
  });

  test("tag validation and permissions", async () => {
    expectCode(
      await exec(
        server,
        `mutation($id: ID!) { addTagToBook(bookId: $id, name: "!!!") { id } }`,
        { id: bookId },
        userId,
      ),
      "BAD_USER_INPUT",
    );
    expectCode(
      await exec(server, `mutation($id: ID!) { addTagToBook(bookId: $id, name: "x") { id } }`, {
        id: bookId,
      }),
      "UNAUTHENTICATED",
    );
    const stranger = (await createTestUser("tagstranger")).user.id;
    expectCode(
      await exec(
        server,
        `mutation($id: ID!) { addTagToBook(bookId: $id, name: "x") { id } }`,
        { id: bookId },
        stranger,
      ),
      "FORBIDDEN",
    );
  });
});
