import { HistoryPanel } from "./HistoryPanel";
import { Icon } from "./Icons";
import { useDialog } from "./useDialog";
import type { Conversation, ManageChat, Workflow } from "./types";

export function VisitHistory({ chats, trashed, hole, onChat, onClose, onAction }: {
  trashed: Conversation[]; onAction: ManageChat;
  chats: Conversation[]; hole: Workflow; onChat: (id: string) => void; onClose: () => void;
}) {
  const dialog = useDialog(true, onClose);
  return <div className="modal-backdrop" onClick={onClose}>
    <section className="visit-dialog" data-theme={hole.theme || "custom"} ref={dialog}
      role="dialog" aria-modal="true" aria-label={`Your visits to ${hole.name}`} onClick={e => e.stopPropagation()}>
      <div className="section-heading"><div><p className="eyebrow">{hole.name}</p><h2>Your visits.</h2></div>
        <button className="icon-button" aria-label="Close visit history" onClick={onClose}><Icon name="close" /></button></div>
      <HistoryPanel chats={chats} trashed={trashed} holes={[hole]} onChat={onChat} onAction={onAction} />
    </section>
  </div>;
}
