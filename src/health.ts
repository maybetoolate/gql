import { sql } from "drizzle-orm";
import { db } from "./db";

export interface Readiness {
  ready: boolean;
  migrationsApplied: number | null;
}

/** Liveness-style check: can we read, and have migrations run? */
export async function checkReadiness(): Promise<Readiness> {
  try {
    const tables = await db.all<{ name: string }>(
      sql`SELECT name FROM sqlite_master WHERE type = 'table' AND name = '__drizzle_migrations'`,
    );
    if (tables.length === 0) return { ready: false, migrationsApplied: null };
    const applied = await db.all<{ n: number }>(
      sql`SELECT count(*) AS n FROM __drizzle_migrations`,
    );
    await db.all(sql`SELECT 1`);
    return { ready: true, migrationsApplied: Number(applied[0]?.n ?? 0) };
  } catch {
    return { ready: false, migrationsApplied: null };
  }
}
