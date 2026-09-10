import { afterEach, expect, jest, test } from "@jest/globals";
import { act, cleanup, render, screen } from "@testing-library/react";
import { useChatSocket, type ChatSocketFactory } from "../../../src/features/chat/useChatSocket.js";
import type { Socket } from "socket.io-client";

afterEach(cleanup);

type SocketListener = (...args: unknown[]) => void;

function socketFixture() {
  let socket: Socket;
  const listeners = new Map<string, SocketListener>();
  const on = jest.fn((event: string, listener: SocketListener) => {
    listeners.set(event, listener);
    return socket;
  });
  const off = jest.fn((event: string, listener: SocketListener) => {
    if (listeners.get(event) === listener) listeners.delete(event);
    return socket;
  });
  socket = { on, off, connect: jest.fn(), disconnect: jest.fn() } as unknown as Socket;
  return { socket, on, off, trigger: (event: string) => listeners.get(event)?.() };
}

function SocketProbe({ createSocket }: { createSocket: ChatSocketFactory }) {
  const { socket, isConnected, connectionStatus } = useChatSocket(createSocket);
  return <output data-testid="connection">{connectionStatus}:{String(isConnected)}:{socket ? "socket" : "none"}</output>;
}

test("connects, reports lifecycle events, and cleans up listeners", () => {
  const fixture = socketFixture();
  const createSocket = jest.fn(() => fixture.socket);
  const { unmount } = render(<SocketProbe createSocket={createSocket} />);

  expect(createSocket).toHaveBeenCalledTimes(1);
  expect(fixture.socket.connect).toHaveBeenCalledTimes(1);
  expect(screen.getByTestId("connection").textContent).toBe("connecting:false:socket");

  act(() => fixture.trigger("connect"));
  expect(screen.getByTestId("connection").textContent).toBe("connected:true:socket");
  act(() => fixture.trigger("connect_error"));
  expect(screen.getByTestId("connection").textContent).toBe("unavailable:true:socket");
  act(() => fixture.trigger("disconnect"));
  expect(screen.getByTestId("connection").textContent).toBe("disconnected:false:socket");

  unmount();
  expect(fixture.off).toHaveBeenCalledTimes(3);
  expect(fixture.socket.disconnect).toHaveBeenCalledTimes(1);
});

test("reports an unavailable state when no socket can be created", () => {
  const createSocket = jest.fn<ChatSocketFactory>(() => null);
  render(<SocketProbe createSocket={createSocket} />);

  expect(screen.getByTestId("connection").textContent).toBe("unavailable:false:none");
  expect(createSocket).toHaveBeenCalledTimes(1);
});

test("cleans up the previous socket when its factory changes", () => {
  const first = socketFixture();
  const second = socketFixture();
  const { rerender } = render(<SocketProbe createSocket={() => first.socket} />);

  rerender(<SocketProbe createSocket={() => second.socket} />);

  expect(first.off).toHaveBeenCalledTimes(3);
  expect(first.socket.disconnect).toHaveBeenCalledTimes(1);
  expect(second.socket.connect).toHaveBeenCalledTimes(1);
});
