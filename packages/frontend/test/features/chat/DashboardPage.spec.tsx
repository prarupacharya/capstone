import { afterEach, expect, jest, test } from "@jest/globals";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ChatroomSummary } from "../../../src/api/chatrooms.js";
import { DashboardPage } from "../../../src/features/chat/DashboardPage.js";
import type { ChatHistoryMessage, JoinRoomAck, LeaveRoomAck, SendMessageAck } from "../../../src/realtime/chat-events.types.js";
import type { Socket } from "socket.io-client";

afterEach(cleanup);

const user = { id: "user-123", email: "user@example.com", userType: "generaluser" as const };

function socketFixture() {
  let socket: Socket;
  type SocketListener = (...args: unknown[]) => void;
  const listeners = new Map<string, SocketListener>();
  const on = jest.fn((event: string, listener: SocketListener) => { listeners.set(event, listener); return socket; });
  const off = jest.fn((event: string, listener: SocketListener) => {
    if (listeners.get(event) === listener) listeners.delete(event);
    return socket;
  });
  const emit = jest.fn();
  socket = {
    on, off, connect: jest.fn(() => listeners.get("connect")?.()), disconnect: jest.fn(), emit
  } as unknown as Socket;
  return { socket, emit, trigger: (event: string, ...args: unknown[]) => listeners.get(event)?.(...args) };
}

test("loads rooms, renders the chat frame, and selects a room", async () => {
  const onLogout = jest.fn();
  const fixture = socketFixture();
  const rooms: ChatroomSummary[] = [
    { id: "room-1", chatroomName: "General", createdAt: "2026-01-01", numberOfUsers: 2 },
    { id: "room-2", chatroomName: "Support", createdAt: "2026-01-02", numberOfUsers: 1 }
  ];
  const generalMessage: ChatHistoryMessage = {
    id: "message-1", chatroomId: "room-1", sender: "Ada", message: "Welcome", createdAt: "2026-01-01T12:00:00.000Z"
  };

  render(<DashboardPage user={user} onLogout={onLogout} loadChatrooms={async () => rooms} createSocket={() => fixture.socket} />);

  expect(screen.getByRole("heading", { name: "Welcome to LF-Chat" })).not.toBeNull();
  await act(async () => fixture.socket.connect());
  await waitFor(() => expect(fixture.emit).toHaveBeenCalledWith("joinRoom", { chatroomId: "room-1" }, expect.any(Function)));
  await act(async () => (fixture.emit.mock.calls[0][2] as (ack: JoinRoomAck) => void)({ ok: true, data: { chatroomId: "room-1", messages: [generalMessage] } }));
  await waitFor(() => expect(screen.getByRole("button", { name: /General\s+2/ })).not.toBeNull());
  expect(screen.getByRole("heading", { name: "General" })).not.toBeNull();
  expect(screen.getByText("Ada")).not.toBeNull();
  expect(screen.getByText("Welcome")).not.toBeNull();
  expect(screen.getByRole("time").getAttribute("datetime")).toBe(generalMessage.createdAt);
  expect(screen.getByRole("textbox", { name: "Message" })).not.toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /Support\s+1/ }));
  await waitFor(() => expect(fixture.emit).toHaveBeenCalledWith("leaveRoom", { chatroomId: "room-1" }, expect.any(Function)));
  await act(async () => (fixture.emit.mock.calls[1][2] as (ack: LeaveRoomAck) => void)({ ok: true, data: { chatroomId: "room-1" } }));
  await waitFor(() => expect(fixture.emit).toHaveBeenCalledWith("joinRoom", { chatroomId: "room-2" }, expect.any(Function)));
  await act(async () => (fixture.emit.mock.calls[2][2] as (ack: JoinRoomAck) => void)({ ok: true, data: { chatroomId: "room-2", messages: [] } }));
  await waitFor(() => expect(screen.getByRole("heading", { name: "Support" })).not.toBeNull());
  expect(screen.queryByText("Welcome")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Log out" }));
  expect(onLogout).toHaveBeenCalledTimes(1);
});

