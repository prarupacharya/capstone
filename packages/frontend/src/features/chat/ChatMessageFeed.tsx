import type { ChatHistoryMessage, RoomNotification } from "../../realtime/chat-events.types.js";

export type ChatMessageFeedProps = {
  readonly messages: readonly ChatHistoryMessage[];
  readonly notifications: readonly RoomNotification[];
};

function formatMessageTime(createdAt: string) {
  const date = new Date(createdAt);
  return Number.isNaN(date.getTime()) ? createdAt : date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function ChatMessageFeed({ messages, notifications }: ChatMessageFeedProps) {
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
      {messages.length === 0 ? <p>No messages yet.</p> : <ol className="message-list">
        {messages.map((message) => <li key={message.id}>
          <strong>{message.sender}</strong><p>{message.message}</p>
          <time dateTime={message.createdAt}>{formatMessageTime(message.createdAt)}</time>
        </li>)}
      </ol>}
    </div>
  );
}
