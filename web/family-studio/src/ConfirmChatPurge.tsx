import { useEffect, useRef, useState } from "react";

export function ConfirmChatPurge({ ids, title, onConfirm, onCancel }: {
  ids: string[]; title?: string; onConfirm: (ids: string[]) => Promise<void>; onCancel: () => void;
}) {
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const cancel = useRef<HTMLButtonElement>(null);
  useEffect(() => { cancel.current?.focus(); }, []);
  return <section className="purge-confirmation" aria-labelledby="purge-title">
    <p className="eyebrow">PERMANENT DELETION</p>
    <h3 id="purge-title">{title ? "Delete this chat forever?" : "Empty this Trash?"}</h3>
    <p>{title ? <>“{title}” and its messages will be permanently deleted.</> : <>{ids.length} trashed {ids.length === 1 ? "conversation" : "conversations"} in this history view will be permanently deleted.</>} You can’t restore {ids.length === 1 ? "it" : "them"} afterward.</p>
    <p className="control-hint">Saved chats outside Trash and images in your library stay untouched.</p>
    {error && <p className="error" role="alert">{error}</p>}
    <div className="purge-buttons">
      <button ref={cancel} className="secondary" disabled={busy} onClick={onCancel}>Cancel</button>
      <button className="purge-danger" disabled={busy} onClick={async () => {
        setBusy(true); setError("");
        try { await onConfirm(ids); onCancel(); }
        catch (e) { setError((e as Error).message); }
        finally { setBusy(false); }
      }}>{busy ? "Deleting…" : title ? "Delete forever" : "Permanently empty Trash"}</button>
    </div>
  </section>;
}
