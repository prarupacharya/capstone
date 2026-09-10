import { afterEach, expect, jest, test } from "@jest/globals";
import { act, cleanup, renderHook } from "@testing-library/react";
import type { Socket } from "socket.io-client";
import type { ChatHistoryMessage, RoomNotification } from "../../../src/realtime/chat-events.types.js";
import { useActiveRoomFeed } from "../../../src/features/chat/useActiveRoomFeed.js";

afterEach(cleanup);

type FeedEvent = ChatHistoryMessage | RoomNotification;
type Listener = (event: FeedEvent) => void;

function socketFixture() {
  let socket: Socket;
  const listeners = new Map<string, Listener>();
  const on = jest.fn((event: string, listener: Listener) => { listeners.set(event, listener); return socket; });
  const off = jest.fn((event: string, listener: Listener) => {
    if (listeners.get(event) === listener) listeners.delete(event);
    return socket;
  });
  socket = { on, off } as unknown as Socket;
  return { socket, on, off, trigger: (event: string, payload: FeedEvent) => listeners.get(event)?.(payload) };
}

test("replaces history, appends active-room messages once, and filters other rooms", () => {
  const fixture = socketFixture();
  const history: ChatHistoryMessage = { id: "history", chatroomId: "room-1", sender: "Ada", message: "History", createdAt: "2026-01-01" };
  const live: ChatHistoryMessage = { id: "live", chatroomId: "room-1", sender: "Lin", message: "Live", createdAt: "2026-01-02" };
  const other: ChatHistoryMessage = { ...live, id: "other", chatroomId: "room-2" };
  const { result, unmount } = renderHook(() => useActiveRoomFeed(fixture.socket, true, "room-1"));

  act(() => result.current.replaceMessages([history]));
  act(() => fixture.trigger("newMessage", live));
  act(() => fixture.trigger("newMessage", live));
  act(() => fixture.trigger("newMessage", other));

  expect(result.current.messages).toEqual([history, live]);
  unmount();
  expect(fixture.off).toHaveBeenCalledWith("newMessage", expect.any(Function));
});

test("filters notifications, clears the feed, and removes listeners on room change", () => {
  const fixture = socketFixture();
  const notification: RoomNotification = {
    chatroomId: "room-1", type: "user_joined", userId: "user-2", identity: "Lin",
    message: "Lin joined", createdAt: "2026-01-01"
  };
  const { result, rerender } = renderHook(
    ({ roomId }) => useActiveRoomFeed(fixture.socket, true, roomId), { initialProps: { roomId: "room-1" } }
  );

  act(() => fixture.trigger("roomNotification", notification));
  act(() => fixture.trigger("roomNotification", { ...notification, chatroomId: "room-2" }));
  expect(result.current.notifications).toHaveLength(1);
  act(() => result.current.clearFeed());
  expect(result.current.notifications).toHaveLength(0);
  rerender({ roomId: "room-2" });
  expect(fixture.off).toHaveBeenCalledWith("roomNotification", expect.any(Function));
  act(() => fixture.trigger("roomNotification", notification));
  act(() => fixture.trigger("roomNotification", { ...notification, chatroomId: "room-2" }));
  expect(result.current.notifications).toHaveLength(1);
});
