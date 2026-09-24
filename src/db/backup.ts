import { Database } from "bun:sqlite";
import { mkdir, readdir, unlink } from "node:fs/promises";
import { join } from "node:path";

export interface BackupResult {
  path: string;
  bytes: number;
  pruned: string[];
}

/**
 * Online backup via SQLite `VACUUM INTO` — safe on a live database file
 * (does not work for :memory: databases).
 */
export async function backupDatabase(
  dbPath: string = process.env.SQLITE_PATH ?? "./sqlite.db",
  destDir = "./backups",
  keep = 7,
): Promise<BackupResult> {
  if (dbPath === ":memory:") {
    throw new Error("Cannot back up an in-memory database");
  }
  await mkdir(destDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const path = join(destDir, `backup-${stamp}.db`);
  const source = new Database(dbPath, { readonly: true });
  try {
    source.exec(`VACUUM INTO '${path.replace(/'/g, "''")}'`);
  } finally {
    source.close();
  }
  const bytes = (await Bun.file(path).arrayBuffer()).byteLength;

  const files = (await readdir(destDir))
    .filter((f) => f.startsWith("backup-") && f.endsWith(".db"))
    .sort();
  const pruned: string[] = [];
  while (files.length > keep) {
    const oldest = files.shift()!;
    await unlink(join(destDir, oldest));
    pruned.push(oldest);
  }
  return { path, bytes, pruned };
}
