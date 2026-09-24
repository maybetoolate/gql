import type { Context, Next } from "hono";
import { sql } from "drizzle-orm";
import { db } from "./db";

export interface Counter {
  count: number;
  resetAt: number;
}

export interface RateLimitStore {
  incr(key: string, windowMs: number): Promise<Counter>;
}

/** In-process store (default). Resets on restart; not shared between replicas. */
export class MemoryStore implements RateLimitStore {
  private hits = new Map<string, Counter>();

  async incr(key: string, windowMs: number): Promise<Counter> {
    const now = Date.now();
    if (Math.random() < 0.01) {
      for (const [k, entry] of this.hits) {
        if (entry.resetAt <= now) this.hits.delete(k);
      }
    }
    let entry = this.hits.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      this.hits.set(key, entry);
    }
    entry.count += 1;
    return { count: entry.count, resetAt: entry.resetAt };
  }
}

/**
 * SQLite-backed store. Shares counters across processes replicas as long as
 * they share the database file (e.g. one volume). Single-statement upsert,
 * so concurrent increments are atomic.
 */
export class SqliteStore implements RateLimitStore {
  async incr(key: string, windowMs: number): Promise<Counter> {
    const now = Date.now();
    const resetAt = now + windowMs;
    const rows = await db.all<{ count: number; resetAt: number }>(
      sql`INSERT INTO rate_limits (key, count, reset_at)
          VALUES (${key}, 1, ${resetAt})
          ON CONFLICT (key) DO UPDATE SET
            count = CASE WHEN reset_at <= ${now} THEN 1 ELSE count + 1 END,
            reset_at = CASE WHEN reset_at <= ${now} THEN ${resetAt} ELSE reset_at END
          RETURNING count, reset_at AS resetAt`,
    );
    const row = rows[0]!;
    if (Math.random() < 0.01) {
      await db.run(sql`DELETE FROM rate_limits WHERE reset_at <= ${now}`);
    }
    return { count: Number(row.count), resetAt: Number(row.resetAt) };
  }
}

export interface RateLimitOptions {
  windowMs: number;
  max: number;
  store?: RateLimitStore;
}

export function rateLimit(options: RateLimitOptions) {
  const { windowMs, max, store = new MemoryStore() } = options;
  return async (c: Context, next: Next) => {
    const ip =
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
      c.req.header("x-real-ip") ??
      "unknown";

    const entry = await store.incr(`rl:${ip}`, windowMs);

    c.header("X-RateLimit-Limit", String(max));
    c.header("X-RateLimit-Remaining", String(Math.max(0, max - entry.count)));
    c.header("X-RateLimit-Reset", String(Math.ceil(entry.resetAt / 1000)));

    if (entry.count > max) {
      return c.json(
        { errors: [{ message: "Rate limit exceeded, try again later." }] },
        429,
      );
    }
    await next();
  };
}
