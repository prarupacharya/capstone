import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { Server as SocketServer } from "socket.io";
import { expect, test } from "@playwright/test";

const httpServer = createServer();
const socketServer = new SocketServer(httpServer, { cors: { origin: "*" } });
let socketPort: number;

socketServer.on("connection", (socket) => {
  socket.on("joinRoom", (payload: { chatroomId?: string }, acknowledge: (response: unknown) => void) => {
    const chatroomId = payload.chatroomId ?? "";
    acknowledge({ ok: true, data: { chatroomId, messages: [] } });
    setTimeout(() => socket.emit("roomUserCountUpdated", { chatroomId, numberOfUsers: 4 }), 100);
  });
});

test.beforeAll(async () => {
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  socketPort = (httpServer.address() as AddressInfo).port;
});

test.afterAll(async () => {
  await new Promise<void>((resolve) => socketServer.close(() => resolve()));
});

test("updates the visible room count from the socket without refetching", async ({ page }) => {
  let catalogRequests = 0;
  await page.addInitScript((port) => {
    const rewriteSocketUrl = (value: string) => value.replace("localhost:3000", `127.0.0.1:${port}`);
    const open = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url, ...rest) {
      return open.call(this, method, rewriteSocketUrl(String(url)), ...rest);
    };
    const NativeWebSocket = window.WebSocket;
    window.WebSocket = class extends NativeWebSocket {
      constructor(url: string | URL, protocols?: string | string[]) {
        super(rewriteSocketUrl(String(url)), protocols);
      }
    } as typeof WebSocket;
  }, socketPort);
  await page.addInitScript(() => {
    window.sessionStorage.setItem("capstone.accessToken", "header.payload.signature");
  });
  await page.route("**/health", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "up", backend: "up", database: "up" }) });
  });
  await page.route("**/auth/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ id: "user-123", email: "user@example.com", userType: "generaluser" })
    });
  });
  await page.route("**/chatrooms", async (route) => {
    catalogRequests += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        { id: "room-1", chatroomName: "General", createdAt: "2026-01-01", numberOfUsers: 2, isMember: true },
        { id: "room-2", chatroomName: "Support", createdAt: "2026-01-02", numberOfUsers: 1, isMember: false }
      ])
    });
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Welcome to LF-Chat" })).toBeVisible();
  await expect(page.getByRole("button", { name: /General\s+4/ })).toBeVisible();
  await page.getByRole("button", { name: /Support\s+1/ }).click();
  await expect(page.getByRole("dialog", { name: "Join Support?" })).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "General" })).toBeVisible();
  await page.getByRole("button", { name: /Support\s+1/ }).click();
  await page.getByRole("button", { name: "Join chatroom" }).click();
  await expect(page.getByRole("heading", { name: "Support" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Support\s+1\s+Joined/ })).toBeVisible();
  expect(catalogRequests).toBe(1);
});
