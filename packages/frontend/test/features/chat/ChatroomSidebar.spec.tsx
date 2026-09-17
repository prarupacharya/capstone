import { afterEach, expect, jest, test } from "@jest/globals";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ApiError } from "../../../src/api/api-error.js";
import type { ComponentProps } from "react";
import type { ChatroomSummary, CreateChatroomInput } from "../../../src/api/chatrooms.js";
import { ChatroomSidebar } from "../../../src/features/chat/ChatroomSidebar.js";

afterEach(cleanup);

const rooms: ChatroomSummary[] = [
  { id: "room-1", chatroomName: "General", createdAt: "2026-01-01", numberOfUsers: 2 },
  { id: "room-2", chatroomName: "Support", createdAt: "2026-01-02", numberOfUsers: 1, isMember: false }
];

const renderSidebar = (overrides: Partial<ComponentProps<typeof ChatroomSidebar>> = {}) => render(
  <ChatroomSidebar
    rooms={rooms} status="ready" activeRoomId="room-1" isMember={(room) => room.isMember !== false}
    onSelect={jest.fn()} onCreateRoom={jest.fn<(input: CreateChatroomInput) => Promise<ChatroomSummary>>()} {...overrides}
  />
);

test("renders loading, error, and empty catalog states", () => {
  const { rerender } = renderSidebar({ status: "loading" });
  expect(screen.getByText("Loading chatrooms...")).not.toBeNull();

  rerender(<ChatroomSidebar rooms={rooms} status="error" isMember={() => true} onSelect={jest.fn()}
    onCreateRoom={jest.fn<(input: CreateChatroomInput) => Promise<ChatroomSummary>>()} />);
  expect(screen.getByRole("alert").textContent).toContain("could not be loaded");

  rerender(<ChatroomSidebar rooms={[]} status="ready" isMember={() => true} onSelect={jest.fn()}
    onCreateRoom={jest.fn<(input: CreateChatroomInput) => Promise<ChatroomSummary>>()} />);
  expect(screen.getByText("No chatrooms available.")).not.toBeNull();
});

test("renders room metadata and reports the selected room", () => {
  const onSelect = jest.fn();
  renderSidebar({ onSelect });

  expect(screen.getByRole("button", { name: /General\s+2\s+Joined/ }).getAttribute("aria-pressed")).toBe("true");
  expect(screen.getByRole("button", { name: /Support\s+1\s+Not joined/ })).not.toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /Support\s+1/ }));
  expect(onSelect).toHaveBeenCalledWith(rooms[1]);
});

test("disables every room action when the dashboard is leaving", () => {
  renderSidebar({ disabled: true });
  expect(screen.getByRole("button", { name: /General/ })).toHaveProperty("disabled", true);
  expect(screen.getByRole("button", { name: /Support/ })).toHaveProperty("disabled", true);
});

test("trims a new room, reports the created room, and clears the form", async () => {
  const onCreateRoom = jest.fn<(input: CreateChatroomInput) => Promise<ChatroomSummary>>()
    .mockResolvedValue({ ...rooms[1], chatroomName: "New room", isMember: false });
  renderSidebar({ onCreateRoom });

  fireEvent.change(screen.getByLabelText("New chatroom"), { target: { value: "  New room  " } });
  fireEvent.submit(screen.getByRole("form", { name: "Create chatroom" }));

  await screen.findByRole("button", { name: "Create chatroom" });
  expect(onCreateRoom).toHaveBeenCalledWith({ chatroomName: "New room" });
  expect((screen.getByLabelText("New chatroom") as HTMLInputElement).value).toBe("");
});

test("blocks invalid names and preserves the name after an API error", async () => {
  const onCreateRoom = jest.fn<(input: CreateChatroomInput) => Promise<ChatroomSummary>>()
    .mockRejectedValue(new ApiError(409, ["chatroom name is already in use"]));
  renderSidebar({ onCreateRoom });

  fireEvent.submit(screen.getByRole("form", { name: "Create chatroom" }));
  expect(screen.getByRole("alert").textContent).toBe("Enter a chatroom name.");
  fireEvent.change(screen.getByLabelText("New chatroom"), { target: { value: "Support" } });
  fireEvent.submit(screen.getByRole("form", { name: "Create chatroom" }));

  expect((await screen.findByRole("alert")).textContent).toContain("chatroom name is already in use");
  expect((screen.getByLabelText("New chatroom") as HTMLInputElement).value).toBe("Support");
});
