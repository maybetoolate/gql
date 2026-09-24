import { describe, expect, test, beforeAll } from "bun:test";
import { app } from "../src/index";
import { signToken } from "../src/auth";
import { coversDir } from "../src/covers";
import { createTestUser } from "./helpers";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.COVERS_DIR = mkdtempSync(join(tmpdir(), "covers-test-"));

const PNG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3]);

async function gql(token: string | null, query: string, variables: Record<string, unknown> = {}) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await app.request("/graphql", {
    method: "POST",
    headers,
    body: JSON.stringify({ query, variables }),
  });
  return res.json() as Promise<{ data?: Record<string, unknown>; errors?: { message: string }[] }>;
}

function upload(token: string | null, bookId: string, file: File | null) {
  const form = new FormData();
  if (file) form.set("cover", file);
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  return app.request(`/api/books/${bookId}/cover`, {
    method: "POST",
    headers,
    body: form,
  });
}

describe("covers", () => {
  let ownerToken: string;
  let strangerToken: string;
  let bookId: string;

  beforeAll(async () => {
    const owner = await createTestUser("coverowner");
    const stranger = await createTestUser("coverstranger");
    ownerToken = await signToken(owner.user);
    strangerToken = await signToken(stranger.user);
    const created = await gql(
      ownerToken,
      `mutation { addBook(title: "Cover Book (covers)", author: "C") { id } }`,
    );
    bookId = (created.data?.addBook as { id: string }).id;
  });

  test("guards", async () => {
    const png = new File([PNG], "x.png", { type: "image/png" });
    const anon = await upload(null, bookId, png);
    expect(anon.status).toBe(401);
    const forbidden = await upload(strangerToken, bookId, png);
    expect(forbidden.status).toBe(403);
    const missing = await upload(ownerToken, "no-such-book", png);
    expect(missing.status).toBe(404);
    const noFile = await upload(ownerToken, bookId, null);
    expect(noFile.status).toBe(400);
  });

  test("validation", async () => {
    const txt = new File(["hello"], "x.txt", { type: "text/plain" });
    const badType = await upload(ownerToken, bookId, txt);
    expect(badType.status).toBe(400);
    expect(((await badType.json()) as { error: string }).error).toContain("JPEG");

    const big = new File([new Uint8Array(2 * 1024 * 1024 + 1)], "x.png", {
      type: "image/png",
    });
    const tooBig = await upload(ownerToken, bookId, big);
    expect(tooBig.status).toBe(400);
  });

  test("upload, serve, and cleanup on delete", async () => {
    const png = new File([PNG], "cover.png", { type: "image/png" });
    const res = await upload(ownerToken, bookId, png);
    expect(res.status).toBe(200);
    const { coverUrl } = (await res.json()) as { coverUrl: string };
    expect(coverUrl).toBe(`/covers/${bookId}.png`);

    const storedPath = `${coversDir()}/${bookId}.png`;
    expect(await Bun.file(storedPath).exists()).toBe(true);
    expect(new Uint8Array(await Bun.file(storedPath).arrayBuffer())).toEqual(PNG);

    const book = await gql(ownerToken, `query($id: ID!) { book(id: $id) { coverUrl } }`, {
      id: bookId,
    });
    expect((book.data?.book as { coverUrl: string }).coverUrl).toBe(coverUrl);

    const del = await gql(ownerToken, `mutation($id: ID!) { deleteBook(id: $id) }`, {
      id: bookId,
    });
    expect(del.data?.deleteBook).toBe(true);
    // NOTE: Bun.file().exists() is cached per handle — use a fresh one.
    expect(await Bun.file(storedPath).exists()).toBe(false);
  });

  test("static file serving", async () => {
    // The static root (./uploads) is fixed at startup; exercise it directly.
    await Bun.write("./uploads/covers/__test__.png", PNG);
    try {
      const served = await app.request("/covers/__test__.png");
      expect(served.status).toBe(200);
      expect(served.headers.get("content-type")).toContain("image/png");
      expect(new Uint8Array(await served.arrayBuffer())).toEqual(PNG);
      const missing = await app.request("/covers/does-not-exist.png");
      expect(missing.status).toBe(404);
    } finally {
      const { unlink } = await import("node:fs/promises");
      await unlink("./uploads/covers/__test__.png").catch(() => {});
    }
  });
});
