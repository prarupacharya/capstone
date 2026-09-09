import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const testDirectory = resolve("test");
const testFiles = readdirSync(testDirectory)
  .filter((file) => file.endsWith(".mjs"))
  .sort();

for (const testFile of testFiles) {
  const result = spawnSync(process.execPath, [
    "--test",
    "--test-concurrency=1",
    resolve(testDirectory, testFile)
  ], { stdio: "inherit" });

  if (result.error || result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
