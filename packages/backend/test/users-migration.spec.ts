import { Pool } from "pg";
import { runUsersMigration, usersMigration } from "../src/modules/database/migrations/001-create-users";

describe("users migration", () => {
  it("defines the required columns and defaults", () => {
    for (const fragment of ["id UUID PRIMARY KEY", "email VARCHAR(320) NOT NULL", "username VARCHAR(255)",
      "hashed_password TEXT NOT NULL", "createddatetime TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP",
      "usertype VARCHAR(32) NOT NULL DEFAULT 'generaluser'", "LOWER(email)"]) {
      expect(usersMigration.up).toContain(fragment);
    }
    expect(usersMigration.down).toContain("DROP TABLE IF EXISTS users");
  });

  it("selects the requested migration direction", async () => {
    const pool = { query: jest.fn().mockResolvedValue(undefined) };

    await runUsersMigration(pool);
    await runUsersMigration(pool, "down");

    expect(pool.query).toHaveBeenNthCalledWith(1, usersMigration.up);
    expect(pool.query).toHaveBeenNthCalledWith(2, usersMigration.down);
  });

  const postgresTest = process.env.TEST_DATABASE_URL ? it : it.skip;
  postgresTest("creates and removes the PostgreSQL schema", async () => {
    const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });

    try {
      await runUsersMigration(pool, "down");
      await runUsersMigration(pool);
      const columns = await pool.query("SELECT column_name, is_nullable FROM information_schema.columns " +
        "WHERE table_schema = 'public' AND table_name = 'users' ORDER BY ordinal_position");

      expect(columns.rows).toEqual([
        { column_name: "id", is_nullable: "NO" }, { column_name: "email", is_nullable: "NO" },
        { column_name: "username", is_nullable: "YES" }, { column_name: "hashed_password", is_nullable: "NO" },
        { column_name: "createddatetime", is_nullable: "NO" }, { column_name: "usertype", is_nullable: "NO" }
      ]);
      const user = await pool.query(
        "INSERT INTO users (email, hashed_password) VALUES ($1, $2) RETURNING id, createddatetime, usertype",
        ["migration@example.com", "test-hash"]
      );
      expect(user.rows[0].id).toMatch(/^[a-f0-9-]{36}$/);
      expect(user.rows[0].createddatetime).toBeTruthy();
      expect(user.rows[0].usertype).toBe("generaluser");
      await expect(pool.query(
        "INSERT INTO users (email, hashed_password) VALUES ($1, $2)",
        ["MIGRATION@example.com", "test-hash"]
      )).rejects.toThrow(/users_email_unique/);
    } finally {
      await runUsersMigration(pool, "down");
      await pool.end();
    }
  });
});
