import { beforeEach, expect, jest, test } from "@jest/globals";
import { fileURLToPath } from "node:url";

const requestMock = jest.fn<(path: string, init?: RequestInit, options?: { authenticated?: boolean }) => Promise<Response>>();
jest.unstable_mockModule(fileURLToPath(new URL("../../src/api/client.ts", import.meta.url)), () => ({ request: requestMock }));
const { listChatrooms } = await import("../../src/api/chatrooms.js");

test("lists chatrooms through the authenticated API", async () => {
  const rooms = [{ id: "room-1", chatroomName: "General", createdAt: "2026-01-01T00:00:00.000Z", numberOfUsers: 2 }];
  const json = jest.fn<() => Promise<unknown>>();
  json.mockResolvedValue(rooms);
  requestMock.mockResolvedValue({ json } as unknown as Response);

  await expect(listChatrooms()).resolves.toEqual(rooms);
  expect(requestMock).toHaveBeenCalledWith("/chatrooms", undefined, { authenticated: true });
});

beforeEach(() => { requestMock.mockReset(); });
