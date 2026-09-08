import { parseFrontendEnv } from "../config/env.js";
import { ApiError } from "./api-error.js";

const config = parseFrontendEnv(import.meta.env ?? {});

function getErrorMessages(body: unknown, status: number) {
  if (!body || typeof body !== "object") return [`Request failed with status ${status}`];

  const message = (body as { message?: unknown }).message;
  if (Array.isArray(message)) {
    const messages = message.filter((value): value is string => typeof value === "string");
    if (messages.length) return messages;
  }
  if (typeof message === "string") return [message];

  return [`Request failed with status ${status}`];
}

export async function request(path: string, init?: RequestInit) {
  const response = await fetch(`${config.apiBaseUrl}${path}`, init);

  if (!response.ok) {
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = undefined;
    }

    throw new ApiError(response.status, getErrorMessages(body, response.status));
  }

  return response;
}
