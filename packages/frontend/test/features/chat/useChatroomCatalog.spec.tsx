import { afterEach, expect, jest, test } from "@jest/globals";
import { act, cleanup, renderHook } from "@testing-library/react";
import type { ChatroomSummary } from "../../../src/api/chatrooms.js";
import { useChatroomCatalog } from "../../../src/features/chat/useChatroomCatalog.js";

afterEach(cleanup);

const rooms: ChatroomSummary[] = [
  { id: "room-1", chatroomName: "General", createdAt: "2026-01-01", numberOfUsers: 2 },
  { id: "room-2", chatroomName: "Support", createdAt: "2026-01-02", numberOfUsers: 1, isMember: false }
];

function deferredLoader() {
  let resolve: (value: ChatroomSummary[]) => void = () => undefined;
  const loadChatrooms = jest.fn(() => new Promise<ChatroomSummary[]>((complete) => { resolve = complete; }));
  return { loadChatrooms, resolveRooms: (value: ChatroomSummary[]) => resolve(value) };
}

test("loads rooms and selects the first joined room", async () => {
  const loader = deferredLoader();
  const { result } = renderHook(() => useChatroomCatalog(loader.loadChatrooms));

  expect(result.current.status).toBe("loading");
  await act(async () => { loader.resolveRooms(rooms); await Promise.resolve(); await Promise.resolve(); });
  expect(result.current.status).toBe("ready");
  expect(result.current.selectedRoom?.id).toBe("room-1");
  expect(result.current.pendingRoom).toBeUndefined();
});

test("keeps selection while confirming an unjoined room and applies membership commands", async () => {
  const loader = deferredLoader();
  const { result } = renderHook(() => useChatroomCatalog(loader.loadChatrooms));
  await act(async () => { loader.resolveRooms(rooms); await Promise.resolve(); await Promise.resolve(); });
  expect(result.current.status).toBe("ready");

  act(() => result.current.selectRoom(rooms[1]));
  expect(result.current.selectedId).toBe("room-1");
  expect(result.current.pendingRoom?.id).toBe("room-2");
  act(() => result.current.confirmJoin());
  expect(result.current.selectedId).toBe("room-2");
  expect(result.current.joinRequestId).toBe("room-2");
  expect(result.current.pendingRoom).toBeUndefined();

  act(() => result.current.markJoined("room-2"));
  expect(result.current.rooms.find((room) => room.id === "room-2")?.isMember).toBe(true);
  act(() => { result.current.markLeft("room-2"); result.current.clearSelection(); });
  expect(result.current.selectedId).toBeUndefined();
  expect(result.current.rooms.find((room) => room.id === "room-2")?.isMember).toBe(false);
});
