import { afterEach, expect, jest, test } from "@jest/globals";
import { act, cleanup, render } from "@testing-library/react";
import type { Socket } from "socket.io-client";
import type { RoomUserCountUpdated } from "../../../src/realtime/chat-events.types.js";
import { useRoomUserCounts, type RoomUserCountUpdater } from "../../../src/features/chat/useRoomUserCounts.js";

afterEach(cleanup);

type Listener = (update: RoomUserCountUpdated) => void;

function socketFixture() {
  let socket: Socket;
  const listeners = new Map<string, Listener>();
  const on = jest.fn((event: string, listener: Listener) => { listeners.set(event, listener); return socket; });
  const off = jest.fn((event: string, listener: Listener) => {
    if (listeners.get(event) === listener) listeners.delete(event);
    return socket;
  });
  socket = { on, off } as unknown as Socket;
  return { socket, on, off, trigger: (update: RoomUserCountUpdated) => listeners.get("roomUserCountUpdated")?.(update) };
}

function CountProbe({ socket, connected, onUpdate }: { socket: Socket; connected: boolean; onUpdate: RoomUserCountUpdater }) {
  useRoomUserCounts(socket, connected, onUpdate);
  return <output data-testid="ready">ready</output>;
}

test("subscribes only while connected, validates updates, and cleans up", () => {
  const fixture = socketFixture();
  const onUpdate = jest.fn<RoomUserCountUpdater>();
  const { rerender, unmount } = render(<CountProbe socket={fixture.socket} connected={false} onUpdate={onUpdate} />);
  expect(fixture.on).not.toHaveBeenCalled();

  rerender(<CountProbe socket={fixture.socket} connected onUpdate={onUpdate} />);
  expect(fixture.on).toHaveBeenCalledTimes(1);
  act(() => fixture.trigger({ chatroomId: "room-1", numberOfUsers: 4 }));
  act(() => fixture.trigger({ chatroomId: "room-1", numberOfUsers: -1 }));
  act(() => fixture.trigger({ chatroomId: "room-1", numberOfUsers: 1.5 }));
  expect(onUpdate).toHaveBeenCalledTimes(1);
  expect(onUpdate).toHaveBeenCalledWith("room-1", 4);

  unmount();
  expect(fixture.off).toHaveBeenCalledTimes(1);
});

test("uses the latest catalog updater without re-registering the listener", () => {
  const fixture = socketFixture();
  const firstUpdate = jest.fn<RoomUserCountUpdater>();
  const secondUpdate = jest.fn<RoomUserCountUpdater>();
  const { rerender } = render(<CountProbe socket={fixture.socket} connected onUpdate={firstUpdate} />);

  rerender(<CountProbe socket={fixture.socket} connected onUpdate={secondUpdate} />);
  act(() => fixture.trigger({ chatroomId: "room-2", numberOfUsers: 3 }));

  expect(fixture.on).toHaveBeenCalledTimes(1);
  expect(firstUpdate).not.toHaveBeenCalled();
  expect(secondUpdate).toHaveBeenCalledWith("room-2", 3);
});
