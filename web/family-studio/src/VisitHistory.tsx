import { useState } from "react";
import { ConversationList } from "./ConversationList";
import { Icon } from "./Icons";
import { useDialog } from "./useDialog";
import type { Conversation, Workflow } from "./types";

export function VisitHistory({ chats, hole, onChat, onClose }: {
  chats: Conversation[]; hole: Workflow; onChat: (id: string) => void; onClose: () => void;
}) {
  const dialog = useDialog(true, onClose);
  const [query, setQuery] = useState("");
  const filtered = chats.filter(chat => chat.title.toLowerCase().includes(query.toLowerCase()));
  return <div className="modal-backdrop" onClick={onClose}>
    <section className="visit-dialog" data-theme={hole.theme || "custom"} ref={dialog}
      role="dialog" aria-modal="true" aria-label={`Your visits to ${hole.name}`} onClick={e => e.stopPropagation()}>
      <div className="section-heading"><div><p className="eyebrow">{hole.name}</p><h2>Your visits.</h2></div>
        <button className="icon-button" aria-label="Close visit history" onClick={onClose}><Icon name="close" /></button></div>
      <input className="history-search" aria-label="Search visits" placeholder="Find a conversation…" value={query} onChange={e => setQuery(e.target.value)} />
      <div className="history-scroll panel-scroll" tabIndex={0} role="region" aria-label="Saved visits">
        <ConversationList chats={filtered} holes={[hole]} onChat={onChat} />
      </div>
    </section>
  </div>;
}
