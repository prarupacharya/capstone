import type { Pool } from "pg";

export const usersMigration = {
  name: "001-create-users",
  up: `
    CREATE EXTENSION IF NOT EXISTS pgcrypto;
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(320) NOT NULL,
      username VARCHAR(255),
      hashed_password TEXT NOT NULL,
      createddatetime TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      usertype VARCHAR(32) NOT NULL DEFAULT 'generaluser'
    );
    CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users (LOWER(email));
  `,
  down: "DROP TABLE IF EXISTS users;"
};

export async function runUsersMigration(pool: Pick<Pool, "query">, direction: "up" | "down" = "up") {
  await pool.query(direction === "up" ? usersMigration.up : usersMigration.down);
}