test("ignores a late history acknowledgement from a former selection", async () => {
  const fixture = socketFixture();
  const rooms: ChatroomSummary[] = [
    { id: "room-1", chatroomName: "General", createdAt: "2026-01-01", numberOfUsers: 2 },
    { id: "room-2", chatroomName: "Support", createdAt: "2026-01-02", numberOfUsers: 1 }
  ];
  render(<DashboardPage user={user} onLogout={jest.fn()} loadChatrooms={async () => rooms} createSocket={() => fixture.socket} />);

  await act(async () => fixture.socket.connect());
  await waitFor(() => expect(fixture.emit).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getByRole("button", { name: /Support\s+1/ }));
  await waitFor(() => expect(fixture.emit).toHaveBeenCalledTimes(2));
  const oldAck = fixture.emit.mock.calls[0][2] as (ack: JoinRoomAck) => void;
  const newAck = fixture.emit.mock.calls[1][2] as (ack: JoinRoomAck) => void;
  await act(async () => oldAck({ ok: true, data: { chatroomId: "room-1", messages: [{ id: "old", chatroomId: "room-1", sender: "Ada", message: "Old room", createdAt: "2026-01-01T12:00:00.000Z" }] } }));
  await act(async () => newAck({ ok: true, data: { chatroomId: "room-2", messages: [{ id: "new", chatroomId: "room-2", sender: "Lin", message: "Current room", createdAt: "2026-01-02T12:00:00.000Z" }] } }));
  expect(screen.queryByText("Old room")).toBeNull();
  expect(screen.getByText("Current room")).not.toBeNull();
});

test("trims valid messages, blocks duplicates, and clears after success", async () => {
  const fixture = socketFixture();
  const rooms: ChatroomSummary[] = [{ id: "room-1", chatroomName: "General", createdAt: "2026-01-01", numberOfUsers: 2 }];
  render(<DashboardPage user={user} onLogout={jest.fn()} loadChatrooms={async () => rooms} createSocket={() => fixture.socket} />);

  await act(async () => fixture.socket.connect());
  await waitFor(() => expect(fixture.emit).toHaveBeenCalledTimes(1));
  await act(async () => (fixture.emit.mock.calls[0][2] as (ack: JoinRoomAck) => void)({ ok: true, data: { chatroomId: "room-1", messages: [] } }));
  const input = screen.getByRole("textbox", { name: "Message" });
  expect(input.getAttribute("maxlength")).toBe("2000");
  fireEvent.change(input, { target: { value: "  hello  " } });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  await waitFor(() => expect(fixture.emit).toHaveBeenCalledWith("sendMessage", { chatroomId: "room-1", message: "hello" }, expect.any(Function)));
  fireEvent.submit(input.closest("form") as HTMLFormElement);
  expect(fixture.emit.mock.calls.filter(([event]) => event === "sendMessage")).toHaveLength(1);
  const ack = fixture.emit.mock.calls[1][2] as (response: SendMessageAck) => void;
  await act(async () => ack({ ok: true, data: { id: "message-1", chatroomId: "room-1", sender: "Ada", message: "hello", createdAt: "2026-01-01T12:00:00.000Z" } }));
  expect((input as HTMLInputElement).value).toBe("");
});

