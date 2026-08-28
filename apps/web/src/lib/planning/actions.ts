"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { PlanningTaskStatusValue } from "@biota/db";
import {
  createPlanningExperimentForUser,
  createPlanningProjectForUser,
  createPlanningTaskForUser,
  createPlanningWhiteboardForUser,
  deletePlanningExperimentForUser,
  deletePlanningProjectForUser,
  deletePlanningTaskForUser,
  deletePlanningWhiteboardForUser,
  planningTaskStatuses,
  updatePlanningExperimentForUser,
  updatePlanningProjectForUser,
  updatePlanningTaskForUser,
  updatePlanningWhiteboardForUser,
} from "@biota/db";
import { isDemoAuthMode } from "@/lib/auth/demo.server";
import { requireServerSession } from "@/lib/auth/session";
import {
  createDemoPlanningExperiment,
  createDemoPlanningProject,
  createDemoPlanningTask,
  createDemoPlanningWhiteboard,
  deleteDemoPlanningExperiment,
  deleteDemoPlanningProject,
  deleteDemoPlanningTask,
  deleteDemoPlanningWhiteboard,
  updateDemoPlanningExperiment,
  updateDemoPlanningProject,
  updateDemoPlanningTask,
  updateDemoPlanningWhiteboard,
} from "@/lib/notebook/demo-store";

function readString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value : "";
}

function readOptionalString(formData: FormData, key: string) {
  const value = readString(formData, key).trim();

  return value || null;
}

function readTaskStatus(formData: FormData) {
  const value = readString(formData, "status").trim();

  return planningTaskStatuses.includes(value as PlanningTaskStatusValue)
    ? (value as PlanningTaskStatusValue)
    : "QUEUED";
}

function readEntryIds(formData: FormData) {
  return formData
    .getAll("linkedEntryIds")
    .filter((value): value is string => typeof value === "string");
}

function revalidatePlanningSurfaces(whiteboardId?: string | null) {
  revalidatePath("/");
  revalidatePath("/planning");

  if (whiteboardId) {
    revalidatePath(`/planning/${whiteboardId}`);
  }
}

export async function createPlanningWhiteboardAction(formData: FormData) {
  const session = await requireServerSession();
  const input = {
    title: readString(formData, "title"),
  };
  const whiteboard = isDemoAuthMode()
    ? await createDemoPlanningWhiteboard(input)
    : await createPlanningWhiteboardForUser({
        userId: session.user.id,
        ...input,
      });

  revalidatePlanningSurfaces(whiteboard.id);
  redirect(`/planning/${whiteboard.id}`);
}

export async function updatePlanningWhiteboardAction(formData: FormData) {
  const session = await requireServerSession();
  const whiteboardId = readString(formData, "whiteboardId").trim();

  if (!whiteboardId) {
    return;
  }

  const input = {
    whiteboardId,
    title: readString(formData, "title"),
  };

  if (isDemoAuthMode()) {
    await updateDemoPlanningWhiteboard(input);
  } else {
    await updatePlanningWhiteboardForUser({
      userId: session.user.id,
      ...input,
    });
  }

  revalidatePlanningSurfaces(whiteboardId);
}

export async function deletePlanningWhiteboardAction(formData: FormData) {
  const session = await requireServerSession();
  const whiteboardId = readString(formData, "whiteboardId").trim();

  if (!whiteboardId) {
    return;
  }

  if (isDemoAuthMode()) {
    await deleteDemoPlanningWhiteboard({ whiteboardId });
  } else {
    await deletePlanningWhiteboardForUser({
      userId: session.user.id,
      whiteboardId,
    });
  }

  revalidatePlanningSurfaces(whiteboardId);
  redirect("/planning");
}

export async function createPlanningProjectAction(formData: FormData) {
  const session = await requireServerSession();
  const whiteboardId = readString(formData, "whiteboardId").trim();

  if (!whiteboardId) {
    return;
  }

  const input = {
    whiteboardId,
    title: readString(formData, "title"),
    startDate: readOptionalString(formData, "startDate"),
    endDate: readOptionalString(formData, "endDate"),
  };

  if (isDemoAuthMode()) {
    await createDemoPlanningProject(input);
  } else {
    await createPlanningProjectForUser({
      userId: session.user.id,
      ...input,
    });
  }

  revalidatePlanningSurfaces(whiteboardId);
}

export async function updatePlanningProjectAction(formData: FormData) {
  const session = await requireServerSession();
  const whiteboardId = readString(formData, "whiteboardId").trim();
  const projectId = readString(formData, "projectId").trim();

  if (!whiteboardId || !projectId) {
    return;
  }

  const input = {
    whiteboardId,
    projectId,
    title: readString(formData, "title"),
    startDate: readOptionalString(formData, "startDate"),
    endDate: readOptionalString(formData, "endDate"),
  };

  if (isDemoAuthMode()) {
    await updateDemoPlanningProject(input);
  } else {
    await updatePlanningProjectForUser({
      userId: session.user.id,
      ...input,
    });
  }

  revalidatePlanningSurfaces(whiteboardId);
}

