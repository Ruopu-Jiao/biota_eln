"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type MouseEvent,
  type ReactNode,
  type SVGProps,
} from "react";
import type {
  NotebookNavigatorData,
  NotebookNavigatorFolder,
  NotebookNavigatorRecord,
} from "@biota/db";

type IconProps = SVGProps<SVGSVGElement>;

type WorkspaceTabSnapshot = {
  kind: "entry" | "entity";
  id: string;
};

type CreateRecordTarget = {
  scope: "root" | "folder";
  folderId?: string;
  folderName?: string;
};

type EntryContextMenuTarget = {
  entryId: string;
  href: string;
  title: string;
  x: number;
  y: number;
};

const navigatorCollapsedStorageKey = "biota-navigator-collapsed";
const workspaceTabsStorageKey = "biota-entry-tabs";
const workspaceStorageEventName = "biota-workspace-storage";

function subscribeToWorkspaceStorage(callback: () => void) {
  const handleChange = () => callback();

  window.addEventListener("storage", handleChange);
  window.addEventListener(workspaceStorageEventName, handleChange);

  return () => {
    window.removeEventListener("storage", handleChange);
    window.removeEventListener(workspaceStorageEventName, handleChange);
  };
}

function notifyWorkspaceStorageChange() {
  window.dispatchEvent(new Event(workspaceStorageEventName));
}

function readNavigatorCollapsedSnapshot() {
  if (typeof window === "undefined") {
    return false;
  }

  const storedValue = window.localStorage.getItem(navigatorCollapsedStorageKey);

  if (storedValue === "1") {
    return true;
  }

  if (storedValue === "0") {
    return false;
  }

  return /^\/(entries|entities)\/[^/]+$/.test(window.location.pathname);
}

function writeNavigatorCollapsedSnapshot(collapsed: boolean) {
  window.localStorage.setItem(
    navigatorCollapsedStorageKey,
    collapsed ? "1" : "0",
  );
  notifyWorkspaceStorageChange();
}

function readWorkspaceTabsSnapshot() {
  if (typeof window === "undefined") {
    return "[]";
  }

  return window.localStorage.getItem(workspaceTabsStorageKey) ?? "[]";
}

function parseWorkspaceTabsSnapshot(snapshot: string) {
  try {
    const parsed = JSON.parse(snapshot) as unknown;

    if (!Array.isArray(parsed)) {
      return [] as WorkspaceTabSnapshot[];
    }

    return parsed.flatMap((tab) => {
      if (typeof tab === "string") {
        return [
          {
            kind: "entry" as const,
            id: tab,
          },
        ];
      }

      if (
        typeof tab === "object" &&
        tab !== null &&
        "kind" in tab &&
        "id" in tab &&
        (tab.kind === "entry" || tab.kind === "entity") &&
        typeof tab.id === "string"
      ) {
        return [
          {
            kind: tab.kind,
            id: tab.id,
          },
        ];
      }

      return [];
    });
  } catch {
    return [] as WorkspaceTabSnapshot[];
  }
}

function writeWorkspaceTabsSnapshot(tabs: WorkspaceTabSnapshot[]) {
  window.localStorage.setItem(workspaceTabsStorageKey, JSON.stringify(tabs));
  notifyWorkspaceStorageChange();
}

function NotebookIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...props}>
      <path d="M5 4.75h10.5A3.5 3.5 0 0 1 19 8.25v11H8.5A3.5 3.5 0 0 0 5 22.75z" />
      <path d="M5 4.75v18" />
      <path d="M9 8.5h6.5" />
      <path d="M9 12h5.5" />
    </svg>
  );
}

function StatsIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...props}>
      <path d="M6 18.25V11.5" />
      <path d="M12 18.25V6.75" />
      <path d="M18 18.25v-4.5" />
      <path d="M4.75 18.25h14.5" />
    </svg>
  );
}

function GraphIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...props}>
      <circle cx="6" cy="6.5" r="1.75" />
      <circle cx="18" cy="8" r="1.75" />
      <circle cx="12" cy="18" r="1.75" />
      <path d="M7.5 7.5l8.75 0.5" />
      <path d="M7.2 7.9l3.7 8.1" />
      <path d="M16.9 9.5l-3.7 7.2" />
    </svg>
  );
}

function PlanningIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...props}>
      <path d="M5 5.75h14v13.5H5z" />
      <path d="M5 9.25h14" />
      <path d="M8.25 4v3.5" />
      <path d="M15.75 4v3.5" />
      <path d="M8 12.5h3.75" />
      <path d="M8 15.75h6.5" />
    </svg>
  );
}

function SettingsIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...props}>
      <path d="M12 8.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7Z" />
      <path d="M4.75 12a7.4 7.4 0 0 0 .22 1.76l-1.82 1.4 1.8 3.1 2.21-.76a7.7 7.7 0 0 0 1.52.88l.32 2.32h3.6l.32-2.32a7.7 7.7 0 0 0 1.52-.88l2.21.76 1.8-3.1-1.82-1.4A7.4 7.4 0 0 0 19.25 12a7.4 7.4 0 0 0-.22-1.76l1.82-1.4-1.8-3.1-2.21.76a7.7 7.7 0 0 0-1.52-.88L14.92 3.3h-3.6L11 5.62a7.7 7.7 0 0 0-1.52.88l-2.21-.76-1.8 3.1 1.82 1.4c-.15.57-.22 1.16-.22 1.76Z" />
    </svg>
  );
}

function PlusIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...props}>
      <path d="M12 5.25v13.5" />
      <path d="M5.25 12h13.5" />
    </svg>
  );
}

function ChevronIcon({
  open,
  ...props
}: IconProps & {
  open?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      {...props}
      className={`${open ? "rotate-90" : ""} ${props.className ?? ""}`}
    >
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

function FolderIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...props}>
      <path d="M3.75 7.25h5l1.5 2h9v9.5h-15.5z" />
      <path d="M3.75 7.25V5.5h6.5" />
    </svg>
  );
}

function EntryIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...props}>
      <path d="M7 4.75h10v14.5H7z" />
      <path d="M10 8.5h4" />
      <path d="M10 12h4" />
      <path d="M10 15.5h3" />
    </svg>
  );
}

function EntityIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...props}>
      <path d="M8 5.5c3.8 0 5 3.2 8 3.2" />
      <path d="M8 18.5c3.8 0 5-3.2 8-3.2" />
      <path d="M8 5.5c0 3.8 3.2 5 3.2 8" />
      <path d="M16 18.5c0-3.8-3.2-5-3.2-8" />
      <path d="M6.5 9h11" />
      <path d="M6.5 15h11" />
    </svg>
  );
}

function TabIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...props}>
      <path d="M5.5 6.75h13v10.5h-13z" />
      <path d="M5.5 10.25h13" />
      <path d="M9 6.75v10.5" />
    </svg>
  );
}

const primaryNav = [
  { label: "Projects", href: "/entries", Icon: NotebookIcon },
  { label: "Stats", href: "/stats", Icon: StatsIcon },
  { label: "Graph", href: "/graph", Icon: GraphIcon },
  { label: "Planning", href: "/planning", Icon: PlanningIcon },
];

function isProjectPath(pathname: string) {
  return (
    pathname === "/entries" ||
    pathname.startsWith("/entries/") ||
    pathname === "/entities" ||
    pathname.startsWith("/entities/") ||
    pathname === "/protocols" ||
    pathname.startsWith("/protocols/")
  );
}