test("appends active-room messages once and ignores other rooms", async () => {
  const fixture = socketFixture();
  const rooms: ChatroomSummary[] = [{ id: "room-1", chatroomName: "General", createdAt: "2026-01-01", numberOfUsers: 2 }];
  const history: ChatHistoryMessage = { id: "message-1", chatroomId: "room-1", sender: "Ada", message: "History", createdAt: "2026-01-01T12:00:00.000Z" };
  const live: ChatHistoryMessage = { id: "message-2", chatroomId: "room-1", sender: "Lin", message: "Live", createdAt: "2026-01-01T12:01:00.000Z" };
  const unrelated: ChatHistoryMessage = { ...live, id: "message-3", chatroomId: "room-2", message: "Other room" };
  const { unmount } = render(<DashboardPage user={user} onLogout={jest.fn()} loadChatrooms={async () => rooms} createSocket={() => fixture.socket} />);

  await act(async () => fixture.socket.connect());
  await waitFor(() => expect(fixture.emit).toHaveBeenCalledTimes(1));
  await act(async () => (fixture.emit.mock.calls[0][2] as (ack: JoinRoomAck) => void)({ ok: true, data: { chatroomId: "room-1", messages: [history] } }));
  await act(async () => fixture.trigger("newMessage", live));
  await act(async () => fixture.trigger("newMessage", live));
  await act(async () => fixture.trigger("newMessage", history));
  await act(async () => fixture.trigger("newMessage", unrelated));

  expect(within(screen.getByLabelText("Messages")).getAllByRole("listitem")).toHaveLength(2);
  expect(screen.getByText("History")).not.toBeNull();
  expect(screen.getByText("Live")).not.toBeNull();
  expect(screen.queryByText("Other room")).toBeNull();
  unmount();
  expect(fixture.socket.off).toHaveBeenCalledWith("newMessage", expect.any(Function));
});

test("stops rendering messages from a room after switching away", async () => {
  const fixture = socketFixture();
  const rooms: ChatroomSummary[] = [
    { id: "room-1", chatroomName: "General", createdAt: "2026-01-01", numberOfUsers: 2 },
    { id: "room-2", chatroomName: "Support", createdAt: "2026-01-02", numberOfUsers: 1 }
  ];
  const oldRoomMessage: ChatHistoryMessage = { id: "old-live", chatroomId: "room-1", sender: "Ada", message: "Old live", createdAt: "2026-01-01T12:00:00.000Z" };
  const currentRoomMessage: ChatHistoryMessage = { ...oldRoomMessage, id: "current-live", chatroomId: "room-2", message: "Current live" };
  render(<DashboardPage user={user} onLogout={jest.fn()} loadChatrooms={async () => rooms} createSocket={() => fixture.socket} />);

  await act(async () => fixture.socket.connect());
  await waitFor(() => expect(fixture.emit).toHaveBeenCalledWith("joinRoom", { chatroomId: "room-1" }, expect.any(Function)));
  await act(async () => (fixture.emit.mock.calls[0][2] as (ack: JoinRoomAck) => void)({ ok: true, data: { chatroomId: "room-1", messages: [] } }));
  fireEvent.click(screen.getByRole("button", { name: /Support\s+1/ }));
  await waitFor(() => expect(fixture.emit).toHaveBeenCalledWith("leaveRoom", { chatroomId: "room-1" }, expect.any(Function)));
  await act(async () => (fixture.emit.mock.calls[1][2] as (ack: LeaveRoomAck) => void)({ ok: true, data: { chatroomId: "room-1" } }));
  await waitFor(() => expect(fixture.emit).toHaveBeenCalledWith("joinRoom", { chatroomId: "room-2" }, expect.any(Function)));
  await act(async () => (fixture.emit.mock.calls[2][2] as (ack: JoinRoomAck) => void)({ ok: true, data: { chatroomId: "room-2", messages: [] } }));

  await act(async () => fixture.trigger("newMessage", oldRoomMessage));
  await act(async () => fixture.trigger("newMessage", currentRoomMessage));
  expect(screen.queryByText("Old live")).toBeNull();
  expect(screen.getByText("Current live")).not.toBeNull();
});

