import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import type {
  PlanningTaskOrderGroup,
  PlanningTaskStatusValue,
} from "@biota/db";
import { planningTaskStatuses, reorderPlanningTasksForUser } from "@biota/db";
import { isDemoAuthMode } from "@/lib/auth/demo.server";
import { requireServerSession } from "@/lib/auth/session";
import { reorderDemoPlanningTasks } from "@/lib/notebook/demo-store";

function normalizeStatus(value: unknown): PlanningTaskStatusValue {
  return planningTaskStatuses.includes(value as PlanningTaskStatusValue)
    ? (value as PlanningTaskStatusValue)
    : "QUEUED";
}

function normalizeTaskOrders(value: unknown): PlanningTaskOrderGroup[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((group) => {
      if (
        typeof group !== "object" ||
        group === null ||
        !("experimentId" in group) ||
        !("taskIds" in group) ||
        typeof group.experimentId !== "string" ||
        !Array.isArray(group.taskIds)
      ) {
        return null;
      }

      return {
        experimentId: group.experimentId,
        status: normalizeStatus("status" in group ? group.status : undefined),
        taskIds: group.taskIds.filter(
          (taskId: unknown): taskId is string => typeof taskId === "string",
        ),
      };
    })
    .filter((group): group is PlanningTaskOrderGroup => Boolean(group));
}

export async function POST(request: Request) {
  const session = await requireServerSession();
  const payload = (await request.json().catch(() => ({}))) as {
    whiteboardId?: unknown;
    taskId?: unknown;
    targetExperimentId?: unknown;
    status?: unknown;
    taskOrders?: unknown;
  };

  if (
    typeof payload.taskId !== "string" ||
    typeof payload.targetExperimentId !== "string"
  ) {
    return NextResponse.json(
      { error: "Missing task or target experiment." },
      { status: 400 },
    );
  }

  const input = {
    taskId: payload.taskId,
    targetExperimentId: payload.targetExperimentId,
    status: normalizeStatus(payload.status),
    taskOrders: normalizeTaskOrders(payload.taskOrders),
  };
  const result = isDemoAuthMode()
    ? await reorderDemoPlanningTasks(input)
    : await reorderPlanningTasksForUser({
        userId: session.user.id,
        ...input,
      });

  revalidatePath("/planning");

  if (typeof payload.whiteboardId === "string") {
    revalidatePath(`/planning/${payload.whiteboardId}`);
  }

  return NextResponse.json({ ok: true, task: result });
}
