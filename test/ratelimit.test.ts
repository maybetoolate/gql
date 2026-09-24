import { describe, expect, test } from "bun:test";
import { Hono } from "hono";
import { MemoryStore, SqliteStore, rateLimit } from "../src/rate-limit";

describe("rate limit stores", () => {
  test("memory store counts and resets", async () => {
    const store = new MemoryStore();
    const first = await store.incr("k1", 30);
    expect(first.count).toBe(1);
    expect((await store.incr("k1", 30)).count).toBe(2);
    // Expired window restarts the count.
    const tiny = await store.incr("k2", 1);
    expect(tiny.count).toBe(1);
    await Bun.sleep(5);
    expect((await store.incr("k2", 1000)).count).toBe(1);
  });

  test("sqlite store counts, shares, and resets", async () => {
    const a = new SqliteStore();
    const b = new SqliteStore();
    const key = `shared-${Date.now()}`;
    expect((await a.incr(key, 60_000)).count).toBe(1);
    // A second "replica" sees the same counter.
    expect((await b.incr(key, 60_000)).count).toBe(2);
    expect((await a.incr(key, 60_000)).count).toBe(3);

    const short = `short-${Date.now()}`;
    expect((await a.incr(short, 1)).count).toBe(1);
    await Bun.sleep(5);
    expect((await b.incr(short, 60_000)).count).toBe(1);
  });

  test("middleware allows then blocks with exact counting", async () => {
    const app = new Hono();
    const store = new MemoryStore();
    app.use("/limited", rateLimit({ windowMs: 60_000, max: 2, store }));
    app.get("/limited", (c) => c.text("ok"));

    const codes: number[] = [];
    for (let i = 0; i < 4; i++) {
      const res = await app.request("/limited");
      codes.push(res.status);
    }
    expect(codes).toEqual([200, 200, 429, 429]);

    const ok = await app.request("/limited");
    expect(ok.headers.get("X-RateLimit-Limit")).toBe("2");
    expect(ok.headers.get("X-RateLimit-Remaining")).toBe("0");
  });
});
