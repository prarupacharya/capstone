import assert from "node:assert/strict";
import { readFile, readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function readJson(name) {
  return JSON.parse(readFileSync(join(root, name), "utf8"));
}

test("the repository exposes a forward-compatible workspace", () => {
  const manifest = readJson("package.json");

  assert.equal(manifest.private, true);
  assert.deepEqual(manifest.workspaces, ["packages/*"]);
});

test("the root quality scripts are available", () => {
  const scripts = readJson("package.json").scripts;

  assert.equal(typeof scripts.lint, "string");
  assert.equal(typeof scripts.typecheck, "string");
  assert.equal(typeof scripts.test, "string");
});

test("CI runs the required quality checks", async () => {
  const workflow = await new Promise((resolve, reject) => {
    readFile(join(root, ".github", "workflows", "ci.yml"), "utf8", (error, data) => {
      if (error) reject(error);
      else resolve(data);
    });
  });

  assert.match(workflow, /npm ci/);
  assert.match(workflow, /npm run lint/);
  assert.match(workflow, /npm run typecheck/);
  assert.match(workflow, /npm test/);
});
