import { describe, expect, test, beforeAll } from "bun:test";
import type { ApolloServer } from "@apollo/server";
import { makeServer, exec, expectOk, createTestUser } from "./helpers";
import type { GraphQLContext } from "../src/schema";

describe("similarBooks", () => {
  let server: ApolloServer<GraphQLContext>;
  let userId: string;
  beforeAll(async () => {
    server = makeServer();
    userId = (await createTestUser("similarian")).user.id;
    for (const [t, a] of [
      ["The Great Gatsby (sim)", "F. Scott Fitzgerald"],
      ["Great Expectations (sim)", "Charles Dickens"],
      ["Unrelated Tome (sim)", "Nobody"],
    ] as const) {
      await exec(
        server,
        `mutation($t: String!, $a: String!) { addBook(title: $t, author: $a) { id } }`,
        { t, a },
        userId,
      );
    }
  });

  test("ranks exact and author matches first", async () => {
    const res = expectOk<{ title: string; author: string }[]>(
      await exec(
        server,
        `{ similarBooks(title: "Great", author: "F. Scott Fitzgerald") { title author } }`,
        {},
        userId,
      ),
      "similarBooks",
    );
    expect(res.map((b) => b.title)).toEqual([
      "The Great Gatsby (sim)",
      "Great Expectations (sim)",
    ]);
  });

  test("empty query and gibberish return nothing", async () => {
    expect(
      expectOk<unknown[]>(
        await exec(server, `{ similarBooks(title: "   ") { id } }`, {}, userId),
        "similarBooks",
      ),
    ).toEqual([]);
    expect(
      expectOk<unknown[]>(
        await exec(server, `{ similarBooks(title: "xqzt kpqr zz") { id } }`, {}, userId),
        "similarBooks",
      ),
    ).toEqual([]);
  });

  test("public and limit-capped", async () => {
    const anon = await exec(server, `{ similarBooks(title: "Great", limit: 1) { title } }`);
    expect(anon.errors ?? []).toEqual([]);
    expect(
      (anon.data?.similarBooks as { title: string }[]).length,
    ).toBeLessThanOrEqual(1);
  });
});
