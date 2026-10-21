import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import { Sidebar } from "./Sidebar";
import { ChatView } from "./ChatView";
import { CreateView } from "./CreateView";
import { Gallery } from "./Gallery";
import { AdminView } from "./AdminView";
import { Signin } from "./Signin";
import { Icon } from "./Icons";
import { MobileNav } from "./MobileNav";
import { RabbitLoading } from "./RabbitLoading";
import { HolePicker } from "./HolePicker";
import { ProfileAdmin } from "./ProfileAdmin";
import { useMobileViewport } from "./useMobileViewport";
import type { Bootstrap, ImageItem, Page, Workflow } from "./types";
import "./style.css";
import "./wonderland.css";
import "./app-layout.css";
import "./world-themes.css";
export function App() {
  useMobileViewport();
  const [data, setData] = useState<Bootstrap | null>(null),
    [preview, setPreview] = useState<{
      images: ImageItem[];
      workflows: Workflow[];
    }>({ images: [], workflows: [] }),
    [page, setPage] = useState<Page>("chat"),
    [holeId, setHoleId] = useState(""),
    [pickingHole, setPickingHole] = useState(false),
    [model, setModel] = useState(""),
    [conversation, setConversation] = useState(""),
    [chatReset, setChatReset] = useState(0),
    [initialPrompt, setInitialPrompt] = useState(""),
    [initialWorkflow, setInitialWorkflow] = useState(""),
    [login, setLogin] = useState(false),
    [menu, setMenu] = useState(false),
    [health, setHealth] = useState<{ online: boolean; checked: number } | null>(
      null,
    ),
    [loading, setLoading] = useState(true),
    [modeError, setModeError] = useState("");
  const refresh = useCallback(async () => {
    try {
      const value = await api<Bootstrap>("/api/bootstrap");
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
    if (data && data.workflows.length > 1) setPickingHole(true);
  }, [data?.user.id]);
  useEffect(() => {
    void (async () => {
      if (!(await refresh()))
        try {
          setPreview(await api("/api/preview"));
        } catch {
          setPreview({ images: [], workflows: [] });
        }
      setLoading(false);
    })();
  }, [refresh]);
  useEffect(() => {
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
  }, []);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setLogin(false);
        setMenu(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  const create = (prompt: string, workflow?: string) => {
    setInitialPrompt(prompt);
    setInitialWorkflow(workflow || "");
    setPage("create");
  };
  const images = data?.images || preview.images,
    workflows = data?.workflows || preview.workflows;
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
  return (
    <>
      <a className="skip-link" href="#studio-main">
        Skip to content
      </a>
      <div
        className="app-shell"
        data-theme={hole?.theme || "custom"}
        inert={login || pickingHole ? true : undefined}
      >
        <Sidebar
          page={page}
          onPage={setPage}
          chats={holeChats}
          onChat={(id) => {
            setConversation(id);
            if (!id) setChatReset((value) => value + 1);
          }}
          user={data?.user}
          preview={!data}
          onSignin={() => setLogin(true)}
          onLogout={async () => {
            await api("/api/auth/signout", {});
            setData(null);
            setConversation("");
            setPage("chat");
            setLogin(true);
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
              onClick={() => setPickingHole(true)}
            >
              <Icon name="key" size={16} />
              <span>{hole?.name || "Pick a hole"}</span>
              <small>Change hole</small>
            </button>
            <a
              className="mobile-brand"
              href="#chat"
              onClick={() => setPage("chat")}
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
              {!data && (
                <button className="signin-top" onClick={() => setLogin(true)}>
                  Sign in
                  <Icon name="arrow" size={14} />
                </button>
              )}
              {data && <span className="account-badge">{data.user.name}</span>}
            </div>
          </header>
          <main id="studio-main" className="main-scroll">
            {modeError && (
              <p className="error" role="alert">
                {modeError}
              </p>
            )}
            {!data && !loading && (
              <div className="preview-banner">
                <span>
                  <Icon name="spark" size={14} />
                  Take a look around Rabbit Hole.
                </span>
                <button onClick={() => setLogin(true)}>
                  Sign in to create in your own space{" "}
                  <Icon name="arrow" size={13} />
                </button>
              </div>
            )}
            {loading ? (
              <RabbitLoading />
            ) : (
              <>
                {page === "chat" && (
                  <ChatView
                    key={`${hole?.id}-${chatReset}`}
                    model={hole?.chat_model || model}
                    workflow={hole?.id}
                    world={hole}
                    onModel={setModel}
                    conversation={conversation}
                    preview={!data}
                    onSignin={() => setLogin(true)}
                    onSaved={() => void refresh()}
                    onCreate={(prompt) => create(prompt)}
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
                    preview={!data}
                    onSignin={() => setLogin(true)}
                    onSaved={() => void refresh()}
                    activeJob={activeJob}
                  />
                )}{" "}
                {page === "library" && (
                  <section className="library-page">
                    <div className="view-top">
                      <div className="breadcrumb">
                        Your space <span>/</span> My library
                      </div>
                      <span className="page-tag">
                        <Icon name="lock" size={12} />
                        YOUR PERSONAL COLLECTION
                      </span>
                    </div>
                    <div className="library-heading">
                      <p className="eyebrow">CURIOSITIES WORTH KEEPING</p>
                      <h1>
                        Your cabinet <em>of curiosities.</em>
                      </h1>
                      <p>The wonderful things you found along the way.</p>
                    </div>
                    <div
                      className="library-results panel-scroll"
                      role="region"
                      aria-label="Image library"
                      tabIndex={0}
                    >
                      <Gallery
                        images={holeImages}
                        preview={!data}
                        onChanged={() => void refresh()}
                        onReuse={(image) =>
                          create(image.prompt, image.workflow)
                        }
                      />
                    </div>
                  </section>
                )}{" "}
                {page === "admin" && data?.user.role === "admin" && (
                  <AdminView onSaved={() => void refresh()} />
                )}
                {page === "people" && data?.user.role === "admin" && (
                  <ProfileAdmin onSaved={() => void refresh()} />
                )}
              </>
            )}
          </main>
          <MobileNav page={page} onPage={setPage} />
        </div>
      </div>
      {login && (
        <Signin
          onClose={() => setLogin(false)}
          onSuccess={async () => {
            if (await refresh()) {
              setLogin(false);
            } else {
              throw new Error(
                "Signed in, but your models and workflows could not load. Try again.",
              );
            }
          }}
        />
      )}
      {pickingHole && (
        <HolePicker
          holes={workflows}
          selected={hole?.id}
          onClose={() => setPickingHole(false)}
          onChoose={(id) => {
            setHoleId(id);
            setConversation("");
            setInitialPrompt("");
            setInitialWorkflow(id);
            setPage("chat");
            setPickingHole(false);
          }}
        />
      )}
    </>
  );
}
