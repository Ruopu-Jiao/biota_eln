import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { requireServerSession } from "@/lib/auth/session";
import { getWorkspaceNavigatorData } from "@/lib/notebook/data";

export const dynamic = "force-dynamic";

export default async function WorkspaceLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await requireServerSession();
  const navigator = await getWorkspaceNavigatorData(session.user.id);

  return (
    <AppShell
      viewerName={session.user.name ?? "Biota user"}
      viewerEmail={session.user.email ?? ""}
      navigator={navigator}
    >
      {children}
    </AppShell>
  );
}