test("blocks whitespace and retains rejected message text", async () => {
  const fixture = socketFixture();
  const rooms: ChatroomSummary[] = [{ id: "room-1", chatroomName: "General", createdAt: "2026-01-01", numberOfUsers: 2 }];
  render(<DashboardPage user={user} onLogout={jest.fn()} loadChatrooms={async () => rooms} createSocket={() => fixture.socket} />);

  await act(async () => fixture.socket.connect());
  await waitFor(() => expect(fixture.emit).toHaveBeenCalledTimes(1));
  await act(async () => (fixture.emit.mock.calls[0][2] as (ack: JoinRoomAck) => void)({ ok: true, data: { chatroomId: "room-1", messages: [] } }));
  const input = screen.getByRole("textbox", { name: "Message" });
  fireEvent.change(input, { target: { value: "   " } });
  expect(screen.getByRole("button", { name: "Send" }).hasAttribute("disabled")).toBe(true);
  fireEvent.change(input, { target: { value: "rejected" } });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  await waitFor(() => expect(fixture.emit.mock.calls.filter(([event]) => event === "sendMessage")).toHaveLength(1));
  await act(async () => (fixture.emit.mock.calls[1][2] as (response: SendMessageAck) => void)({ ok: false, error: { code: "MESSAGE_FAILED", message: "Message rejected" } }));
  expect(screen.getByRole("alert").textContent).toBe("Message rejected");
  expect((input as HTMLInputElement).value).toBe("rejected");
});

test("shows empty and error room states without exposing error details", async () => {
  const { rerender } = render(<DashboardPage user={user} onLogout={jest.fn()} loadChatrooms={async () => []} />);
  await waitFor(() => expect(screen.getByText("No chatrooms available.")).not.toBeNull());
  rerender(<DashboardPage user={user} onLogout={jest.fn()} loadChatrooms={async () => { throw new Error("Bearer secret-token"); }} />);
  await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("could not be loaded"));
  expect(screen.queryByText("secret-token")).toBeNull();
});

test("keeps a failed room inactive and rejoins it after reconnect", async () => {
  const fixture = socketFixture();
  const rooms: ChatroomSummary[] = [{ id: "room-1", chatroomName: "General", createdAt: "2026-01-01", numberOfUsers: 2 }];
  render(<DashboardPage user={user} onLogout={jest.fn()} loadChatrooms={async () => rooms} createSocket={() => fixture.socket} />);

  await act(async () => fixture.socket.connect());
  await waitFor(() => expect(fixture.emit).toHaveBeenCalledWith("joinRoom", { chatroomId: "room-1" }, expect.any(Function)));
  await act(async () => (fixture.emit.mock.calls[0][2] as (ack: JoinRoomAck) => void)({ ok: false, error: { code: "ROOM_NOT_FOUND", message: "Room unavailable" } }));
  await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Room unavailable"));
  expect(screen.getByRole("heading", { name: "Select a chatroom" })).not.toBeNull();

  await act(async () => { fixture.trigger("disconnect"); });
  await act(async () => { fixture.trigger("connect"); });
  await waitFor(() => expect(fixture.emit).toHaveBeenCalledTimes(2));
  expect(fixture.emit.mock.calls[1][0]).toBe("joinRoom");
});

test("connects once and disconnects with the authenticated dashboard", async () => {
  const on = jest.fn();
  const socket = { on, off: jest.fn(), connect: jest.fn(), disconnect: jest.fn() } as unknown as Socket;
  const { unmount } = render(
    <DashboardPage user={user} onLogout={jest.fn()} loadChatrooms={async () => []} createSocket={() => socket} />
  );

  await waitFor(() => expect(socket.connect).toHaveBeenCalledTimes(1));
  expect(screen.getByText("Chat: connecting")).not.toBeNull();
  const failed = on.mock.calls.find(([event]) => event === "connect_error")?.[1] as () => void;
  await act(async () => failed());
  expect(screen.getByRole("status").textContent).toContain("unavailable");
  unmount();
  expect(socket.off).toHaveBeenCalledTimes(3);
  expect(socket.disconnect).toHaveBeenCalledTimes(1);
});
