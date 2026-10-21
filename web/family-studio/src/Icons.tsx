import type { CSSProperties } from "react";
const paths: Record<string, React.ReactNode> = {
  book: (
    <>
      <path d="M12 6C9 3 5 3 2 4v15c3-1 7-1 10 2 3-3 7-3 10-2V4c-3-1-7-1-10 2Zm0 0v15" />
      <path d="M5 8h3M5 12h3m8-4h3m-3 4h3" />
    </>
  ),
  key: (
    <>
      <circle cx="8" cy="8" r="5" />
      <path d="m12 12 9 9m-3-3 3-3m-6 0 3-3" />
    </>
  ),
  rabbit: (
    <>
      <path d="M8 11C4 5 5 1 7 2s4 5 4 8m2 0c0-7 2-10 4-8s0 7-1 10" />
      <path d="M5 16c0-4 3-6 7-6s7 2 7 6-3 6-7 6-7-2-7-6Z" />
      <path d="M9 15h.01M15 15h.01m-4 3h2" />
    </>
  ),
  chat: (
    <>
      <path d="M20 11a8 8 0 0 1-8 8H5l-3 3V11a9 9 0 1 1 18 0Z" />
      <path d="M7 8h8M7 12h5" />
    </>
  ),
  image: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <circle cx="8" cy="8" r="1.5" />
      <path d="m3 16 5-5 5 5 3-3 5 5" />
    </>
  ),
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="2" />
      <rect x="14" y="3" width="7" height="7" rx="2" />
      <rect x="3" y="14" width="7" height="7" rx="2" />
      <rect x="14" y="14" width="7" height="7" rx="2" />
    </>
  ),
  arrow: <path d="M12 19V5m-5 5 5-5 5 5" />,
  plus: <path d="M12 5v14M5 12h14" />,
  settings: (
    <>
      <path d="m9 3 1 3h4l1-3 3 2-1 3 2 3 3 1v3l-3 1-2 3 1 3-3 1-2-2h-3l-2 2-3-1 1-3-2-3-3-1v-3l3-1 2-3-1-3Z" />
      <circle cx="12" cy="13" r="3" />
    </>
  ),
  chevron: <path d="m8 10 4 4 4-4" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  download: (
    <>
      <path d="M12 3v12m-4-4 4 4 4-4M4 15v5h16v-5" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 7v5h-5M4 17v-5h5" />
      <path d="M6 7a7 7 0 0 1 12-1l2 2M4 16l2 2a7 7 0 0 0 12-1" />
    </>
  ),
  spark: (
    <>
      <path d="m12 2 2.7 7.3L22 12l-7.3 2.7L12 22l-2.7-7.3L2 12l7.3-2.7Z" />
    </>
  ),
  search: (
    <>
      <circle cx="10" cy="10" r="6" />
      <path d="m15 15 5 5" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10" width="14" height="11" rx="3" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </>
  ),
  logout: (
    <>
      <path d="M10 4H4v16h6M10 12h11m-4-4 4 4-4 4" />
    </>
  ),
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  check: <path d="m5 12 4 4L19 6" />,
  stop: <rect x="6" y="6" width="12" height="12" rx="2" />,
  external: (
    <>
      <path d="M14 3h7v7m0-7L10 14M10 3H3v18h18v-7" />
    </>
  ),
};
export function Icon({
  name,
  size = 20,
  style,
}: {
  name: string;
  size?: number;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={style}
    >
      {paths[name] || paths.spark}
    </svg>
  );
}
export function StudioMark() {
  return (
    <img
      className="studio-mark"
      src="/assets/brand/android-chrome-192x192.png"
      alt=""
      aria-hidden="true"
      width="192"
      height="192"
    />
  );
}
