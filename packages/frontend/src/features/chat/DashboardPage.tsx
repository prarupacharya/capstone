import { useEffect, useState, type FormEvent } from "react";
import { listChatrooms, type ChatroomSummary } from "../../api/chatrooms.js";
import type { CurrentUser } from "../../api/auth.js";
import { createChatSocket } from "../../realtime/chat-socket.js";
import type { JoinRoomAck, LeaveRoomAck, SendMessageAck } from "../../realtime/chat-events.types.js";
import type { Socket } from "socket.io-client";
import { ChatMessageFeed } from "./ChatMessageFeed.js";
import { MessageComposer } from "./MessageComposer.js";
import { ChatroomSidebar } from "./ChatroomSidebar.js";
import { useChatSocket } from "./useChatSocket.js";
import { isRoomMember, useChatroomCatalog } from "./useChatroomCatalog.js";
import { useActiveRoomFeed } from "./useActiveRoomFeed.js";
import { useRoomUserCounts } from "./useRoomUserCounts.js";

type DashboardPageProps = {
  readonly user: CurrentUser;
  readonly onLogout: () => void;
  readonly loadChatrooms?: () => Promise<ChatroomSummary[]>;
  readonly createSocket?: () => Socket | null;
};

export function DashboardPage({
  user, onLogout, loadChatrooms = listChatrooms, createSocket = createChatSocket
}: DashboardPageProps) {
  const [activeRoomId, setActiveRoomId] = useState<string>();
  const [roomError, setRoomError] = useState<string>();
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [sendError, setSendError] = useState<string>();
  const {
    rooms, selectedId, selectedRoom, pendingRoom, status, joinRequestId,
    selectRoom, confirmJoin, cancelJoin, clearJoinRequest, markJoined, markLeft,
    clearSelection, updateRoomUserCount
  } = useChatroomCatalog(loadChatrooms);
  const { socket, isConnected, connectionStatus } = useChatSocket(createSocket);
  useRoomUserCounts(socket, isConnected, updateRoomUserCount);
  const { messages, notifications, replaceMessages, clearFeed } = useActiveRoomFeed(socket, isConnected, activeRoomId);

  useEffect(() => {
    if (connectionStatus !== "disconnected") return;
    setLeaving(false);
    setActiveRoomId(undefined);
    clearFeed();
  }, [connectionStatus]);

  useEffect(() => {
    if (!socket || !isConnected || !selectedId) return;
    let active = true;
    if (!selectedRoom || !isRoomMember(selectedRoom) && joinRequestId !== selectedId) return;
    setRoomError(undefined);
    setSendError(undefined);
    setActiveRoomId(undefined);
    clearFeed();

    const join = () => {
      socket.emit("joinRoom", { chatroomId: selectedId }, (ack: JoinRoomAck) => {
        if (!active) return;
        if (!ack.ok) {
          clearJoinRequest();
          setRoomError(ack.error.message);
          return;
        }
        if (ack.data.chatroomId !== selectedId) return;
        clearJoinRequest();
        markJoined(selectedId);
        setActiveRoomId(selectedId);
        replaceMessages(ack.data.messages);
      });
    };

    join();

    return () => { active = false; };
  }, [isConnected, selectedId, socket]);

  const leaveRoom = () => {
    const chatroomId = activeRoomId;
    if (!socket || !isConnected || !chatroomId || selectedRoom?.id !== chatroomId ||
      !isRoomMember(selectedRoom) || leaving) return;
    setLeaving(true);
    setRoomError(undefined);
    socket.emit("leaveRoom", { chatroomId }, (ack: LeaveRoomAck) => {
      setLeaving(false);
      if (!ack.ok) {
        setRoomError(ack.error.message);
        return;
      }
      if (ack.data.chatroomId !== chatroomId) return;
      markLeft(chatroomId);
      clearSelection();
      setActiveRoomId(undefined);
      clearFeed();
      setDraft("");
      setSendError(undefined);
    });
  };
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
        <output className="connection-status">Chat: {connectionStatus}</output>
        <button className="auth-secondary-button" type="button" onClick={onLogout}>Log out</button>
      </header>
      <div className="dashboard-layout">
        <ChatroomSidebar
          rooms={rooms} status={status} activeRoomId={activeRoomId} disabled={leaving}
          isMember={isRoomMember} onSelect={selectRoom}
        />
        <section className="chat-panel" aria-labelledby="selected-room-heading">
          <div className="chat-panel__header">
            <h2 id="selected-room-heading">{selectedRoom && selectedRoom.id === activeRoomId ? selectedRoom.chatroomName : "Select a chatroom"}</h2>
            {selectedRoom && selectedRoom.id === activeRoomId && isRoomMember(selectedRoom) && <button
              className="leave-chatroom-button" type="button" disabled={leaving} onClick={leaveRoom}
            >{leaving ? "Leaving..." : "Leave chatroom"}</button>}
          </div>
          {roomError && <p role="alert">{roomError}</p>}
          <ChatMessageFeed messages={messages} notifications={notifications} />
          {sendError && <p role="alert">{sendError}</p>}
          <MessageComposer
            draft={draft} sending={sending} active={Boolean(activeRoomId)}
            onDraftChange={setDraft} onSubmit={handleSubmit}
          />
        </section>
      </div>
      {pendingRoom && <div className="join-dialog-backdrop">
        <dialog className="join-dialog" open aria-labelledby="join-room-heading" aria-describedby="join-room-description">
          <h2 id="join-room-heading">Join {pendingRoom.chatroomName}?</h2>
          <p id="join-room-description">Join this group chat to view and send messages.</p>
          <div className="join-dialog__actions">
            <button className="auth-secondary-button" type="button" onClick={cancelJoin}>Cancel</button>
            <button type="button" onClick={confirmJoin}>Join chatroom</button>
          </div>
        </dialog>
      </div>}
    </main>
  );
}
