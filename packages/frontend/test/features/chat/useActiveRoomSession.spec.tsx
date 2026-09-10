import { afterEach, expect, jest, test } from "@jest/globals";
import { act, cleanup, renderHook } from "@testing-library/react";
import type { ChatroomSummary } from "../../../src/api/chatrooms.js";
import type { JoinRoomAck, LeaveRoomAck } from "../../../src/realtime/chat-events.types.js";
import type { Socket } from "socket.io-client";
import { useActiveRoomSession, type ActiveRoomSessionActions, type ActiveRoomSessionOptions } from "../../../src/features/chat/useActiveRoomSession.js";

afterEach(cleanup);

const room: ChatroomSummary = { id: "room-1", chatroomName: "General", createdAt: "2026-01-01", numberOfUsers: 2 };

function sessionFixture() {
  const emit = jest.fn();
  const actions: ActiveRoomSessionActions = {
    clearFeed: jest.fn(), replaceMessages: jest.fn(), reset: jest.fn(), clearError: jest.fn()
  };
  const options: ActiveRoomSessionOptions = {
    socket: { emit } as unknown as Socket, isConnected: true, connectionStatus: "connected",
    selectedId: room.id, selectedRoom: room, joinRequestId: undefined,
    clearJoinRequest: jest.fn(), markJoined: jest.fn(), markLeft: jest.fn(), clearSelection: jest.fn(),
    actionsRef: { current: actions }
  };
  return { emit, actions, options };
}

test("joins the selected room and installs matching history", () => {
  const fixture = sessionFixture();
  const { result } = renderHook(() => useActiveRoomSession(fixture.options));
  expect(fixture.emit).toHaveBeenCalledWith("joinRoom", { chatroomId: room.id }, expect.any(Function));

  const ack = fixture.emit.mock.calls[0][2] as (response: JoinRoomAck) => void;
  const history = [{ id: "message-1", chatroomId: room.id, sender: "Ada", message: "Welcome", createdAt: "2026-01-01" }];
  act(() => ack({ ok: true, data: { chatroomId: room.id, messages: history } }));

  expect(result.current.activeRoomId).toBe(room.id);
  expect(fixture.options.markJoined).toHaveBeenCalledWith(room.id);
  expect(fixture.actions.replaceMessages).toHaveBeenCalledWith(history);
});

test("preserves the active room after leave failure and clears it after success", () => {
  const fixture = sessionFixture();
  const { result } = renderHook(() => useActiveRoomSession(fixture.options));
  const joinAck = fixture.emit.mock.calls[0][2] as (response: JoinRoomAck) => void;
  act(() => joinAck({ ok: true, data: { chatroomId: room.id, messages: [] } }));

  act(() => result.current.leaveRoom());
  const failedLeave = fixture.emit.mock.calls[1][2] as (response: LeaveRoomAck) => void;
  act(() => failedLeave({ ok: false, error: { code: "LEAVE_FAILED", message: "Could not leave" } }));
  expect(result.current.activeRoomId).toBe(room.id);
  expect(result.current.roomError).toBe("Could not leave");

  act(() => result.current.leaveRoom());
  const successfulLeave = fixture.emit.mock.calls[2][2] as (response: LeaveRoomAck) => void;
  act(() => successfulLeave({ ok: true, data: { chatroomId: room.id } }));
  expect(result.current.activeRoomId).toBeUndefined();
  expect(fixture.options.markLeft).toHaveBeenCalledWith(room.id);
  expect(fixture.options.clearSelection).toHaveBeenCalledTimes(1);
  expect(fixture.actions.reset).toHaveBeenCalledTimes(1);
});
