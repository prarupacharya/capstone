import assert from "node:assert/strict";
import crypto from "node:crypto";
import { after, before, test } from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const hasDatabase = Boolean(process.env.TEST_DATABASE_URL);
const loginEmail = "login@example.com";
const generateRandomPassword = () => {
  const randomSuffix = crypto.randomBytes(12).toString("hex");
  return `test-login-${randomSuffix}-${Date.now().toString(36)}`;
};
const loginPassword = generateRandomPassword();

const jwtSecret = "login-test-secret-that-is-at-least-32-characters";
process.env.JWT_SECRET = jwtSecret;
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
const { JwtService } = require("@nestjs/jwt");
const { AppModule } = require("../dist/app.module.js");
const { configureValidation } = require("../dist/main.js");
const { runUsersMigration } = require("../dist/modules/database/migrations/001-create-users.js");

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

async function post(path, body) {
  return fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

test("valid credentials return a signed token with minimal identity claims", { skip: !hasDatabase }, async () => {
  const registration = await post("/auth/register", {
    email: loginEmail,
    password: loginPassword
  });
  assert.equal(registration.status, 201);
  const registeredUser = await registration.json();

  const response = await post("/auth/login", {
    email: "  LOGIN@EXAMPLE.COM ",
    password: loginPassword
  });

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(Object.keys(body), ["accessToken"]);
  assert.equal(typeof body.accessToken, "string");

  const verifier = new JwtService({ secret: jwtSecret });
  const claims = verifier.verify(body.accessToken);
  assert.deepEqual(claims, {
    sub: registeredUser.id,
    email: loginEmail,
    userType: "generaluser",
    iat: claims.iat,
    exp: claims.exp
  });
  assert.ok(Number.isInteger(claims.iat));
  assert.ok(Number.isInteger(claims.exp));
  assert.ok(claims.exp > claims.iat);
});

test("unknown email and wrong password share one unauthorized response", { skip: !hasDatabase }, async () => {
  const unknownEmailResponse = await post("/auth/login", {
    email: "missing@example.com",
    password: loginPassword
  });
  const wrongPasswordResponse = await post("/auth/login", {
    email: loginEmail,
    password: "wrong-password"
  });

  assert.equal(unknownEmailResponse.status, 401);
  assert.equal(wrongPasswordResponse.status, 401);
  const expectedBody = {
    statusCode: 401,
    message: "invalid email or password",
    error: "Unauthorized"
  };
  assert.deepEqual(await unknownEmailResponse.json(), expectedBody);
  assert.deepEqual(await wrongPasswordResponse.json(), expectedBody);
});

test("login rejects invalid email without echoing the password", { skip: !hasDatabase }, async () => {
  const secretPassword = "secret-login-password";
  const response = await post("/auth/login", {
    email: "not-an-email",
    password: secretPassword
  });

  assert.equal(response.status, 400);
  assert.doesNotMatch(JSON.stringify(await response.json()), new RegExp(secretPassword));
});
