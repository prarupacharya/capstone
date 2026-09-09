import { afterEach, expect, jest, test } from "@jest/globals";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ChatroomSummary } from "../../../src/api/chatrooms.js";
import { DashboardPage } from "../../../src/features/chat/DashboardPage.js";
import type { Socket } from "socket.io-client";

afterEach(cleanup);

const user = { id: "user-123", email: "user@example.com", userType: "generaluser" as const };

test("loads rooms, renders the chat frame, and selects a room", async () => {
  const onLogout = jest.fn();
  const rooms: ChatroomSummary[] = [
    { id: "room-1", chatroomName: "General", createdAt: "2026-01-01", numberOfUsers: 2 },
    { id: "room-2", chatroomName: "Support", createdAt: "2026-01-02", numberOfUsers: 1 }
  ];

  render(<DashboardPage user={user} onLogout={onLogout} loadChatrooms={async () => rooms} />);

  expect(screen.getByRole("heading", { name: "Welcome to LF-Chat" })).not.toBeNull();
  await waitFor(() => expect(screen.getByRole("button", { name: /General\s+2/ })).not.toBeNull());
  expect(screen.getByRole("heading", { name: "General" })).not.toBeNull();
  expect(screen.getByRole("textbox", { name: "Message" })).not.toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /Support\s+1/ }));
  expect(screen.getByRole("heading", { name: "Support" })).not.toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Log out" }));
  expect(onLogout).toHaveBeenCalledTimes(1);
});

test("shows empty and error room states without exposing error details", async () => {
  const { rerender } = render(<DashboardPage user={user} onLogout={jest.fn()} loadChatrooms={async () => []} />);
  await waitFor(() => expect(screen.getByText("No chatrooms available.")).not.toBeNull());
  rerender(<DashboardPage user={user} onLogout={jest.fn()} loadChatrooms={async () => { throw new Error("Bearer secret-token"); }} />);
  await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("could not be loaded"));
  expect(screen.queryByText("secret-token")).toBeNull();
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
