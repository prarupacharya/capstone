import { afterEach, expect, jest, test } from "@jest/globals";

const ioMock = jest.fn();
jest.unstable_mockModule("socket.io-client", () => ({ io: ioMock }));
const { createChatSocket } = await import("../../src/realtime/chat-socket.js");

afterEach(() => {
  ioMock.mockReset();
  window.sessionStorage.clear();
  window.localStorage.clear();
});

test("does not create a socket without a tab session token", () => {
  expect(createChatSocket()).toBeNull();
  expect(ioMock).not.toHaveBeenCalled();
});

test("passes only the session token and enables reconnection", () => {
  const token = "header.payload.signature";
  window.sessionStorage.setItem("capstone.accessToken", token);
  window.localStorage.setItem("capstone.accessToken", "legacy-token");

  createChatSocket();

  expect(ioMock).toHaveBeenCalledWith("http://localhost:3000", {
    auth: { token }, autoConnect: false, reconnection: true
  });
  expect((ioMock.mock.calls[0][1] as { auth: Record<string, unknown> }).auth).not.toHaveProperty("localStorage");
});
