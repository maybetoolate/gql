import { describe, expect, test, beforeAll } from "bun:test";
import type { ApolloServer } from "@apollo/server";
import { makeServer, exec, expectOk, expectCode, createTestUser } from "./helpers";
import type { GraphQLContext } from "../src/schema";

const CONN = (extra = "") => `{
  booksConnection(first: 2, ${extra}) {
    totalCount
    edges { cursor node { title } }
    pageInfo { hasNextPage endCursor }
  }
}`;

interface Conn {
  totalCount: number;
  edges: { cursor: string; node: { title: string } }[];
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
}

describe("booksConnection", () => {
  let server: ApolloServer<GraphQLContext>;
  let userId: string;
  const titles = [
    "Page Alpha (page)",
    "Page Bravo (page)",
    "Page Charlie (page)",
    "Page Delta (page)",
    "Page Echo (page)",
  ];
  beforeAll(async () => {
    server = makeServer();
    userId = (await createTestUser("pager")).user.id;
    for (const t of titles) {
      await exec(
        server,
        `mutation($t: String!) { addBook(title: $t, author: "P") { id } }`,
        { t },
        userId,
      );
    }
  });

  test("guards", async () => {
    expectCode(
      await exec(server, CONN(`after: "bogus"`), {}, userId),
      "BAD_USER_INPUT",
    );
    // Like `books`, the connection is public — no auth required.
    const anon = await exec(server, CONN(`search: "(page)"`));
    expect(anon.errors ?? []).toEqual([]);
  });

  test("pages newest-first with no duplicates", async () => {
    const seen: string[] = [];
    let after: string | null = null;
    let pages = 0;
    for (;;) {
      const conn = expectOk<Conn>(
        await exec(
          server,
          CONN(after ? `after: "${after}"` : ""),
          {},
          userId,
        ),
        "booksConnection",
      );
      pages += 1;
      expect(conn.edges.length).toBeLessThanOrEqual(2);
      seen.push(...conn.edges.map((e) => e.node.title));
      if (!conn.pageInfo.hasNextPage) break;
      after = conn.pageInfo.endCursor;
      if (pages > 10) throw new Error("pagination did not terminate");
    }
    for (const t of titles) expect(seen).toContain(t);
    expect(new Set(seen).size).toBe(seen.length);
    expect(pages).toBeGreaterThan(1);
  });

  test("stable under concurrent inserts", async () => {
    const first = expectOk<Conn>(
      await exec(server, CONN(`search: "(page)"`), {}, userId),
      "booksConnection",
    );
    // Newest book lands before the cursor — later pages are unaffected.
    // Title avoids the word "page" so the "(page)" FTS set is untouched.
    await exec(
      server,
      `mutation { addBook(title: "Zzz Newcomer", author: "P") { id } }`,
      {},
      userId,
    );
    const seen = first.edges.map((e) => e.node.title);
    let after = first.pageInfo.endCursor;
    for (let i = 0; i < 5 && after; i++) {
      const conn = expectOk<Conn>(
        await exec(server, CONN(`search: "(page)", after: "${after}"`), {}, userId),
        "booksConnection",
      );
      seen.push(...conn.edges.map((e) => e.node.title));
      after = conn.pageInfo.hasNextPage ? conn.pageInfo.endCursor : null;
    }
    for (const t of titles) {
      expect(seen.filter((s) => s === t)).toHaveLength(1);
    }
  });

  test("totalCount matches filtered set", async () => {    const conn = expectOk<Conn>(
      await exec(server, CONN(`search: "(page)"`), {}, userId),
      "booksConnection",
    );
    expect(conn.totalCount).toBe(titles.length);
  });

  test("rating sort leads with top-rated and pages through", async () => {
    const all = expectOk<{ edges: { node: { id: string; title: string } }[] }>(
      await exec(
        server,
        `{ booksConnection(first: 10, search: "(page)", sort: NEWEST) { edges { node { id title } } } }`,
        {},
        userId,
      ),
      "booksConnection",
    );
    const alpha = all.edges.map((e) => e.node).find((b) => b.title === "Page Alpha (page)")!;
    await exec(
      server,
      `mutation($id: ID!) { upsertReview(bookId: $id, rating: 5) { id } }`,
      { id: alpha.id },
      userId,
    );

    const first = expectOk<Conn>(
      await exec(server, CONN(`search: "(page)", sort: RATING`), {}, userId),
      "booksConnection",
    );
    expect(first.edges[0]?.node.title).toBe("Page Alpha (page)");

    const seen = first.edges.map((e) => e.node.title);
    let after = first.pageInfo.endCursor;
    for (let i = 0; i < 5 && first.pageInfo.hasNextPage && after; i++) {
      const conn = expectOk<Conn>(
        await exec(
          server,
          CONN(`search: "(page)", sort: RATING, after: "${after}"`),
          {},
          userId,
        ),
        "booksConnection",
      );
      seen.push(...conn.edges.map((e) => e.node.title));
      if (!conn.pageInfo.hasNextPage) break;
      after = conn.pageInfo.endCursor;
    }
    for (const t of titles) {
      expect(seen.filter((s) => s === t)).toHaveLength(1);
    }
  });

  test("author sort orders by author then title", async () => {
    const all = expectOk<{ edges: { node: { title: string; author: string } }[] }>(
      await exec(
        server,
        `{ booksConnection(first: 10, search: "(page)", sort: AUTHOR) { edges { node { title author } } } }`,
        {},
        userId,
      ),
      "booksConnection",
    );
    const keys = all.edges.map((e) => `${e.node.author}\n${e.node.title}`);
    expect(keys).toEqual([...keys].sort());
  });

  test("title sort pages in order", async () => {    const all = expectOk<Conn>(
      await exec(
        server,
        `{ booksConnection(first: 10, search: "(page)", sort: TITLE) {
          edges { cursor node { title } } pageInfo { hasNextPage }
        } }`,
        {},
        userId,
      ),
      "booksConnection",
    );
    expect(all.pageInfo.hasNextPage).toBe(false);
    expect(all.edges.map((e) => e.node.title)).toEqual([...titles].sort());

    const first = expectOk<Conn>(
      await exec(server, CONN(`sort: TITLE`), {}, userId),
      "booksConnection",
    );
    const second = expectOk<Conn>(
      await exec(
        server,
        CONN(`sort: TITLE, after: "${first.pageInfo.endCursor}"`),
        {},
        userId,
      ),
      "booksConnection",
    );
    const overlap = first.edges.filter((e) =>
      second.edges.some((s) => s.node.title === e.node.title),
    );
    expect(overlap).toEqual([]);
  });
});
