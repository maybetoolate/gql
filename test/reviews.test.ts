import { describe, expect, test, beforeAll } from "bun:test";
import type { ApolloServer } from "@apollo/server";
import { makeServer, exec, expectOk, expectCode, createTestUser } from "./helpers";
import type { GraphQLContext } from "../src/schema";

describe("reviews, likes, and comments", () => {
  let server: ApolloServer<GraphQLContext>;
  let userId: string;
  let otherId: string;
  let bookId: string;
  let reviewId: string;
  beforeAll(async () => {
    server = makeServer();
    userId = (await createTestUser("reviewer")).user.id;
    otherId = (await createTestUser("reviewother")).user.id;
    bookId = expectOk<{ id: string }>(
      await exec(
        server,
        `mutation { addBook(title: "Reviewed Book (reviews)", author: "R") { id } }`,
        {},
        userId,
      ),
      "addBook",
    ).id;
    reviewId = expectOk<{ id: string }>(
      await exec(
        server,
        `mutation($id: ID!) { upsertReview(bookId: $id, rating: 5, text: "Great (reviews)") { id } }`,
        { id: bookId },
        userId,
      ),
      "upsertReview",
    ).id;
  });

  test("rating validation", async () => {
    expectCode(
      await exec(
        server,
        `mutation($id: ID!) { upsertReview(bookId: $id, rating: 0) { id } }`,
        { id: bookId },
        userId,
      ),
      "BAD_USER_INPUT",
    );
    expectCode(
      await exec(server, `mutation($id: ID!) { upsertReview(bookId: $id, rating: 5) { id } }`, {
        id: bookId,
      }),
      "UNAUTHENTICATED",
    );
  });

  test("likes toggle and TOP sort", async () => {
    const liked = expectOk<{ likesCount: number; likedByMe: boolean }>(
      await exec(
        server,
        `mutation($id: ID!) { toggleReviewLike(reviewId: $id) { likesCount likedByMe } }`,
        { id: reviewId },
        otherId,
      ),
      "toggleReviewLike",
    );
    expect(liked).toEqual({ likesCount: 1, likedByMe: true });

    const top = expectOk<{ likesCount: number }[]>(
      await exec(
        server,
        `query($id: ID!) { bookReviews(bookId: $id, sort: TOP) { likesCount } }`,
        { id: bookId },
        otherId,
      ),
      "bookReviews",
    );
    expect(top[0]?.likesCount).toBe(1);

    expectCode(
      await exec(
        server,
        `mutation { toggleReviewLike(reviewId: "missing") { id } }`,
        {},
        otherId,
      ),
      "NOT_FOUND",
    );
  });

  test("comments CRUD with ownership", async () => {
    expectCode(
      await exec(
        server,
        `mutation($id: ID!) { addComment(reviewId: $id, text: "   ") { id } }`,
        { id: reviewId },
        otherId,
      ),
      "BAD_USER_INPUT",
    );

    const added = expectOk<{ id: string }>(
      await exec(
        server,
        `mutation($id: ID!) { addComment(reviewId: $id, text: "Agreed (reviews)") { id } }`,
        { id: reviewId },
        otherId,
      ),
      "addComment",
    );

    expectCode(
      await exec(
        server,
        `mutation($id: ID!) { updateComment(id: $id, text: "hijack") { id } }`,
        { id: added.id },
        userId,
      ),
      "FORBIDDEN",
    );

    const edited = expectOk<{ text: string }>(
      await exec(
        server,
        `mutation($id: ID!) { updateComment(id: $id, text: "Agreed!! (reviews)") { text } }`,
        { id: added.id },
        otherId,
      ),
      "updateComment",
    );
    expect(edited.text).toBe("Agreed!! (reviews)");

    const withComments = expectOk<{
      reviews: { commentsCount: number; comments: { text: string }[] }[];
    }>(
      await exec(
        server,
        `query($id: ID!) { book(id: $id) { reviews { commentsCount comments { text } } } }`,
        { id: bookId },
        userId,
      ),
      "book",
    );
    expect(withComments.reviews[0]?.commentsCount).toBe(1);

    const deleted = expectOk<boolean>(
      await exec(
        server,
        `mutation($id: ID!) { deleteComment(id: $id) }`,
        { id: added.id },
        otherId,
      ),
      "deleteComment",
    );
    expect(deleted).toBe(true);
  });
});
