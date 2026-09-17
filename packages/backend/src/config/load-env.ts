import { existsSync } from "node:fs";
import { resolve } from "node:path";

export function loadBackendEnvFile() {
  const envPath = resolve(__dirname, "../../.env");
  if (existsSync(envPath)) process.loadEnvFile(envPath);
}
