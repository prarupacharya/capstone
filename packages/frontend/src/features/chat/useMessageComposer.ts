import { useState, type FormEvent } from "react";
import type { Socket } from "socket.io-client";
import type { SendMessageAck } from "../../realtime/chat-events.types.js";

export function useMessageComposer(socket: Socket | null, isConnected: boolean, activeRoomId?: string) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string>();

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
  const clearError = () => setSendError(undefined);
  const reset = () => {
    setDraft("");
    setSending(false);
    setSendError(undefined);
  };

  return { draft, sending, sendError, onDraftChange: setDraft, handleSubmit, clearError, reset };
}
