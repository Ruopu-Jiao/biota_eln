import type { SVGProps } from "react";

export type IconName =
  | "add"
  | "analysis"
  | "archive"
  | "back"
  | "calendar"
  | "check"
  | "chevron"
  | "clock"
  | "close"
  | "command"
  | "dna"
  | "document"
  | "dots"
  | "edit"
  | "experiment"
  | "external"
  | "file"
  | "folder"
  | "graph"
  | "history"
  | "home"
  | "inbox"
  | "info"
  | "layout"
  | "link"
  | "menu"
  | "moon"
  | "notebook"
  | "panel"
  | "planning"
  | "protocol"
  | "refresh"
  | "search"
  | "sequence"
  | "settings"
  | "sparkle"
  | "split"
  | "table"
  | "tag"
  | "timeline"
  | "trash"
  | "warning";

export function Icon({
  name,
  size = 18,
  ...props
}: SVGProps<SVGSVGElement> & { name: IconName; size?: number }) {
  const common = {
    viewBox: "0 0 24 24",
    width: size,
    height: size,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  const content: Record<IconName, React.ReactNode> = {
    add: (
      <>
        <path d="M12 5v14M5 12h14" />
      </>
    ),
    analysis: (
      <>
        <path d="M5 19V9m5 10V5m5 14v-7m4 7V8" />
        <path d="M3.5 19.5h17" />
      </>
    ),
    archive: (
      <>
        <path d="M4 7h16v13H4zM3 4h18v3H3z" />
        <path d="M9 11h6" />
      </>
    ),
    back: <path d="m14.5 6-6 6 6 6" />,
    calendar: (
      <>
        <rect x="4" y="5.5" width="16" height="14" rx="2" />
        <path d="M8 3.5v4M16 3.5v4M4 9.5h16" />
      </>
    ),
    check: <path d="m5 12 4.5 4.5L19 7" />,
    chevron: <path d="m9 6 6 6-6 6" />,
    clock: (
      <>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 7.5V12l3 2" />
      </>
    ),
    close: <path d="m6 6 12 12M18 6 6 18" />,
    command: (
      <>
        <path d="M9 7V5.5A2.5 2.5 0 1 0 6.5 8H17.5A2.5 2.5 0 1 0 15 5.5v13a2.5 2.5 0 1 0 2.5-2.5H6.5A2.5 2.5 0 1 0 9 18.5Z" />
      </>
    ),
    dna: (
      <>
        <path d="M7 4c5 0 5 4 10 4M7 20c5 0 5-4 10-4M7 4c0 5 4 5 4 10M17 20c0-5-4-5-4-10" />
        <path d="M6 9h12M6 15h12" />
      </>
    ),
    document: (
      <>
        <path d="M6 3.5h8l4 4V20.5H6z" />
        <path d="M14 3.5v4h4M9 12h6M9 15.5h6" />
      </>
    ),
    dots: (
      <>
        <circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" />
        <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
        <circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" />
      </>
    ),
    edit: (
      <>
        <path d="m5 16-.8 3.8 3.8-.8L18.5 8.5l-3-3zM13.5 7.5l3 3" />
      </>
    ),
    experiment: (
      <>
        <path d="M9 3.5h6M10 3.5v5l-5 9A2 2 0 0 0 6.8 20h10.4a2 2 0 0 0 1.8-2.5l-5-9v-5" />
        <path d="M7.5 15h9" />
      </>
    ),
    external: (
      <>
        <path d="M13 5h6v6M11 13l8-8" />
        <path d="M18 14v5H5V6h5" />
      </>
    ),
    file: (
      <>
        <path d="M6 3.5h8l4 4V20.5H6z" />
        <path d="M14 3.5v4h4" />
      </>
    ),
    folder: (
      <>
        <path d="M3.5 6.5h6l2 2H20.5v11H3.5z" />
      </>
    ),
    graph: (
      <>
        <circle cx="6" cy="7" r="2" />
        <circle cx="18" cy="8" r="2" />
        <circle cx="12" cy="18" r="2" />
        <path d="m8 7.2 8 .6M7.2 8.8l3.6 7.4M16.8 9.8l-3.6 6.4" />
      </>
    ),
    history: (
      <>
        <path d="M4 11a8 8 0 1 0 2.3-5.6L4 7.7" />
        <path d="M4 3.5v4.2h4.2M12 7.5V12l3 2" />
      </>
    ),
    home: (
      <>
        <path d="m4 11 8-7 8 7v9H5v-9" />
        <path d="M9 20v-6h6v6" />
      </>
    ),
    inbox: (
      <>
        <path d="M4 5h16v14H4z" />
        <path d="m4 14 4-4h8l4 4M8 14l1.5 2h5L16 14" />
      </>
    ),
    info: (
      <>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 11v5" />
        <circle cx="12" cy="8" r=".8" fill="currentColor" stroke="none" />
      </>
    ),
    layout: (
      <>
        <rect x="3.5" y="4" width="17" height="16" rx="1.5" />
        <path d="M9 4v16M9 10h11.5" />
      </>
    ),
    link: (
      <>
        <path d="m10 13 4-4M8.5 16.5l-1 1a3.5 3.5 0 0 1-5-5l3-3a3.5 3.5 0 0 1 5 0M15.5 7.5l1-1a3.5 3.5 0 0 1 5 5l-3 3a3.5 3.5 0 0 1-5 0" />
      </>
    ),
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    moon: <path d="M19 15.5A8 8 0 0 1 8.5 5 8 8 0 1 0 19 15.5Z" />,
    notebook: (
      <>
        <path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 0-3 3z" />
        <path d="M5 4v19M9 8h6M9 12h5" />
      </>
    ),
    panel: (
      <>
        <rect x="3.5" y="4" width="17" height="16" rx="1.5" />
        <path d="M15 4v16" />
      </>
    ),
    planning: (
      <>
        <rect x="4" y="5.5" width="16" height="14" rx="2" />
        <path d="M8 3.5v4M16 3.5v4M4 9.5h16M8 13h3M8 16h6" />
      </>
    ),
    protocol: (
      <>
        <path d="M7 3.5h10v17H7zM10 3.5v3h4v-3" />
        <path d="m9.5 11 1.2 1.2 2-2M9.5 16l1.2 1.2 2-2M14 11h1M14 16h1" />
      </>
    ),
    refresh: (
      <>
        <path d="M19 7V3.5l-2.1 2.1A8 8 0 1 0 20 12" />
      </>
    ),
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="6" />
        <path d="m15 15 4.5 4.5" />
      </>
    ),
    sequence: (
      <>
        <path d="M5 8h14M5 16h14" />
        <path d="M8 5v6M12 13v6M16 5v6" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19 12a7 7 0 0 0-.2-1.7l2-1.5-2-3.4-2.4 1A7 7 0 0 0 15 5.6L14.6 3h-4l-.4 2.6a7 7 0 0 0-1.5.8l-2.4-1-2 3.4 2 1.5A7 7 0 0 0 6 12c0 .6.1 1.2.2 1.7l-2 1.5 2 3.4 2.4-1a7 7 0 0 0 1.5.8l.4 2.6h4l.4-2.6a7 7 0 0 0 1.5-.8l2.4 1 2-3.4-2-1.5c.1-.5.2-1.1.2-1.7Z" />
      </>
    ),
    sparkle: (
      <>
        <path d="m12 3 1.2 4.1L17 9l-3.8 1.9L12 15l-1.2-4.1L7 9l3.8-1.9zM18.5 14l.7 2.3 2.3.7-2.3.7-.7 2.3-.7-2.3-2.3-.7 2.3-.7z" />
      </>
    ),
    split: (
      <>
        <rect x="3.5" y="4" width="17" height="16" rx="1.5" />
        <path d="M12 4v16" />
      </>
    ),
    table: (
      <>
        <rect x="3.5" y="5" width="17" height="14" rx="1" />
        <path d="M3.5 10h17M9 5v14" />
      </>
    ),
    tag: (
      <>
        <path d="M3.5 5.5v6l8.5 8.5 8-8-8.5-8.5z" />
        <circle cx="8" cy="8" r="1.2" />
      </>
    ),
    timeline: (
      <>
        <path d="M5 5v14M5 8h6M5 13h11M5 18h8" />
        <circle cx="5" cy="8" r="1.5" fill="currentColor" />
        <circle cx="5" cy="13" r="1.5" fill="currentColor" />
        <circle cx="5" cy="18" r="1.5" fill="currentColor" />
      </>
    ),
    trash: (
      <>
        <path d="M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" />
      </>
    ),
    warning: (
      <>
        <path d="M12 3 2.8 20h18.4z" />
        <path d="M12 9v5M12 17.2v.2" />
      </>
    ),
  };

  return (
    <svg {...common} {...props}>
      {content[name]}
    </svg>
  );
}
