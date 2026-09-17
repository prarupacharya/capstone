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
    id: "message-1", chatroomId: "room-1", senderEmail: "ada@example.com", sender: "Ada", message: "Welcome",
    createdAt: "2026-01-01T12:00:00.000Z"
  };
  const notification: RoomNotification = {
    chatroomId: "room-1", type: "user_joined", userId: "user-2", identity: "Lin",
    message: "Lin joined the room", createdAt: "not-a-date"
  };

  render(<ChatMessageFeed messages={[message]} notifications={[notification]} />);

  const feed = screen.getByLabelText("Messages");
  expect(within(feed).getByText("Welcome")).not.toBeNull();
  expect(within(feed).getByText("ada@example.com")).not.toBeNull();
  expect(within(feed).getByText("Lin joined the room")).not.toBeNull();
  const times = within(feed).getAllByRole("time");
  expect(times[0].textContent).toBe("not-a-date");
  expect(times[1].getAttribute("datetime")).toBe(message.createdAt);
});

test("classifies messages by sender ID and removes ordered-list counters", () => {
  const ownMessage: ChatHistoryMessage = {
    id: "own", chatroomId: "room-1", senderId: "user-1", sender: "Ada", message: "Mine",
    createdAt: "2026-01-01T12:00:00.000Z"
  };
  const otherMessage: ChatHistoryMessage = {
    id: "other", chatroomId: "room-1", senderId: "user-2", sender: "Lin", message: "Theirs",
    createdAt: "2026-01-01T12:01:00.000Z"
  };
  const legacyMessage: ChatHistoryMessage = {
    id: "legacy", chatroomId: "room-1", sender: "Pat", message: "Legacy",
    createdAt: "2026-01-01T12:02:00.000Z"
  };

  render(<ChatMessageFeed messages={[ownMessage, otherMessage, legacyMessage]} notifications={[]} currentUserId="user-1" />);

  const list = screen.getByRole("list", { name: "Chat messages" });
  const items = within(list).getAllByRole("listitem");
  expect(items[0].className).toContain("message-row--own");
  expect(items[1].className).toContain("message-row--other");
  expect(items[2].className).toContain("message-row--other");
  expect(list.tagName).toBe("UL");
  expect(within(list).queryByRole("list", { name: "Chat messages" })).toBeNull();
});

test("falls back to the sender label when a message email is unavailable", () => {
  const message: ChatHistoryMessage = {
    id: "legacy", chatroomId: "room-1", sender: "Pat", message: "Legacy",
    createdAt: "2026-01-01T12:00:00.000Z"
  };

  render(<ChatMessageFeed messages={[message]} notifications={[]} />);

  expect(screen.getByText("Pat")).not.toBeNull();
});

test("keeps message text, email, and timestamp in separate elements", () => {
  const message: ChatHistoryMessage = {
    id: "metadata", chatroomId: "room-1", senderEmail: "ada@example.com", sender: "Ada",
    message: "Metadata", createdAt: "2026-01-01T12:00:00.000Z"
  };

  render(<ChatMessageFeed messages={[message]} notifications={[]} />);

  const bubble = screen.getByText("Metadata").parentElement;
  expect(bubble?.querySelector(".message-sender")?.textContent).toBe("ada@example.com");
  expect(bubble?.querySelector("p")?.textContent).toBe("Metadata");
  expect(bubble?.querySelector(".message-time")?.getAttribute("datetime")).toBe(message.createdAt);
});
