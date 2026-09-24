import { describe, expect, test, beforeAll } from "bun:test";
import type { ApolloServer } from "@apollo/server";
import { makeServer, exec, expectOk, expectCode, createTestUser } from "./helpers";
import type { GraphQLContext } from "../src/schema";

const LIST = `{ myNotifications { id type readAt actor { name } book { title } } }`;

describe("notifications", () => {
  let server: ApolloServer<GraphQLContext>;
  let aliceId: string;
  let bobId: string;
  let bookId: string;
  let reviewId: string;
  beforeAll(async () => {
    server = makeServer();
    aliceId = (await createTestUser("notifalice")).user.id;
    bobId = (await createTestUser("notifbob")).user.id;
    bookId = expectOk<{ id: string }>(
      await exec(
        server,
        `mutation { addBook(title: "Notif Book (notif)", author: "N") { id } }`,
        {},
        aliceId,
      ),
      "addBook",
    ).id;
    reviewId = expectOk<{ id: string }>(
      await exec(
        server,
        `mutation($id: ID!) { upsertReview(bookId: $id, rating: 5, text: "Hi (notif)") { id } }`,
        { id: bookId },
        aliceId,
      ),
      "upsertReview",
    ).id;
  });

  test("guards", async () => {
    expectCode(await exec(server, `{ myNotifications { id } }`), "UNAUTHENTICATED");
    expectCode(await exec(server, `{ unreadNotificationsCount }`), "UNAUTHENTICATED");
    expectCode(
      await exec(server, `mutation($id: ID!) { markNotificationRead(id: $id) { id } }`, { id: "x" }, aliceId),
      "NOT_FOUND",
    );
  });

  test("follow, like, and comment notify; self-actions do not", async () => {
    // Bob follows Alice -> Alice notified.
    await exec(server, `mutation($id: ID!) { followUser(userId: $id) { id } }`, { id: aliceId }, bobId);
    // Bob likes Alice's review -> notified.
    await exec(
      server,
      `mutation($id: ID!) { toggleReviewLike(reviewId: $id) { id } }`,
      { id: reviewId },
      bobId,
    );
    // Bob comments -> notified.
    await exec(
      server,
      `mutation($id: ID!) { addComment(reviewId: $id, text: "Nice (notif)") { id } }`,
      { id: reviewId },
      bobId,
    );
    // Alice likes her own review -> no notification.
    await exec(
      server,
      `mutation($id: ID!) { toggleReviewLike(reviewId: $id) { id } }`,
      { id: reviewId },
      aliceId,
    );

    const list = expectOk<{ type: string }[]>(
      await exec(server, LIST, {}, aliceId),
      "myNotifications",
    );
    expect(list.map((n) => n.type).sort()).toEqual(
      ["FOLLOW", "REVIEW_COMMENT", "REVIEW_LIKE"].sort(),
    );

    const count = expectOk<number>(
      await exec(server, `{ unreadNotificationsCount }`, {}, aliceId),
      "unreadNotificationsCount",
    );
    expect(count).toBe(3);
  });

  test("unlike retracts the unread like notification", async () => {
    await exec(
      server,
      `mutation($id: ID!) { toggleReviewLike(reviewId: $id) { id } }`,
      { id: reviewId },
      bobId,
    );
    const list = expectOk<{ type: string }[]>(
      await exec(server, LIST, {}, aliceId),
      "myNotifications",
    );
    expect(list.map((n) => n.type).sort()).toEqual(["FOLLOW", "REVIEW_COMMENT"].sort());
  });

  test("mark read one and all", async () => {
    const list = expectOk<{ id: string }[]>(
      await exec(server, LIST, {}, aliceId),
      "myNotifications",
    );
    const one = expectOk<{ readAt: number }>(
      await exec(
        server,
        `mutation($id: ID!) { markNotificationRead(id: $id) { readAt } }`,
        { id: list[0]!.id },
        aliceId,
      ),
      "markNotificationRead",
    );
    expect(one.readAt).toBeGreaterThan(0);

    const unread = expectOk<{ id: string }[]>(
      await exec(server, `{ myNotifications(unreadOnly: true) { id } }`, {}, aliceId),
      "myNotifications",
    );
    expect(unread.length).toBe(list.length - 1);

    // Another user cannot mark Alice's notification.
    expectCode(
      await exec(
        server,
        `mutation($id: ID!) { markNotificationRead(id: $id) { id } }`,
        { id: list[0]!.id },
        bobId,
      ),
      "NOT_FOUND",
    );

    const marked = expectOk<number>(
      await exec(server, `mutation { markAllNotificationsRead }`, {}, aliceId),
      "markAllNotificationsRead",
    );
    expect(marked).toBe(list.length - 1);
    expect(
      expectOk<number>(
        await exec(server, `{ unreadNotificationsCount }`, {}, aliceId),
        "unreadNotificationsCount",
      ),
    ).toBe(0);
  });
});
