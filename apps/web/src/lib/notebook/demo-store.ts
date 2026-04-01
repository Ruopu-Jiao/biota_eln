import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type {
  CreateEntryDraftInput,
  CreateProtocolDraftInput,
  EntryBlock,
  EntryDetail,
  EntryListItem,
  NotebookContext,
  ProtocolDetail,
  ProtocolListItem,
  UpdateEntryDraftInput,
} from "@biota/db";
import {
  demoRepositoryId,
  demoRootFolderId,
  demoWorkspaceId,
  getDemoEntries,
  getDemoProtocols,
} from "@/lib/auth/demo.server";

type DemoStoreEntry = {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  status: string;
  repositoryName: string;
  folderName: string | null;
  latestVersionNumber: number;
  updatedAt: string;
  createdByName: string | null;
  bodyText: string | null;
  blocks: EntryBlock[];
  linkedProtocolIds: string[];
};

type DemoStoreProtocol = {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  status: string;
  repositoryName: string;
  folderName: string | null;
  latestVersionNumber: number;
  updatedAt: string;
  createdByName: string | null;
  bodyText: string | null;
};

type DemoNotebookStore = {
  entries: DemoStoreEntry[];
  protocols: DemoStoreProtocol[];
};

const localDataDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../.local",
);
const demoStorePath = path.join(localDataDirectory, "demo-notebook.json");

function compactSlug(value: string) {
  const base = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return base || "draft";
}

function uniqueSlug(existingSlugs: string[], preferred: string) {
  let suffix = 0;
  let candidate = preferred;

  while (existingSlugs.includes(candidate)) {
    suffix += 1;
    candidate = `${preferred}-${suffix}`;
  }

  return candidate;
}

function normalizeEntryBlocks(blocks: EntryBlock[] | undefined | null) {
  const normalized = (blocks ?? [])
    .map((block) =>
      block.type === "text"
        ? {
            ...block,
            text: block.text.trim(),
          }
        : block,
    )
    .filter((block) => block.type !== "text" || block.text.length > 0);

  if (!normalized.length) {
    return [
      {
        id: "text-initial",
        type: "text" as const,
        text: "",
      },
    ];
  }

  return normalized;
}

function buildEntryBlocksForEntry(entry: DemoStoreEntry) {
  if (entry.blocks?.length) {
    return normalizeEntryBlocks(entry.blocks);
  }

  return normalizeEntryBlocks([
    {
      id: `${entry.id}-text`,
      type: "text",
      text: entry.bodyText ?? "",
    },
    ...entry.linkedProtocolIds.map((protocolId, index) => ({
      id: `${entry.id}-protocol-${index + 1}`,
      type: "protocol" as const,
      protocolId,
    })),
  ]);
}

function deriveLinkedProtocolIds(blocks: EntryBlock[]) {
  return Array.from(
    new Set(
      blocks.flatMap((block) =>
        block.type === "protocol" ? [block.protocolId] : [],
      ),
    ),
  );
}

function deriveBodyText(
  blocks: EntryBlock[],
  protocolsById: Map<string, DemoStoreProtocol>,
) {
  const text = blocks
    .map((block) => {
      if (block.type === "text") {
        return block.text.trim();
      }

      const protocol = protocolsById.get(block.protocolId);
      return protocol ? `Protocol: ${protocol.title}` : null;
    })
    .filter((value): value is string => Boolean(value))
    .join("\n\n")
    .trim();

  return text || null;
}

function getSeedStore(): DemoNotebookStore {
  const protocols = getDemoProtocols().map((protocol) => ({
    ...protocol,
    updatedAt: protocol.updatedAt.toISOString(),
  }));
  const entries = getDemoEntries().map((entry, index) => ({
    ...entry,
    updatedAt: entry.updatedAt.toISOString(),
    blocks: normalizeEntryBlocks([
      {
        id: `${entry.id}-text`,
        type: "text",
        text: entry.bodyText ?? "",
      },
      {
        id: `${entry.id}-protocol`,
        type: "protocol",
        protocolId:
          index === 0
            ? "demo-protocol-sgrna-oligo"
            : "demo-protocol-colony-pcr",
      },
    ]),
    linkedProtocolIds:
      index === 0
        ? ["demo-protocol-sgrna-oligo"]
        : ["demo-protocol-colony-pcr"],
  }));

  return {
    entries,
    protocols,
  };
}

