import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createRequire } from "node:module";
import crypto from "node:crypto";

const require = createRequire(import.meta.url);
const hasDatabase = Boolean(process.env.TEST_DATABASE_URL);
process.env.JWT_SECRET = "registration-test-secret-that-is-at-least-32-characters";
process.env.JWT_EXPIRES_IN = "15m";

if (hasDatabase) {
  const databaseUrl = new URL(process.env.TEST_DATABASE_URL);
  process.env.DATABASE_ENABLED = "true";
  process.env.DATABASE_HOST = databaseUrl.hostname;
  process.env.DATABASE_PORT = databaseUrl.port || "5432";
  process.env.DATABASE_NAME = databaseUrl.pathname.slice(1);
  process.env.DATABASE_USER = decodeURIComponent(databaseUrl.username);
  process.env.DATABASE_PASSWORD = decodeURIComponent(databaseUrl.password);
}

const { NestFactory } = require("@nestjs/core");
const { AppModule } = require("../dist/app.module.js");
const { configureValidation } = require("../dist/main.js");
const { runUsersMigration } = require("../dist/modules/database/migrations/001-create-users.js");
const { AuthService } = require("../dist/modules/auth/auth.service.js");
const bcrypt = require("bcrypt");

let app;
let pool;
let baseUrl;

before(async () => {
  if (!hasDatabase) return;

  pool = new (require("pg").Pool)({ connectionString: process.env.TEST_DATABASE_URL });
  await runUsersMigration(pool, "down");
  await runUsersMigration(pool);

  app = await NestFactory.create(AppModule, { logger: false });
  configureValidation(app);
  await app.listen(0);
  const address = app.getHttpServer().address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (app) await app.close();
  if (pool) {
    await runUsersMigration(pool, "down");
    await pool.end();
  }
});

test("registration stores a bcrypt hash and returns a public user", { skip: !hasDatabase }, async () => {
  const generateRandomPassword = () => {
    const randomSuffix = crypto.randomBytes(12).toString("hex");
    return `test-login-${randomSuffix}-${Date.now().toString(36)}`;
  };
  const password = generateRandomPassword();
  const lines = [];
  const originalLog = globalThis.console.log;
  globalThis.console.log = (...args) => lines.push(args.join(" "));

  let response;
  try {
    response = await fetch(`${baseUrl}/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "  NEW@Example.COM ", password })
    });
  } finally {
    globalThis.console.log = originalLog;
  }

  assert.equal(response.status, 201);
  const body = await response.json();
  assert.equal(body.email, "new@example.com");
  assert.equal(body.username, null);
  assert.equal(body.userType, "generaluser");
  assert.ok(body.id);
  assert.ok(body.createdDateTime);
  assert.equal("password" in body, false);
  assert.equal("hashedPassword" in body, false);

  const result = await pool.query("SELECT hashed_password, usertype FROM users WHERE email = $1", ["new@example.com"]);
  assert.equal(result.rows.length, 1);
  assert.notEqual(result.rows[0].hashed_password, password);
  assert.equal(await bcrypt.compare(password, result.rows[0].hashed_password), true);
  assert.equal(result.rows[0].usertype, "generaluser");
  assert.equal(lines.some((line) => line.includes(password)), false);
  assert.equal(lines.some((line) => line.includes(result.rows[0].hashed_password)), false);
});

test("registration rejects duplicate email regardless of casing", { skip: !hasDatabase }, async () => {
  const response = await fetch(`${baseUrl}/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "NEW@example.com", password: "another-password" })
  });

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    statusCode: 400,
    message: ["email is already registered"],
    error: "Bad Request"
  });
});

test("auth service maps a unique-email race to conflict", async () => {
  const service = new AuthService({
    createUser: async () => {
      const error = new Error("duplicate key value violates unique constraint");
      error.code = "23505";
      error.constraint = "users_email_unique";
      throw error;
    }
  });

  await assert.rejects(
    service.register({ email: "race@example.com", password: "another-password" }),
    (error) => error?.getStatus?.() === 409 && error.message === "email is already registered"
  );
});
