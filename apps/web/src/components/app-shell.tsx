"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useState, type ReactNode, type SVGProps } from "react";
import type { NotebookNavigatorData, NotebookNavigatorFolder } from "@biota/db";
import { ThemeSwitcher } from "@/components/theme/theme-switcher";

type IconProps = SVGProps<SVGSVGElement>;

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

function HelixIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...props}>
      <path d="M7 4.5c4.5 0 5.5 4 10 4" />
      <path d="M7 19.5c4.5 0 5.5-4 10-4" />
      <path d="M7 4.5c0 4.5 4 5.5 4 10" />
      <path d="M17 19.5c0-4.5-4-5.5-4-10" />
      <path d="M6.5 8.5h11" />
      <path d="M6.5 15.5h11" />
    </svg>
  );
}

function ProtocolIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...props}>
      <path d="M7 4.75h10" />
      <path d="M7 9h10" />
      <path d="M7 13.25h6.5" />
      <path d="M5.5 3.5h13v17h-13z" />
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

const primaryNav = [
  { label: "Entries", href: "/entries", Icon: NotebookIcon },
  { label: "Entities", href: "/entities", Icon: HelixIcon },
  { label: "Protocols", href: "/protocols", Icon: ProtocolIcon },
  { label: "Graph", href: "/graph", Icon: GraphIcon },
  { label: "Settings", href: "/settings", Icon: SettingsIcon },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function titleFromPath(pathname: string) {
  if (pathname === "/") {
    return "Workspace";
  }

  if (pathname.startsWith("/entries/")) {
    return "Entry";
  }

  if (pathname.startsWith("/protocols/")) {
    return "Protocol";
  }

  return pathname.slice(1).replaceAll("/", " / ");
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

function NavigatorFolderTree({
  folder,
  pathname,
  depth,
  openByFolderId,
  onToggle,
}: {
  folder: NotebookNavigatorFolder;
  pathname: string;
  depth: number;
  openByFolderId: Record<string, boolean>;
  onToggle: (folderId: string) => void;
}) {
  const isOpen = openByFolderId[folder.id] ?? true;
  const hasChildren = folder.childFolders.length > 0 || folder.entries.length > 0;

  return (
    <div>
      <button
        type="button"
        onClick={() => onToggle(folder.id)}
        className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm text-[color:var(--text-muted)] transition hover:text-[color:var(--text-primary)]"
        style={{ paddingLeft: `${depth * 14 + 8}px` }}
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

      {isOpen ? (
        <div className="space-y-0.5">
          {folder.entries.map((entry) => {
            const active = pathname === `/entries/${entry.id}`;

            return (
              <Link
                key={entry.id}
                href={`/entries/${entry.id}`}
                className={`flex items-center gap-2 px-2 py-1.5 text-sm transition ${
                  active
                    ? "bg-[color:var(--accent-muted)] text-[color:var(--text-primary)]"
                    : "text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)]"
                }`}
                style={{ paddingLeft: `${depth * 14 + 32}px` }}
              >
                <EntryIcon className="h-4 w-4 shrink-0" />
                <span className="min-w-0 truncate">{entry.title}</span>
                <span className="ml-auto text-[10px] uppercase tracking-[0.14em] text-[color:var(--text-soft)]">
                  v{entry.latestVersionNumber}
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

export function AppShell({
  children,
  viewerName = "Biota user",
  viewerEmail = "",
  workspaceLabel = "Personal workspace",
  navigator = null,
}: AppShellProps) {
  const pathname = usePathname();
  const demoMode = process.env.NEXT_PUBLIC_BIOTA_DEMO_MODE === "true";
  const [openByFolderId, setOpenByFolderId] = useState<Record<string, boolean>>(
    () => collectFolderState(navigator?.folders ?? []),
  );

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

  return (
    <div className="min-h-screen bg-[color:var(--bg)] text-[color:var(--text-primary)]">
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
              <span>Search entries, entities, protocols, and linked relations</span>
            </div>
          </div>

          <div className="flex items-center gap-2 pl-4">
            <ThemeSwitcher />
            <Link
              href="/entries"
              className="inline-flex items-center border border-[color:var(--line)] px-3 py-2 text-sm text-[color:var(--text-muted)] transition hover:border-[color:var(--line-strong)] hover:text-[color:var(--text-primary)]"
            >
              New entry
            </Link>
            <div className="hidden border border-[color:var(--line)] px-3 py-2 text-sm text-[color:var(--text-muted)] lg:block">
              {workspaceLabel}
            </div>
            <button
              type="button"
              onClick={() => {
                void handleSignOut();
              }}
              className="inline-flex items-center border border-[color:var(--line)] px-3 py-2 text-sm text-[color:var(--text-muted)] transition hover:border-[color:var(--line-strong)] hover:text-[color:var(--text-primary)]"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="grid min-h-[calc(100vh-4rem)] grid-cols-[72px_minmax(240px,320px)_minmax(0,1fr)_minmax(260px,320px)]">
        <aside className="border-r border-[color:var(--line)] bg-[color:var(--surface-muted)] px-2 py-4">
          <div className="space-y-2">
            {primaryNav.map((item) => {
              const active = isActive(pathname, item.href);
              const Icon = item.Icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex h-11 items-center justify-center border transition ${
                    active
                      ? "border-[color:var(--accent-soft)] bg-[color:var(--accent-muted)] text-[color:var(--text-primary)]"
                      : "border-[color:var(--line)] text-[color:var(--text-muted)] hover:border-[color:var(--line-strong)] hover:text-[color:var(--text-primary)]"
                  }`}
                  aria-label={item.label}
                  title={item.label}
                >
                  <Icon className="h-5 w-5" />
                </Link>
              );
            })}
          </div>
        </aside>

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
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[color:var(--text-soft)]">
              Files
            </span>
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
                />
              ))
            ) : (
              <p className="px-2 py-4 text-sm leading-7 text-[color:var(--text-soft)]">
                Folders and entries will appear here as the notebook grows.
              </p>
            )}

            {navigator?.unfiledEntries.length ? (
              <div className="border-t border-[color:var(--line)] pt-3">
                <p className="px-2 text-[11px] uppercase tracking-[0.18em] text-[color:var(--text-soft)]">
                  Unfiled
                </p>
                <div className="mt-2 space-y-0.5">
                  {navigator.unfiledEntries.map((entry) => {
                    const active = pathname === `/entries/${entry.id}`;

                    return (
                      <Link
                        key={entry.id}
                        href={`/entries/${entry.id}`}
                        className={`flex items-center gap-2 px-2 py-1.5 text-sm transition ${
                          active
                            ? "bg-[color:var(--accent-muted)] text-[color:var(--text-primary)]"
                            : "text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)]"
                        }`}
                      >
                        <EntryIcon className="h-4 w-4" />
                        <span className="truncate">{entry.title}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        </aside>

        <main className="px-5 py-5 lg:px-7">
          <div className="mb-5 flex items-center gap-2 border-b border-[color:var(--line)] pb-4 font-mono text-[11px] uppercase tracking-[0.22em] text-[color:var(--text-soft)]">
            <span>{titleFromPath(pathname)}</span>
            <span className="text-[color:var(--line-strong)]">/</span>
            <span>Workspace</span>
          </div>
          <div>{children}</div>
        </main>

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
      </div>
    </div>
  );
}
