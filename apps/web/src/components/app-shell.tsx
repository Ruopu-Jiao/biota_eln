"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import type { ReactNode } from "react";

const primaryNav = [
  { label: "Entries", href: "/entries", shortcut: "1" },
  { label: "Entities", href: "/entities", shortcut: "2" },
  { label: "Protocols", href: "/protocols", shortcut: "3" },
  { label: "Graph", href: "/graph", shortcut: "4" },
  { label: "Settings", href: "/settings", shortcut: "5" },
];

const navigatorItems = [
  "Recent notes",
  "Shared folders",
  "Pinned protocol blocks",
  "Sequence entities",
  "Relation bookmarks",
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

type AppShellProps = {
  children: ReactNode;
  viewerName?: string;
  viewerEmail?: string;
  workspaceLabel?: string;
};

export function AppShell({
  children,
  viewerName = "Biota user",
  viewerEmail = "",
  workspaceLabel = "Personal workspace",
}: AppShellProps) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.16),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(14,165,233,0.14),_transparent_24%),linear-gradient(180deg,#020617_0%,#020617_45%,#07111f_100%)] text-slate-100">
      <header className="sticky top-0 z-20 border-b border-white/8 bg-slate-950/75 backdrop-blur-xl">
        <div className="flex h-16 items-center gap-4 px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10 text-sm font-semibold text-emerald-200">
              B
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold text-white">Biota ELN</p>
              <p className="text-xs text-slate-400">Workspace shell</p>
            </div>
          </div>

          <div className="hidden flex-1 items-center gap-3 rounded-2xl border border-white/8 bg-white/5 px-4 py-2 text-sm text-slate-300 md:flex">
            <span className="text-slate-500">⌘K</span>
            <span>Search entries, entities, protocols, and relations</span>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 transition hover:border-emerald-300/25 hover:bg-emerald-400/10"
            >
              New
            </button>
            <div className="rounded-xl border border-white/8 bg-white/5 px-3 py-2 text-sm text-slate-300">
              {workspaceLabel}
            </div>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/sign-in" })}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 transition hover:border-white/20 hover:bg-white/10"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="grid min-h-[calc(100vh-4rem)] grid-cols-[72px_minmax(220px,280px)_minmax(0,1fr)_minmax(280px,340px)]">
        <aside className="border-r border-white/8 bg-slate-950/55 px-3 py-4">
          <div className="space-y-2">
            {primaryNav.map((item) => {
              const active = isActive(pathname, item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex h-12 items-center justify-center rounded-2xl border text-xs font-medium transition ${
                    active
                      ? "border-emerald-400/25 bg-emerald-400/15 text-emerald-100"
                      : "border-white/8 bg-white/5 text-slate-400 hover:border-white/15 hover:bg-white/10 hover:text-slate-100"
                  }`}
                  aria-label={item.label}
                  title={`${item.label} (${item.shortcut})`}
                >
                  {item.shortcut}
                </Link>
              );
            })}
          </div>
        </aside>

        <aside className="border-r border-white/8 bg-slate-950/45 px-4 py-5">
          <p className="text-xs uppercase tracking-[0.28em] text-slate-500">
            Navigator
          </p>
          <div className="mt-4 space-y-2">
            {navigatorItems.map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-white/8 bg-white/5 px-3 py-3 text-sm text-slate-200"
              >
                {item}
              </div>
            ))}
          </div>
        </aside>

        <main className="px-4 py-5 lg:px-6">
          <div className="mb-5 flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-slate-500">
            <span>{pathname === "/" ? "Home" : pathname.slice(1)}</span>
            <span className="text-slate-700">/</span>
            <span>Tab workspace</span>
          </div>
          <div className="rounded-[32px] border border-white/8 bg-slate-950/50 p-5 shadow-[0_20px_80px_rgba(0,0,0,0.3)]">
            {children}
          </div>
        </main>

        <aside className="border-l border-white/8 bg-slate-950/45 px-4 py-5">
          <p className="text-xs uppercase tracking-[0.28em] text-slate-500">
            Inspector
          </p>
          <div className="mt-4 space-y-4">
            <section className="rounded-2xl border border-white/8 bg-white/5 p-4">
              <h2 className="text-sm font-semibold text-white">Metadata</h2>
              <dl className="mt-3 space-y-2 text-sm text-slate-300">
                <div className="flex items-center justify-between gap-3">
                  <dt>Owner</dt>
                  <dd className="text-white">{viewerName}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt>Status</dt>
                  <dd className="text-emerald-200">Foundation</dd>
                </div>
                {viewerEmail ? (
                  <div className="flex items-center justify-between gap-3">
                    <dt>Email</dt>
                    <dd className="truncate text-white">{viewerEmail}</dd>
                  </div>
                ) : null}
              </dl>
            </section>

            <section className="rounded-2xl border border-white/8 bg-white/5 p-4">
              <h2 className="text-sm font-semibold text-white">Links</h2>
              <div className="mt-3 space-y-2 text-sm text-slate-300">
                <div className="rounded-xl border border-white/8 bg-slate-950/50 px-3 py-2">
                  Backlinks will appear here.
                </div>
                <div className="rounded-xl border border-white/8 bg-slate-950/50 px-3 py-2">
                  Related entities and protocols will land here.
                </div>
              </div>
            </section>
          </div>
        </aside>
      </div>
    </div>
  );
}
