import { describe, expect, test, beforeAll } from "bun:test";
import type { ApolloServer } from "@apollo/server";
import { makeServer, exec, expectOk, expectCode, createTestUser } from "./helpers";
import type { GraphQLContext } from "../src/schema";

describe("reading stats", () => {
  let server: ApolloServer<GraphQLContext>;
  let userId: string;
  beforeAll(async () => {
    server = makeServer();
    userId = (await createTestUser("statter")).user.id;
  });

  test("guards and validation", async () => {
    expectCode(await exec(server, `{ readingStats(year: 2026) { month } }`), "UNAUTHENTICATED");
    expectCode(
      await exec(server, `{ readingStats(year: 1999) { month } }`, {}, userId),
      "BAD_USER_INPUT",
    );
  });

  test("monthly counts from finished shelf items", async () => {
    const year = new Date().getUTCFullYear();
    const month = new Date().getUTCMonth() + 1;
    for (const title of ["Stat One (stats)", "Stat Two (stats)"]) {
      const bookId = expectOk<{ id: string }>(
        await exec(server, `mutation($t: String!) { addBook(title: $t, author: "S") { id } }`, { t: title }, userId),
        "addBook",
      ).id;
      await exec(
        server,
        `mutation($id: ID!) { setShelfStatus(bookId: $id, status: finished) { id } }`,
        { id: bookId },
        userId,
      );
    }

    const stats = expectOk<{ month: number; finished: number }[]>(
      await exec(server, `{ readingStats(year: ${year}) { month finished } }`, {}, userId),
      "readingStats",
    );
    expect(stats).toHaveLength(12);
    expect(stats.map((s) => s.month)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(stats.find((s) => s.month === month)?.finished).toBe(2);
    expect(stats.reduce((sum, s) => sum + s.finished, 0)).toBe(2);

    const empty = expectOk<{ finished: number }[]>(
      await exec(server, `{ readingStats(year: 2030) { finished } }`, {}, userId),
      "readingStats",
    );
    expect(empty.every((s) => s.finished === 0)).toBe(true);
  });
});
