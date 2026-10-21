import { Icon, StudioMark } from "./Icons";
import type { Conversation, Page, User } from "./types";
import { useDialog } from "./useDialog";
const tabs: { page: Page; icon: string; label: string }[] = [
  { page: "chat", icon: "chat", label: "Chat" },
  { page: "create", icon: "image", label: "Create image" },
  { page: "library", icon: "grid", label: "My library" },
];
export function Sidebar({
  page,
  onPage,
  chats,
  onChat,
  user,
  preview,
  onSignin,
  onLogout,
  open,
  onClose,
}: {
  page: Page;
  onPage: (page: Page) => void;
  chats: Conversation[];
  onChat: (id: string) => void;
  user?: User;
  preview: boolean;
  onSignin: () => void;
  onLogout: () => void;
  open: boolean;
  onClose: () => void;
}) {
  const navigation = useDialog(open, onClose);
  return (
    <>
      <button
        className={`sidebar-scrim ${open ? "visible" : ""}`}
        aria-label="Close navigation"
        onClick={onClose}
      />
      <aside
        ref={navigation}
        className={`sidebar ${open ? "open" : ""}`}
        role={open ? "dialog" : undefined}
        aria-modal={open || undefined}
        aria-label="Rabbit Hole navigation"
      >
        <a
          className="brand"
          href="#chat"
          aria-label="Rabbit Hole by The Basement"
          onClick={() => onPage("chat")}
        >
          <StudioMark />
          <span className="brand-name">
            Rabbit<span className="brand-light">Hole</span>
            <small>BY THE BASEMENT</small>
          </span>
        </a>
        <p className="sidebar-caption">WE’RE ALL CURIOUS HERE</p>
        <button
          className="new-chat"
          onClick={() => {
            onPage("chat");
            onChat("");
            onClose();
          }}
        >
          <Icon name="plus" size={17} />
          New conversation
        </button>
        <nav aria-label="Main navigation">
          {tabs.map((tab) => (
            <button
              className={`nav-item ${page === tab.page ? "active" : ""}`}
              key={tab.page}
              aria-current={page === tab.page ? "page" : undefined}
              onClick={() => {
                onPage(tab.page);
                onClose();
              }}
            >
              <Icon name={tab.icon} />
              {tab.label}
              {tab.page === "create" && <span className="nav-accent">NEW</span>}
            </button>
          ))}
        </nav>
        <div className="recent">
          <div className="section-label">TRAILS YOU’VE FOLLOWED</div>
          {chats.slice(0, 10).map((chat) => (
            <button
              key={chat.id}
              onClick={() => {
                onPage("chat");
                onChat(chat.id);
                onClose();
              }}
              title={chat.title}
            >
              <Icon name="chat" size={14} />
              <span>{chat.title}</span>
            </button>
          ))}
          {!chats.length && (
            <p>
              Your conversations will feel
              <br />
              right at home here.
            </p>
          )}
        </div>
        <div className="sidebar-bottom">
          <div className="privacy-note">
            <Icon name="lock" size={14} />
            <span>Your account. Your space.</span>
          </div>
          {user?.role === "admin" && (
            <button className="nav-item" onClick={() => { onPage("people"); onClose(); }}><Icon name="book" size={17} />User profiles</button>
          )}
          {user?.role === "admin" && (
            <button
              className="nav-item admin-nav"
              onClick={() => {
                onPage("admin");
                onClose();
              }}
            >
              <Icon name="settings" size={17} />
              Manage Rabbit Hole
            </button>
          )}
          <button
            className="profile"
            onClick={() => {
              onClose();
              (preview ? onSignin : onLogout)();
            }}
          >
            <span className="avatar">{user?.name?.slice(0, 1) || "B"}</span>
            <span>
              <strong>{user?.name || "Welcome home"}</strong>
              <small>
                {preview ? "Sign in to your space" : "Sign out of Rabbit Hole"}
              </small>
            </span>
            <Icon name={preview ? "arrow" : "logout"} size={16} />
          </button>
        </div>
      </aside>
    </>
  );
}
