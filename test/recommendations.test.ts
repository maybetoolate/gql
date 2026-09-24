import { describe, expect, test, beforeAll } from "bun:test";
import type { ApolloServer } from "@apollo/server";
import { makeServer, exec, expectOk, expectCode, createTestUser } from "./helpers";
import type { GraphQLContext } from "../src/schema";

const RECS = `{ recommendations(limit: 10) { book { title } score reason } }`;

describe("recommendations", () => {
  let server: ApolloServer<GraphQLContext>;
  let aliceId: string;
  let bobId: string;
  let carolId: string;
  beforeAll(async () => {
    server = makeServer();
    aliceId = (await createTestUser("recalice")).user.id;
    bobId = (await createTestUser("recbob")).user.id;
    carolId = (await createTestUser("reccarol")).user.id;

    // Bob's 5-star read, unknown to Alice.
    const bookA = expectOk<{ id: string }>(
      await exec(server, `mutation { addBook(title: "Rec Book A (rec)", author: "R") { id } }`, {}, bobId),
      "addBook",
    ).id;
    await exec(server, `mutation($id: ID!) { upsertReview(bookId: $id, rating: 5, text: "Loved (rec)") { id } }`, { id: bookA }, bobId);
    await exec(server, `mutation($id: ID!) { setShelfStatus(bookId: $id, status: finished) { id } }`, { id: bookA }, bobId);

    // Alice finishes a fantasy book tagged by herself...
    const bookB = expectOk<{ id: string }>(
      await exec(server, `mutation { addBook(title: "Rec Book B (rec)", author: "R") { id } }`, {}, aliceId),
      "addBook",
    ).id;
    await exec(server, `mutation($id: ID!) { addTagToBook(bookId: $id, name: "recfantasy") { id } }`, { id: bookB }, aliceId);
    await exec(server, `mutation($id: ID!) { setShelfStatus(bookId: $id, status: finished) { id } }`, { id: bookB }, aliceId);

    // ...and Carol's unread book shares that tag.
    const bookC = expectOk<{ id: string }>(
      await exec(server, `mutation { addBook(title: "Rec Book C (rec)", author: "R") { id } }`, {}, carolId),
      "addBook",
    ).id;
    await exec(server, `mutation($id: ID!) { addTagToBook(bookId: $id, name: "recfantasy") { id } }`, { id: bookC }, carolId);

    await exec(server, `mutation($id: ID!) { followUser(userId: $id) { id } }`, { id: bobId }, aliceId);
  });

  test("requires auth", async () => {
    expectCode(await exec(server, `{ recommendations { reason } }`), "UNAUTHENTICATED");
  });

  test("social rec with reason, known books excluded", async () => {
    const recs = expectOk<{ book: { title: string }; score: number; reason: string }[]>(
      await exec(server, RECS, {}, aliceId),
      "recommendations",
    );
    const titles = recs.map((r) => r.book.title);
    // Bob's book recommended via social signal...
    expect(titles).toContain("Rec Book A (rec)");
    const social = recs.find((r) => r.book.title === "Rec Book A (rec)")!;
    expect(social.reason).toContain("recbob");
    // ...tag overlap recommends Carol's book...
    expect(titles).toContain("Rec Book C (rec)");
    const content = recs.find((r) => r.book.title === "Rec Book C (rec)")!;
    expect(content.reason).toContain("#recfantasy");
    // ...but Alice's own finished book is never recommended.
    expect(titles).not.toContain("Rec Book B (rec)");
    // Scores sort descending.
    const scores = recs.map((r) => r.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });

  test("cold start falls back to top rated", async () => {
    const freshId = (await createTestUser("reccold")).user.id;
    const recs = expectOk<{ book: { title: string }; reason: string }[]>(
      await exec(server, RECS, {}, freshId),
      "recommendations",
    );
    expect(recs.length).toBeGreaterThan(0);
    expect(recs[0]!.reason).toContain("Top rated");
  });
});
