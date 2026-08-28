import { notFound } from "next/navigation";
import {
  getPlanningWhiteboardForUser,
  listEntriesForUser,
  listPlanningWhiteboardsForUser,
} from "@biota/db";
import { PlanningWorkspace } from "@/components/planning/planning-workspace";
import { isDemoAuthMode } from "@/lib/auth/demo.server";
import { requireServerSession } from "@/lib/auth/session";
import {
  getDemoPlanningWhiteboard,
  listDemoEntries,
  listDemoPlanningWhiteboards,
} from "@/lib/notebook/demo-store";

type PlanningWhiteboardPageProps = {
  params: Promise<{
    whiteboardId: string;
  }>;
};

export default async function PlanningWhiteboardPage({
  params,
}: PlanningWhiteboardPageProps) {
  const session = await requireServerSession();
  const { whiteboardId } = await params;
  const demoMode = isDemoAuthMode();
  const [whiteboard, whiteboards, entries] = demoMode
    ? await Promise.all([
        getDemoPlanningWhiteboard(whiteboardId),
        listDemoPlanningWhiteboards(),
        listDemoEntries(),
      ])
    : await Promise.all([
        getPlanningWhiteboardForUser(session.user.id, whiteboardId),
        listPlanningWhiteboardsForUser(session.user.id),
        listEntriesForUser(session.user.id),
      ]);

  if (!whiteboard) {
    notFound();
  }

  return (
    <PlanningWorkspace
      initialWhiteboard={whiteboard}
      whiteboards={whiteboards}
      entries={entries}
    />
  );
}
