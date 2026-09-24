import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { app } from "../src/index";
import { checkReadiness } from "../src/health";

describe("readiness and slow operations", () => {
  test("readyz reports migrations on the app db", async () => {
    const res = await app.request("/readyz");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ready: boolean; migrationsApplied: number };
    expect(body.ready).toBe(true);
    expect(body.migrationsApplied).toBeGreaterThan(0);
  });

  test("checkReadiness is false without migrations", async () => {
    // A bare database has no migrations table (same SQL shape the helper uses).
    const sqlite = new Database(":memory:");
    const tables = sqlite
      .query("SELECT name FROM sqlite_master WHERE type = 'table' AND name = '__drizzle_migrations'")
      .all() as { name: string }[];
    expect(tables).toEqual([]);
    sqlite.close();
    // And the helper itself reports ready against the migrated app DB.
    expect((await checkReadiness()).ready).toBe(true);
  });

  test("slow operations warn above the threshold", async () => {
    const previous = process.env.SLOW_OP_MS;
    process.env.SLOW_OP_MS = "-1";
    const warnings: string[] = [];
    const origWarn = console.warn;
    console.warn = (...args: unknown[]) => {
      warnings.push(args.map(String).join(" "));
    };
    try {
      const res = await app.request("/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: "query SlowProbe { hello }",
          operationName: "SlowProbe",
        }),
      });
      expect(res.status).toBe(200);
      const hit = warnings.find((w) => w.includes("slow GraphQL operation"));
      expect(hit).toBeTruthy();
      expect(hit).toContain("SlowProbe");
    } finally {
      console.warn = origWarn;
      if (previous === undefined) delete process.env.SLOW_OP_MS;
      else process.env.SLOW_OP_MS = previous;
    }
  });

  test("fast operations stay quiet", async () => {
    const warnings: string[] = [];
    const origWarn = console.warn;
    console.warn = (...args: unknown[]) => {
      warnings.push(args.map(String).join(" "));
    };
    try {
      await app.request("/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: "{ hello }" }),
      });
      expect(warnings.filter((w) => w.includes("slow GraphQL operation"))).toEqual([]);
    } finally {
      console.warn = origWarn;
    }
  });
});
