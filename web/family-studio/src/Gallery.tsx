import { useEffect, useState } from "react";
import { api } from "./api";
import {useDialog} from './useDialog';
import { Icon } from "./Icons";
import type { ImageItem } from "./types";
export function imageUrl(image: ImageItem) {
  return image.url || "/api/media/" + image.id;
}
export function Gallery({
  images,
  onReuse,
  preview = false,
  onSelect,
  onChanged,
}: {
  images: ImageItem[];
  onReuse: (image: ImageItem) => void;
  preview?: boolean;
  onSelect?: (image: ImageItem) => void;
  onChanged?: () => void;
}) {
  const [selected, setSelected] = useState<ImageItem | null>(null),
    [search, setSearch] = useState(""),
    [trash, setTrash] = useState(false),
    [trashed, setTrashed] = useState<ImageItem[]>([]),
    [removed, setRemoved] = useState<string[]>([]),
    [confirmDelete, setConfirmDelete] = useState(false),
    [busy, setBusy] = useState(false),
    [loadingTrash, setLoadingTrash] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    if (!trash) return;
    let active = true;
    setLoadingTrash(true);
    setError("");
    api<ImageItem[]>("/api/images/trash")
      .then((value) => { if (active) setTrashed(value); })
      .catch((err) => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoadingTrash(false); });
    return () => { active = false; };
  }, [trash]);
  function close() {
    if (busy) return;
    setSelected(null);
    setConfirmDelete(false);
  }
  async function changeCreation() {
    if (!selected || busy) return;
    setBusy(true);
    setError("");
    try {
      await api(`/api/images/${encodeURIComponent(selected.id)}/${trash ? "restore" : "delete"}`, {});
      if (trash) {
        setTrashed((current) => current.filter((image) => image.id !== selected.id));
        setRemoved((current) => current.filter((id) => id !== selected.id));
      } else {
        setRemoved((current) => [...current, selected.id]);
      }
      setSelected(null);
      setConfirmDelete(false);
      onChanged?.();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const dialog=useDialog(!!selected,close);
  const collection = trash ? trashed : images.filter((image) => !removed.includes(image.id));
  const visible = collection.filter((image) =>
    image.prompt.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <div className="gallery-tools">
        <span>
          {collection.length} {collection.length === 1 ? "creation" : "creations"}{trash ? " in trash" : ""}
          {preview ? " · design preview" : ""}
        </span>
        <label>
          <Icon name="search" size={15} />
          <input
            aria-label="Search images"
            placeholder="Find an image…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        {!preview && <button className="gallery-trash-toggle secondary" aria-pressed={trash} onClick={() => { setTrash(!trash); setError(""); setSelected(null); setConfirmDelete(false); }}>{trash ? "Back to creations" : "Trash"}</button>}
      </div>
      {error && !selected && <p className="error" role="alert">{error}</p>}
      {loadingTrash && trash ? <p role="status">Opening trash…</p> : visible.length ? (
        <div className="gallery-grid">
          {visible.map((image, index) => (
            <button
              className="image-card"
              key={image.id}
              style={{ animationDelay: Math.min(index, 8) * 45 + "ms" }}
              onClick={() => {
                if (onSelect) onSelect(image);
                else setSelected(image);
                setConfirmDelete(false);
                setError("");
              }}
            >
              <img src={imageUrl(image)} alt={image.prompt} loading="lazy" />
              <span className="image-card-overlay">
                <strong>{image.prompt}</strong>
                <small>
                  {image.workflow_name.replace("ComfyUI ", "")} <span>↗</span>
                </small>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <Icon name="image" size={40} />
          <h2>
            {search
              ? "Nothing here just yet"
              : trash ? "Trash is empty." : "A collection that’s all yours."}
          </h2>
          <p>
            {search
              ? "Try another word."
              : trash ? "Deleted creations appear here and can be restored." : "Every image you make will find its way here."}
          </p>
        </div>
      )}
      {selected && (
        <div
          className="modal-backdrop image-backdrop"
          onClick={close}
        >
          <section
            ref={dialog}
            role="dialog"
            aria-modal="true"
            aria-label="Image preview"
            className="image-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="icon-button image-close"
              aria-label="Close image preview"
              onClick={close}
              disabled={busy}
            >
              <Icon name="close" />
            </button>
            <img
              className="full-image"
              src={imageUrl(selected)}
              alt={selected.prompt}
            />
            <div className="image-detail">
              <p className="eyebrow">YOUR CREATION</p>
              <h2>{selected.prompt}</h2>
              <div className="image-detail-meta">
                {selected.workflow_name.replace("ComfyUI ", "")}
                {selected.options?.resolution
                  ? ` · ${selected.options.resolution}`
                  : ""}
                {selected.options?.aspect_ratio
                  ? ` · ${selected.options.aspect_ratio}`
                  : ""}
              </div>
              <div className="image-detail-actions">
                <a
                  className="primary"
                  href={
                    imageUrl(selected) + (selected.url ? "" : "?download=1")
                  }
                  download
                >
                  <Icon name="download" size={17} />
                  Download original
                </a>
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() => {
                    onReuse(selected);
                    setSelected(null);
                  }}
                >
                  <Icon name="refresh" size={16} />
                  Use this idea
                </button>
                {!preview && (trash ? (
                  <button className="secondary" disabled={busy} onClick={() => void changeCreation()}>{busy ? "Restoring…" : "Restore creation"}</button>
                ) : confirmDelete ? (
                  <div className="creation-delete-confirm">
                    <p>Delete this creation? You can restore it from Trash.</p>
                    <button className="delete-creation" disabled={busy} onClick={() => void changeCreation()}>{busy ? "Deleting…" : "Delete creation"}</button>
                    <button className="secondary" disabled={busy} onClick={() => setConfirmDelete(false)}>Cancel</button>
                  </div>
                ) : (
                  <button className="delete-creation" onClick={() => setConfirmDelete(true)}>Delete creation</button>
                ))}
              </div>
              {error && <p className="error" role="alert">{error}</p>}
              <p className="control-hint">
                Your original file includes its generation metadata.
              </p>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