export async function deletePlanningProjectAction(formData: FormData) {
  const session = await requireServerSession();
  const whiteboardId = readString(formData, "whiteboardId").trim();
  const id = readString(formData, "projectId").trim();

  if (!whiteboardId || !id) {
    return;
  }

  if (isDemoAuthMode()) {
    await deleteDemoPlanningProject({ id });
  } else {
    await deletePlanningProjectForUser({
      userId: session.user.id,
      id,
    });
  }

  revalidatePlanningSurfaces(whiteboardId);
}

export async function createPlanningExperimentAction(formData: FormData) {
  const session = await requireServerSession();
  const whiteboardId = readString(formData, "whiteboardId").trim();
  const projectId = readString(formData, "projectId").trim();

  if (!whiteboardId || !projectId) {
    return;
  }

  const input = {
    projectId,
    title: readString(formData, "title"),
    startDate: readOptionalString(formData, "startDate"),
    endDate: readOptionalString(formData, "endDate"),
  };

  if (isDemoAuthMode()) {
    await createDemoPlanningExperiment(input);
  } else {
    await createPlanningExperimentForUser({
      userId: session.user.id,
      ...input,
    });
  }

  revalidatePlanningSurfaces(whiteboardId);
}

export async function updatePlanningExperimentAction(formData: FormData) {
  const session = await requireServerSession();
  const whiteboardId = readString(formData, "whiteboardId").trim();
  const projectId = readString(formData, "projectId").trim();
  const experimentId = readString(formData, "experimentId").trim();

  if (!whiteboardId || !projectId || !experimentId) {
    return;
  }

  const input = {
    projectId,
    experimentId,
    title: readString(formData, "title"),
    startDate: readOptionalString(formData, "startDate"),
    endDate: readOptionalString(formData, "endDate"),
  };

  if (isDemoAuthMode()) {
    await updateDemoPlanningExperiment(input);
  } else {
    await updatePlanningExperimentForUser({
      userId: session.user.id,
      ...input,
    });
  }

  revalidatePlanningSurfaces(whiteboardId);
}

export async function deletePlanningExperimentAction(formData: FormData) {
  const session = await requireServerSession();
  const whiteboardId = readString(formData, "whiteboardId").trim();
  const id = readString(formData, "experimentId").trim();

  if (!whiteboardId || !id) {
    return;
  }

  if (isDemoAuthMode()) {
    await deleteDemoPlanningExperiment({ id });
  } else {
    await deletePlanningExperimentForUser({
      userId: session.user.id,
      id,
    });
  }

  revalidatePlanningSurfaces(whiteboardId);
}

export async function createPlanningTaskAction(formData: FormData) {
  const session = await requireServerSession();
  const whiteboardId = readString(formData, "whiteboardId").trim();
  const experimentId = readString(formData, "experimentId").trim();

  if (!whiteboardId || !experimentId) {
    return;
  }

  const input = {
    experimentId,
    title: readString(formData, "title"),
    notes: readOptionalString(formData, "notes"),
    status: readTaskStatus(formData),
    startDate: readOptionalString(formData, "startDate"),
    endDate: readOptionalString(formData, "endDate"),
    linkedEntryIds: readEntryIds(formData),
  };

  if (isDemoAuthMode()) {
    await createDemoPlanningTask(input);
  } else {
    await createPlanningTaskForUser({
      userId: session.user.id,
      ...input,
    });
  }

  revalidatePlanningSurfaces(whiteboardId);
}

export async function updatePlanningTaskAction(formData: FormData) {
  const session = await requireServerSession();
  const whiteboardId = readString(formData, "whiteboardId").trim();
  const experimentId = readString(formData, "experimentId").trim();
  const taskId = readString(formData, "taskId").trim();

  if (!whiteboardId || !experimentId || !taskId) {
    return;
  }

  const input = {
    experimentId,
    taskId,
    title: readString(formData, "title"),
    notes: readOptionalString(formData, "notes"),
    status: readTaskStatus(formData),
    startDate: readOptionalString(formData, "startDate"),
    endDate: readOptionalString(formData, "endDate"),
    linkedEntryIds: readEntryIds(formData),
  };

  if (isDemoAuthMode()) {
    await updateDemoPlanningTask(input);
  } else {
    await updatePlanningTaskForUser({
      userId: session.user.id,
      ...input,
    });
  }

  revalidatePlanningSurfaces(whiteboardId);
}

export async function deletePlanningTaskAction(formData: FormData) {
  const session = await requireServerSession();
  const whiteboardId = readString(formData, "whiteboardId").trim();
  const id = readString(formData, "taskId").trim();

  if (!whiteboardId || !id) {
    return;
  }

  if (isDemoAuthMode()) {
    await deleteDemoPlanningTask({ id });
  } else {
    await deletePlanningTaskForUser({
      userId: session.user.id,
      id,
    });
  }

  revalidatePlanningSurfaces(whiteboardId);
}
