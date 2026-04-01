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

export interface EntryTableBlock {
  id: string;
  type: "table";
  columns: string[];
  rows: string[][];
}

export type EntryEditorBlock =
  | EntryTextBlock
  | EntryProtocolBlock
  | EntryTableBlock;

export interface ProtocolOption {
  id: string;
  title: string;
  slug: string;
  summary?: string | null;
  status?: string | null;
}

export interface SerializedEntryEditorValue {
  blocks: EntryEditorBlock[];
}

export function createTextBlock(): EntryTextBlock {
  return {
    id: crypto.randomUUID(),
    type: "text",
    content: "",
  };
}

export function createProtocolBlock(protocolId = ""): EntryProtocolBlock {
  return {
    id: crypto.randomUUID(),
    type: "protocol",
    protocolId,
  };
}

export function createTableBlock(): EntryTableBlock {
  return {
    id: crypto.randomUUID(),
    type: "table",
    columns: ["Column 1", "Column 2", "Column 3"],
    rows: [
      ["", "", ""],
      ["", "", ""],
    ],
  };
}

export function createDefaultEntryBlocks(): EntryEditorBlock[] {
  return [createTextBlock()];
}

export function normalizeEntryEditorBlocks(
  blocks: EntryEditorBlock[],
): EntryEditorBlock[] {
  return blocks.map((block) => {
    if (block.type === "text") {
      return {
        id: block.id,
        type: "text",
        content: block.content ?? "",
      };
    }

    if (block.type === "protocol") {
      return {
        id: block.id,
        type: "protocol",
        protocolId: block.protocolId ?? "",
      };
    }

    const columns = block.columns?.length
      ? block.columns.map((column) => column ?? "")
      : ["Column 1", "Column 2"];
    const rows = (block.rows ?? []).map((row) =>
      Array.from({ length: columns.length }, (_, index) => row[index] ?? ""),
    );

    return {
      id: block.id,
      type: "table",
      columns,
      rows,
    };
  });
}

export function serializeEntryEditorValue(blocks: EntryEditorBlock[]) {
  const value: SerializedEntryEditorValue = {
    blocks: normalizeEntryEditorBlocks(blocks),
  };

  return JSON.stringify(value);
}
