import { useEffect, useRef } from "react";
import type { Socket } from "socket.io-client";
import type { RoomUserCountUpdated } from "../../realtime/chat-events.types.js";

export type RoomUserCountUpdater = (chatroomId: string, numberOfUsers: number) => void;

export function useRoomUserCounts(
  socket: Socket | null, isConnected: boolean, onUpdate: RoomUserCountUpdater
) {
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    if (!socket || !isConnected) return;
    const receiveUserCount = (update: RoomUserCountUpdated) => {
      if (!Number.isInteger(update.numberOfUsers) || update.numberOfUsers < 0) return;
      onUpdateRef.current(update.chatroomId, update.numberOfUsers);
    };
    socket.on("roomUserCountUpdated", receiveUserCount);
    return () => { socket.off("roomUserCountUpdated", receiveUserCount); };
  }, [isConnected, socket]);
}
