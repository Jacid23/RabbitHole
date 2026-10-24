import { useEffect, useRef, useState } from "react";
import { ConversationList } from "./ConversationList";
import { ConfirmChatPurge } from "./ConfirmChatPurge";
import type { Conversation, ManageChat, PurgeChats, Workflow } from "./types";

export function HistoryPanel({ chats, trashed, holes, onChat, onAction, onPurge, showWorld = false }: {
  chats: Conversation[]; trashed: Conversation[]; holes: Workflow[];
  onChat: (id: string) => void; onAction: ManageChat; onPurge: PurgeChats; showWorld?: boolean;
}) {
  const [trash, setTrash] = useState(false), [query, setQuery] = useState("");
  const [pending, setPending] = useState<{ ids: string[]; title?: string } | null>(null);
  const folders = useRef<HTMLDivElement>(null), wasConfirming = useRef(false);
  useEffect(() => {
    if (!pending && wasConfirming.current)
      folders.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus({ preventScroll: true });
    wasConfirming.current = !!pending;
  }, [pending]);
  const filtered = (trash ? trashed : chats).filter(chat => {
    const hole = holes.find(h => h.id === chat.workflow) || (!chat.workflow ? holes[0] : undefined);
    return hole && (chat.title + " " + hole.name).toLowerCase().includes(query.toLowerCase());
  });
  if (pending) return <div className="history-panel history-scroll panel-scroll">
    <ConfirmChatPurge ids={pending.ids} title={pending.title} onConfirm={onPurge} onCancel={() => setPending(null)} />
  </div>;
  return <div className="history-panel">
    <div ref={folders} className="history-tabs" role="group" aria-label="Conversation folders">
      <button aria-pressed={!trash} onClick={() => setTrash(false)}>Saved chats <span>{chats.length}</span></button>
      <button aria-pressed={trash} onClick={() => setTrash(true)}>Trash <span>{trashed.length}</span></button>
      {trash && !!trashed.length && <button className="empty-trash" onClick={() => setPending({ ids: trashed.map(chat => chat.id) })}>Empty Trash</button>}
    </div>
    <input className="history-search" aria-label={showWorld ? "Search all conversations" : "Search visits"} placeholder="Find a conversation…" value={query} onChange={e => setQuery(e.target.value)} />
    <div className="history-scroll panel-scroll" tabIndex={0} role="region" aria-label={trash ? "Deleted conversations" : "Saved visits"}>
      <ConversationList key={trash ? "trash" : "saved"} chats={filtered} holes={holes} showWorld={showWorld} onChat={onChat} onAction={onAction} trash={trash}
        onDeleteForever={chat => setPending({ ids: [chat.id], title: chat.title })} />
    </div>
  </div>;
}
