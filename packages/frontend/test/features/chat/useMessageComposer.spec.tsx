import { afterEach, expect, jest, test } from "@jest/globals";
import { act, cleanup, renderHook } from "@testing-library/react";
import type { FormEvent } from "react";
import type { Socket } from "socket.io-client";
import type { SendMessageAck } from "../../../src/realtime/chat-events.types.js";
import { useMessageComposer } from "../../../src/features/chat/useMessageComposer.js";

afterEach(cleanup);

function socketFixture() {
  const emit = jest.fn();
  return { socket: { emit } as unknown as Socket, emit };
}

function submitEvent() {
  return { preventDefault: jest.fn() } as unknown as FormEvent<HTMLFormElement>;
}

test("trims valid drafts, blocks duplicate sends, and clears after success", () => {
  const fixture = socketFixture();
  const { result } = renderHook(() => useMessageComposer(fixture.socket, true, "room-1"));
  const event = submitEvent();

  act(() => result.current.onDraftChange("  hello  "));
  act(() => result.current.handleSubmit(event));
  expect(event.preventDefault).toHaveBeenCalledTimes(1);
  expect(fixture.emit).toHaveBeenCalledWith("sendMessage", { chatroomId: "room-1", message: "hello" }, expect.any(Function));
  act(() => result.current.handleSubmit(submitEvent()));
  expect(fixture.emit).toHaveBeenCalledTimes(1);

  const ack = fixture.emit.mock.calls[0][2] as (response: SendMessageAck) => void;
  act(() => ack({ ok: true, data: { id: "message-1", chatroomId: "room-1", sender: "Ada", message: "hello", createdAt: "2026-01-01" } }));
  expect(result.current.draft).toBe("");
  expect(result.current.sending).toBe(false);
});

test("keeps rejected text, ignores invalid sends, and resets composer state", () => {
  const fixture = socketFixture();
  const { result } = renderHook(() => useMessageComposer(fixture.socket, true, "room-1"));

  act(() => result.current.onDraftChange("   "));
  act(() => result.current.handleSubmit(submitEvent()));
  expect(fixture.emit).not.toHaveBeenCalled();
  act(() => result.current.onDraftChange("rejected"));
  act(() => result.current.handleSubmit(submitEvent()));
  const ack = fixture.emit.mock.calls[0][2] as (response: SendMessageAck) => void;
  act(() => ack({ ok: false, error: { code: "MESSAGE_FAILED", message: "Message rejected" } }));
  expect(result.current.draft).toBe("rejected");
  expect(result.current.sendError).toBe("Message rejected");
  act(() => result.current.reset());
  expect(result.current.draft).toBe("");
  expect(result.current.sendError).toBeUndefined();
  expect(result.current.sending).toBe(false);
});
