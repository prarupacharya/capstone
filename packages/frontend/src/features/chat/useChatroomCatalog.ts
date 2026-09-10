import { useEffect, useState } from "react";
import type { ChatroomSummary } from "../../api/chatrooms.js";

export type ChatroomCatalogStatus = "loading" | "ready" | "error";
export type ChatroomLoader = () => Promise<ChatroomSummary[]>;

export function isRoomMember(room: ChatroomSummary) {
  return room.isMember !== false;
}

export function useChatroomCatalog(loadChatrooms: ChatroomLoader) {
  const [rooms, setRooms] = useState<ChatroomSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [status, setStatus] = useState<ChatroomCatalogStatus>("loading");
  const [pendingRoomId, setPendingRoomId] = useState<string>();
  const [joinRequestId, setJoinRequestId] = useState<string>();

  useEffect(() => {
    let active = true;
    loadChatrooms()
      .then((loaded) => {
        if (!active) return;
        const nextRooms = Array.isArray(loaded) ? loaded : [];
        setRooms(nextRooms);
        setSelectedId((current) => nextRooms.some((room) => room.id === current && isRoomMember(room))
          ? current
          : nextRooms.find(isRoomMember)?.id);
        setStatus("ready");
      })
      .catch(() => active && setStatus("error"));
    return () => { active = false; };
  }, [loadChatrooms]);

  const selectedRoom = rooms.find((room) => room.id === selectedId);
  const pendingRoom = rooms.find((room) => room.id === pendingRoomId);
  const selectRoom = (room: ChatroomSummary) => {
    if (!isRoomMember(room)) {
      setPendingRoomId(room.id);
      return;
    }
    setJoinRequestId(undefined);
    setSelectedId(room.id);
  };
  const confirmJoin = () => {
    if (!pendingRoomId) return;
    setJoinRequestId(pendingRoomId);
    setPendingRoomId(undefined);
    setSelectedId(pendingRoomId);
  };
  const cancelJoin = () => setPendingRoomId(undefined);
  const clearJoinRequest = () => setJoinRequestId(undefined);
  const markJoined = (roomId: string) => setRooms((current) => current.map((room) =>
    room.id === roomId ? { ...room, isMember: true } : room
  ));
  const markLeft = (roomId: string) => setRooms((current) => current.map((room) =>
    room.id === roomId ? { ...room, isMember: false } : room
  ));
  const clearSelection = () => setSelectedId(undefined);
  const updateRoomUserCount = (roomId: string, numberOfUsers: number) => setRooms((current) => current.map((room) =>
    room.id === roomId ? { ...room, numberOfUsers } : room
  ));

  return {
    rooms, selectedId, selectedRoom, pendingRoom, status, joinRequestId,
    selectRoom, confirmJoin, cancelJoin, clearJoinRequest, markJoined, markLeft,
    clearSelection, updateRoomUserCount
  };
}
