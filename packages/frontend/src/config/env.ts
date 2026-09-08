const DEFAULT_API_URL = "http://localhost:3000";

export interface FrontendConfig {
  apiBaseUrl: string;
}

export function parseFrontendEnv(env: Record<string, string | undefined>): FrontendConfig {
  const value = env.VITE_API_URL?.trim() || DEFAULT_API_URL;
  const url = new URL(value);

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("VITE_API_URL must use http or https");
  }

  return { apiBaseUrl: value.replace(/\/$/, "") };
}
