import { Pool } from "pg";
import { getDatabasePoolConfig, parseDatabaseConfig } from "./database.config";
import { runUsersMigration } from "./migrations/001-create-users";

export async function migrate() {
  const config = parseDatabaseConfig();
  if (!config.enabled) throw new Error("DATABASE_ENABLED must be true to run migrations");

  const pool = new Pool(getDatabasePoolConfig(config));
  try {
    await runUsersMigration(pool);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  void migrate().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
