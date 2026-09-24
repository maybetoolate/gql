import { eq } from "drizzle-orm";
import { db, runMigrations } from "./index";
import { users } from "./schema";

const email = (Bun.argv[2] ?? "").trim().toLowerCase();
if (!email) {
  console.error("Usage: bun run db:promote <email>");
  process.exit(1);
}

runMigrations();
const rows = await db.select().from(users).where(eq(users.email, email));
if (!rows[0]) {
  console.error(`No user with email ${email}`);
  process.exit(1);
}
await db.update(users).set({ role: "admin" }).where(eq(users.id, rows[0].id));
console.log(`Promoted ${email} to admin.`);
