import { useEffect, useRef } from "react";
export function useDialog(active: boolean, onClose: () => void, initialFocus: "field" | "control" = "field") {
  const root = useRef<HTMLElement>(null),
    close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!active) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = root.current;
    if (!dialog) return;
    const first =
      (initialFocus === "field" ? dialog.querySelector<HTMLElement>("input:not(:disabled),textarea:not(:disabled)") : null) ||
      dialog.querySelector<HTMLElement>("button:not(:disabled),a[href]");
    first?.focus({ preventScroll: true });
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close.current();
        return;
      }
      if (event.key !== "Tab") return;
      const targets = [
        ...dialog.querySelectorAll<HTMLElement>(
          'button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]',
        ),
      ].filter((el) => el.getClientRects().length);
      if (!targets.length) return;
      const first = targets[0],
        last = targets.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("keydown", keydown);
      if (previous?.isConnected) previous.focus();
    };
  }, [active, initialFocus]);
  return root;
}
