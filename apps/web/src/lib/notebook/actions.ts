"use server";

import { revalidatePath } from "next/cache";
import { createEntryDraftForUser, createProtocolDraftForUser } from "@biota/db";
import { isDemoAuthMode } from "@/lib/auth/demo.server";
import { requireServerSession } from "@/lib/auth/session";
import {
  createDemoEntryDraft,
  createDemoProtocolDraft,
} from "@/lib/notebook/demo-store";

function readOptionalString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value : "";
}

function revalidateNotebookSurfaces() {
  revalidatePath("/");
  revalidatePath("/entries");
  revalidatePath("/protocols");
}

export async function createProtocolDraftAction(formData: FormData) {
  const session = await requireServerSession();
  const title = readOptionalString(formData, "title").trim();

  if (!title) {
    return;
  }

  const input = {
    title,
    summary: readOptionalString(formData, "summary"),
    bodyText: readOptionalString(formData, "bodyText"),
  };

  if (isDemoAuthMode()) {
    await createDemoProtocolDraft(input);
  } else {
    await createProtocolDraftForUser({
      userId: session.user.id,
      ...input,
    });
  }

  revalidateNotebookSurfaces();
}

export async function createEntryDraftAction(formData: FormData) {
  const session = await requireServerSession();
  const title = readOptionalString(formData, "title").trim();

  if (!title) {
    return;
  }

  const input = {
    title,
    summary: readOptionalString(formData, "summary"),
    bodyText: readOptionalString(formData, "bodyText"),
    linkedProtocolIds: formData
      .getAll("linkedProtocolIds")
      .filter((value): value is string => typeof value === "string"),
  };

  if (isDemoAuthMode()) {
    await createDemoEntryDraft(input);
  } else {
    await createEntryDraftForUser({
      userId: session.user.id,
      ...input,
    });
  }

  revalidateNotebookSurfaces();
}
