import { describe, expect, test, beforeAll } from "bun:test";
import type { ApolloServer } from "@apollo/server";
import { makeServer, exec, expectOk, expectCode, createTestUser } from "./helpers";
import type { GraphQLContext } from "../src/schema";

describe("settings", () => {
  let server: ApolloServer<GraphQLContext>;
  let userId: string;
  let email: string;
  beforeAll(async () => {
    server = makeServer();
    const created = await createTestUser("settingsue");
    userId = created.user.id;
    email = created.user.email;
  });

  test("guards", async () => {
    expectCode(await exec(server, `{ myNotificationPrefs { follow } }`), "UNAUTHENTICATED");
    expectCode(
      await exec(server, `mutation { updateProfile(name: "X") { id } }`),
      "UNAUTHENTICATED",
    );
  });

  test("profile update validation", async () => {
    expectCode(
      await exec(server, `mutation { updateProfile(name: "   ") { id } }`, {}, userId),
      "BAD_USER_INPUT",
    );
    const updated = expectOk<{ name: string }>(
      await exec(server, `mutation { updateProfile(name: "New Name (settings)") { name } }`, {}, userId),
      "updateProfile",
    );
    expect(updated.name).toBe("New Name (settings)");
  });

  test("password change rotates all sessions", async () => {
    expectCode(
      await exec(
        server,
        `mutation { changePassword(currentPassword: "wrong", newPassword: "newpass123") { token } }`,
        {},
        userId,
      ),
      "UNAUTHENTICATED",
    );
    expectCode(
      await exec(
        server,
        `mutation { changePassword(currentPassword: "password123", newPassword: "123") { token } }`,
        {},
        userId,
      ),
      "BAD_USER_INPUT",
    );

    const first = expectOk<{ refreshToken: string }>(
      await exec(
        server,
        `mutation($e: String!) { login(email: $e, password: "password123") { refreshToken } }`,
        { e: email },
      ),
      "login",
    );
    const changed = expectOk<{ token: string; refreshToken: string }>(
      await exec(
        server,
        `mutation { changePassword(currentPassword: "password123", newPassword: "newpass123") { token refreshToken } }`,
        {},
        userId,
      ),
      "changePassword",
    );
    expect(changed.refreshToken).toBeTruthy();

    // Old password dead, old session revoked, new pair works.
    expectCode(
      await exec(server, `mutation($e: String!) { login(email: $e, password: "password123") { token } }`, { e: email }),
      "UNAUTHENTICATED",
    );
    expectCode(
      await exec(server, `mutation($t: String!) { refreshToken(token: $t) { token } }`, { t: first.refreshToken }),
      "UNAUTHENTICATED",
    );
    const relogin = expectOk<{ token: string }>(
      await exec(server, `mutation($e: String!) { login(email: $e, password: "newpass123") { token } }`, { e: email }),
      "login",
    );
    expect(relogin.token).toBeTruthy();
  });

  test("notification prefs gate emission", async () => {
    const otherId = (await createTestUser("settingother")).user.id;
    const bookId = expectOk<{ id: string }>(
      await exec(server, `mutation { addBook(title: "Prefs Book (settings)", author: "P") { id } }`, {}, userId),
      "addBook",
    ).id;
    const reviewId = expectOk<{ id: string }>(
      await exec(server, `mutation($id: ID!) { upsertReview(bookId: $id, rating: 5) { id } }`, { id: bookId }, userId),
      "upsertReview",
    ).id;

    const defaults = expectOk<{ follow: boolean; like: boolean; comment: boolean }>(
      await exec(server, `{ myNotificationPrefs { follow like comment } }`, {}, userId),
      "myNotificationPrefs",
    );
    expect(defaults).toEqual({ follow: true, like: true, comment: true });

    await exec(
      server,
      `mutation { setNotificationPrefs(like: false) { like } }`,
      {},
      userId,
    );
    // Like muted -> no notification.
    await exec(
      server,
      `mutation($id: ID!) { toggleReviewLike(reviewId: $id) { id } }`,
      { id: reviewId },
      otherId,
    );
    expect(
      expectOk<number>(
        await exec(server, `{ unreadNotificationsCount }`, {}, userId),
        "unreadNotificationsCount",
      ),
    ).toBe(0);

    // Re-enable -> comment notifies.
    await exec(server, `mutation { setNotificationPrefs(like: true) { like } }`, {}, userId);
    await exec(
      server,
      `mutation($id: ID!) { addComment(reviewId: $id, text: "Hi (settings)") { id } }`,
      { id: reviewId },
      otherId,
    );
    expect(
      expectOk<number>(
        await exec(server, `{ unreadNotificationsCount }`, {}, userId),
        "unreadNotificationsCount",
      ),
    ).toBe(1);
  });
});
