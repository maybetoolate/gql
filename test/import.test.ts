import { describe, expect, test, beforeAll } from "bun:test";
import type { ApolloServer } from "@apollo/server";
import { makeServer, exec, expectOk, expectCode, createTestUser } from "./helpers";
import type { GraphQLContext } from "../src/schema";

describe("import and export", () => {
  let server: ApolloServer<GraphQLContext>;
  let userId: string;
  beforeAll(async () => {
    server = makeServer();
    userId = (await createTestUser("importer")).user.id;
  });

  test("guards and batch cap", async () => {
    expectCode(await exec(server, `{ exportData }`), "UNAUTHENTICATED");
    expectCode(
      await exec(server, `mutation { importBooks(books: []) { imported } }`),
      "UNAUTHENTICATED",
    );
    const tooMany = Array.from({ length: 201 }, (_, i) => ({
      title: `Bulk ${i} (imp)`,
      author: "Bulk",
    }));
    expectCode(
      await exec(server, `mutation($b: [BookImport!]!) { importBooks(books: $b) { imported } }`, { b: tooMany }, userId),
      "BAD_USER_INPUT",
    );
  });

  test("import creates, matches, shelves, and reviews", async () => {
    // Seed an existing book to match against (case-insensitive).
    await exec(
      server,
      `mutation { addBook(title: "Existing Import (imp)", author: "Some Author") { id } }`,
      {},
      userId,
    );

    const res = expectOk<{ imported: number; matched: number; shelved: number; reviewed: number; errors: string[] }>(
      await exec(
        server,
        `mutation($b: [BookImport!]!) {
          importBooks(books: $b) { imported matched shelved reviewed errors }
        }`,
        {
          b: [
            { title: "Brand New (imp)", author: "New Writer", year: 2024, shelf: "want_to_read", rating: 5, reviewText: "Loved (imp)" },
            { title: "existing import (imp)", author: "some author", shelf: "reading" },
            { title: "  ", author: "Nope" },
            { title: "Bad Rating (imp)", author: "X", rating: 9 },
          ],
        },
        userId,
      ),
      "importBooks",
    );
    expect(res).toMatchObject({ imported: 1, matched: 1, shelved: 2, reviewed: 1 });
    expect(res.errors).toHaveLength(2);
    expect(res.errors[0]).toContain("Row 3");
    expect(res.errors[1]).toContain("Row 4");

    const shelf = expectOk<{ status: string; book: { title: string } }[]>(
      await exec(server, `{ myShelf { status book { title } } }`, {}, userId),
      "myShelf",
    );
    const titles = shelf.map((s) => s.book.title);
    expect(titles).toContain("Brand New (imp)");
    expect(titles).toContain("Existing Import (imp)");
  });

  test("export contains the user's data", async () => {
    const raw = expectOk<string>(
      await exec(server, `{ exportData }`, {}, userId),
      "exportData",
    );
    const data = JSON.parse(raw) as {
      user: { email: string };
      shelf: { book: { title: string } }[];
      reviews: { rating: number }[];
      favorites: unknown[];
      goals: unknown[];
    };
    expect(data.user.email).toContain("importer");
    expect(data.shelf.map((s) => s.book.title)).toContain("Brand New (imp)");
    expect(data.reviews.map((r) => r.rating)).toContain(5);
    expect(Array.isArray(data.favorites) && Array.isArray(data.goals)).toBe(true);
  });
});
