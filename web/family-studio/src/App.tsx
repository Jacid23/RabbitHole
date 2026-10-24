import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import { Sidebar } from "./Sidebar";
import { ChatView } from "./ChatView";
import { CreateView } from "./CreateView";
import { LibraryView } from "./LibraryView";
import { AdminView } from "./AdminView";
import { Signin } from "./Signin";
import { Icon } from "./Icons";
import { MobileNav } from "./MobileNav";
import { LeaveTemporary } from "./LeaveTemporary";
import { VisitHistory } from "./VisitHistory";
import { HolePicker } from "./HolePicker";
import { ProfileAdmin } from "./ProfileAdmin";
import { useMobileViewport } from "./useMobileViewport";
import type { Bootstrap, Page, ChatAction } from "./types";
import "./style.css";
import "./wonderland.css";
import "./app-layout.css";
import "./world-themes.css";
import "./signin.css";
import "./opening.css";
import "./history.css";
export function App() {
  useMobileViewport();
  const [data, setData] = useState<Bootstrap | null>(null),
    [page, setPage] = useState<Page>("chat"),
    [holeId, setHoleId] = useState(""),
    [pickingHole, setPickingHole] = useState(false),
    [model, setModel] = useState(""),
    [conversation, setConversation] = useState(""),
    [chatReset, setChatReset] = useState(0),
    [temporary, setTemporary] = useState(false),
    [historyOpen, setHistoryOpen] = useState(false),
    [leaveAction, setLeaveAction] = useState<(() => void) | null>(null),
    [lastVisits, setLastVisits] = useState<Record<string, string>>({}),
    [initialPrompt, setInitialPrompt] = useState(""),
    [initialWorkflow, setInitialWorkflow] = useState(""),
    [menu, setMenu] = useState(false),
    [health, setHealth] = useState<{ online: boolean; checked: number } | null>(
      null,
    ),
    [loading, setLoading] = useState(true),
    [modeError, setModeError] = useState("");
  const refresh = useCallback(async (notBefore = 0) => {
    try {
      const [value] = await Promise.all([
        api<Bootstrap>("/api/bootstrap"),
        new Promise<void>((resolve) => {
          const remaining = notBefore - Date.now();
          if (remaining > 0) setTimeout(resolve, remaining);
          else resolve();
        }),
      ]);
      setData(value);
      setModel((current) =>
        value.models.some((m) => m.id === current)
          ? current
          : value.models.find((m) => m.id === "comfyui-studio")?.id ||
            value.models[0]?.id ||
            "",
      );
      return true;
    } catch {
      return false;
    }
  }, []);
  useEffect(() => {
    setHoleId("");
    setPickingHole(!!data);
    setConversation("");
    setTemporary(false);
    setLastVisits({});
    const first = data?.workflows[0];
    setPage(first?.opening?.screen === "create" ? "create" : "chat");
    setInitialPrompt(first?.opening?.screen === "create" ? first.opening.image_starters?.[0]?.prompt || "" : "");
    setInitialWorkflow(first?.id || "");
  }, [data?.user.id]);
  useEffect(() => {
    void refresh().finally(() => setLoading(false));
  }, [refresh]);
  useEffect(() => {
    if (!data) return;
    let alive = true;
    const ping = () =>
      api<{ online: boolean; checked: number }>("/api/health")
        .then((v) => {
          if (alive) setHealth(v);
        })
        .catch(() => {
          if (alive) setHealth({ online: false, checked: Date.now() / 1000 });
        });
    void ping();
    const timer = setInterval(ping, 15000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [data?.user.id]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenu(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  const create = (prompt: string, workflow?: string) => {
    setInitialPrompt(prompt);
    setInitialWorkflow(workflow || "");
    changePage("create");
  };
  const images = data?.images || [],
    workflows = data?.workflows || [];
  const hole =
    workflows.find((workflow) => workflow.id === holeId) || workflows[0];
  const holeImages = images.filter(
    (image) => !image.workflow || image.workflow === hole?.id,
  );
  const holeChats = (data?.chats || []).filter(
    (chat) =>
      chat.workflow === hole?.id ||
      (!chat.workflow && hole?.id === workflows[0]?.id),
  );
  const activeJob = data?.jobs.find(
    (job) =>
      ["queued", "running"].includes(job.state) && job.workflow === hole?.id,
  );
  const leaveTemporary = (action: () => void) => {
    if (temporary) { setHistoryOpen(false); setLeaveAction(() => action); }
    else action();
  };
  const newChat = (isTemporary = false) => leaveTemporary(() => {
    setConversation(""); setTemporary(isTemporary);
    if (hole) setLastVisits(v => ({ ...v, [hole.id]: "" }));
    setChatReset(v => v + 1); setPage("chat");
  });
  const openChat = (id: string) => {
    const chat = data?.chats.find(c => c.id === id);
    const target = workflows.find(w => w.id === chat?.workflow) || (!chat?.workflow ? workflows[0] : undefined);
    if (!chat || !target) return;
    leaveTemporary(() => {
      setHoleId(target.id); setConversation(id);
      setLastVisits(v => ({ ...v, [target.id]: id }));
      setTemporary(false); setChatReset(v => v + 1); setPage("chat");
      setPickingHole(false); setHistoryOpen(false);
    });
  };
  const changePage = (next: Page) => {
    if (next !== page && page === "chat" && temporary) leaveTemporary(() => {
      setTemporary(false); setConversation(""); setChatReset(v => v + 1); setPage(next);
    });
    else setPage(next);
  };
  const entrance = () => leaveTemporary(() => { setTemporary(false); setPickingHole(true); });
  const manageChat = async (id: string, action: ChatAction) => {
    await api(`/api/chats/${id}/${action}`, {});
    if (action === "trash") {
      setLastVisits(v => Object.fromEntries(Object.entries(v).filter(([, visit]) => visit !== id)));
      if (conversation === id) { setConversation(""); setChatReset(v => v + 1); }
    }
    if (!await refresh()) throw new Error("Change saved. Reopen history to refresh the list.");
  };
  const purgeChats = async (ids: string[]) => {
    await api("/api/chats/trash/purge", { ids, confirmed: true });
    if (!await refresh()) throw new Error("Conversations deleted. Refresh Rabbit Hole to reload history.");
  };
  const holeTrash = (data?.trashed_chats || []).filter(chat => chat.workflow === hole?.id || (!chat.workflow && hole?.id === workflows[0]?.id));
  if (!data)
    return (
      <Signin
        checking={loading}
        onSuccess={async (notBefore) => {
          if (!(await refresh(notBefore)))
            throw new Error(
              "Signed in, but your space could not load. Please retry.",
            );
        }}
      />
    );
  return (
    <>
      <a className="skip-link" href="#studio-main">
        Skip to content
      </a>
      <div
        className="app-shell"
        data-theme={hole?.theme || "custom"}
        inert={pickingHole || historyOpen || !!leaveAction || undefined}
      >
        <Sidebar
          page={page}
          onPage={changePage}
          chats={holeChats}
          onChat={(id) => id ? openChat(id) : newChat()}
          onEntrance={entrance}
          holes={workflows}
          activeChat={conversation}
          onAction={manageChat}
          user={data?.user}
          preview={false}
          onSignin={() => setData(null)}
          onLogout={async () => {
            await api("/api/auth/signout", {});
            setData(null);
            setConversation("");
            setPage("chat");
          }}
          open={menu}
          onClose={() => setMenu(false)}
        />
        <div className="studio-surface" inert={menu || undefined}>
          <header className="topbar">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMenu(true)}
            >
              <Icon name="menu" />
            </button>
            <button
              className="hole-switch"
              aria-label={`Change hole: ${hole?.name || "Pick a hole"}`}
              onClick={entrance}
            >
              <Icon name="key" size={16} />
              <span>{hole?.name || "Pick a hole"}</span>
              <small>Change hole</small>
            </button>
            <a
              className="mobile-brand"
              href="#chat"
              onClick={() => changePage("chat")}
              aria-label="Rabbit Hole home"
            >
              <img
                src="/assets/brand/android-chrome-192x192.png"
                alt=""
                width="32"
                height="32"
              />
              <span>
                Rabbit Hole<small>BY THE BASEMENT</small>
              </span>
            </a>
            <div className="topbar-right">
              {data?.user.is_admin && (
                <button
                  className={`view-mode ${data.user.user_mode ? "active" : ""}`}
                  aria-pressed={!!data.user.user_mode}
                  title="Preview the normal user interface with your own account's profile and access"
                  onClick={async () => {
                    try {
                      setModeError("");
                      await api("/api/auth/view", {
                        user_mode: !data.user.user_mode,
                      });
                      setPage("chat");
                      setConversation("");
                      await refresh();
                    } catch (err) {
                      setModeError((err as Error).message);
                    }
                  }}
                >
                  {data.user.user_mode ? "Return to admin" : "User mode"}
                </button>
              )}
              <span
                className={`server-health ${health?.online ? "online" : "offline"}`}
                title={
                  health
                    ? "Last checked " +
                      new Date(health.checked * 1000).toLocaleTimeString()
                    : "Checking image server"
                }
              >
                <i />
                {health
                  ? health.online
                    ? "Image server ready"
                    : "Image server offline"
                  : "Checking image server"}
              </span>
              {data && <span className="account-badge">{data.user.name}</span>}
            </div>
          </header>
          <main id="studio-main" className="main-scroll">
            {modeError && (
              <p className="error" role="alert">
                {modeError}
              </p>
            )}
            <>
              {page === "chat" && (
                <ChatView
                  key={`${hole?.id}-${chatReset}-${temporary}`}
                  model={hole?.chat_model || model}
                  workflow={hole?.id}
                  world={hole}
                  onModel={setModel}
                  conversation={conversation}
                  preview={false}
                  onSignin={() => setData(null)}
                  onSaved={() => void refresh()}
                  temporary={temporary}
                  onNewChat={newChat}
                  onHistory={() => setHistoryOpen(true)}
                  onConversation={(id) => { setConversation(id); void refresh(); if (hole) setLastVisits(v => ({ ...v, [hole.id]: id })); }}
                  onCreate={(prompt) => create(prompt, hole?.id)}
                />
              )}{" "}
              {page === "create" && (
                <CreateView
                  key={hole?.id}
                  model={hole?.chat_model || model}
                  workflows={hole ? [hole] : []}
                  images={holeImages}
                  initialPrompt={initialPrompt}
                  initialWorkflow={initialWorkflow}
                  preview={false}
                  onSignin={() => setData(null)}
                  onSaved={() => void refresh()}
                  activeJob={activeJob}
                />
              )}{" "}
              {page === "library" && (
                <LibraryView images={holeImages} onChanged={() => void refresh()} onCreate={create} />
              )}{" "}
              {page === "admin" && data?.user.role === "admin" && (
                <AdminView onSaved={() => void refresh()} />
              )}
              {page === "people" && data?.user.role === "admin" && (
                <ProfileAdmin onSaved={() => void refresh()} />
              )}
            </>
          </main>
          <MobileNav page={page} onPage={changePage} />
        </div>
      </div>
      {leaveAction && <LeaveTemporary onCancel={() => setLeaveAction(null)} onLeave={() => { leaveAction(); setLeaveAction(null); }} />}
      {historyOpen && !leaveAction && hole && <VisitHistory chats={holeChats} trashed={holeTrash} onAction={manageChat} onPurge={purgeChats} hole={hole} onChat={openChat} onClose={() => setHistoryOpen(false)} />}
      {pickingHole && (
        <HolePicker
          holes={workflows}
          selected={hole?.id}
          chats={data.chats}
          trashed={data.trashed_chats || []}
          onPurge={purgeChats}
          onAction={manageChat}
          onChat={openChat}
          onClose={() => setPickingHole(false)}
          onChoose={(id) => {
            const chosen = workflows.find((workflow) => workflow.id === id);
            setHoleId(id);
            setConversation(lastVisits[id] || "");
            setTemporary(false);
            setChatReset((value) => value + 1);
            setInitialPrompt(chosen?.opening?.screen === "create" ? chosen.opening.image_starters?.[0]?.prompt || "" : "");
            setInitialWorkflow(id);
            setPage(chosen?.opening?.screen === "create" ? "create" : "chat");
            setPickingHole(false);
          }}
        />
      )}
    </>
  );
}