function isActive(pathname: string, href: string) {
  if (href === "/entries") {
    return isProjectPath(pathname);
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function titleFromPath(pathname: string) {
  if (pathname === "/") {
    return "Workspace";
  }

  if (pathname === "/entries") {
    return "Entries";
  }

  if (pathname === "/entities") {
    return "Entities";
  }

  if (pathname === "/stats") {
    return "Stats";
  }

  if (pathname === "/planning" || pathname.startsWith("/planning/")) {
    return "Planning";
  }

  if (pathname.startsWith("/entries/")) {
    return "Entry workspace";
  }

  if (pathname.startsWith("/entities/")) {
    return "Sequence workspace";
  }

  if (pathname.startsWith("/protocols/")) {
    return "Protocol";
  }

  return pathname.slice(1).replaceAll("/", " / ");
}

function getWorkspaceTabFromPath(pathname: string): WorkspaceTabSnapshot | null {
  const entryMatch = pathname.match(/^\/entries\/([^/]+)/);

  if (entryMatch) {
    return {
      kind: "entry",
      id: entryMatch[1],
    };
  }

  const entityMatch = pathname.match(/^\/entities\/([^/]+)/);

  if (entityMatch) {
    return {
      kind: "entity",
      id: entityMatch[1],
    };
  }

  return null;
}

function workspaceTabKey(tab: WorkspaceTabSnapshot) {
  return `${tab.kind}:${tab.id}`;
}

function collectFolderState(
  folders: NotebookNavigatorFolder[],
): Record<string, boolean> {
  return folders.reduce<Record<string, boolean>>((state, folder) => {
    state[folder.id] = true;

    for (const [childId, value] of Object.entries(
      collectFolderState(folder.childFolders),
    )) {
      state[childId] = value;
    }

    return state;
  }, {});
}

function collectNavigatorRecordMap(
  navigator: NotebookNavigatorData | null,
): Map<string, NotebookNavigatorRecord> {
  const recordMap = new Map<string, NotebookNavigatorRecord>();

  function addRecords(records: NotebookNavigatorRecord[]) {
    for (const record of records) {
      recordMap.set(`${record.kind}:${record.id}`, record);
    }
  }

  function walkFolders(folders: NotebookNavigatorFolder[]) {
    for (const folder of folders) {
      addRecords(folder.records);
      walkFolders(folder.childFolders);
    }
  }

  if (navigator) {
    walkFolders(navigator.folders);
    addRecords(navigator.unfiledRecords);
  }

  return recordMap;
}

function normalizeNavigatorSearch(value: string) {
  return value.trim().toLowerCase();
}

function getNavigatorRecordSearchText(record: NotebookNavigatorRecord) {
  const badge =
    record.kind === "entry"
      ? `v${record.latestVersionNumber}`
      : record.entityTypeLabel;

  return [
    record.title,
    record.slug,
    record.kind,
    badge,
  ].join(" ").toLowerCase();
}

function filterNavigatorFolder(
  folder: NotebookNavigatorFolder,
  query: string,
): NotebookNavigatorFolder | null {
  const folderMatches = [folder.name, folder.slug]
    .join(" ")
    .toLowerCase()
    .includes(query);

  if (folderMatches) {
    return folder;
  }

  const records = folder.records.filter((record) =>
    getNavigatorRecordSearchText(record).includes(query),
  );
  const childFolders = folder.childFolders.flatMap((childFolder) => {
    const filteredFolder = filterNavigatorFolder(childFolder, query);

    return filteredFolder ? [filteredFolder] : [];
  });

  if (!records.length && !childFolders.length) {
    return null;
  }

  return {
    ...folder,
    records,
    childFolders,
  };
}

function filterNavigatorData(
  navigator: NotebookNavigatorData | null,
  query: string,
): NotebookNavigatorData | null {
  if (!navigator || !query) {
    return navigator;
  }

  return {
    ...navigator,
    folders: navigator.folders.flatMap((folder) => {
      const filteredFolder = filterNavigatorFolder(folder, query);

      return filteredFolder ? [filteredFolder] : [];
    }),
    unfiledRecords: navigator.unfiledRecords.filter((record) =>
      getNavigatorRecordSearchText(record).includes(query),
    ),
  };
}

function NavigatorFolderTree({
  folder,
  pathname,
  depth,
  searchActive,
  openByFolderId,
  onToggle,
  createTarget,
  onCreate,
  onOpenEntryMenu,
}: {
  folder: NotebookNavigatorFolder;
  pathname: string;
  depth: number;
  searchActive: boolean;
  openByFolderId: Record<string, boolean>;
  onToggle: (folderId: string) => void;
  createTarget: CreateRecordTarget | null;
  onCreate: (target: CreateRecordTarget) => void;
  onOpenEntryMenu: (
    event: MouseEvent<HTMLAnchorElement>,
    record: NotebookNavigatorRecord,
  ) => void;
}) {
  const isOpen = searchActive || (openByFolderId[folder.id] ?? true);
  const hasChildren = folder.childFolders.length > 0 || folder.records.length > 0;
  const isCreateMenuOpen =
    createTarget?.scope === "folder" && createTarget.folderId === folder.id;

  return (
    <div>
      <div
        className="flex items-center gap-1 px-2 py-1.5 text-left text-sm text-[color:var(--text-muted)]"
        style={{ paddingLeft: `${depth * 14 + 8}px` }}
      >
        <button
          type="button"
          onClick={() => onToggle(folder.id)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left transition hover:text-[color:var(--text-primary)]"
        >
          <ChevronIcon
            open={isOpen}
            className={`h-3.5 w-3.5 text-[color:var(--text-soft)] transition ${
              hasChildren ? "opacity-100" : "opacity-0"
            }`}
          />
          <FolderIcon className="h-4 w-4" />
          <span className="truncate">{folder.name}</span>
        </button>
        <div data-create-menu-root className="relative">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onCreate({
                scope: "folder",
                folderId: folder.id,
                folderName: folder.name,
              });
            }}
            aria-label={`Create a record in ${folder.name}`}
            title={`Create in ${folder.name}`}
            className="inline-flex h-7 w-7 items-center justify-center border border-[color:var(--line)] text-[color:var(--text-muted)] transition hover:border-[color:var(--line-strong)] hover:text-[color:var(--text-primary)]"
          >
            <PlusIcon className="h-3.5 w-3.5" />
          </button>
          {isCreateMenuOpen ? (
            <RecordCreateMenu target={createTarget} />
          ) : null}
        </div>
      </div>

      {isOpen ? (
        <div className="space-y-0.5">
          {folder.records.map((record) => {
            const active = pathname === record.href;
            const Icon = record.kind === "entity" ? EntityIcon : EntryIcon;
            const badge =
              record.kind === "entry"
                ? `v${record.latestVersionNumber}`
                : record.entityTypeLabel;

            return (
              <Link
                key={`${record.kind}-${record.id}`}
                href={record.href}
                onContextMenu={(event) => onOpenEntryMenu(event, record)}
                className={`flex items-center gap-2 px-2 py-1.5 text-sm transition ${
                  active
                    ? "bg-[color:var(--accent-muted)] text-[color:var(--text-primary)]"
                    : "text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)]"
                }`}
                style={{ paddingLeft: `${depth * 14 + 32}px` }}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="min-w-0 truncate">{record.title}</span>
                <span className="ml-auto text-[10px] uppercase tracking-[0.14em] text-[color:var(--text-soft)]">
                  {badge}
                </span>
              </Link>
            );
          })}

          {folder.childFolders.map((childFolder) => (
          <NavigatorFolderTree
            key={childFolder.id}
            folder={childFolder}
            pathname={pathname}
            depth={depth + 1}
            searchActive={searchActive}
            openByFolderId={openByFolderId}
            onToggle={onToggle}
            createTarget={createTarget}
            onCreate={onCreate}
            onOpenEntryMenu={onOpenEntryMenu}
          />
        ))}
      </div>
    ) : null}
    </div>
  );
}

type AppShellProps = {
  children: ReactNode;
  viewerName?: string;
  viewerEmail?: string;
  navigator?: NotebookNavigatorData | null;
};

function WorkspaceTabButton({
  active,
  children,
  onClick,
  onClose,
  closeLabel,
  title,
  compact,
}: {
  active?: boolean;
  children: ReactNode;
  onClick: () => void;
  onClose?: () => void;
  closeLabel?: string;
  title?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`group inline-flex shrink-0 items-stretch border transition ${
        active
          ? "border-[color:var(--accent-soft)] bg-[color:var(--accent-muted)] text-[color:var(--text-primary)]"
          : "border-[color:var(--line)] bg-[color:var(--surface-muted)] text-[color:var(--text-muted)] hover:border-[color:var(--line-strong)] hover:text-[color:var(--text-primary)]"
      } ${compact ? "text-xs" : "text-sm"}`}
      title={title}
    >
      <button
        type="button"
        onClick={onClick}
        className={`flex min-w-0 items-center gap-2 text-left ${
          compact ? "px-2 py-1" : "px-3 py-2"
        }`}
      >
        {children}
      </button>
      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          aria-label={closeLabel}
          className={`border-l border-[color:var(--line)] text-[11px] text-[color:var(--text-soft)] transition hover:bg-[color:var(--surface)] hover:text-[color:var(--text-primary)] ${
            compact ? "px-1.5" : "px-2.5"
          }`}
        >
          ×
        </button>
      ) : null}
    </div>
  );
}

