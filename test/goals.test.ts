import { describe, expect, test, beforeAll } from "bun:test";
import type { ApolloServer } from "@apollo/server";
import { makeServer, exec, expectOk, expectCode, createTestUser } from "./helpers";
import type { GraphQLContext } from "../src/schema";

const GOAL = `{ id year target finishedCount remaining complete }`;

describe("reading goals", () => {
  let server: ApolloServer<GraphQLContext>;
  let userId: string;
  beforeAll(async () => {
    server = makeServer();
    userId = (await createTestUser("goaler")).user.id;
  });

  test("guards and validation", async () => {
    expectCode(await exec(server, `{ myGoals { id } }`), "UNAUTHENTICATED");
    expectCode(
      await exec(server, `mutation { setGoal(year: 2026, target: 12) { id } }`),
      "UNAUTHENTICATED",
    );
    expectCode(
      await exec(server, `mutation { setGoal(year: 1999, target: 12) { id } }`, {}, userId),
      "BAD_USER_INPUT",
    );
    expectCode(
      await exec(server, `mutation { setGoal(year: 2026, target: 0) { id } }`, {}, userId),
      "BAD_USER_INPUT",
    );
  });

  test("set, progress, update, delete", async () => {
    const created = expectOk<{ year: number; target: number; finishedCount: number; remaining: number; complete: boolean }>(
      await exec(server, `mutation { setGoal(year: 2026, target: 2) ${GOAL} }`, {}, userId),
      "setGoal",
    );
    expect(created).toMatchObject({ year: 2026, target: 2, finishedCount: 0, remaining: 2, complete: false });

    // Finish two books.
    for (const title of ["Goal Book One (goals)", "Goal Book Two (goals)"]) {
      const bookId = expectOk<{ id: string }>(
        await exec(server, `mutation($t: String!) { addBook(title: $t, author: "G") { id } }`, { t: title }, userId),
        "addBook",
      ).id;
      await exec(
        server,
        `mutation($id: ID!) { setShelfStatus(bookId: $id, status: finished) { id } }`,
        { id: bookId },
        userId,
      );
    }

    const progressed = expectOk<{ finishedCount: number; remaining: number; complete: boolean }>(
      await exec(server, `{ goal(year: 2026) ${GOAL} }`, {}, userId),
      "goal",
    );
    expect(progressed).toMatchObject({ finishedCount: 2, remaining: 0, complete: true });

    const listed = expectOk<{ year: number }[]>(
      await exec(server, `{ myGoals ${GOAL} }`, {}, userId),
      "myGoals",
    );
    expect(listed.map((g) => g.year)).toContain(2026);

    const updated = expectOk<{ target: number; remaining: number }>(
      await exec(server, `mutation { setGoal(year: 2026, target: 5) ${GOAL} }`, {}, userId),
      "setGoal",
    );
    expect(updated).toMatchObject({ target: 5, remaining: 3 });

    const missing = await exec(server, `{ goal(year: 2030) { id } }`, {}, userId);
    expect(missing.errors ?? []).toEqual([]);
    expect(missing.data?.goal).toBeNull();

    expect(
      expectOk<boolean>(
        await exec(server, `mutation { deleteGoal(year: 2026) }`, {}, userId),
        "deleteGoal",
      ),
    ).toBe(true);
  });
});
