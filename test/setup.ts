// Bun test preload: isolated in-memory SQLite + migrations.
// Runs before any test file, so the shared db module binds to :memory:
// and never touches the dev sqlite.db file.
process.env.SQLITE_PATH = ":memory:";
process.env.JWT_SECRET = "test-secret";
process.env.BCRYPT_COST = "4";
process.env.DISABLE_PRUNER = "1";

const { runMigrations } = await import("../src/db/index");
runMigrations();
