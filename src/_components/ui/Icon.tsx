// Ícones do mockup (traço 1.8, 24×24). Um lugar só para todo o app.
const PATHS = {
  flag: <path d="M5 21V4M5 4h11l-2 4 2 4H5" />,
  clip: <path d="M21 11l-8.5 8.5a5 5 0 01-7-7L14 4a3.5 3.5 0 015 5l-8.5 8.5a2 2 0 01-3-3L15 7" />,
  filter: <path d="M3 5h18l-7 8v6l-4 2v-8z" />,
  sort: <path d="M7 4v16M3 16l4 4 4-4M17 20V4M13 8l4-4 4 4" />,
  list: <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />,
  kanban: <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 3v18M15 3v12" /></>,
  image: <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="M21 16l-5-5-9 9" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5v.5" /></>,
  mic: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0014 0M12 18v3" /></>,
  micOff: <><path d="M15 9.5V6a3 3 0 00-5.8-1M9 9v2a3 3 0 004.6 2.5M5 11a7 7 0 0011.5 5.4M19 11a7 7 0 01-.6 2.8M12 18v3M3 3l18 18" /></>,
  edit: <path d="M4 20h4L19 9l-4-4L4 16zM14 6l4 4" />,
  trash: <><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></>,
  smile: <><circle cx="12" cy="12" r="9" /><path d="M8.5 14a4 4 0 007 0M9 9.5v.5M15 9.5v.5" /></>,
  reply: <path d="M10 8L4 13l6 5M4 13h11a5 5 0 015 5v1" />,
  link: <path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1" />,
  box: <rect x="4" y="4" width="16" height="16" rx="4" />,
  home: <><path d="M3 11l9-8 9 8" /><path d="M5 9.5V20h14V9.5" /></>,
  bell: <><path d="M6 8a6 6 0 0112 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a2 2 0 003.4 0" /></>,
  chat: <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2 21v-1a6 6 0 0112 0v1" /><path d="M16 4.5a3.5 3.5 0 010 7M22 21v-1a6 6 0 00-4-5.6" /></>,
  folder: <path d="M3 6a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2z" />,
  video: <><rect x="2" y="6" width="13" height="12" rx="2" /><path d="M22 8l-7 4 7 4z" /></>,
  cal: <><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>,
  task: <><circle cx="12" cy="12" r="9" /><path d="M8.5 12l2.5 2.5 4.5-5" /></>,
  help: <><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 015 .5c0 1.5-2.5 2-2.5 3.5M12 17v.5" /></>,
  shield: <path d="M12 3l8 3v6c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V6z" />,
  sliders: <><path d="M4 7h9M17 7h3M4 17h3M11 17h9" /><circle cx="15" cy="7" r="2" /><circle cx="9" cy="17" r="2" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></>,
  down: <path d="M6 9l6 6 6-6" />,
  right: <path d="M9 6l6 6-6 6" />,
  back: <path d="M15 18l-6-6 6-6" />,
  panel: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16" /></>,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  hash: <path d="M5 9h14M5 15h14M10 4L8 20M16 4l-2 16" />,
  lock: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21v-1a7 7 0 0114 0v1" /></>,
  logout: <><path d="M15 4h3a2 2 0 012 2v12a2 2 0 01-2 2h-3" /><path d="M10 17l-5-5 5-5M5 12h11" /></>,
  key: <><circle cx="8" cy="15" r="4" /><path d="M11 12l9-9M16 7l3 3" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  more: <><circle cx="5" cy="12" r="1.3" /><circle cx="12" cy="12" r="1.3" /><circle cx="19" cy="12" r="1.3" /></>,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  check: <path d="M5 12.5l4.5 4.5L19 7" />,
  board: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16M15 4v16" /></>,
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 18, className, label }: { name: IconName; size?: number; className?: string; label?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ flex: "none", verticalAlign: "-0.15em" }}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {PATHS[name]}
    </svg>
  );
}
