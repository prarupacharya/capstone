const DEFAULT_PORT = 3000;
const DEFAULT_CORS_ORIGINS = ["http://localhost:5173"];
const DEFAULT_JWT_EXPIRES_IN = "15m";
const MINIMUM_JWT_SECRET_LENGTH = 32;

export interface BackendConfig {
  port: number;
  corsOrigins: string[];
}

export interface JwtConfig {
  secret: string;
  expiresIn: string;
}

function parsePort(value: string | undefined) {
  if (!value?.trim()) return DEFAULT_PORT;

  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535");
  }

  return port;
}

function parseCorsOrigins(value: string | undefined) {
  const origins = value?.split(",").map((origin) => origin.trim()).filter(Boolean);
  if (!origins?.length) return DEFAULT_CORS_ORIGINS;

  return origins.map((origin) => {
    if (origin === "*") throw new Error("CORS_ORIGINS must not contain a wildcard");

    const url = new URL(origin);
    if (!["http:", "https:"].includes(url.protocol) || url.origin !== origin) {
      throw new Error(`Invalid CORS origin: ${origin}`);
    }

    return origin;
  });
}

function parseJwtExpiration(value: string | undefined) {
  const expiresIn = value?.trim() || DEFAULT_JWT_EXPIRES_IN;
  if (!/^[1-9]\d*[smhdwy]$/.test(expiresIn)) {
    throw new Error("JWT_EXPIRES_IN must be a positive duration such as 15m or 1h");
  }

  return expiresIn;
}

export function parseBackendEnv(env: Record<string, string | undefined> = process.env): BackendConfig {
  return {
    port: parsePort(env.PORT),
    corsOrigins: parseCorsOrigins(env.CORS_ORIGINS)
  };
}

export function parseJwtConfig(env: Record<string, string | undefined> = process.env): JwtConfig {
  const secret = env.JWT_SECRET?.trim();
  if (!secret || secret.length < MINIMUM_JWT_SECRET_LENGTH) {
    throw new Error(`JWT_SECRET must be at least ${MINIMUM_JWT_SECRET_LENGTH} characters`);
  }

  return {
    secret,
    expiresIn: parseJwtExpiration(env.JWT_EXPIRES_IN)
  };
}
