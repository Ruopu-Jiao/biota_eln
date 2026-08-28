import { NextResponse } from "next/server";
import type { EntryBlock } from "@biota/db";
import { autosaveEntryDraftForUser } from "@biota/db";
import { isDemoAuthMode } from "@/lib/auth/demo.server";
import { requireServerSession } from "@/lib/auth/session";
import { autosaveDemoEntryDraft } from "@/lib/notebook/demo-store";

type AutosaveRouteContext = {
  params: Promise<{
    entryId: string;
  }>;
};

function normalizeEntryTitle(value: unknown) {
  const title = typeof value === "string" ? value.trim() : "";

  return title || "Untitled entry";
}

function parseEntryBlocksJson(rawValue: unknown): EntryBlock[] {
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
            block.type === "entity" &&
            "entityId" in block &&
            typeof block.entityId === "string"
          ) {
            return {
              id: block.id,
              type: "entity" as const,
              entityId: block.entityId,
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
              name:
                "name" in block && typeof block.name === "string"
                  ? block.name
                  : undefined,
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

export async function POST(request: Request, { params }: AutosaveRouteContext) {
  const session = await requireServerSession();
  const { entryId } = await params;
  const payload = (await request.json().catch(() => ({}))) as {
    title?: unknown;
    summary?: unknown;
    blocksJson?: unknown;
  };
  const normalizedEntryId = entryId.trim();

  if (!normalizedEntryId) {
    return NextResponse.json({ error: "Missing entry id." }, { status: 400 });
  }

  const input = {
    entryId: normalizedEntryId,
    title: normalizeEntryTitle(payload.title),
    summary: typeof payload.summary === "string" ? payload.summary : undefined,
    blocks: parseEntryBlocksJson(payload.blocksJson),
  };

  const demoMode = isDemoAuthMode();
  const savedEntry = demoMode
    ? await autosaveDemoEntryDraft(input)
    : await autosaveEntryDraftForUser({
        userId: session.user.id,
        ...input,
      });

  return NextResponse.json({ ok: true, entry: savedEntry });
}
