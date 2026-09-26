import { describe, expect, test, beforeAll } from "bun:test";
import type { ApolloServer } from "@apollo/server";
import { makeServer, exec, expectOk, expectCode, createTestUser } from "./helpers";
import type { GraphQLContext } from "../src/schema";

const now = Date.now();
const DAY = 24 * 60 * 60 * 1000;

describe("challenges", () => {
  let server: ApolloServer<GraphQLContext>;
  let aliceId: string;
  let bobId: string;
  let challengeId: string;
  beforeAll(async () => {
    server = makeServer();
    aliceId = (await createTestUser("chalice")).user.id;
    bobId = (await createTestUser("chalhort")).user.id;

    challengeId = expectOk<{ id: string }>(
      await exec(
        server,
        `mutation($s: Float!, $e: Float!) {
          createChallenge(name: "October Sprint (chal)", startAt: $s, endAt: $e, target: 3) { id }
        }`,
        { s: now - DAY, e: now + 30 * DAY },
        aliceId,
      ),
      "createChallenge",
    ).id;
  });

  test("validation and guards", async () => {
    expectCode(
      await exec(server, `mutation { joinChallenge(id: "x") { id } }`),
      "UNAUTHENTICATED",
    );
    expectCode(
      await exec(
        server,
        `mutation { createChallenge(name: "Bad (chal)", startAt: ${now + DAY}, endAt: ${now}, target: 3) { id } }`,
        {},
        aliceId,
      ),
      "BAD_USER_INPUT",
    );
    expectCode(
      await exec(server, `mutation($id: ID!) { joinChallenge(id: $id) { id } }`, { id: "missing" }, bobId),
      "NOT_FOUND",
    );
    // Non-creator, non-admin cannot delete.
    expectCode(
      await exec(server, `mutation($id: ID!) { deleteChallenge(id: $id) }`, { id: challengeId }, bobId),
      "FORBIDDEN",
    );
  });

  test("join, progress, leaderboard, leave", async () => {
    await exec(
      server,
      `mutation($id: ID!) { joinChallenge(id: $id) { id } }`,
      { id: challengeId },
      bobId,
    );

    // Bob finishes two books now (inside the window).
    for (const title of ["Chal One (chal)", "Chal Two (chal)"]) {
      const bookId = expectOk<{ id: string }>(
        await exec(server, `mutation($t: String!) { addBook(title: $t, author: "C") { id } }`, { t: title }, bobId),
        "addBook",
      ).id;
      await exec(
        server,
        `mutation($id: ID!) { setShelfStatus(bookId: $id, status: finished) { id } }`,
        { id: bookId },
        bobId,
      );
    }

    const detail = expectOk<{
      status: string;
      memberCount: number;
      isMember: boolean;
      myProgress: number;
      leaderboard: { user: { name: string }; finished: number; percent: number }[];
    }>(
      await exec(
        server,
        `query($id: ID!) {
          challenge(id: $id) {
            status memberCount isMember myProgress
            leaderboard { user { name } finished percent }
          }
        }`,
        { id: challengeId },
        bobId,
      ),
      "challenge",
    );
    expect(detail.status).toBe("ACTIVE");
    expect(detail.memberCount).toBe(2);
    expect(detail.isMember).toBe(true);
    expect(detail.myProgress).toBe(2);
    expect(detail.leaderboard[0]?.finished).toBe(2);
    expect(detail.leaderboard.map((e) => e.user.name)).toEqual(
      expect.arrayContaining([expect.stringContaining("chalhort")]),
    );

    const listed = expectOk<{ status: string }[]>(
      await exec(server, `{ challenges(status: ACTIVE) { status } }`, {}, aliceId),
      "challenges",
    );
    expect(listed.length).toBeGreaterThan(0);
    expect(listed.every((c) => c.status === "ACTIVE")).toBe(true);

    expect(
      expectOk<boolean>(
        await exec(server, `mutation($id: ID!) { leaveChallenge(id: $id) }`, { id: challengeId }, bobId),
        "leaveChallenge",
      ),
    ).toBe(true);
    const after = expectOk<{ memberCount: number; isMember: boolean }>(
      await exec(server, `query($id: ID!) { challenge(id: $id) { memberCount isMember } }`, { id: challengeId }, bobId),
      "challenge",
    );
    expect(after).toMatchObject({ memberCount: 1, isMember: false });
  });
});
