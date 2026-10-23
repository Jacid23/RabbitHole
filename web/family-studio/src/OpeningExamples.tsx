import { useEffect, useRef, useState } from "react";
import type { OpeningExample } from "./types";

export function OpeningExamples({ value, onChange, uploadEnabled = false }: {
  value: OpeningExample[];
  onChange: (value: OpeningExample[]) => void;
  uploadEnabled?: boolean;
}) {
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function upload(file: File) {
    setBusy(true); setError("");
    const active = new AbortController(); controller.current = active;
    try {
      const response = await fetch("/api/admin/opening-images", { method: "POST", body: file, signal: active.signal });
      const result = await response.json();
      if (!response.ok) throw Error(result.error || "Could not add this image.");
      if (!active.signal.aborted) onChange([...value, { image: result.image, label: file.name.replace(/\.[^.]+$/, "").slice(0,70), chat: "", prompt: "" }]);
    } catch (err) { if (!active.signal.aborted) setError((err as Error).message); }
    finally { if (!active.signal.aborted) setBusy(false); }
  }
  const patch = (index: number, change: Partial<OpeningExample>) => onChange(value.map((example, i) => i === index ? { ...example, ...change } : example));
  return (
    <div className="opening-examples-editor">
      <strong>Random themed postcards</strong>
      <p className="control-hint">One saved image and its matching chat idea appear on entry. No model call or image generation runs on entry.</p>
      {value.map((example, index) => (
        <div className="opening-idea-editor" key={example.image}>
          {uploadEnabled && <img className="opening-example-thumb" src={`/api/admin/opening-images/${example.image}`} alt={example.label} width={240} height={135} />}
          <label>Scene title<input value={example.label} maxLength={70} disabled={busy} onChange={(event) => patch(index, { label: event.target.value })} /></label>
          <label>Matching chat idea<textarea rows={2} maxLength={500} value={example.chat} disabled={busy} onChange={(event) => patch(index, { chat: event.target.value })} placeholder="What could the user ask your character about this scene?" /></label>
          <label>Matching image idea<textarea rows={3} maxLength={12000} value={example.prompt} disabled={busy} onChange={(event) => patch(index, { prompt: event.target.value })} placeholder="The editable prompt for making a new image from this idea." /></label>
          <button type="button" className="text-button" disabled={busy} onClick={() => onChange(value.filter((_, i) => i !== index))}>Remove postcard</button>
        </div>
      ))}
      {uploadEnabled ? <label className="opening-example-upload">{busy ? "Adding image…" : "Add a postcard image"}
        <input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy || value.length >= 12} onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); event.target.value = ""; }} />
      </label> : <p className="control-hint">Import this recipe in Manage Rabbit Hole to add the postcard images. Existing postcards stay in the recipe.</p>}
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  );
}
