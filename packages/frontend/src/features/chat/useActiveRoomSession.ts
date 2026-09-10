import { useEffect, useState } from "react";
import type { ChatroomSummary } from "../../api/chatrooms.js";
import type { Socket } from "socket.io-client";
import type { ChatHistoryMessage, JoinRoomAck, LeaveRoomAck } from "../../realtime/chat-events.types.js";
import { isRoomMember } from "./useChatroomCatalog.js";

export type ActiveRoomSessionActions = {
  clearFeed: () => void;
  replaceMessages: (messages: ChatHistoryMessage[]) => void;
  reset: () => void;
  clearError: () => void;
};

export type ActiveRoomSessionOptions = {
  readonly socket: Socket | null;
  readonly isConnected: boolean;
  readonly connectionStatus: string;
  readonly selectedId?: string;
  readonly selectedRoom?: ChatroomSummary;
  readonly joinRequestId?: string;
  readonly clearJoinRequest: () => void;
  readonly markJoined: (roomId: string) => void;
  readonly markLeft: (roomId: string) => void;
  readonly clearSelection: () => void;
  readonly actionsRef: { current: ActiveRoomSessionActions };
};

export function useActiveRoomSession({
  socket, isConnected, connectionStatus, selectedId, selectedRoom, joinRequestId,
  clearJoinRequest, markJoined, markLeft, clearSelection, actionsRef
}: ActiveRoomSessionOptions) {
  const [activeRoomId, setActiveRoomId] = useState<string>();
  const [roomError, setRoomError] = useState<string>();
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (connectionStatus !== "disconnected") return;
    setLeaving(false);
    setActiveRoomId(undefined);
    actionsRef.current.clearFeed();
    actionsRef.current.reset();
  }, [connectionStatus]);

  useEffect(() => {
    if (!socket || !isConnected || !selectedId) return;
    let active = true;
    if (!selectedRoom || !isRoomMember(selectedRoom) && joinRequestId !== selectedId) return;
    setRoomError(undefined);
    actionsRef.current.clearError();
    setActiveRoomId(undefined);
    actionsRef.current.clearFeed();

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
      actionsRef.current.replaceMessages(ack.data.messages);
    });
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
      actionsRef.current.clearFeed();
      actionsRef.current.reset();
    });
  };

  return { activeRoomId, roomError, leaving, leaveRoom };
}
