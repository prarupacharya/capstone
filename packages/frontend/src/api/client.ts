import { parseFrontendEnv } from "../config/env.js";
import { getAccessToken } from "../auth/session.js";
import { ApiError } from "./api-error.js";

const config = parseFrontendEnv(import.meta.env ?? {});

export interface RequestOptions {
  authenticated?: boolean;
}

function redact(value: string, accessToken?: string) {
  return accessToken ? value.replaceAll(accessToken, "[redacted]") : value;
}

function getErrorMessages(body: unknown, status: number, accessToken?: string) {
  if (!body || typeof body !== "object") return [`Request failed with status ${status}`];

  const message = (body as { message?: unknown }).message;
  if (Array.isArray(message)) {
    const messages = message.filter((value): value is string => typeof value === "string");
    if (messages.length) return messages.map((value) => redact(value, accessToken));
  }
  if (typeof message === "string") return [redact(message, accessToken)];

  return [`Request failed with status ${status}`];
}

export async function request(path: string, init?: RequestInit, options: RequestOptions = {}) {
  const headers = new Headers(init?.headers);
  headers.delete("authorization");
  const accessToken = options.authenticated ? getAccessToken() : null;

  if (accessToken) headers.set("authorization", `Bearer ${accessToken}`);

  const response = await fetch(`${config.apiBaseUrl}${path}`, {
    ...init,
    headers
  });

  if (!response.ok) {
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = undefined;
    }

    throw new ApiError(response.status, getErrorMessages(body, response.status, accessToken ?? undefined));
  }

  return response;
}
