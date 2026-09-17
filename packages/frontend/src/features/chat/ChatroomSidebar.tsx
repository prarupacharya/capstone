import { useState, type FormEvent } from "react";
import { ApiError } from "../../api/api-error.js";
import type { ChatroomSummary, CreateChatroomInput } from "../../api/chatrooms.js";

type ChatroomLoadStatus = "loading" | "ready" | "error";

export type ChatroomSidebarProps = {
  readonly rooms: readonly ChatroomSummary[];
  readonly status: ChatroomLoadStatus;
  readonly activeRoomId?: string;
  readonly disabled?: boolean;
  readonly isMember: (room: ChatroomSummary) => boolean;
  readonly onSelect: (room: ChatroomSummary) => void;
  readonly onCreateRoom: (input: CreateChatroomInput) => Promise<ChatroomSummary>;
};

function getCreateErrorMessage(error: unknown) {
  if (error instanceof ApiError && error.messages.length) return error.messages.join(". ");
  return "Chatroom could not be created. Please try again.";
}

export function ChatroomSidebar({
  rooms, status, activeRoomId, disabled = false, isMember, onSelect, onCreateRoom
}: ChatroomSidebarProps) {
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string>();

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled || creating) return;

    const chatroomName = name.trim();
    if (!chatroomName) {
      setCreateError("Enter a chatroom name.");
      return;
    }
    if (chatroomName.length > 100) {
      setCreateError("Chatroom names must be 100 characters or fewer.");
      return;
    }

    setCreating(true);
    setCreateError(undefined);
    try {
      await onCreateRoom({ chatroomName });
      setName("");
    } catch (error) {
      setCreateError(getCreateErrorMessage(error));
    } finally {
      setCreating(false);
    }
  }

  return (
    <aside className="room-sidebar" aria-label="Chatrooms">
      <h2>Chatrooms</h2>
      <form className="create-room-form" aria-label="Create chatroom" onSubmit={handleCreate}>
        <label htmlFor="create-chatroom-name">New chatroom</label>
        <input id="create-chatroom-name" value={name} maxLength={100}
          onChange={(event) => setName(event.target.value)} disabled={disabled || creating} />
        <button type="submit" disabled={disabled || creating}>
          {creating ? "Creating..." : "Create chatroom"}
        </button>
        {createError && <p role="alert">{createError}</p>}
      </form>
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
