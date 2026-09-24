import { runMigrations } from "./index";
import { seedIfEmpty } from "./seed";

runMigrations();
await seedIfEmpty();
console.log("Done.");
