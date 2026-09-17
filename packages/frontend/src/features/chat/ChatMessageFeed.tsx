import type { ChatHistoryMessage, RoomNotification } from "../../realtime/chat-events.types.js";

export type ChatMessageFeedProps = {
  readonly messages: readonly ChatHistoryMessage[];
  readonly notifications: readonly RoomNotification[];
  readonly currentUserId?: string;
};

function formatMessageTime(createdAt: string) {
  const date = new Date(createdAt);
  return Number.isNaN(date.getTime()) ? createdAt : date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function ChatMessageFeed({ messages, notifications, currentUserId }: ChatMessageFeedProps) {
  return (
    <div className="message-region" aria-label="Messages" aria-live="polite">
      {notifications.length > 0 && <ul className="room-notification-list" aria-label="Room activity">
        {notifications.map((notification, index) => <li
          className="room-notification" key={`${notification.type}-${notification.userId}-${notification.createdAt}-${index}`}
        >
          <strong>{notification.identity}</strong><p>{notification.message}</p>
          <time dateTime={notification.createdAt}>{formatMessageTime(notification.createdAt)}</time>
        </li>)}
      </ul>}
      {messages.length === 0 ? <p>No messages yet.</p> : <ul className="message-list" aria-label="Chat messages">
        {messages.map((message) => <li
          className={`message-row ${message.senderId !== undefined && message.senderId === currentUserId ? "message-row--own" : "message-row--other"}`}
          key={message.id}
        >
          <div className="message-bubble">
            <strong className="message-sender">{message.senderEmail ?? message.sender}</strong>
            <p>{message.message}</p>
            <time className="message-time" dateTime={message.createdAt}>{formatMessageTime(message.createdAt)}</time>
          </div>
        </li>)}
      </ul>}
    </div>
  );
}
