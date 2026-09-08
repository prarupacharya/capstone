import "reflect-metadata";
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { NestFactory } from "@nestjs/core";

const require = createRequire(import.meta.url);
const { AppModule } = require("../dist/app.module.js");
let app;
let baseUrl;

before(async () => {
  app = await NestFactory.create(AppModule, { logger: false });
  await app.listen(0);
  const address = app.getHttpServer().address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await app.close();
});

test("GET /health reports backend and database status", async () => {
  const response = await fetch(`${baseUrl}/health`);

  assert.equal(response.status, 200);
  assert.match(response.headers.get("x-correlation-id"), /^[a-f0-9-]{36}$/);
  assert.deepEqual(await response.json(), {
    status: "down",
    backend: "up",
    database: "down"
  });
});

test("logs non-GET requests and preserves a valid correlation ID", async () => {
  const lines = [];
  const originalLog = globalThis.console.log;
  globalThis.console.log = (...args) => lines.push(args.join(" "));

  try {
    const response = await fetch(`${baseUrl}/health`, {
      method: "POST",
      headers: { "X-Correlation-ID": "request-from-test" }
    });

    assert.equal(response.status, 404);
    assert.equal(response.headers.get("x-correlation-id"), "request-from-test");
  } finally {
    globalThis.console.log = originalLog;
  }

  assert.equal(lines.length, 1);
  assert.match(lines[0], /^\[\d{4}-\d{2}-\d{2}T[^\]]+\] \[WARN\] - API request completed /);
  assert.match(lines[0], /"method":"POST"/);
  assert.match(lines[0], /"correlationId":"request-from-test"/);

  const logFile = resolve(process.cwd(), "logs", "POST", `${new Date().toISOString().slice(0, 10)}.log`);
  const fileContents = await readFile(logFile, "utf8");
  assert.match(fileContents, /"method":"POST"/);
  assert.match(fileContents, /"correlationId":"request-from-test"/);
});
