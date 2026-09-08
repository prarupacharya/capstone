import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const { Pool } = require("pg");
const { runUsersMigration } = require("../dist/modules/database/migrations/001-create-users.js");
const { UsersRepository } = require("../dist/modules/users/users.repository.js");

test("users repository creates users and finds them by normalized email", { skip: !process.env.TEST_DATABASE_URL }, async () => {
  const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
  const databaseService = { getPool: () => pool };
  const repository = new UsersRepository(databaseService);

  try {
    await runUsersMigration(pool, "down");
    await runUsersMigration(pool);

    const created = await repository.createUser({
      email: "  Alice@Example.COM ",
      hashedPassword: "bcrypt-hash"
    });

    assert.match(created.id, /^[a-f0-9-]{36}$/);
    assert.equal(created.email, "alice@example.com");
    assert.equal(created.username, null);
    assert.equal(created.hashedPassword, "bcrypt-hash");
    assert.ok(created.createdDateTime);
    assert.equal(created.userType, "generaluser");

    const found = await repository.findByEmail("ALICE@example.com");
    assert.deepEqual(found, created);
    assert.equal(await repository.findByEmail("missing@example.com"), null);

    await assert.rejects(
      repository.createUser({ email: "ALICE@example.com", hashedPassword: "another-hash" }),
      (error) => error?.code === "23505"
    );
  } finally {
    await runUsersMigration(pool, "down");
    await pool.end();
  }
});
