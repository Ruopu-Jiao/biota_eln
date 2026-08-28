"use client";

import { signOut } from "next-auth/react";

type WorkspaceActionsProps = {
  workspaceLabel: string;
};

export function WorkspaceActions({ workspaceLabel }: WorkspaceActionsProps) {
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
    <div className="ml-auto flex h-full shrink-0 flex-nowrap items-center gap-2 pl-4">
      <span className="hidden h-7 shrink-0 items-center whitespace-nowrap border border-[color:var(--line)] px-2.5 text-xs text-[color:var(--text-muted)] lg:inline-flex">
        {workspaceLabel}
      </span>
      <button
        type="button"
        onClick={() => {
          void handleSignOut();
        }}
        className="inline-flex h-7 shrink-0 items-center whitespace-nowrap border border-[color:var(--line)] px-2.5 text-xs text-[color:var(--text-muted)] transition hover:border-[color:var(--line-strong)] hover:text-[color:var(--text-primary)]"
      >
        Sign out
      </button>
    </div>
  );
}
