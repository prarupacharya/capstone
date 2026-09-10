import type { FormEvent } from "react";

export type MessageComposerProps = {
  readonly draft: string;
  readonly sending: boolean;
  readonly active: boolean;
  readonly onDraftChange: (draft: string) => void;
  readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function MessageComposer({
  draft, sending, active, onDraftChange, onSubmit
}: MessageComposerProps) {
  return (
    <form className="message-composer" onSubmit={onSubmit}>
      <input
        aria-label="Message" placeholder="Type a message" maxLength={2000}
        value={draft} onChange={(event) => onDraftChange(event.target.value)}
      />
      <button type="submit" disabled={!active || !draft.trim() || sending}>
        {sending ? "Sending..." : "Send"}
      </button>
    </form>
  );
}
