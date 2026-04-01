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

export type EntryEditorBlock = EntryTextBlock | EntryProtocolBlock;

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

    return {
      id: block.id,
      type: "protocol",
      protocolId: block.protocolId ?? "",
    };
  });
}

export function serializeEntryEditorValue(blocks: EntryEditorBlock[]) {
  const value: SerializedEntryEditorValue = {
    blocks: normalizeEntryEditorBlocks(blocks),
  };

  return JSON.stringify(value);
}
