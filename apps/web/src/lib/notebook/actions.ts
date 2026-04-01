"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { EntryBlock } from "@biota/db";
import {
  createEntryDraftForUser,
  createProtocolDraftForUser,
  updateEntryDraftForUser,
} from "@biota/db";
import { isDemoAuthMode } from "@/lib/auth/demo.server";
import { requireServerSession } from "@/lib/auth/session";
import {
  createDemoEntryDraft,
  createDemoProtocolDraft,
  updateDemoEntryDraft,
} from "@/lib/notebook/demo-store";

function readOptionalString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value : "";
}

function readPresentString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value : undefined;
}

function normalizeEntryTitle(value: string | undefined) {
  const title = value?.trim();

  return title ? title : "Untitled entry";
}

function revalidateNotebookSurfaces() {
  revalidatePath("/");
  revalidatePath("/entries");
  revalidatePath("/protocols");
}

function parseEntryBlocksJson(formData: FormData): EntryBlock[] {
  const rawValue = formData.get("blocksJson");

  if (typeof rawValue !== "string" || !rawValue.trim()) {
    return [
      {
        id: "text-initial",
        type: "text",
        text: "",
      },
    ];
  }

  try {
    const parsed = JSON.parse(rawValue) as
      | {
          blocks?: unknown;
        }
      | unknown[];
    const rawBlocks = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.blocks)
        ? parsed.blocks
        : [];

    const blocks = rawBlocks
      .map((block) => {
        if (
          typeof block === "object" &&
          block !== null &&
          "type" in block &&
          "id" in block &&
          typeof block.id === "string"
        ) {
          if (block.type === "text") {
            const text =
              "content" in block && typeof block.content === "string"
                ? block.content
                : "text" in block && typeof block.text === "string"
                  ? block.text
                  : "";

            return {
              id: block.id,
              type: "text" as const,
              text,
            };
          }

          if (
            block.type === "protocol" &&
            "protocolId" in block &&
            typeof block.protocolId === "string"
          ) {
            return {
              id: block.id,
              type: "protocol" as const,
              protocolId: block.protocolId,
            };
          }

          if (
            block.type === "table" &&
            "columns" in block &&
            "rows" in block &&
            Array.isArray(block.columns) &&
            Array.isArray(block.rows)
          ) {
            return {
              id: block.id,
              type: "table" as const,
              columns: block.columns.map((column: unknown) =>
                typeof column === "string" ? column : "",
              ),
              rows: block.rows.map((row: unknown) =>
                Array.isArray(row)
                  ? row.map((cell: unknown) =>
                      typeof cell === "string" ? cell : "",
                    )
                  : [],
              ),
            };
          }
        }

        return null;
      })
      .filter((block): block is EntryBlock => Boolean(block));

    return blocks.length
      ? blocks
      : [
          {
            id: "text-initial",
            type: "text",
            text: "",
          },
        ];
  } catch {
    return [
      {
        id: "text-initial",
        type: "text",
        text: "",
      },
    ];
  }
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
  const title = normalizeEntryTitle(readPresentString(formData, "title"));

  const input = {
    title,
    summary: readPresentString(formData, "summary"),
    bodyText: readPresentString(formData, "bodyText"),
    linkedProtocolIds: formData
      .getAll("linkedProtocolIds")
      .filter((value): value is string => typeof value === "string"),
  };

  const entry = isDemoAuthMode()
    ? await createDemoEntryDraft(input)
    : await createEntryDraftForUser({
        userId: session.user.id,
        ...input,
      });

  revalidateNotebookSurfaces();
  redirect(`/entries/${entry.id}`);
}

export async function updateEntryDraftAction(formData: FormData) {
  const session = await requireServerSession();
  const entryId = readOptionalString(formData, "entryId").trim();

  if (!entryId) {
    return;
  }

  const input = {
    entryId,
    title: normalizeEntryTitle(readPresentString(formData, "title")),
    summary: readPresentString(formData, "summary"),
    blocks: parseEntryBlocksJson(formData),
  };

  if (isDemoAuthMode()) {
    await updateDemoEntryDraft(input);
  } else {
    await updateEntryDraftForUser({
      userId: session.user.id,
      ...input,
    });
  }

  revalidateNotebookSurfaces();
  revalidatePath(`/entries/${entryId}`);
}
