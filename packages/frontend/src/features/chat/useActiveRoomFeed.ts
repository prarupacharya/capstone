import { useEffect, useState } from "react";
import type { Socket } from "socket.io-client";
import type { ChatHistoryMessage, RoomNotification } from "../../realtime/chat-events.types.js";

export function useActiveRoomFeed(
  socket: Socket | null, isConnected: boolean, activeRoomId?: string
) {
  const [messages, setMessages] = useState<ChatHistoryMessage[]>([]);
  const [notifications, setNotifications] = useState<RoomNotification[]>([]);

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

  const replaceMessages = (history: ChatHistoryMessage[]) => setMessages(history);
  const clearFeed = () => {
    setMessages([]);
    setNotifications([]);
  };

  return { messages, notifications, replaceMessages, clearFeed };
}
