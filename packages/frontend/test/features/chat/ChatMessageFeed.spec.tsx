import { afterEach, expect, test } from "@jest/globals";
import { cleanup, render, screen, within } from "@testing-library/react";
import type { ChatHistoryMessage, RoomNotification } from "../../../src/realtime/chat-events.types.js";
import { ChatMessageFeed } from "../../../src/features/chat/ChatMessageFeed.js";

afterEach(cleanup);

test("renders the empty message state without activity", () => {
  render(<ChatMessageFeed messages={[]} notifications={[]} />);

  const feed = screen.getByLabelText("Messages");
  expect(screen.getByText("No messages yet.")).not.toBeNull();
  expect(within(feed).queryByLabelText("Room activity")).toBeNull();
});

test("renders messages and room activity with safe timestamps", () => {
  const message: ChatHistoryMessage = {
    id: "message-1", chatroomId: "room-1", sender: "Ada", message: "Welcome",
    createdAt: "2026-01-01T12:00:00.000Z"
  };
  const notification: RoomNotification = {
    chatroomId: "room-1", type: "user_joined", userId: "user-2", identity: "Lin",
    message: "Lin joined the room", createdAt: "not-a-date"
  };

  render(<ChatMessageFeed messages={[message]} notifications={[notification]} />);

  const feed = screen.getByLabelText("Messages");
  expect(within(feed).getByText("Welcome")).not.toBeNull();
  expect(within(feed).getByText("Lin joined the room")).not.toBeNull();
  const times = within(feed).getAllByRole("time");
  expect(times[0].textContent).toBe("not-a-date");
  expect(times[1].getAttribute("datetime")).toBe(message.createdAt);
});
