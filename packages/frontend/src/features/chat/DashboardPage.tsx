import { useEffect, useState } from "react";
import { listChatrooms, type ChatroomSummary } from "../../api/chatrooms.js";
import type { CurrentUser } from "../../api/auth.js";

type DashboardPageProps = {
  readonly user: CurrentUser;
  readonly onLogout: () => void;
  readonly loadChatrooms?: () => Promise<ChatroomSummary[]>;
};

export function DashboardPage({ user, onLogout, loadChatrooms = listChatrooms }: DashboardPageProps) {
  const [rooms, setRooms] = useState<ChatroomSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

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

  return (
    <main className="dashboard-shell">
      <header className="dashboard-header">
        <h1>Welcome to LF-Chat</h1>
        <h2 className="dashboard-header__user">{user.email}</h2>
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
              <button className="room-button" type="button" aria-pressed={room.id === selectedId} onClick={() => setSelectedId(room.id)}>
                <span>{room.chatroomName}</span><span className="room-button__count">{room.numberOfUsers}</span>
              </button>
            </li>)}
          </ul>}
        </aside>
        <section className="chat-panel" aria-labelledby="selected-room-heading">
          <h2 id="selected-room-heading">{selectedRoom?.chatroomName ?? "Select a chatroom"}</h2>
          <div className="message-region" aria-live="polite"><p>No messages yet.</p></div>
          <form className="message-composer" onSubmit={(event) => event.preventDefault()}>
            <input aria-label="Message" placeholder="Type a message" disabled />
            <button type="submit" disabled>Send</button>
          </form>
        </section>
      </div>
    </main>
  );
}
