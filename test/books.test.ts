import { describe, expect, test, beforeAll } from "bun:test";
import type { ApolloServer } from "@apollo/server";
import { makeServer, exec, expectOk, expectCode, createTestUser } from "./helpers";
import type { GraphQLContext } from "../src/schema";

const ADD = `mutation($t: String!, $a: String!) {
  addBook(title: $t, author: $a) { id title author }
}`;

describe("books", () => {
  let server: ApolloServer<GraphQLContext>;
  let ownerId: string;
  let strangerId: string;
  beforeAll(async () => {
    server = makeServer();
    ownerId = (await createTestUser("bookowner")).user.id;
    strangerId = (await createTestUser("bookstranger")).user.id;
  });

  test("addBook requires auth and valid input", async () => {
    expectCode(await exec(server, ADD, { t: "X", a: "Y" }), "UNAUTHENTICATED");
    expectCode(
      await exec(server, ADD, { t: "   ", a: "Y" }, ownerId),
      "BAD_USER_INPUT",
    );
  });

  test("owner can update and delete, others cannot", async () => {
    const added = expectOk<{ id: string }>(
      await exec(server, ADD, { t: "Owner Book (books)", a: "Owner" }, ownerId),
      "addBook",
    );

    expectCode(
      await exec(
        server,
        `mutation($id: ID!) { updateBook(id: $id, title: "Hijacked") { id } }`,
        { id: added.id },
        strangerId,
      ),
      "FORBIDDEN",
    );
    const updated = expectOk<{ title: string }>(
      await exec(
        server,
        `mutation($id: ID!) { updateBook(id: $id, title: "Owner Book 2 (books)") { title } }`,
        { id: added.id },
        ownerId,
      ),
      "updateBook",
    );
    expect(updated.title).toBe("Owner Book 2 (books)");

    expectCode(
      await exec(server, `mutation($id: ID!) { deleteBook(id: $id) }`, { id: added.id }, strangerId),
      "FORBIDDEN",
    );
    const del = expectOk<boolean>(
      await exec(server, `mutation($id: ID!) { deleteBook(id: $id) }`, { id: added.id }, ownerId),
      "deleteBook",
    );
    expect(del).toBe(true);

    const gone = await exec(
      server,
      `query($id: ID!) { book(id: $id) { id } }`,
      { id: added.id },
      ownerId,
    );
    expect(gone.errors ?? []).toEqual([]);
    expect(gone.data?.book).toBeNull();
  });

  test("search, sort, and counts agree", async () => {
    await exec(server, ADD, { t: "Zebra Tales (books)", a: "Zed" }, ownerId);
    await exec(server, ADD, { t: "Apple Stories (books)", a: "Ann" }, ownerId);

    const fts = expectOk<{ title: string }[]>(
      await exec(server, `{ books(search: "zebra (books)") { title } }`),
      "books",
    );
    expect(fts.map((b) => b.title)).toEqual(["Zebra Tales (books)"]);

    const sorted = expectOk<{ title: string }[]>(
      await exec(
        server,
        `{ books(search: "(books)", sort: TITLE) { title } }`,
      ),
      "books",
    );
    const titles = sorted.map((b) => b.title);
    expect(titles).toEqual([...titles].sort());

    const counted = expectOk<number>(
      await exec(server, `{ booksCount(search: "(books)") }`),
      "booksCount",
    );
    expect(counted).toBe(titles.length);
  });
});
