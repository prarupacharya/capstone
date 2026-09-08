import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const { runUsersMigration, usersMigration } = require("../dist/modules/database/migrations/001-create-users.js");

test("users migration defines the required columns and defaults", () => {
  assert.match(usersMigration.up, /id UUID PRIMARY KEY/);
  assert.match(usersMigration.up, /email VARCHAR\(320\) NOT NULL/);
  assert.match(usersMigration.up, /username VARCHAR\(255\)/);
  assert.match(usersMigration.up, /hashed_password TEXT NOT NULL/);
  assert.match(usersMigration.up, /createddatetime TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP/);
  assert.match(usersMigration.up, /usertype VARCHAR\(32\) NOT NULL DEFAULT 'generaluser'/);
  assert.match(usersMigration.up, /LOWER\(email\)/);
  assert.match(usersMigration.down, /DROP TABLE IF EXISTS users/);
});

test("users migration creates and removes the PostgreSQL schema", { skip: !process.env.TEST_DATABASE_URL }, async () => {
  const { Pool } = require("pg");
  const pool = new Pool(process.env.TEST_DATABASE_URL);

  try {
    await runUsersMigration(pool, "down");
    await runUsersMigration(pool);

    const columns = await pool.query(`
      SELECT column_name, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users'
      ORDER BY ordinal_position
    `);
    assert.deepEqual(columns.rows, [
      { column_name: "id", is_nullable: "NO" },
      { column_name: "email", is_nullable: "NO" },
      { column_name: "username", is_nullable: "YES" },
      { column_name: "hashed_password", is_nullable: "NO" },
      { column_name: "createddatetime", is_nullable: "NO" },
      { column_name: "usertype", is_nullable: "NO" }
    ]);

    const user = await pool.query(
      "INSERT INTO users (email, hashed_password) VALUES ($1, $2) RETURNING id, createddatetime, usertype",
      ["migration@example.com", "test-hash"]
    );
    assert.match(user.rows[0].id, /^[a-f0-9-]{36}$/);
    assert.ok(user.rows[0].createddatetime);
    assert.equal(user.rows[0].usertype, "generaluser");
    await assert.rejects(
      pool.query("INSERT INTO users (email, hashed_password) VALUES ($1, $2)", ["MIGRATION@example.com", "test-hash"]),
      /users_email_unique/
    );
  } finally {
    await runUsersMigration(pool, "down");
    await pool.end();
  }
});
