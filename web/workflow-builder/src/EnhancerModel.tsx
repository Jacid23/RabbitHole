import { useEffect, useState } from "react";

export function EnhancerModel({ value, onChange, label = "Enhancer model" }: { value: string; onChange: (model: string) => void; label?: string }) {
  const [models, setModels] = useState<{ id: string; name: string }[]>([]);
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    if (!/^https?:$/.test(location.protocol)) return;
    const controller = new AbortController();
    fetch("/api/admin/workflows", { credentials: "same-origin", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) return;
        const result = await response.json();
        if (Array.isArray(result.models)) {
          setModels(result.models);
          setConnected(true);
        }
      }).catch(() => {});
    return () => controller.abort();
  }, []);
  return (
    <>
      <label>
        {label} <span className="optional">optional</span>
        {connected ? (
          <select value={value} onChange={(event) => onChange(event.target.value)}>
            <option value="">Use the selected chat model</option>
            {value && !models.some((model) => model.id === value) && <option value={value}>{value} (unavailable)</option>}
            {models.map((model) => <option key={model.id} value={model.id}>{model.name}</option>)}
          </select>
        ) : (
          <input value={value} maxLength={200} onChange={(event) => onChange(event.target.value.trim())} placeholder="Default: selected chat model" spellCheck={false} />
        )}
      </label>
      <p className="hint">{label === "Chat model" ? "Conversations use this model and your chat instructions." : "Enhance uses this model. Keep it blank to use this hole’s chat model."} Members need access to the chosen model in Open WebUI.{!connected && " Open this builder from Manage Rabbit Hole to load the model picker, or enter an exact model ID."}</p>
    </>
  );
}
