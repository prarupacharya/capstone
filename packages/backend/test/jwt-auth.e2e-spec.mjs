import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const jwtSecret = "jwt-guard-test-secret-that-is-at-least-32-characters";
process.env.JWT_SECRET = jwtSecret;
process.env.JWT_EXPIRES_IN = "15m";
process.env.DATABASE_ENABLED = "false";

const { NestFactory } = require("@nestjs/core");
const { JwtService } = require("@nestjs/jwt");
const { AppModule } = require("../dist/app.module.js");
const { configureValidation } = require("../dist/main.js");

let app;
let baseUrl;

before(async () => {
  app = await NestFactory.create(AppModule, { logger: false });
  configureValidation(app);
  await app.listen(0);
  const address = app.getHttpServer().address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await app.close();
});

async function request(path, options = {}) {
  return fetch(`${baseUrl}${path}`, options);
}

function unauthorizedBody() {
  return {
    statusCode: 401,
    message: "Unauthorized"
  };
}

test("health remains public without a token", async () => {
  const response = await request("/health");

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    status: "down",
    backend: "up",
    database: "down"
  });
});

test("protected routes reject missing, malformed, invalid, and expired tokens", async () => {
  const jwt = new JwtService({ secret: jwtSecret });
  const expiredToken = jwt.sign({
    sub: "expired-user",
    email: "expired@example.com",
    userType: "generaluser"
  }, { expiresIn: "-1s" });

  const authorizations = [
    undefined,
    "Token not-a-bearer-token",
    "Bearer not-a-valid-jwt",
    `Bearer ${expiredToken}`
  ];

  for (const authorization of authorizations) {
    const headers = authorization ? { authorization } : undefined;
    const response = await request("/auth/me", { headers });

    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), unauthorizedBody());
  }
});

test("a valid token returns only the authenticated public identity", async () => {
  const jwt = new JwtService({ secret: jwtSecret });
  const token = jwt.sign({
    sub: "user-123",
    email: "user@example.com",
    userType: "generaluser",
    password: "must-not-escape"
  });

  const response = await request("/auth/me", {
    headers: { authorization: `Bearer ${token}` }
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    id: "user-123",
    email: "user@example.com",
    userType: "generaluser"
  });
});