function buildCreateHref(
  basePath: "/entries/new" | "/entities/new",
  target: CreateRecordTarget | null,
) {
  if (!target || target.scope === "root" || !target.folderId) {
    return basePath;
  }

  const params = new URLSearchParams({
    folderId: target.folderId,
  });

  if (target.folderName) {
    params.set("folderName", target.folderName);
  }

  return `${basePath}?${params.toString()}`;
}

function RecordCreateMenu({
  target,
}: {
  target: CreateRecordTarget | null;
}) {
  if (!target) {
    return null;
  }

  return (
    <div
      data-create-menu-root
      className="absolute right-0 top-full z-20 mt-2 min-w-[210px] border border-[color:var(--line)] bg-[color:var(--surface-strong)] p-1 shadow-xl"
    >
      <Link
        href={buildCreateHref("/entries/new", target)}
        className="flex items-center justify-between gap-3 px-3 py-2 text-sm text-[color:var(--text-primary)] transition hover:bg-[color:var(--surface-muted)]"
      >
        <span>New entry</span>
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-[color:var(--text-soft)]">
          Entry
        </span>
      </Link>
      <Link
        href={buildCreateHref("/entities/new", target)}
        className="flex items-center justify-between gap-3 px-3 py-2 text-sm text-[color:var(--text-primary)] transition hover:bg-[color:var(--surface-muted)]"
      >
        <span>New entity</span>
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-[color:var(--text-soft)]">
          DNA
        </span>
      </Link>
    </div>
  );
}

