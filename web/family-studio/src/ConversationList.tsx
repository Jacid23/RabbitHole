import { useState } from "react";
import { Icon } from "./Icons";
import type { ChatAction, Conversation, ManageChat, Workflow } from "./types";

export function ConversationList({ chats, holes, onChat, active, showWorld = false, onAction, onDeleteForever, trash = false }: {
  chats: Conversation[]; holes: Workflow[]; onChat: (id: string) => void;
  onDeleteForever?: (chat: Conversation) => void;
  active?: string; showWorld?: boolean; onAction?: ManageChat; trash?: boolean;
}) {
  const [busy, setBusy] = useState(""), [error, setError] = useState("");
  const sorted = [...chats].sort((a, b) => (b.updated || b.created) - (a.updated || a.created));
  async function act(id: string, action: ChatAction) {
    if (!onAction || busy) return;
    setBusy(id); setError("");
    try { await onAction(id, action); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(""); }
  }
  return <div className="conversation-list">
    {error && <p className="error" role="alert">{error}</p>}
    {sorted.map(chat => {
      const hole = holes.find(h => h.id === chat.workflow) || (!chat.workflow ? holes[0] : undefined);
      return <article key={chat.id} data-theme={hole?.theme || "custom"} className={`visit-row ${chat.id === active ? "current" : ""}`}>
        <button className="visit-open" disabled={trash} aria-current={chat.id === active ? "true" : undefined} onClick={() => onChat(chat.id)}>
          <span className="visit-icon"><Icon name={chat.locked ? "lock" : "chat"} size={17} /></span>
          <span className="visit-copy"><strong>{chat.title}</strong>
            <small>{showWorld && <span>{hole?.name || "Earlier conversation"} · </span>}
              <time dateTime={new Date((chat.updated || chat.created) * 1000).toISOString()}>
                {new Date((chat.updated || chat.created) * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </time>{chat.locked && <span> · Locked</span>}
            </small>
          </span>{!trash && <Icon name="arrow" size={15} />}
        </button>
        {onAction && <div className="visit-actions" aria-label={`Actions for ${chat.title}`}>
          {trash ? <>
            <button disabled={!!busy} onClick={() => void act(chat.id, "restore")} aria-label={`Restore ${chat.title}`}>Restore</button>
            {onDeleteForever && <button className="delete-visit" disabled={!!busy || chat.locked} onClick={() => onDeleteForever(chat)} aria-label={`Permanently delete ${chat.title}`}>Delete forever</button>}
          </> : <>
            <button disabled={!!busy} aria-pressed={!!chat.locked} onClick={() => void act(chat.id, chat.locked ? "unlock" : "lock")}
              aria-label={`${chat.locked ? "Unlock" : "Lock"} ${chat.title}`}>{chat.locked ? "Unlock" : "Lock"}</button>
            <button className="delete-visit" disabled={!!busy || chat.locked} title={chat.locked ? "Unlock before deleting" : "Move to recoverable trash"}
              onClick={() => void act(chat.id, "trash")} aria-label={`Delete ${chat.title}`}>Delete</button>
          </>}
        </div>}
      </article>;
    })}
    {!sorted.length && <p className="history-empty">{trash ? "No deleted conversations. You can restore deleted chats or erase them permanently here." : "Your saved conversations will appear here. Temporary chats leave no visit in history."}</p>}
  </div>;
}
