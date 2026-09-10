import { useEffect, useState } from "react";
import type { Socket } from "socket.io-client";

export type ChatConnectionStatus = "connecting" | "connected" | "disconnected" | "unavailable";
export type ChatSocketFactory = () => Socket | null;

export function useChatSocket(createSocket: ChatSocketFactory) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ChatConnectionStatus>("connecting");

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
      setConnectionStatus("disconnected");
      setIsConnected(false);
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

  return { socket, isConnected, connectionStatus };
}
