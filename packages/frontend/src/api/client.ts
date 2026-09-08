import { parseFrontendEnv } from "../config/env";

const config = parseFrontendEnv(import.meta.env);

export async function request(path: string, init?: RequestInit) {
  const response = await fetch(`${config.apiBaseUrl}${path}`, init);

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response;
}
