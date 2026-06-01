"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { DNAFeature, SequenceEntityType } from "@biota/bio";
import { requireServerSession } from "@/lib/auth/session";
import {
  addStoredSequenceEntityFeature,
  parseEntityFeaturePayload,
  removeStoredSequenceEntityFeature,
  updateStoredSequenceEntityDraft,
} from "@/lib/entities/store";

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function buildEntityRedirect(entityId: string, view: string) {
  const params = new URLSearchParams();

  if (view) {
    params.set("view", view);
  }

  const query = params.toString();

  return query
    ? `/entities/${encodeURIComponent(entityId)}?${query}`
    : `/entities/${encodeURIComponent(entityId)}`;
}

function revalidateEntitySurfaces(entityId: string) {
  revalidatePath("/entities");
  revalidatePath("/stats");
  revalidatePath("/entries");
  revalidatePath(`/entities/${entityId}`);
}

export async function updateStoredSequenceEntityDraftAction(formData: FormData) {
  await requireServerSession();

  const entityId = readString(formData, "entityId").trim();
  const rawSequence = readString(formData, "sequence");
  const safeSequenceLength = Math.max(rawSequence.trim().length, 1);
  const view = readString(formData, "view").trim() || "sequence";

  if (!entityId) {
    return;
  }

  await updateStoredSequenceEntityDraft({
    entityId,
    name: readString(formData, "name"),
    description: readString(formData, "description"),
    entityType: (readString(formData, "entityType") || "plasmid") as SequenceEntityType,
    topology: readString(formData, "topology") === "linear" ? "linear" : "circular",
    sequence: rawSequence,
    purpose: readString(formData, "purpose"),
    defaultMotif: readString(formData, "defaultMotif"),
    featureSummary: readString(formData, "featureSummary"),
    notes: readString(formData, "notes"),
    aliases: readString(formData, "aliases")
      .split(",")
      .map((alias) => alias.trim())
      .filter(Boolean),
    features: parseEntityFeaturePayload(
      readString(formData, "featuresJson"),
      safeSequenceLength,
    ),
  });

  revalidateEntitySurfaces(entityId);
  redirect(buildEntityRedirect(entityId, view));
}

export const updateSequenceEntityDraftAction =
  updateStoredSequenceEntityDraftAction;

export async function addStoredSequenceEntityFeatureAction(formData: FormData) {
  await requireServerSession();

  const entityId = readString(formData, "entityId").trim();
  const view = readString(formData, "view").trim() || "features";

  if (!entityId) {
    return;
  }

  const strand = readString(formData, "strand") === "-1" ? -1 : 1;
  const start = Number(readString(formData, "start")) || 1;
  const end = Number(readString(formData, "end")) || start;

  await addStoredSequenceEntityFeature({
    entityId,
    name: readString(formData, "name"),
    type: (readString(formData, "type") || "misc") as DNAFeature["type"],
    start,
    end,
    strand,
    notes: readString(formData, "notes"),
  });

  revalidateEntitySurfaces(entityId);
  redirect(buildEntityRedirect(entityId, view));
}

export async function removeStoredSequenceEntityFeatureAction(formData: FormData) {
  await requireServerSession();

  const entityId = readString(formData, "entityId").trim();
  const featureId = readString(formData, "featureId").trim();
  const view = readString(formData, "view").trim() || "features";

  if (!entityId || !featureId) {
    return;
  }

  await removeStoredSequenceEntityFeature({
    entityId,
    featureId,
  });

  revalidateEntitySurfaces(entityId);
  redirect(buildEntityRedirect(entityId, view));
}