async function ensureDemoStore() {
  try {
    const raw = await readFile(demoStorePath, "utf8");
    return JSON.parse(raw) as DemoNotebookStore;
  } catch {
    const seed = getSeedStore();
    await mkdir(localDataDirectory, { recursive: true });
    await writeFile(demoStorePath, JSON.stringify(seed, null, 2), "utf8");
    return seed;
  }
}

async function saveDemoStore(store: DemoNotebookStore) {
  await mkdir(localDataDirectory, { recursive: true });
  await writeFile(demoStorePath, JSON.stringify(store, null, 2), "utf8");
}

export function getDemoNotebookContext(): NotebookContext {
  return {
    workspace: {
      id: demoWorkspaceId,
      name: "Demo workspace",
      slug: "demo-workspace",
    },
    repository: {
      id: demoRepositoryId,
      name: "Main notebook",
      slug: "main",
    },
    rootFolder: {
      id: demoRootFolderId,
      name: "Root",
      slug: "root",
    },
  };
}

export async function listDemoProtocols(): Promise<ProtocolListItem[]> {
  const store = await ensureDemoStore();

  return store.protocols
    .slice()
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .map((protocol) => ({
      id: protocol.id,
      title: protocol.title,
      slug: protocol.slug,
      summary: protocol.summary,
      status: protocol.status,
      repositoryName: protocol.repositoryName,
      folderName: protocol.folderName,
      latestVersionNumber: protocol.latestVersionNumber,
      updatedAt: new Date(protocol.updatedAt),
      createdByName: protocol.createdByName,
    }));
}

export async function listDemoEntries(): Promise<EntryListItem[]> {
  const store = await ensureDemoStore();
  const protocolsById = new Map(
    store.protocols.map((protocol) => [protocol.id, protocol]),
  );

  return store.entries
    .slice()
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .map((entry) => ({
      id: entry.id,
      title: entry.title,
      slug: entry.slug,
      summary: entry.summary,
      status: entry.status,
      repositoryName: entry.repositoryName,
      folderName: entry.folderName,
      latestVersionNumber: entry.latestVersionNumber,
      updatedAt: new Date(entry.updatedAt),
      createdByName: entry.createdByName,
      linkedProtocols: entry.linkedProtocolIds
        .map((protocolId) => protocolsById.get(protocolId))
        .filter((protocol): protocol is DemoStoreProtocol => Boolean(protocol))
        .map((protocol) => ({
          id: protocol.id,
          title: protocol.title,
          slug: protocol.slug,
          status: protocol.status,
        })),
    }));
}

export async function createDemoProtocolDraft(
  input: Omit<CreateProtocolDraftInput, "userId">,
) {
  const store = await ensureDemoStore();
  const title = input.title.trim();
  const now = new Date().toISOString();
  const slug = uniqueSlug(
    store.protocols.map((protocol) => protocol.slug),
    compactSlug(title),
  );

  store.protocols.unshift({
    id: `demo-protocol-${crypto.randomUUID()}`,
    title,
    slug,
    summary: input.summary?.trim() || null,
    status: "DRAFT",
    repositoryName: "Main notebook",
    folderName: "Root",
    latestVersionNumber: 1,
    updatedAt: now,
    createdByName: "Demo Researcher",
    bodyText: input.bodyText?.trim() || null,
  });

  await saveDemoStore(store);
}

