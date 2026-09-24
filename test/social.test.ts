import { describe, expect, test, beforeAll } from "bun:test";
import type { ApolloServer } from "@apollo/server";
import { makeServer, exec, expectOk, expectCode, createTestUser } from "./helpers";
import type { GraphQLContext } from "../src/schema";

describe("follows and feed", () => {
  let server: ApolloServer<GraphQLContext>;
  let aliceId: string;
  let bobId: string;
  let bookId: string;
  beforeAll(async () => {
    server = makeServer();
    aliceId = (await createTestUser("followalice")).user.id;
    bobId = (await createTestUser("followbob")).user.id;
    bookId = expectOk<{ id: string }>(
      await exec(
        server,
        `mutation { addBook(title: "Follow Book (social)", author: "F") { id } }`,
        {},
        aliceId,
      ),
      "addBook",
    ).id;
  });

  test("follow guards", async () => {
    expectCode(
      await exec(server, `mutation($id: ID!) { followUser(userId: $id) { id } }`, { id: aliceId }, aliceId),
      "BAD_USER_INPUT",
    );
    expectCode(
      await exec(server, `mutation { followUser(userId: "missing") { id } }`, {}, aliceId),
      "NOT_FOUND",
    );
    expectCode(
      await exec(server, `{ activityFeed { id } }`),
      "UNAUTHENTICATED",
    );
  });

  test("follow, feed, unfollow", async () => {
    // Bob reviews + shelves before Alice follows.
    await exec(
      server,
      `mutation($id: ID!) { upsertReview(bookId: $id, rating: 4, text: "Bob here (social)") { id } }`,
      { id: bookId },
      bobId,
    );
    await exec(
      server,
      `mutation($id: ID!) { setShelfStatus(bookId: $id, status: reading) { id } }`,
      { id: bookId },
      bobId,
    );

    const empty = expectOk<unknown[]>(
      await exec(server, `{ activityFeed { id } }`, {}, aliceId),
      "activityFeed",
    );
    expect(empty).toEqual([]);

    const followed = expectOk<{ followersCount: number; isFollowing: boolean }>(
      await exec(
        server,
        `mutation($id: ID!) { followUser(userId: $id) { followersCount isFollowing } }`,
        { id: bobId },
        aliceId,
      ),
      "followUser",
    );
    // isFollowing reflects the viewer's own follow, resolved via loaders.
    expect(followed.followersCount).toBe(1);

    const feed = expectOk<{ type: string; user: { name: string }; book: { title: string } }[]>(
      await exec(
        server,
        `{ activityFeed(limit: 5) { type user { name } book { title } } }`,
        {},
        aliceId,
      ),
      "activityFeed",
    );
    expect(feed.length).toBe(2);
    expect(feed.map((i) => i.type).sort()).toEqual(["REVIEW", "SHELF_UPDATE"]);
    expect(new Set(feed.map((i) => i.book.title))).toEqual(new Set(["Follow Book (social)"]));

    const followers = expectOk<{ name: string }[]>(
      await exec(server, `query($id: ID!) { followers(userId: $id) { name } }`, { id: bobId }, aliceId),
      "followers",
    );
    expect(followers.length).toBe(1);
    expect(followers[0]?.name).toContain("followalice");
    const following = expectOk<{ name: string }[]>(
      await exec(server, `query($id: ID!) { following(userId: $id) { name } }`, { id: aliceId }, aliceId),
      "following",
    );
    expect(following.length).toBe(1);
    expect(following[0]?.name).toContain("followbob");

    const unfollowed = expectOk<boolean>(
      await exec(server, `mutation($id: ID!) { unfollowUser(userId: $id) }`, { id: bobId }, aliceId),
      "unfollowUser",
    );
    expect(unfollowed).toBe(true);
    expect(
      expectOk<unknown[]>(await exec(server, `{ activityFeed { id } }`, {}, aliceId), "activityFeed"),
    ).toEqual([]);
  });

  test("depth limit rejects cyclic nesting", async () => {
    let q = "id";
    for (let i = 0; i < 8; i++) q = `book { reviews { ${q} } }`;
    const res = await exec(server, `{ book(id: "x") { reviews { ${q} } } }`, {}, aliceId);
    expectCode(res, "GRAPHQL_VALIDATION_FAILED");
  });
});
