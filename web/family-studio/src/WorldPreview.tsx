import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useDialog } from "./useDialog";
import { WonderlandWelcome } from "./WonderlandWelcome";
import { Icon } from "./Icons";
import type { Workflow } from "./types";

export function WorldPreview({
  theme,
  name,
  onClose,
}: {
  theme: string;
  name?: string;
  onClose: () => void;
}) {
  const dialog = useDialog(true, onClose);
  useEffect(() => {
    const root = document.getElementById("root");
    if (!root) return;
    const previous = root.inert;
    root.inert = true;
    return () => { root.inert = previous; };
  }, []);
  const world = { theme, name: name || "Your world" } as Workflow;
  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <section
        className="app-shell world-preview-shell"
        data-theme={theme}
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-label="Draft world preview"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="topbar">
          <span>Draft preview · {world.name}</span>
          <button
            className="icon-button"
            aria-label="Close world preview"
            onClick={onClose}
          >
            <Icon name="close" />
          </button>
        </header>
        <div className="studio-surface">
          <section className="chat-page">
            <div className="chat-content">
              <WonderlandWelcome
                world={world}
                interactive={false}
                onPrompt={() => {}}
                onCreate={() => {}}
              />
            </div>
            <p className="compose-note">
              Visual preview · chat and image generation are inactive.
            </p>
          </section>
        </div>
      </section>
    </div>, document.body
  );
}
