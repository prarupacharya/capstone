const DEFAULT_DATABASE_PORT = 5432;

export interface DatabaseConfig {
  enabled: boolean;
  host: string;
  port: number;
  name: string;
  user: string;
  password: string;
}

function parseEnabled(value: string | undefined) {
  if (!value?.trim() || value === "false") return false;
  if (value === "true") return true;
  throw new Error("DATABASE_ENABLED must be true or false");
}

function parsePort(value: string | undefined) {
  if (!value?.trim()) return DEFAULT_DATABASE_PORT;

  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("DATABASE_PORT must be an integer between 1 and 65535");
  }

  return port;
}

export function parseDatabaseConfig(env: Record<string, string | undefined> = process.env): DatabaseConfig {
  return {
    enabled: parseEnabled(env.DATABASE_ENABLED),
    host: env.DATABASE_HOST?.trim() || "localhost",
    port: parsePort(env.DATABASE_PORT),
    name: env.DATABASE_NAME?.trim() || "capstone",
    user: env.DATABASE_USER?.trim() || "capstone",
    password: env.DATABASE_PASSWORD ?? "capstone"
  };
}
