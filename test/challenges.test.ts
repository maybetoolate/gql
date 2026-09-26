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

  test("finished_at is stable under touches and clears on unfinish", async () => {
    const frankId = (await createTestUser("chalfrank")).user.id;
    const bookId = expectOk<{ id: string }>(
      await exec(server, `mutation { addBook(title: "Frank Book (chalfin)", author: "F") { id } }`, {}, frankId),
      "addBook",
    ).id;
    await exec(server, `mutation($id: ID!) { setShelfStatus(bookId: $id, status: finished) { id } }`, { id: bookId }, frankId);
    // Touching progress while finished must not move the finish time.
    await exec(server, `mutation($id: ID!) { updateShelfProgress(bookId: $id, progress: 90) { id } }`, { id: bookId }, frankId);

    const cid = expectOk<{ id: string }>(
      await exec(
        server,
        `mutation($s: Float!, $e: Float!) { createChallenge(name: "Fin Window (chalfin)", startAt: $s, endAt: $e, target: 5) { id } }`,
        { s: Date.now() - DAY, e: Date.now() + DAY },
        frankId,
      ),
      "createChallenge",
    ).id;
    const progress = expectOk<{ myProgress: number }>(
      await exec(server, `query($id: ID!) { challenge(id: $id) { myProgress } }`, { id: cid }, frankId),
      "challenge",
    );
    expect(progress.myProgress).toBe(1);

    // Leaving finished drops it from the window.
    await exec(server, `mutation($id: ID!) { setShelfStatus(bookId: $id, status: reading) { id } }`, { id: bookId }, frankId);
    const dropped = expectOk<{ myProgress: number }>(
      await exec(server, `query($id: ID!) { challenge(id: $id) { myProgress } }`, { id: cid }, frankId),
      "challenge",
    );
    expect(dropped.myProgress).toBe(0);
  });

  test("leaderboard hides emails", async () => {
    const res = await exec(
      server,
      `query($id: ID!) { challenge(id: $id) { leaderboard { user { id name email } } } }`,
      { id: challengeId },
      aliceId,
    );
    expectCode(res, "GRAPHQL_VALIDATION_FAILED");
    const ok = expectOk<{ user: { id: string; name: string } }[]>(
      await exec(
        server,
        `query($id: ID!) { challenge(id: $id) { leaderboard { user { id name } } } }`,
        { id: challengeId },
        aliceId,
      ),
      "challenge",
    );
    expect(ok).toBeTruthy();
  });

  test("status filter and pagination run in SQL", async () => {
    const oldId = expectOk<{ id: string }>(
      await exec(
        server,
        `mutation($s: Float!, $e: Float!) { createChallenge(name: "Oldie (chalpg)", startAt: $s, endAt: $e, target: 1) { id } }`,
        { s: now - 10 * DAY, e: now - 5 * DAY },
        aliceId,
      ),
      "createChallenge",
    ).id;
    const ended = expectOk<{ id: string }[]>(
      await exec(server, `{ challenges(status: ENDED, limit: 10) { id } }`, {}, aliceId),
      "challenges",
    );
    expect(ended.map((c) => c.id)).toContain(oldId);
    const secondPage = expectOk<{ id: string }[]>(
      await exec(server, `{ challenges(limit: 1, offset: 1) { id } }`, {}, aliceId),
      "challenges",
    );
    expect(secondPage).toHaveLength(1);
  });
});
