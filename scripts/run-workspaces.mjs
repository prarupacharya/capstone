import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const script = process.argv[2];
const packagesRoot = join(process.cwd(), "packages");

if (!script || !existsSync(packagesRoot)) process.exit(0);

for (const name of readdirSync(packagesRoot)) {
  const packageDir = join(packagesRoot, name);
  const manifestPath = join(packageDir, "package.json");

  if (!existsSync(manifestPath)) continue;
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (!manifest.scripts?.[script]) continue;

  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  const result = spawnSync(npm, ["run", script, "--workspace", name], { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
