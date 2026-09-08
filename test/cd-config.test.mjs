import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const workflow = readFileSync(join(root, ".github", "workflows", "cd.yml"), "utf8");

test("CD runs on main pushes and manual dispatch", () => {
  assert.match(workflow, /push:\s+branches: \[main\]/);
  assert.match(workflow, /workflow_dispatch:/);
});

test("CD runs quality gates before packaging", () => {
  assert.match(workflow, /npm run lint/);
  assert.match(workflow, /npm run typecheck/);
  assert.match(workflow, /npm test/);
  assert.match(workflow, /npm run build/);
  assert.match(workflow, /packages\/backend\/dist/);
  assert.match(workflow, /packages\/frontend\/dist/);
});

test("CD records an immutable artifact and DORA metadata", () => {
  assert.match(workflow, /environment:\s+name: dora/);
  assert.match(workflow, /actions\/upload-artifact@v4/);
  assert.match(workflow, /capstone-\$\{\{ github\.sha \}\}-\$\{\{ github\.run_id \}\}/);
  assert.match(workflow, /github\.sha/);
  assert.match(workflow, /github\.event\.pull_request\.html_url/);
  assert.match(workflow, /github\.run_id/);
  assert.match(workflow, /github\.run_started_at/);
  assert.match(workflow, /completed_at/);
  assert.match(workflow, /job\.status/);
});
