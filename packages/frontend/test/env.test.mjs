import assert from "node:assert/strict";
import { test } from "node:test";
import { parseFrontendEnv } from "../dist/config-test/env.js";

test("uses the local backend URL by default", () => {
  assert.deepEqual(parseFrontendEnv({}), { apiBaseUrl: "http://localhost:3000" });
});

test("parses a configured frontend API URL", () => {
  assert.deepEqual(parseFrontendEnv({ VITE_API_URL: "https://api.example.com/" }), {
    apiBaseUrl: "https://api.example.com"
  });
});

test("rejects unsupported frontend API protocols", () => {
  assert.throws(() => parseFrontendEnv({ VITE_API_URL: "ftp://api.example.com" }), /http or https/);
});
