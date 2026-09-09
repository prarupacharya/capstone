import { io, type Socket } from "socket.io-client";
import { getAccessToken } from "../auth/session.js";
import { parseFrontendEnv } from "../config/env.js";

const config = parseFrontendEnv(import.meta.env ?? {});

export function createChatSocket(): Socket | null {
  const token = getAccessToken();
  if (!token) return null;

  return io(config.apiBaseUrl, {
    auth: { token },
    autoConnect: false,
    reconnection: true
  });
}