export async function createDemoEntryDraft(
  input: Omit<CreateEntryDraftInput, "userId">,
) {
  const store = await ensureDemoStore();
  const title = input.title.trim();
  const now = new Date().toISOString();
  const slug = uniqueSlug(
    store.entries.map((entry) => entry.slug),
    compactSlug(title),
  );
  const validProtocolIds = new Set(store.protocols.map((protocol) => protocol.id));
  const requestedProtocolIds = Array.from(
    new Set((input.linkedProtocolIds ?? []).filter((id) => validProtocolIds.has(id))),
  );
  const blocks = normalizeEntryBlocks([
    {
      id: "text-initial",
      type: "text",
      text: input.bodyText?.trim() || "",
    },
    ...requestedProtocolIds.map((protocolId, index) => ({
      id: `protocol-${index + 1}`,
      type: "protocol" as const,
      protocolId,
    })),
  ]);
  const protocolsById = new Map(
    store.protocols.map((protocol) => [protocol.id, protocol]),
  );

  store.entries.unshift({
    id: `demo-entry-${crypto.randomUUID()}`,
    title,
    slug,
    summary: input.summary?.trim() || null,
    status: "DRAFT",
    repositoryName: "Main notebook",
    folderName: "Root",
    latestVersionNumber: 1,
    updatedAt: now,
    createdByName: "Demo Researcher",
    bodyText: deriveBodyText(blocks, protocolsById),
    blocks,
    linkedProtocolIds: deriveLinkedProtocolIds(blocks),
  });

  await saveDemoStore(store);
}

export async function getDemoEntryDetail(
  entryId: string,
): Promise<EntryDetail | null> {
  const store = await ensureDemoStore();
  const protocolsById = new Map(
    store.protocols.map((protocol) => [protocol.id, protocol]),
  );
  const entry = store.entries.find((record) => record.id === entryId);

  if (!entry) {
    return null;
  }

  return {
    id: entry.id,
    title: entry.title,
    slug: entry.slug,
    summary: entry.summary,
    status: entry.status,
    repositoryName: entry.repositoryName,
    folderName: entry.folderName,
    latestVersionNumber: entry.latestVersionNumber,
    updatedAt: new Date(entry.updatedAt),
    createdByName: entry.createdByName,
    bodyText: entry.bodyText,
    blocks: buildEntryBlocksForEntry(entry),
    linkedProtocols: entry.linkedProtocolIds
      .map((protocolId) => protocolsById.get(protocolId))
      .filter((protocol): protocol is DemoStoreProtocol => Boolean(protocol))
      .map((protocol) => ({
        id: protocol.id,
        title: protocol.title,
        slug: protocol.slug,
        status: protocol.status,
      })),
  };
}

export async function getDemoProtocolDetail(
  protocolId: string,
): Promise<ProtocolDetail | null> {
  const store = await ensureDemoStore();
  const protocol = store.protocols.find((record) => record.id === protocolId);

  if (!protocol) {
    return null;
  }

  return {
    id: protocol.id,
    title: protocol.title,
    slug: protocol.slug,
    summary: protocol.summary,
    status: protocol.status,
    repositoryName: protocol.repositoryName,
    folderName: protocol.folderName,
    latestVersionNumber: protocol.latestVersionNumber,
    updatedAt: new Date(protocol.updatedAt),
    createdByName: protocol.createdByName,
    bodyText: protocol.bodyText,
  };
}

export async function updateDemoEntryDraft(
  input: Omit<UpdateEntryDraftInput, "userId">,
) {
  const store = await ensureDemoStore();
  const entry = store.entries.find((record) => record.id === input.entryId);

  if (!entry) {
    throw new Error(`Demo entry ${input.entryId} was not found.`);
  }

  const protocolsById = new Map(
    store.protocols.map((protocol) => [protocol.id, protocol]),
  );
  const validProtocolIds = new Set(store.protocols.map((protocol) => protocol.id));
  const blocks = normalizeEntryBlocks(
    input.blocks.filter(
      (block) =>
        block.type !== "protocol" || validProtocolIds.has(block.protocolId),
    ),
  );

  entry.title = input.title.trim();
  entry.summary = input.summary?.trim() || null;
  entry.blocks = blocks;
  entry.bodyText = deriveBodyText(blocks, protocolsById);
  entry.linkedProtocolIds = deriveLinkedProtocolIds(blocks);
  entry.latestVersionNumber += 1;
  entry.updatedAt = new Date().toISOString();

  await saveDemoStore(store);

  return {
    id: entry.id,
    versionNumber: entry.latestVersionNumber,
  };
}
