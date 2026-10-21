import { useEffect } from "react";

export function useMobileViewport() {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const update = () => {
      if (viewport.scale !== 1) return;
      document.documentElement.style.setProperty(
        "--app-height",
        `${Math.round(viewport.height)}px`,
      );
      const editing = document.activeElement?.matches("input,textarea");
      document.documentElement.classList.toggle(
        "keyboard-open",
        !!editing && window.innerHeight - viewport.height > 120,
      );
    };
    update();
    viewport.addEventListener("resize", update);
    document.addEventListener("focusin", update);
    document.addEventListener("focusout", update);
    return () => {
      viewport.removeEventListener("resize", update);
      document.removeEventListener("focusin", update);
      document.removeEventListener("focusout", update);
      document.documentElement.style.removeProperty("--app-height");
      document.documentElement.classList.remove("keyboard-open");
    };
  }, []);
}
