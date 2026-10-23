import { useEffect, useRef, useState, type ReactNode } from "react";
import { api } from "./api";
import { Icon } from "./Icons";

export function ImagePrompt({ prompt, onPrompt, model, workflow, running, canGenerate, preview, onSignin, onGenerate, children, ideas = [] }: {
  prompt: string;
  onPrompt: (text: string) => void;
  model: string;
  workflow?: string;
  running: boolean;
  canGenerate: boolean;
  preview: boolean;
  onSignin: () => void;
  onGenerate: () => void;
  children?: ReactNode;
  ideas?: string[];
}) {
  const [enhancing, setEnhancing] = useState(false),
    [history, setHistory] = useState<string[]>([]),
    [notice, setNotice] = useState(""),
    [error, setError] = useState("");
  const request = useRef<AbortController | null>(null),
    editor = useRef<HTMLTextAreaElement>(null),
    currentPrompt = useRef(prompt);
  currentPrompt.current = prompt;
  useEffect(() => () => request.current?.abort(), []);

  async function enhance() {
    if (preview) { onSignin(); return; }
    if (enhancing || !prompt.trim() || !model) return;
    const original = prompt;
    const controller = new AbortController();
    request.current = controller;
    setEnhancing(true);
    setError("");
    setNotice("");
    try {
      const result = await api<{ prompt: string }>("/api/prompts/enhance", { model, workflow, prompt: original }, controller.signal);
      if (currentPrompt.current !== original) {
        setNotice("Your idea changed while enhancing. Enhance again to use your latest text.");
        return;
      }
      setHistory((previous) => [...previous.slice(-9), original]);
      onPrompt(result.prompt);
      setNotice("Enhanced. Edit it, enhance again, or create when you’re ready.");
    } catch (err) {
      if (!controller.signal.aborted) setError((err as Error).message);
    } finally {
      if (!controller.signal.aborted) {
        setEnhancing(false);
        requestAnimationFrame(() => editor.current?.focus());
      }
    }
  }

  return (
    <form className={`image-prompt ${history.length ? "has-enhanced-prompt" : ""}`} onSubmit={(event) => { event.preventDefault(); if (!enhancing) onGenerate(); }}>
      <label htmlFor="image-prompt">Your idea</label>
      <textarea
        ref={editor}
        id="image-prompt"
        placeholder="A tea party in the clouds, a moonlit mushroom forest…"
        rows={4}
        value={prompt}
        onChange={(event) => { onPrompt(event.target.value); setNotice(""); }}
        maxLength={12000}
        readOnly={enhancing}
        aria-busy={enhancing}
      />
      <div className="image-prompt-bottom">
        <button type="button" className="text-button enhance-prompt" disabled={!prompt.trim() || enhancing || (!model && !preview)} onClick={() => void enhance()} title="Refine this idea with this workspace’s enhancer model">
          <Icon name="spark" size={15} />{enhancing ? "Enhancing…" : "Enhance"}
        </button>
        <div className="prompt-edit-actions">
          {history.length > 0 && <button type="button" className="text-button" disabled={enhancing} onClick={() => {
            onPrompt(history[history.length - 1]);
            setHistory((previous) => previous.slice(0, -1));
            setNotice("Previous prompt restored.");
            setError("");
            editor.current?.focus();
          }}>Undo enhance</button>}
          <button type="button" className="text-button" disabled={enhancing || running} onClick={() => { onPrompt(ideas.length ? ideas[Math.floor(Math.random() * ideas.length)] : "A small wooden cabin floating above the clouds, warm window light, whimsical illustrated style."); setNotice(""); }}>Try an idea</button>
        </div>
      </div>
      <div className="prompt-feedback" aria-live="polite">
        {enhancing ? <span role="status">Refining your idea…</span> : error ? <span className="prompt-error" role="alert">{error}</span> : notice || "Enhance first, or send your idea as it is."}
      </div>
      {children}
      <button className="primary generate-button" disabled={!prompt.trim() || running || enhancing || !canGenerate}>
        <Icon name="spark" size={17} />
        {running ? "Creating your image…" : preview ? "Sign in to create" : "Create image"}
        <Icon name="arrow" size={17} />
      </button>
    </form>
  );
}
