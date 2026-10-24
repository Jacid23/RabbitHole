import { useState } from "react";
import { ConversationList } from "./ConversationList";
import type { Conversation, ManageChat, Workflow } from "./types";

export function HistoryPanel({ chats, trashed, holes, onChat, onAction, showWorld = false }: {
  chats: Conversation[]; trashed: Conversation[]; holes: Workflow[];
  onChat: (id: string) => void; onAction: ManageChat; showWorld?: boolean;
}) {
  const [trash, setTrash] = useState(false), [query, setQuery] = useState("");
  const filtered = (trash ? trashed : chats).filter(chat => {
    const hole = holes.find(h => h.id === chat.workflow) || (!chat.workflow ? holes[0] : undefined);
    return hole && (chat.title + " " + hole.name).toLowerCase().includes(query.toLowerCase());
  });
  return <div className="history-panel">
    <div className="history-tabs" role="group" aria-label="Conversation folders">
      <button aria-pressed={!trash} onClick={() => setTrash(false)}>Saved chats <span>{chats.length}</span></button>
      <button aria-pressed={trash} onClick={() => setTrash(true)}>Trash <span>{trashed.length}</span></button>
    </div>
    <input className="history-search" aria-label={showWorld ? "Search all conversations" : "Search visits"} placeholder="Find a conversation…" value={query} onChange={e => setQuery(e.target.value)} />
    <div className="history-scroll panel-scroll" tabIndex={0} role="region" aria-label={trash ? "Deleted conversations" : "Saved visits"}>
      <ConversationList key={trash ? "trash" : "saved"} chats={filtered} holes={holes} showWorld={showWorld} onChat={onChat} onAction={onAction} trash={trash} />
    </div>
  </div>;
}
