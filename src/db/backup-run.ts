import { backupDatabase } from "./backup";

const destDir = Bun.argv[2] ?? "./backups";
const keep = Number(Bun.argv[3] ?? 7);
const result = await backupDatabase(undefined, destDir, keep);
console.log(`Backup written to ${result.path} (${result.bytes} bytes)`);
if (result.pruned.length > 0) {
  console.log(`Pruned: ${result.pruned.join(", ")}`);
}
