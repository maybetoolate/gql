import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { backupDatabase } from "../src/db/backup";
import { app } from "../src/index";

describe("ops", () => {
  test("backup round-trips live data", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ops-"));
    const dbPath = join(dir, "live.db");
    const source = new Database(dbPath);
    source.exec("CREATE TABLE t (id TEXT PRIMARY KEY, v INTEGER);");
    source.exec("INSERT INTO t VALUES ('a', 1), ('b', 2);");
    source.close();

    const first = await backupDatabase(dbPath, join(dir, "backups"), 7);
    expect(first.bytes).toBeGreaterThan(0);

    // Mutate after backup, then restore from the backup file.
    const live = new Database(dbPath);
    live.exec("DELETE FROM t WHERE id = 'a';");
    live.close();

    const { copyFile } = await import("node:fs/promises");
    await copyFile(first.path, dbPath);
    const restored = new Database(dbPath, { readonly: true });
    const rows = restored.query("SELECT COUNT(*) AS n FROM t").all() as { n: number }[];
    restored.close();
    expect(rows[0]?.n).toBe(2);
  });

  test("backup rejects in-memory databases", async () => {
    await expect(backupDatabase(":memory:", mkdtempSync(join(tmpdir(), "ops-")))).rejects.toThrow();
  });

  test("backup rotation keeps N newest", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ops-"));
    const dbPath = join(dir, "live.db");
    const source = new Database(dbPath);
    source.exec("CREATE TABLE t (id TEXT);");
    source.close();

    for (let i = 0; i < 3; i++) {
      await backupDatabase(dbPath, join(dir, "backups"), 2);
      await Bun.sleep(1100);
    }
    const { readdir } = await import("node:fs/promises");
    const files = (await readdir(join(dir, "backups"))).filter((f) => f.endsWith(".db"));
    expect(files.length).toBe(2);
  });

  test("metrics and request ids", async () => {
    const health = await app.request("/health");
    expect(health.status).toBe(200);
    expect(health.headers.get("x-request-id")).toBeTruthy();

    const metrics = await app.request("/metrics");
    expect(metrics.status).toBe(200);
    const body = (await metrics.json()) as {
      uptimeSeconds: number;
      requestsTotal: number;
      byStatus: Record<string, number>;
    };
    expect(body.uptimeSeconds).toBeGreaterThanOrEqual(0);
    expect(body.requestsTotal).toBeGreaterThanOrEqual(1);
    expect(body.byStatus["200"]).toBeGreaterThanOrEqual(1);
  });
});
