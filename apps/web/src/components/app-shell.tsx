"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
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

function NavigatorFolderTree({
  folder,
  pathname,
  depth,
  openByFolderId,
  onToggle,
  createTarget,
  onCreate,
}: {
  folder: NotebookNavigatorFolder;
  pathname: string;
  depth: number;
  openByFolderId: Record<string, boolean>;
  onToggle: (folderId: string) => void;
  createTarget: CreateRecordTarget | null;
  onCreate: (target: CreateRecordTarget) => void;
}) {
  const isOpen = openByFolderId[folder.id] ?? true;
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
            openByFolderId={openByFolderId}
            onToggle={onToggle}
            createTarget={createTarget}
            onCreate={onCreate}
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
  workspaceLabel?: string;
  navigator?: NotebookNavigatorData | null;
};

function WorkspaceTabButton({
  active,
  children,
  onClick,
  onClose,
  closeLabel,
  title,
}: {
  active?: boolean;
  children: ReactNode;
  onClick: () => void;
  onClose?: () => void;
  closeLabel?: string;
  title?: string;
}) {
  return (
    <div
      className={`group inline-flex items-stretch border text-sm transition ${
        active
          ? "border-[color:var(--accent-soft)] bg-[color:var(--accent-muted)] text-[color:var(--text-primary)]"
          : "border-[color:var(--line)] bg-[color:var(--surface-muted)] text-[color:var(--text-muted)] hover:border-[color:var(--line-strong)] hover:text-[color:var(--text-primary)]"
      }`}
      title={title}
    >
      <button
        type="button"
        onClick={onClick}
        className="flex min-w-0 items-center gap-2 px-3 py-2 text-left"
      >
        {children}
      </button>
      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          aria-label={closeLabel}
          className="border-l border-[color:var(--line)] px-2.5 text-[11px] text-[color:var(--text-soft)] transition hover:bg-[color:var(--surface)] hover:text-[color:var(--text-primary)]"
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
  workspaceLabel = "Personal workspace",
  navigator = null,
}: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const demoMode = process.env.NEXT_PUBLIC_BIOTA_DEMO_MODE === "true";
  const activeWorkspaceTab = getWorkspaceTabFromPath(pathname);
  const isEntryDetailRoute = activeWorkspaceTab?.kind === "entry";
  const isEntityDetailRoute = activeWorkspaceTab?.kind === "entity";
  const isSettingsOverlayRoute = pathname === "/settings";
  const showInspector =
    !isEntryDetailRoute && !isEntityDetailRoute && !isSettingsOverlayRoute;
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

  async function handleSignOut() {
    if (demoMode) {
      await fetch("/api/demo-logout", {
        method: "POST",
      });
      window.location.assign("/sign-in?demo=1");
      return;
    }

    await signOut({ callbackUrl: "/sign-in" });
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
      <header className="sticky top-0 z-20 border-b border-[color:var(--line)] bg-[color:var(--surface-strong)] backdrop-blur-xl">
        <div className="grid h-16 grid-cols-[auto_minmax(0,1fr)_auto] items-stretch px-4 lg:px-6">
          <div className="flex items-center gap-3 pr-4">
            <div className="flex h-9 w-9 items-center justify-center border border-[color:var(--accent-soft)] bg-[color:var(--accent-muted)] text-sm font-semibold text-[color:var(--text-primary)]">
              B
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold tracking-[0.06em] text-[color:var(--text-primary)]">
                Biota ELN
              </p>
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[color:var(--text-soft)]">
                Lab notebook shell
              </p>
            </div>
          </div>

          <div className="hidden items-center border-x border-[color:var(--line)] px-4 md:flex">
            <div className="flex w-full items-center gap-3 text-sm text-[color:var(--text-muted)]">
              <span className="font-mono text-[color:var(--text-soft)]">⌘K</span>
              <span>Search workspace records, sequences, methods, and linked relations</span>
            </div>
          </div>

          <div className="flex items-center gap-2 pl-4">
            <Link
              href={`/settings?from=${encodeURIComponent(currentLocation)}`}
              aria-label="Settings"
              title="Settings"
              className="inline-flex h-9 w-9 items-center justify-center border border-[color:var(--line)] text-[color:var(--text-muted)] transition hover:border-[color:var(--line-strong)] hover:text-[color:var(--text-primary)]"
            >
              <SettingsIcon className="h-4 w-4" />
            </Link>
            <div className="hidden min-h-9 items-center border border-[color:var(--line)] px-3 text-sm text-[color:var(--text-muted)] lg:flex">
              {workspaceLabel}
            </div>
            <button
              type="button"
              onClick={() => {
                void handleSignOut();
              }}
              className="inline-flex min-h-9 items-center border border-[color:var(--line)] px-3 text-sm text-[color:var(--text-muted)] transition hover:border-[color:var(--line-strong)] hover:text-[color:var(--text-primary)]"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div
        className={`grid min-h-[calc(100vh-4rem)] ${
          isSettingsOverlayRoute ? "pointer-events-none select-none opacity-35 blur-[2px]" : ""
        }`}
        style={{
          gridTemplateColumns: navigatorCollapsed
            ? showInspector
              ? "72px minmax(0,1fr) minmax(260px,320px)"
              : "72px minmax(0,1fr)"
            : showInspector
              ? "72px minmax(240px,320px) minmax(0,1fr) minmax(260px,320px)"
              : "72px minmax(240px,320px) minmax(0,1fr)",
        }}
      >
        <aside className="flex flex-col border-r border-[color:var(--line)] bg-[color:var(--surface-muted)] px-2 py-4">
          <div className="space-y-2">
            {primaryNav.map((item) => {
              const active = isActive(pathname, item.href);
              const Icon = item.Icon;

              return (
                <button
                  key={item.href}
                  type="button"
                  onClick={() => handlePrimaryNavClick(item.href, active)}
                  className={`group relative flex h-11 items-center justify-center border transition ${
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
        </aside>

        {!navigatorCollapsed ? (
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

            <div className="mt-4 space-y-1">
              {navigator?.folders.length ? (
                navigator.folders.map((folder) => (
                  <NavigatorFolderTree
                    key={folder.id}
                    folder={folder}
                    pathname={pathname}
                    depth={0}
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
                  />
                ))
                ) : (
                  <p className="px-2 py-4 text-sm leading-7 text-[color:var(--text-soft)]">
                    Folders and records will appear here as the workspace grows.
                  </p>
                )}

              {navigator?.unfiledRecords.length ? (
                <div className="border-t border-[color:var(--line)] pt-3">
                  <p className="px-2 text-[11px] uppercase tracking-[0.18em] text-[color:var(--text-soft)]">
                    Unfiled
                  </p>
                  <div className="mt-2 space-y-0.5">
                    {navigator.unfiledRecords.map((record) => {
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
            </div>
          </aside>
        ) : null}

        <main
          className={`min-w-0 ${isEntryDetailRoute || isEntityDetailRoute ? "px-4 py-6 lg:px-8" : "px-5 py-5 lg:px-7"}`}
        >
          <div className="mb-5 space-y-3 border-b border-[color:var(--line)] pb-4">
            {(pathname.startsWith("/entries") || pathname.startsWith("/entities")) && workspaceTabs.length ? (
              <div className="flex min-w-0 items-center gap-2 overflow-x-auto pb-1">
                {workspaceTabs.map((tab) => (
                  <WorkspaceTabButton
                    key={tab.key}
                    active={tab.active}
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
    </div>
  );
}
