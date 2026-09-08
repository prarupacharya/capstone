import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const { parseDatabaseConfig } = require("../dist/modules/database/database.config.js");

test("uses disabled local database defaults", () => {
  assert.deepEqual(parseDatabaseConfig({}), {
    enabled: false,
    host: "localhost",
    port: 5432,
    name: "capstone",
    user: "capstone",
    password: "capstone"
  });
});

test("parses database overrides", () => {
  assert.deepEqual(parseDatabaseConfig({
    DATABASE_ENABLED: "true",
    DATABASE_HOST: "db",
    DATABASE_PORT: "5433",
    DATABASE_NAME: "app",
    DATABASE_USER: "app_user",
    DATABASE_PASSWORD: "secret"
  }), {
    enabled: true,
    host: "db",
    port: 5433,
    name: "app",
    user: "app_user",
    password: "secret"
  });
});

test("rejects invalid database settings", () => {
  assert.throws(() => parseDatabaseConfig({ DATABASE_ENABLED: "yes" }), /DATABASE_ENABLED/);
  assert.throws(() => parseDatabaseConfig({ DATABASE_PORT: "70000" }), /DATABASE_PORT/);
});
