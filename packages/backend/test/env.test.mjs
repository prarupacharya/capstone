import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const { parseBackendEnv, parseJwtConfig } = require("../dist/config/env.js");
const { configureApp } = require("../dist/main.js");

test("uses safe backend environment defaults", () => {
  assert.deepEqual(parseBackendEnv({}), {
    port: 3000,
    corsOrigins: ["http://localhost:5173"]
  });
});

test("parses backend port and CORS overrides", () => {
  assert.deepEqual(parseBackendEnv({ PORT: "4000", CORS_ORIGINS: "http://localhost:5173,https://app.example.com" }), {
    port: 4000,
    corsOrigins: ["http://localhost:5173", "https://app.example.com"]
  });
});

test("rejects invalid backend environment values", () => {
  assert.throws(() => parseBackendEnv({ PORT: "70000" }), /PORT/);
  assert.throws(() => parseBackendEnv({ CORS_ORIGINS: "*" }), /wildcard/);
});

test("parses JWT configuration with a safe default expiration", () => {
  assert.deepEqual(parseJwtConfig({ JWT_SECRET: "a".repeat(32) }), {
    secret: "a".repeat(32),
    expiresIn: "15m"
  });

  assert.deepEqual(parseJwtConfig({ JWT_SECRET: "development-secret-that-is-at-least-32-characters", JWT_EXPIRES_IN: "1h" }), {
    secret: "development-secret-that-is-at-least-32-characters",
    expiresIn: "1h"
  });
});

test("rejects missing, short, and invalid JWT configuration", () => {
  assert.throws(() => parseJwtConfig({}), /JWT_SECRET/);
  assert.throws(() => parseJwtConfig({ JWT_SECRET: "too-short" }), /JWT_SECRET/);
  assert.throws(() => parseJwtConfig({ JWT_SECRET: "a".repeat(32), JWT_EXPIRES_IN: "forever" }), /JWT_EXPIRES_IN/);
});

test("wires configured origins into Nest CORS", () => {
  let options;
  configureApp({ enableCors: (value) => { options = value; } }, parseBackendEnv({
    CORS_ORIGINS: "http://localhost:5173,https://app.example.com"
  }));

  assert.deepEqual(options, {
    origin: ["http://localhost:5173", "https://app.example.com"]
  });
});
