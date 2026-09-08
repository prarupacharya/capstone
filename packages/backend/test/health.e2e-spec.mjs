import "reflect-metadata";
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createRequire } from "node:module";
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
  assert.deepEqual(await response.json(), {
    status: "down",
    backend: "up",
    database: "down"
  });
});
