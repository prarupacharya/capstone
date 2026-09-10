import type { ChatroomSummary } from "../../api/chatrooms.js";

type ChatroomLoadStatus = "loading" | "ready" | "error";

export type ChatroomSidebarProps = {
  readonly rooms: readonly ChatroomSummary[];
  readonly status: ChatroomLoadStatus;
  readonly activeRoomId?: string;
  readonly disabled?: boolean;
  readonly isMember: (room: ChatroomSummary) => boolean;
  readonly onSelect: (room: ChatroomSummary) => void;
};

export function ChatroomSidebar({
  rooms, status, activeRoomId, disabled = false, isMember, onSelect
}: ChatroomSidebarProps) {
  return (
    <aside className="room-sidebar" aria-label="Chatrooms">
      <h2>Chatrooms</h2>
      {status === "loading" && <output>Loading chatrooms...</output>}
      {status === "error" && <p role="alert">Chatrooms could not be loaded. Please try again.</p>}
      {status === "ready" && rooms.length === 0 && <p>No chatrooms available.</p>}
      {status === "ready" && rooms.length > 0 && <ul className="room-list">
        {rooms.map((room) => <li key={room.id}>
          <button
            className="room-button" type="button" disabled={disabled}
            aria-pressed={room.id === activeRoomId} onClick={() => onSelect(room)}
          >
            <span>{room.chatroomName}</span>
            <span className="room-button__meta">
              <span className="room-button__count">{room.numberOfUsers}</span>
              <span className="room-button__status">{isMember(room) ? "Joined" : "Not joined"}</span>
            </span>
          </button>
        </li>)}
      </ul>}
    </aside>
  );
}
