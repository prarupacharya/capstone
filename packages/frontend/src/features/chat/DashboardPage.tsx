import { useEffect, useRef, useState, type FormEvent } from "react";
import { listChatrooms, type ChatroomSummary } from "../../api/chatrooms.js";
import type { CurrentUser } from "../../api/auth.js";
import { createChatSocket } from "../../realtime/chat-socket.js";
import type { ChatHistoryMessage, JoinRoomAck, LeaveRoomAck, RoomNotification, SendMessageAck } from "../../realtime/chat-events.types.js";
import type { Socket } from "socket.io-client";

type DashboardPageProps = {
  readonly user: CurrentUser;
  readonly onLogout: () => void;
  readonly loadChatrooms?: () => Promise<ChatroomSummary[]>;
  readonly createSocket?: () => Socket | null;
};

function formatMessageTime(createdAt: string) {
  const date = new Date(createdAt);
  return Number.isNaN(date.getTime()) ? createdAt : date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function DashboardPage({
  user, onLogout, loadChatrooms = listChatrooms, createSocket = createChatSocket
}: DashboardPageProps) {
  const [rooms, setRooms] = useState<ChatroomSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [connectionStatus, setConnectionStatus] = useState("connecting");
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [activeRoomId, setActiveRoomId] = useState<string>();
  const [roomError, setRoomError] = useState<string>();
  const [messages, setMessages] = useState<ChatHistoryMessage[]>([]);
  const [notifications, setNotifications] = useState<RoomNotification[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string>();
  const joinedRoomId = useRef<string>();

  useEffect(() => {
    const currentSocket = createSocket();
    setSocket(currentSocket);
    if (!currentSocket) {
      setConnectionStatus("unavailable");
      return;
    }
    const connected = () => {
      setConnectionStatus("connected");
      setIsConnected(true);
    };
    const disconnected = () => {
      joinedRoomId.current = undefined;
      setConnectionStatus("disconnected");
      setIsConnected(false);
      setActiveRoomId(undefined);
      setMessages([]);
      setNotifications([]);
    };
    const failed = () => setConnectionStatus("unavailable");
    currentSocket.on("connect", connected);
    currentSocket.on("disconnect", disconnected);
    currentSocket.on("connect_error", failed);
    currentSocket.connect();
    return () => {
      currentSocket.off("connect", connected);
      currentSocket.off("disconnect", disconnected);
      currentSocket.off("connect_error", failed);
      currentSocket.disconnect();
      setSocket(null);
      setIsConnected(false);
    };
  }, [createSocket]);

  useEffect(() => {
    if (!socket || !isConnected || !selectedId) return;
    let active = true;
    const previousRoomId = joinedRoomId.current;
    setRoomError(undefined);
    setSendError(undefined);
    setActiveRoomId(undefined);
    setMessages([]);
    setNotifications([]);

    const join = () => {
      socket.emit("joinRoom", { chatroomId: selectedId }, (ack: JoinRoomAck) => {
        if (!active) return;
        if (!ack.ok) {
          setRoomError(ack.error.message);
          return;
        }
        if (ack.data.chatroomId !== selectedId) return;
        joinedRoomId.current = selectedId;
        setActiveRoomId(selectedId);
        setMessages(ack.data.messages);
      });
    };

    if (!previousRoomId || previousRoomId === selectedId) {
      join();
    } else {
      socket.emit("leaveRoom", { chatroomId: previousRoomId }, (ack: LeaveRoomAck) => {
        if (!active) return;
        if (ack.ok) {
          joinedRoomId.current = undefined;
          join();
        }
        else setRoomError(ack.error.message);
      });
    }

    return () => { active = false; };
  }, [isConnected, selectedId, socket]);

  useEffect(() => {
    if (!socket || !isConnected || !activeRoomId) return;
    const receiveMessage = (message: ChatHistoryMessage) => {
      if (message.chatroomId !== activeRoomId) return;
      setMessages((current) => current.some((existing) => existing.id === message.id)
        ? current
        : [...current, message]);
    };
    socket.on("newMessage", receiveMessage);
    return () => { socket.off("newMessage", receiveMessage); };
  }, [activeRoomId, isConnected, socket]);

  useEffect(() => {
    if (!socket || !isConnected || !activeRoomId) return;
    const receiveNotification = (notification: RoomNotification) => {
      if (notification.chatroomId !== activeRoomId) return;
      setNotifications((current) => [...current, notification]);
    };
    socket.on("roomNotification", receiveNotification);
    return () => { socket.off("roomNotification", receiveNotification); };
  }, [activeRoomId, isConnected, socket]);

  useEffect(() => {
    let active = true;
    loadChatrooms()
      .then((loaded) => {
        if (!active) return;
        const nextRooms = Array.isArray(loaded) ? loaded : [];
        setRooms(nextRooms);
        setSelectedId((current) => nextRooms.some((room) => room.id === current) ? current : nextRooms[0]?.id);
        setStatus("ready");
      })
      .catch(() => active && setStatus("error"));
    return () => { active = false; };
  }, [loadChatrooms]);

  const selectedRoom = rooms.find((room) => room.id === selectedId);
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const message = draft.trim();
    if (!socket || !isConnected || !activeRoomId || !message || sending) return;
    setSending(true);
    setSendError(undefined);
    socket.emit("sendMessage", { chatroomId: activeRoomId, message }, (ack: SendMessageAck) => {
      setSending(false);
      if (ack.ok) setDraft("");
      else setSendError(ack.error.message);
    });
  };

  return (
    <main className="dashboard-shell">
      <header className="dashboard-header">
        <h1>Welcome to LF-Chat</h1>
        <h2 className="dashboard-header__user">{user.email}</h2>
        <p className="connection-status" role="status">Chat: {connectionStatus}</p>
        <button className="auth-secondary-button" type="button" onClick={onLogout}>Log out</button>
      </header>
      <div className="dashboard-layout">
        <aside className="room-sidebar" aria-label="Chatrooms">
          <h2>Chatrooms</h2>
          {status === "loading" && <output role="status">Loading chatrooms...</output>}
          {status === "error" && <p role="alert">Chatrooms could not be loaded. Please try again.</p>}
          {status === "ready" && rooms.length === 0 && <p>No chatrooms available.</p>}
          {status === "ready" && rooms.length > 0 && <ul className="room-list">
            {rooms.map((room) => <li key={room.id}>
              <button className="room-button" type="button" aria-pressed={room.id === activeRoomId} onClick={() => setSelectedId(room.id)}>
                <span>{room.chatroomName}</span><span className="room-button__count">{room.numberOfUsers}</span>
              </button>
            </li>)}
          </ul>}
        </aside>
        <section className="chat-panel" aria-labelledby="selected-room-heading">
          <h2 id="selected-room-heading">{selectedRoom?.id === activeRoomId ? selectedRoom?.chatroomName : "Select a chatroom"}</h2>
          {roomError && <p role="alert">{roomError}</p>}
          <div className="message-region" aria-label="Messages" aria-live="polite">
            {notifications.length > 0 && <ul className="room-notification-list" aria-label="Room activity">
              {notifications.map((notification, index) => <li
                className="room-notification" key={`${notification.type}-${notification.userId}-${notification.createdAt}-${index}`} role="status"
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
          {sendError && <p role="alert">{sendError}</p>}
          <form className="message-composer" onSubmit={handleSubmit}>
            <input
              aria-label="Message" placeholder="Type a message" maxLength={2000}
              value={draft} onChange={(event) => setDraft(event.target.value)}
            />
            <button type="submit" disabled={!activeRoomId || !draft.trim() || sending}>{sending ? "Sending..." : "Send"}</button>
          </form>
        </section>
      </div>
    </main>
  );
}
