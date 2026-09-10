import { afterEach, expect, jest, test } from "@jest/globals";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import type { ChatroomSummary } from "../../../src/api/chatrooms.js";
import { ChatroomSidebar } from "../../../src/features/chat/ChatroomSidebar.js";

afterEach(cleanup);

const rooms: ChatroomSummary[] = [
  { id: "room-1", chatroomName: "General", createdAt: "2026-01-01", numberOfUsers: 2 },
  { id: "room-2", chatroomName: "Support", createdAt: "2026-01-02", numberOfUsers: 1, isMember: false }
];

const renderSidebar = (overrides: Partial<ComponentProps<typeof ChatroomSidebar>> = {}) => render(
  <ChatroomSidebar
    rooms={rooms} status="ready" activeRoomId="room-1" isMember={(room) => room.isMember !== false}
    onSelect={jest.fn()} {...overrides}
  />
);

test("renders loading, error, and empty catalog states", () => {
  const { rerender } = renderSidebar({ status: "loading" });
  expect(screen.getByText("Loading chatrooms...")).not.toBeNull();

  rerender(<ChatroomSidebar rooms={rooms} status="error" isMember={() => true} onSelect={jest.fn()} />);
  expect(screen.getByRole("alert").textContent).toContain("could not be loaded");

  rerender(<ChatroomSidebar rooms={[]} status="ready" isMember={() => true} onSelect={jest.fn()} />);
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
