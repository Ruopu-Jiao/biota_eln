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
  const demoMode = process.env.NEXT_PUBLIC_BIOTA_DEMO_MODE === "true";

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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.08),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(56,189,248,0.08),_transparent_26%),linear-gradient(180deg,#020617_0%,#020617_34%,#06101b_100%)] text-slate-100">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/82 backdrop-blur-xl">
        <div className="grid h-16 grid-cols-[auto_minmax(0,1fr)_auto] items-stretch px-4 lg:px-6">
          <div className="flex items-center gap-3 pr-4">
            <div className="flex h-9 w-9 items-center justify-center border border-emerald-400/25 bg-emerald-400/10 text-sm font-semibold text-emerald-200">
              B
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold tracking-wide text-white">
                Biota ELN
              </p>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
                Workspace shell
              </p>
            </div>
          </div>

          <div className="hidden items-center border-x border-white/10 px-4 md:flex">
            <div className="flex w-full items-center gap-3 text-sm text-slate-300">
              <span className="text-slate-500">⌘K</span>
              <span>Search entries, entities, protocols, and relations</span>
            </div>
          </div>

          <div className="flex items-center gap-2 pl-4">
            <button
              type="button"
              className="border border-white/10 px-3 py-2 text-sm text-slate-200 transition hover:border-white/20 hover:bg-white/5"
            >
              New
            </button>
            <div className="border border-white/10 px-3 py-2 text-sm text-slate-300">
              {workspaceLabel}
            </div>
            <button
              type="button"
              onClick={() => {
                void handleSignOut();
              }}
              className="border border-white/10 px-3 py-2 text-sm text-slate-200 transition hover:border-white/20 hover:bg-white/5"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="grid min-h-[calc(100vh-4rem)] grid-cols-[72px_minmax(220px,280px)_minmax(0,1fr)_minmax(280px,340px)]">
        <aside className="border-r border-white/10 bg-slate-950/45 px-2 py-4">
          <div className="space-y-2">
            {primaryNav.map((item) => {
              const active = isActive(pathname, item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex h-11 items-center justify-center border text-xs font-medium tracking-[0.18em] transition ${
                    active
                      ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-100"
                      : "border-white/10 text-slate-400 hover:border-white/20 hover:bg-white/5 hover:text-slate-100"
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

        <aside className="border-r border-white/10 bg-slate-950/35 px-4 py-5">
          <p className="text-xs uppercase tracking-[0.32em] text-slate-500">
            Navigator
          </p>
          <div className="mt-4 divide-y divide-white/8 border-y border-white/8">
            {navigatorItems.map((item) => (
              <div
                key={item}
                className="px-1 py-3 text-sm text-slate-200"
              >
                {item}
              </div>
            ))}
          </div>
        </aside>

        <main className="px-4 py-5 lg:px-6">
          <div className="mb-5 flex items-center gap-2 text-xs uppercase tracking-[0.32em] text-slate-500">
            <span>{pathname === "/" ? "Home" : pathname.slice(1)}</span>
            <span className="text-slate-700">/</span>
            <span>Tab workspace</span>
          </div>
          <div className="border-t border-white/10 pt-5">
            {children}
          </div>
        </main>

        <aside className="border-l border-white/10 bg-slate-950/35 px-4 py-5">
          <p className="text-xs uppercase tracking-[0.32em] text-slate-500">
            Inspector
          </p>
          <div className="mt-4 divide-y divide-white/8 border-y border-white/8">
            <section className="py-4">
              <h2 className="text-sm font-semibold tracking-wide text-white">
                Metadata
              </h2>
              <dl className="mt-3 space-y-2 text-sm text-slate-300">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-slate-400">Owner</dt>
                  <dd className="text-white">{viewerName}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-slate-400">Status</dt>
                  <dd className="text-emerald-200">Foundation</dd>
                </div>
                {viewerEmail ? (
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-slate-400">Email</dt>
                    <dd className="truncate text-white">{viewerEmail}</dd>
                  </div>
                ) : null}
              </dl>
            </section>

            <section className="py-4">
              <h2 className="text-sm font-semibold tracking-wide text-white">
                Links
              </h2>
              <div className="mt-3 space-y-2 text-sm text-slate-300">
                <p className="text-slate-400">Backlinks will appear here.</p>
                <p className="text-slate-400">
                  Related entities and protocols will land here.
                </p>
              </div>
            </section>
          </div>
        </aside>
      </div>
    </div>
  );
}
