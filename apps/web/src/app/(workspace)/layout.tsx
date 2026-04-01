import type { ReactNode } from "react";
import { getWorkspaceSnapshotForUser } from "@biota/db";
import { AppShell } from "@/components/app-shell";
import {
  getDemoWorkspaceSnapshot,
  isDemoAuthMode,
} from "@/lib/auth/demo.server";
import { requireServerSession } from "@/lib/auth/session";
import { getWorkspaceNavigatorData } from "@/lib/notebook/data";

export const dynamic = "force-dynamic";

export default async function WorkspaceLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await requireServerSession();
  const [snapshot, navigator] = await Promise.all([
    isDemoAuthMode()
      ? Promise.resolve(getDemoWorkspaceSnapshot())
      : getWorkspaceSnapshotForUser(session.user.id),
    getWorkspaceNavigatorData(session.user.id),
  ]);

  return (
    <AppShell
      viewerName={session.user.name ?? "Biota user"}
      viewerEmail={session.user.email ?? ""}
      workspaceLabel={snapshot?.personalWorkspace?.name ?? "Personal workspace"}
      navigator={navigator}
    >
      {children}
    </AppShell>
  );
}
