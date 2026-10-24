import { Icon } from "./Icons";
import type { Conversation, Workflow } from "./types";

export function ConversationList({ chats, holes, onChat, active, showWorld = false }: {
  chats: Conversation[]; holes: Workflow[]; onChat: (id: string) => void;
  active?: string; showWorld?: boolean;
}) {
  const sorted = [...chats].sort((a, b) => (b.updated || b.created) - (a.updated || a.created));
  return <div className="conversation-list">
    {sorted.map(chat => {
      const hole = holes.find(h => h.id === chat.workflow) || (!chat.workflow ? holes[0] : undefined);
      return <button key={chat.id} data-theme={hole?.theme || "custom"}
        aria-current={chat.id === active ? "true" : undefined} onClick={() => onChat(chat.id)}>
        <span className="visit-icon"><Icon name="chat" size={17} /></span>
        <span className="visit-copy"><strong>{chat.title}</strong>
          <small>{showWorld && <span>{hole?.name || "Earlier conversation"} · </span>}
            <time dateTime={new Date((chat.updated || chat.created) * 1000).toISOString()}>
              {new Date((chat.updated || chat.created) * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </time>
          </small>
        </span><Icon name="arrow" size={15} />
      </button>;
    })}
    {!sorted.length && <p className="history-empty">Your saved conversations will appear here.<br />Temporary chats leave no visit in history.</p>}
  </div>;
}
