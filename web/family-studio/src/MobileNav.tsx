import { Icon } from "./Icons";
import type { Page } from "./types";
const tabs = [
  { page: "chat", label: "Chat", icon: "chat" },
  { page: "create", label: "Create image", icon: "spark" },
  { page: "library", label: "My library", icon: "grid" },
] as const;
export function MobileNav({
  page,
  onPage,
}: {
  page: Page;
  onPage: (page: Page) => void;
}) {
  return (
    <nav className="mobile-dock" aria-label="Quick navigation">
      {tabs.map((tab) => (
        <button
          key={tab.page}
          className={page === tab.page ? "active" : ""}
          aria-current={page === tab.page ? "page" : undefined}
          onClick={() => onPage(tab.page)}
        >
          <Icon name={tab.icon} size={21} />
          <span>{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}
