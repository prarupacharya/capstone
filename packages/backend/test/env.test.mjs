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

test("wires configured origins into Nest CORS", () => {
  let options;
  configureApp({ enableCors: (value) => { options = value; } }, parseBackendEnv({
    CORS_ORIGINS: "http://localhost:5173,https://app.example.com"
  }));

  assert.deepEqual(options, {
    origin: ["http://localhost:5173", "https://app.example.com"]
  });
});

test("parses JWT configuration with a safe default expiration", () => {
  assert.deepEqual(parseJwtConfig({
    JWT_SECRET: "a-secret-that-is-at-least-32-characters-long"
  }), {
    secret: "a-secret-that-is-at-least-32-characters-long",
    expiresIn: "15m"
  });
  assert.equal(parseJwtConfig({
    JWT_SECRET: "a-secret-that-is-at-least-32-characters-long",
    JWT_EXPIRES_IN: "2h"
  }).expiresIn, "2h");
});

test("rejects missing, short, and invalid JWT configuration", () => {
  assert.throws(() => parseJwtConfig({}), /JWT_SECRET/);
  assert.throws(() => parseJwtConfig({ JWT_SECRET: "too-short" }), /JWT_SECRET/);
  assert.throws(() => parseJwtConfig({
    JWT_SECRET: "a-secret-that-is-at-least-32-characters-long",
    JWT_EXPIRES_IN: "forever"
  }), /JWT_EXPIRES_IN/);
});
