import type { ReactNode } from "react";
import { getWorkspaceSnapshotForUser } from "@biota/db";
import { AppShell } from "@/components/app-shell";
import { requireServerSession } from "@/lib/auth/session";

export default async function WorkspaceLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await requireServerSession();
  const snapshot = await getWorkspaceSnapshotForUser(session.user.id);

  return (
    <AppShell
      viewerName={session.user.name ?? "Biota user"}
      viewerEmail={session.user.email ?? ""}
      workspaceLabel={snapshot?.personalWorkspace?.name ?? "Personal workspace"}
    >
      {children}
    </AppShell>
  );
}
