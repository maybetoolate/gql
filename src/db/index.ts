import { Database } from "bun:sqlite";
import { drizzle, type BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import * as schema from "./schema";

const sqlitePath = process.env.SQLITE_PATH ?? "./sqlite.db";

const sqlite = new Database(sqlitePath, { create: true });
sqlite.exec("PRAGMA journal_mode = WAL;");
sqlite.exec("PRAGMA foreign_keys = ON;");

export const db: BunSQLiteDatabase<typeof schema> = drizzle(sqlite, {
  schema,
});

export function runMigrations() {
  migrate(db, { migrationsFolder: "./drizzle" });
}
