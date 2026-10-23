import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { api, streamChat } from "./api";
import { Icon, StudioMark } from "./Icons";
import { WonderlandWelcome } from "./WonderlandWelcome";
import type { ChatMessage, Conversation, Workflow } from "./types";
export function ChatView({
  model,
  workflow,
  world,
  onModel,
  conversation,
  preview,
  onSignin,
  onSaved,
  onCreate,
}: {
  model: string;
  workflow?: string;
  world?: Workflow;
  onModel: (id: string) => void;
  conversation: string;
  preview: boolean;
  onSignin: () => void;
  onSaved: () => void;
  onCreate: (prompt: string) => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]),
    [id, setId] = useState(conversation),
    [prompt, setPrompt] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const abort = useRef<AbortController | null>(null),
    conversationPanel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    abort.current?.abort();
    setId(conversation);
    setMessages([]);
    setError("");
    if (conversation)
      api<Conversation>("/api/chats/" + conversation)
        .then((chat) => {
          setMessages(chat.messages);
          onModel(chat.model);
        })
        .catch((e) => setError(e.message));
    return () => abort.current?.abort();
  }, [conversation]);
  useEffect(() => {
    if (!messages.length) return;
    const panel = conversationPanel.current;
    panel?.scrollTo({
      top: panel.scrollHeight,
      behavior: busy || window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  }, [messages, busy]);
  async function send(text = prompt) {
    if (!text.trim()) return;
    if (preview) {
      onSignin();
      return;
    }
    if (!model) {
      setError("This hole needs a chat model assigned by your administrator.");
      return;
    }
    setPrompt("");
    setError("");
    setBusy(true);
    setMessages((v) => [
      ...v,
      ...(!v.length && world?.opening?.greeting ? [{ role: "assistant" as const, content: world.opening.greeting }] : []),
      { role: "user", content: text },
      { role: "assistant", content: "" },
    ]);
    abort.current = new AbortController();
    try {
      await streamChat(
        { model, workflow, message: text, conversation: id || null },
        (event) => {
          if (event.type === "conversation") setId(event.id!);
          if (event.type === "text")
            setMessages((v) =>
              v.map((m, i) =>
                i === v.length - 1
                  ? { ...m, content: m.content + event.text }
                  : m,
              ),
            );
          if (event.type === "error")
            setError(event.message || "The reply was interrupted.");
        },
        abort.current.signal,
      );
      onSaved();
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className={`chat-page ${messages.length ? "has-messages" : ""}`}>
      <div className="view-top">
        <div className="breadcrumb">
          Your space <span>/</span> Chat
        </div>

      </div>
      <div ref={conversationPanel} className="chat-content panel-scroll" role="region" aria-label="Conversation" tabIndex={0}>
        {!messages.length ? (
          <WonderlandWelcome onPrompt={setPrompt} onCreate={onCreate} world={world} />
        ) : (
          <div className="message-list" aria-live="polite">
            {messages.map((message, index) => (
              <article className={`message ${message.role}`} key={index}>
                <span className="message-avatar">
                  {message.role === "assistant" ? <StudioMark /> : "You"}
                </span>
                <div>
                  {message.content ? (
                    <ReactMarkdown
                      components={{
                        a: ({ children, href }) => (
                          <a
                            href={
                              href?.startsWith("https://") ||
                              href?.startsWith("http://")
                                ? href
                                : "#"
                            }
                            target="_blank"
                            rel="noreferrer"
                          >
                            {children}
                          </a>
                        ),
                        img: ({ src, alt }) =>
                          typeof src === "string" &&
                          src.startsWith("/api/v1/files/") ? (
                            <img src={src} alt={alt || "Generated image"} />
                          ) : null,
                      }}
                    >
                      {message.content}
                    </ReactMarkdown>
                  ) : busy ? (
                    <span
                      className="thinking-dots"
                      aria-label="Preparing a reply"
                    >
                      <i />
                      <i />
                      <i />
                    </span>
                  ) : (
                    <span className="control-hint">No answer received.</span>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
      <div className="chat-compose-wrap">
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <form
          className="chat-compose"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <textarea
            aria-label="Message"
            placeholder="What are you curious about?"
            value={prompt}
            rows={2}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (
                e.key === "Enter" &&
                !e.shiftKey &&
                !e.nativeEvent.isComposing
              ) {
                e.preventDefault();
                if (!busy) void send();
              }
            }}
          />
          <div className="compose-actions">
            <span>
              <Icon name="lock" size={12} />A conversation in your own space
            </span>
            {busy ? (
              <button
                className="send-button"
                aria-label="Stop reply"
                type="button"
                onClick={() => abort.current?.abort()}
              >
                <Icon name="stop" size={16} />
              </button>
            ) : (
              <button
                className="send-button"
                aria-label="Send message"
                disabled={!prompt.trim()}
              >
                <Icon name="arrow" size={19} />
              </button>
            )}
          </div>
        </form>
        <p className="compose-note">
          A helpful starting point. Always use your own judgment.
        </p>
      </div>
    </section>
  );
}