export function AppShell({
  children,
  viewerName = "Biota user",
  viewerEmail = "",
  navigator = null,
}: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeWorkspaceTab = getWorkspaceTabFromPath(pathname);
  const isEntryDetailRoute = activeWorkspaceTab?.kind === "entry";
  const isEntityDetailRoute = activeWorkspaceTab?.kind === "entity";
  const isSettingsOverlayRoute = pathname === "/settings";
  const isPlanningRoute = pathname === "/planning" || pathname.startsWith("/planning/");
  const showInspector =
    !isEntryDetailRoute &&
    !isEntityDetailRoute &&
    !isSettingsOverlayRoute &&
    !isPlanningRoute;
  const recordMap = useMemo(() => collectNavigatorRecordMap(navigator), [navigator]);
  const settingsReturnPath = useMemo(() => {
    const from = searchParams.get("from");

    if (!from || from === "/settings") {
      return "/entries";
    }

    return from;
  }, [searchParams]);
  const currentLocation = useMemo(() => {
    const query = searchParams.toString();

    if (!query) {
      return pathname;
    }

    return `${pathname}?${query}`;
  }, [pathname, searchParams]);
  const navigatorCollapsed = useSyncExternalStore(
    subscribeToWorkspaceStorage,
    readNavigatorCollapsedSnapshot,
    () => Boolean(isEntryDetailRoute || isEntityDetailRoute),
  );
  const showNavigatorPane = !navigatorCollapsed && !isPlanningRoute;
  const storedWorkspaceTabsSnapshot = useSyncExternalStore(
    subscribeToWorkspaceStorage,
    readWorkspaceTabsSnapshot,
    () => "[]",
  );
  const storedWorkspaceTabs = useMemo(
    () => parseWorkspaceTabsSnapshot(storedWorkspaceTabsSnapshot),
    [storedWorkspaceTabsSnapshot],
  );
  const openWorkspaceTabs = useMemo(() => {
    const tabs = activeWorkspaceTab
      ? [...storedWorkspaceTabs, activeWorkspaceTab]
      : [...storedWorkspaceTabs];

    return tabs.filter(
      (tab, index, currentTabs) =>
        currentTabs.findIndex((candidate) => workspaceTabKey(candidate) === workspaceTabKey(tab)) === index,
    );
  }, [activeWorkspaceTab, storedWorkspaceTabs]);
  const [openByFolderId, setOpenByFolderId] = useState<Record<string, boolean>>(
    () => collectFolderState(navigator?.folders ?? []),
  );
  const [createMenuTarget, setCreateMenuTarget] = useState<CreateRecordTarget | null>(null);
  const [entryContextMenu, setEntryContextMenu] =
    useState<EntryContextMenuTarget | null>(null);
  const [deletingEntryId, setDeletingEntryId] = useState<string | null>(null);
  const [entryActionError, setEntryActionError] = useState("");
  const [navigatorSearchQuery, setNavigatorSearchQuery] = useState("");
  const normalizedNavigatorSearchQuery = normalizeNavigatorSearch(navigatorSearchQuery);
  const filteredNavigator = useMemo(
    () => filterNavigatorData(navigator, normalizedNavigatorSearchQuery),
    [navigator, normalizedNavigatorSearchQuery],
  );
  const navigatorSearchActive = normalizedNavigatorSearchQuery.length > 0;
  const navigatorHasResults = Boolean(
    filteredNavigator?.folders.length || filteredNavigator?.unfiledRecords.length,
  );

  useEffect(() => {
    if (!activeWorkspaceTab) {
      return;
    }

    const storedTabs = parseWorkspaceTabsSnapshot(readWorkspaceTabsSnapshot());

    if (
      storedTabs.some(
        (tab) => workspaceTabKey(tab) === workspaceTabKey(activeWorkspaceTab),
      )
    ) {
      return;
    }

    writeWorkspaceTabsSnapshot([...storedTabs, activeWorkspaceTab]);
  }, [activeWorkspaceTab]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setCreateMenuTarget(null);
      setEntryContextMenu(null);
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [currentLocation]);

  useEffect(() => {
    if (!createMenuTarget) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (event.target instanceof Element) {
        if (!event.target.closest("[data-create-menu-root]")) {
          setCreateMenuTarget(null);
        }
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setCreateMenuTarget(null);
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [createMenuTarget]);

  useEffect(() => {
    if (!entryContextMenu) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (event.target instanceof Element) {
        if (!event.target.closest("[data-entry-context-menu-root]")) {
          setEntryContextMenu(null);
        }
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setEntryContextMenu(null);
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [entryContextMenu]);

  const workspaceTabs = useMemo(() => {
    const tabs = openWorkspaceTabs.map((tab) => {
      const record = recordMap.get(workspaceTabKey(tab));
      const href =
        record?.href ??
        (tab.kind === "entry" ? `/entries/${tab.id}` : `/entities/${tab.id}`);

      return {
        key: workspaceTabKey(tab),
        id: tab.id,
        kind: tab.kind,
        title:
          record?.title ??
          (tab.kind === "entry" ? "Entry" : "Sequence entity"),
        href,
        active: pathname === href,
        closable: true,
        version:
          record?.kind === "entry" ? record.latestVersionNumber : null,
        entityType:
          record?.kind === "entity" ? record.entityTypeLabel : null,
      };
    });

    return tabs.filter(
      (tab, index, currentTabs) =>
        currentTabs.findIndex((candidate) => candidate.key === tab.key) === index,
    );
  }, [openWorkspaceTabs, pathname, recordMap]);
  const mainClassName = isEntryDetailRoute
    ? "min-w-0 px-2 py-2 lg:px-4"
    : isEntityDetailRoute
      ? "min-w-0 px-4 py-6 lg:px-8"
      : "min-w-0 px-5 py-5 lg:px-7";
  const workspaceHeaderClassName = isEntryDetailRoute
    ? "mb-1 border-b border-[color:var(--line)] pb-1"
    : "mb-5 space-y-3 border-b border-[color:var(--line)] pb-4";

  function openEntryContextMenu(
    event: MouseEvent<HTMLAnchorElement>,
    record: NotebookNavigatorRecord,
  ) {
    if (record.kind !== "entry") {
      return;
    }

    event.preventDefault();
    setCreateMenuTarget(null);
    setEntryActionError("");

    const menuWidth = 180;
    const menuHeight = 48;
    const viewportPadding = 8;
    const x = Math.min(
      event.clientX,
      window.innerWidth - menuWidth - viewportPadding,
    );
    const y = Math.min(
      event.clientY,
      window.innerHeight - menuHeight - viewportPadding,
    );

    setEntryContextMenu({
      entryId: record.id,
      href: record.href,
      title: record.title,
      x: Math.max(viewportPadding, x),
      y: Math.max(viewportPadding, y),
    });
  }

  async function deleteEntryFromNavigator(target: EntryContextMenuTarget) {
    setDeletingEntryId(target.entryId);
    setEntryActionError("");

    try {
      const deletingCurrentEntry =
        window.location.pathname === target.href || pathname === target.href;
      const response = await fetch(`/api/entries/${encodeURIComponent(target.entryId)}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Entry delete failed.");
      }

      writeWorkspaceTabsSnapshot(
        openWorkspaceTabs.filter(
          (tab) => workspaceTabKey(tab) !== `entry:${target.entryId}`,
        ),
      );
      setEntryContextMenu(null);

      if (deletingCurrentEntry) {
        router.push("/entries");
        window.setTimeout(() => {
          router.refresh();
        }, 0);
      } else {
        router.refresh();
      }
    } catch {
      setEntryActionError("Could not delete entry.");
    } finally {
      setDeletingEntryId(null);
    }
  }

  function closeWorkspaceTab(tabToClose: WorkspaceTabSnapshot) {
    const remainingTabs = openWorkspaceTabs.filter(
      (currentTab) => workspaceTabKey(currentTab) !== workspaceTabKey(tabToClose),
    );

    writeWorkspaceTabsSnapshot(remainingTabs);

    if (
      activeWorkspaceTab &&
      workspaceTabKey(activeWorkspaceTab) === workspaceTabKey(tabToClose)
    ) {
      const nextTab = remainingTabs.at(-1);

      router.push(
        nextTab
          ? nextTab.kind === "entry"
            ? `/entries/${nextTab.id}`
            : `/entities/${nextTab.id}`
          : "/stats",
      );
    }
  }

  function closeSettingsOverlay() {
    router.push(settingsReturnPath);
  }

  function handlePrimaryNavClick(href: string, active: boolean) {
    setCreateMenuTarget(null);

    if (href === "/entries" && active) {
      writeNavigatorCollapsedSnapshot(!navigatorCollapsed);
      return;
    }

    if (href === "/entries" && !active) {
      writeNavigatorCollapsedSnapshot(false);
      router.push(href);
      return;
    }

    if (active) {
      return;
    }

    router.push(href);
  }

  return (
    <div className="relative min-h-screen bg-[color:var(--bg)] text-[color:var(--text-primary)]">
      <div
        className={`grid min-h-screen ${
          isSettingsOverlayRoute ? "pointer-events-none select-none opacity-35 blur-[2px]" : ""
        }`}
        style={{
          gridTemplateColumns: !showNavigatorPane
            ? showInspector
              ? "72px minmax(0,1fr) minmax(260px,320px)"
              : "72px minmax(0,1fr)"
            : showInspector
              ? "72px minmax(240px,320px) minmax(0,1fr) minmax(260px,320px)"
              : "72px minmax(240px,320px) minmax(0,1fr)",
        }}
      >
        <aside className="flex flex-col items-center border-r border-[color:var(--line)] bg-[color:var(--surface-muted)] py-4">
          <div className="space-y-2">
            {primaryNav.map((item) => {
              const active = isActive(pathname, item.href);
              const Icon = item.Icon;

              return (
                <button
                  key={item.href}
                  type="button"
                  onClick={() => handlePrimaryNavClick(item.href, active)}
                  className={`group relative flex h-11 w-11 items-center justify-center border transition ${
                    active
                      ? "border-[color:var(--accent-soft)] bg-[color:var(--accent-muted)] text-[color:var(--text-primary)]"
                      : "border-[color:var(--line)] text-[color:var(--text-muted)] hover:border-[color:var(--line-strong)] hover:text-[color:var(--text-primary)]"
                  }`}
                  aria-label={item.label}
                  title={item.label}
                >
                  <Icon className="h-5 w-5" />
                  <span className="pointer-events-none absolute left-full top-1/2 z-20 ml-3 -translate-y-1/2 whitespace-nowrap border border-[color:var(--line)] bg-[color:var(--surface-strong)] px-2 py-1 text-[11px] uppercase tracking-[0.16em] text-[color:var(--text-muted)] opacity-0 shadow-lg transition group-hover:opacity-100 group-focus-visible:opacity-100">
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
          <Link
            href={`/settings?from=${encodeURIComponent(currentLocation)}`}
            aria-label="Settings"
            title="Settings"
            className="group relative mt-auto flex h-11 w-11 items-center justify-center border border-[color:var(--line)] text-[color:var(--text-muted)] transition hover:border-[color:var(--line-strong)] hover:text-[color:var(--text-primary)]"
          >
            <SettingsIcon className="h-5 w-5" />
            <span className="pointer-events-none absolute left-full top-1/2 z-20 ml-3 -translate-y-1/2 whitespace-nowrap border border-[color:var(--line)] bg-[color:var(--surface-strong)] px-2 py-1 text-[11px] uppercase tracking-[0.16em] text-[color:var(--text-muted)] opacity-0 shadow-lg transition group-hover:opacity-100 group-focus-visible:opacity-100">
              Settings
            </span>
          </Link>
        </aside>

        {showNavigatorPane ? (
          <aside className="border-r border-[color:var(--line)] bg-[color:var(--surface)] px-4 py-5">
            <div className="flex items-center justify-between gap-3 border-b border-[color:var(--line)] pb-3">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[color:var(--text-soft)]">
                  Navigator
                </p>
                <p className="mt-1 text-sm text-[color:var(--text-muted)]">
                  {navigator?.repository.name ?? "Main notebook"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div data-create-menu-root className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setCreateMenuTarget((current) =>
                        current?.scope === "root" ? null : { scope: "root" },
                      );
                    }}
                    aria-label="Create new record"
                    title="Create new record"
                    className="inline-flex h-8 w-8 items-center justify-center border border-[color:var(--line)] text-[color:var(--text-muted)] transition hover:border-[color:var(--line-strong)] hover:text-[color:var(--text-primary)]"
                  >
                    <PlusIcon className="h-4 w-4" />
                  </button>

                  {createMenuTarget?.scope === "root" ? (
                    <RecordCreateMenu target={createMenuTarget} />
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCreateMenuTarget(null);
                    writeNavigatorCollapsedSnapshot(true);
                  }}
                  aria-label="Collapse navigator"
                  title="Collapse navigator"
                  className="inline-flex h-8 min-w-8 items-center justify-center border border-[color:var(--line)] px-1 font-mono text-xs text-[color:var(--text-muted)] transition hover:border-[color:var(--line-strong)] hover:text-[color:var(--text-primary)]"
                >
                  <span>{"<<"}</span>
                </button>
              </div>
            </div>

            <div className="mt-3">
              <label htmlFor="navigator-search" className="sr-only">
                Search navigator
              </label>
              <div className="flex min-h-9 items-center border border-[color:var(--line)] bg-[color:var(--surface-strong)] px-2">
                <input
                  id="navigator-search"
                  type="search"
                  value={navigatorSearchQuery}
                  onChange={(event) => setNavigatorSearchQuery(event.target.value)}
                  placeholder="Search navigator"
                  className="min-w-0 flex-1 bg-transparent text-sm text-[color:var(--text-primary)] outline-none placeholder:text-[color:var(--text-soft)]"
                />
                {navigatorSearchQuery ? (
                  <button
                    type="button"
                    onClick={() => setNavigatorSearchQuery("")}
                    aria-label="Clear navigator search"
                    className="ml-2 inline-flex h-6 w-6 items-center justify-center text-xs text-[color:var(--text-soft)] transition hover:text-[color:var(--text-primary)]"
                  >
                    ×
                  </button>
                ) : null}
              </div>
            </div>

            <div className="mt-4 space-y-1">
              {filteredNavigator?.folders.length ? (
                filteredNavigator.folders.map((folder) => (
                  <NavigatorFolderTree
                    key={folder.id}
                    folder={folder}
                    pathname={pathname}
                    depth={0}
                    searchActive={navigatorSearchActive}
                    openByFolderId={openByFolderId}
                    onToggle={(folderId) => {
                      setOpenByFolderId((current) => ({
                        ...current,
                        [folderId]: !(current[folderId] ?? true),
                      }));
                    }}
                    createTarget={createMenuTarget}
                    onCreate={(target) => {
                      setCreateMenuTarget(
                        createMenuTarget?.scope === "folder" &&
                          createMenuTarget.folderId === target.folderId
                          ? null
                          : target,
                      );
                    }}
                    onOpenEntryMenu={openEntryContextMenu}
                  />
                ))
                ) : (
                  !navigatorSearchActive ? (
                    <p className="px-2 py-4 text-sm leading-7 text-[color:var(--text-soft)]">
                      Folders and records will appear here as the workspace grows.
                    </p>
                  ) : null
                )}

              {filteredNavigator?.unfiledRecords.length ? (
                <div className="border-t border-[color:var(--line)] pt-3">
                  <p className="px-2 text-[11px] uppercase tracking-[0.18em] text-[color:var(--text-soft)]">
                    Unfiled
                  </p>
                  <div className="mt-2 space-y-0.5">
                    {filteredNavigator.unfiledRecords.map((record) => {
                      const active = pathname === record.href;
                      const Icon = record.kind === "entity" ? EntityIcon : EntryIcon;
                      const badge =
                        record.kind === "entry"
                          ? `v${record.latestVersionNumber}`
                          : record.entityTypeLabel;

                      return (
                        <Link
                          key={`${record.kind}-${record.id}`}
                          href={record.href}
                          onContextMenu={(event) => openEntryContextMenu(event, record)}
                          className={`flex items-center gap-2 px-2 py-1.5 text-sm transition ${
                            active
                              ? "bg-[color:var(--accent-muted)] text-[color:var(--text-primary)]"
                              : "text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)]"
                          }`}
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                          <span className="truncate">{record.title}</span>
                          <span className="ml-auto text-[10px] uppercase tracking-[0.14em] text-[color:var(--text-soft)]">
                            {badge}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {navigatorSearchActive && !navigatorHasResults ? (
                <p className="px-2 py-4 text-sm leading-7 text-[color:var(--text-soft)]">
                  No navigator matches.
                </p>
              ) : null}

              {entryActionError ? (
                <p role="alert" className="px-2 py-3 text-sm text-[color:var(--danger)]">
                  {entryActionError}
                </p>
              ) : null}
            </div>
          </aside>
        ) : null}

        <main className={mainClassName}>
          <div className={workspaceHeaderClassName}>
            {(pathname.startsWith("/entries") || pathname.startsWith("/entities")) && workspaceTabs.length ? (
              <div
                className={`flex min-w-0 flex-nowrap items-center overflow-hidden ${
                  isEntryDetailRoute ? "gap-1.5 pb-0" : "gap-2 pb-1"
                }`}
              >
                {workspaceTabs.map((tab) => (
                  <WorkspaceTabButton
                    key={tab.key}
                    active={tab.active}
                    compact={isEntryDetailRoute}
                    onClick={() => router.push(tab.href)}
                    onClose={
                      tab.closable
                        ? () => {
                            closeWorkspaceTab({
                              kind: tab.kind,
                              id: tab.id,
                            });
                          }
                        : undefined
                    }
                    closeLabel={`Close ${tab.title}`}
                    title={tab.title}
                  >
                    {tab.kind === "entity" ? (
                      <EntityIcon className="h-4 w-4 shrink-0" />
                    ) : (
                      <TabIcon className="h-4 w-4 shrink-0" />
                    )}
                    <span className="min-w-0 truncate">{tab.title}</span>
                    {tab.version ? (
                      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[color:var(--text-soft)]">
                        v{tab.version}
                      </span>
                    ) : null}
                    {tab.entityType ? (
                      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[color:var(--text-soft)]">
                        {tab.entityType}
                      </span>
                    ) : null}
                  </WorkspaceTabButton>
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] uppercase tracking-[0.22em] text-[color:var(--text-soft)]">
                <span>{titleFromPath(pathname)}</span>
                <span className="text-[color:var(--line-strong)]">/</span>
                <span>Workspace</span>
              </div>
            )}
          </div>
          <div>{isSettingsOverlayRoute ? null : children}</div>
        </main>

        {showInspector ? (
          <aside className="border-l border-[color:var(--line)] bg-[color:var(--surface)] px-4 py-5">
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[color:var(--text-soft)]">
              Inspector
            </p>
            <div className="mt-4 divide-y divide-[color:var(--line)] border-y border-[color:var(--line)]">
              <section className="py-4">
                <h2 className="text-sm font-semibold tracking-[0.06em] text-[color:var(--text-primary)]">
                  Metadata
                </h2>
                <dl className="mt-3 space-y-2 text-sm text-[color:var(--text-muted)]">
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-[color:var(--text-soft)]">Owner</dt>
                    <dd className="text-[color:var(--text-primary)]">{viewerName}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-[color:var(--text-soft)]">Status</dt>
                    <dd className="text-[color:var(--accent-strong)]">Notebook core</dd>
                  </div>
                  {viewerEmail ? (
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-[color:var(--text-soft)]">Email</dt>
                      <dd className="truncate text-[color:var(--text-primary)]">
                        {viewerEmail}
                      </dd>
                    </div>
                  ) : null}
                </dl>
              </section>

              <section className="py-4">
                <h2 className="text-sm font-semibold tracking-[0.06em] text-[color:var(--text-primary)]">
                  Focus
                </h2>
                <div className="mt-3 space-y-2 text-sm leading-7 text-[color:var(--text-muted)]">
                  <p>Entries are now moving toward a full document workflow.</p>
                  <p>Protocol blocks and tables can live directly inside the page.</p>
                </div>
              </section>
            </div>
          </aside>
        ) : null}
      </div>

      {isSettingsOverlayRoute ? (
        <div className="fixed inset-0 z-40 overflow-y-auto bg-[color:var(--surface-strong)]/72 backdrop-blur-md">
          <div className="flex min-h-screen flex-col bg-[color:var(--bg)]">
            <div className="flex items-center justify-between gap-4 border-b border-[color:var(--line)] bg-[color:var(--surface-strong)] px-4 py-4 lg:px-6">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[color:var(--accent-strong)]">
                  Settings
                </p>
                <p className="mt-1 text-sm text-[color:var(--text-muted)]">
                  Application preferences and workspace configuration
                </p>
              </div>
              <button
                type="button"
                onClick={closeSettingsOverlay}
                className="inline-flex h-9 items-center border border-[color:var(--line)] px-3 text-sm text-[color:var(--text-muted)] transition hover:border-[color:var(--line-strong)] hover:text-[color:var(--text-primary)]"
              >
                Close
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-6 lg:px-8 lg:py-8">
              {children}
            </div>
          </div>
        </div>
      ) : null}

      {entryContextMenu ? (
        <div
          data-entry-context-menu-root
          role="menu"
          aria-label={`Actions for ${entryContextMenu.title}`}
          className="fixed z-50 min-w-[180px] border border-[color:var(--line)] bg-[color:var(--surface-strong)] p-1 shadow-xl"
          style={{
            left: entryContextMenu.x,
            top: entryContextMenu.y,
          }}
        >
          <button
            type="button"
            role="menuitem"
            disabled={deletingEntryId === entryContextMenu.entryId}
            onClick={() => {
              void deleteEntryFromNavigator(entryContextMenu);
            }}
            className="flex w-full items-center justify-between gap-4 px-3 py-2 text-left text-sm text-[color:var(--danger)] transition hover:bg-[color:var(--danger-soft)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span>
              {deletingEntryId === entryContextMenu.entryId
                ? "Deleting..."
                : "Delete entry"}
            </span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
