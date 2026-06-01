export interface EntryTextBlock {
  id: string;
  type: "text";
  content: string;
}

export interface EntryProtocolBlock {
  id: string;
  type: "protocol";
  protocolId: string;
}

export interface EntryEntityBlock {
  id: string;
  type: "entity";
  entityId: string;
}

export interface EntryTableBlock {
  id: string;
  type: "table";
  name?: string;
  columns: string[];
  rows: string[][];
}

export type EntryEditorBlock =
  | EntryTextBlock
  | EntryProtocolBlock
  | EntryEntityBlock
  | EntryTableBlock;

export interface ProtocolOption {
  id: string;
  title: string;
  slug: string;
  summary?: string | null;
  status?: string | null;
}

export interface EntityOption {
  id: string;
  title: string;
  slug: string;
  typeLabel: string;
  summary?: string | null;
  sequenceLength: number;
  topology: "linear" | "circular";
}

export interface SerializedEntryEditorValue {
  blocks: EntryEditorBlock[];
}

export function getSpreadsheetColumnLabel(index: number) {
  let label = "";
  let current = index;

  do {
    label = String.fromCharCode(65 + (current % 26)) + label;
    current = Math.floor(current / 26) - 1;
  } while (current >= 0);

  return label;
}

export function buildSpreadsheetColumns(count: number) {
  return Array.from({ length: Math.max(1, count) }, (_, index) =>
    getSpreadsheetColumnLabel(index),
  );
}

export function createTextBlock(content = ""): EntryTextBlock {
  return {
    id: crypto.randomUUID(),
    type: "text",
    content,
  };
}

export function createProtocolBlock(protocolId = ""): EntryProtocolBlock {
  return {
    id: crypto.randomUUID(),
    type: "protocol",
    protocolId,
  };
}

export function createEntityBlock(entityId = ""): EntryEntityBlock {
  return {
    id: crypto.randomUUID(),
    type: "entity",
    entityId,
  };
}

export function createTableBlock(): EntryTableBlock {
  return {
    id: crypto.randomUUID(),
    type: "table",
    columns: buildSpreadsheetColumns(3),
    rows: [
      ["", "", ""],
      ["", "", ""],
    ],
  };
}

export function createDefaultEntryBlocks(): EntryEditorBlock[] {
  return [createTextBlock()];
}

function normalizeTextBlock(block: EntryTextBlock): EntryTextBlock {
  return {
    id: block.id,
    type: "text",
    content: block.content ?? "",
  };
}

function normalizeProtocolBlock(block: EntryProtocolBlock): EntryProtocolBlock {
  return {
    id: block.id,
    type: "protocol",
    protocolId: block.protocolId ?? "",
  };
}

function normalizeEntityBlock(block: EntryEntityBlock): EntryEntityBlock {
  return {
    id: block.id,
    type: "entity",
    entityId: block.entityId ?? "",
  };
}

function normalizeTableBlock(block: EntryTableBlock): EntryTableBlock {
  const columns = buildSpreadsheetColumns(block.columns?.length || 2);
  const rows = (block.rows ?? []).map((row) =>
    Array.from({ length: columns.length }, (_, index) => row[index] ?? ""),
  );

  return {
    id: block.id,
    type: "table",
    name: block.name?.trim() ? block.name : undefined,
    columns,
    rows,
  };
}

export function normalizeEntryEditorBlocks(
  blocks: EntryEditorBlock[],
): EntryEditorBlock[] {
  return blocks.map((block) => {
    if (block.type === "text") {
      return normalizeTextBlock(block);
    }

    if (block.type === "protocol") {
      return normalizeProtocolBlock(block);
    }

    if (block.type === "entity") {
      return normalizeEntityBlock(block);
    }

    return normalizeTableBlock(block);
  });
}

function mergeTextContent(previous: string, next: string) {
  if (!previous) {
    return next;
  }

  if (!next) {
    return previous;
  }

  if (previous.endsWith("\n") || next.startsWith("\n")) {
    return `${previous}${next}`;
  }

  return `${previous}\n\n${next}`;
}

export function compactEntryEditorBlocks(
  blocks: EntryEditorBlock[],
): EntryEditorBlock[] {
  const normalizedBlocks = normalizeEntryEditorBlocks(blocks);
  const compacted = normalizedBlocks.reduce<EntryEditorBlock[]>((result, block) => {
    if (block.type === "text") {
      const previous = result.at(-1);

      if (previous?.type === "text") {
        previous.content = mergeTextContent(previous.content, block.content);
        return result;
      }

      result.push({
        ...block,
        content: block.content,
      });
      return result;
    }

    result.push(block);
    return result;
  }, []);

  const filtered = compacted.filter((block) => {
    if (block.type !== "text") {
      return true;
    }

    return block.content.trim().length > 0;
  });

  if (!filtered.length) {
    return [createTextBlock()];
  }

  return filtered;
}

export function ensureInlineEntryEditorBlocks(
  blocks: EntryEditorBlock[],
): EntryEditorBlock[] {
  const normalizedBlocks = normalizeEntryEditorBlocks(blocks);
  const inlineBlocks: EntryEditorBlock[] = [];

  for (const block of normalizedBlocks) {
    const previous = inlineBlocks.at(-1);

    if (block.type === "text" && previous?.type === "text") {
      previous.content = mergeTextContent(previous.content, block.content);
      continue;
    }

    if (!previous && block.type !== "text") {
      inlineBlocks.push(createTextBlock());
    }

    if (previous && previous.type !== "text" && block.type !== "text") {
      inlineBlocks.push(createTextBlock());
    }

    inlineBlocks.push(block);
  }

  const last = inlineBlocks.at(-1);

  if (!last || last.type !== "text") {
    inlineBlocks.push(createTextBlock());
  }

  return inlineBlocks.length ? inlineBlocks : [createTextBlock()];
}

export function getSerializableEntryEditorBlocks(
  blocks: EntryEditorBlock[],
) {
  const compactedBlocks = compactEntryEditorBlocks(blocks);
  const firstTextBlock = normalizeEntryEditorBlocks(blocks).find(
    (block): block is EntryTextBlock => block.type === "text",
  );

  return compactedBlocks.length
    ? compactedBlocks
    : [
        {
          id: firstTextBlock?.id ?? "text-initial",
          type: "text" as const,
          content: "",
        },
      ];
}

export function serializeEntryEditorValue(blocks: EntryEditorBlock[]) {
  const value: SerializedEntryEditorValue = {
    blocks: getSerializableEntryEditorBlocks(blocks),
  };

  return JSON.stringify(value);
}
