import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type {
  CreateEntryDraftInput,
  CreateProtocolDraftInput,
  EntryDetail,
  EntryListItem,
  NotebookContext,
  ProtocolDetail,
  ProtocolListItem,
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

function getSeedStore(): DemoNotebookStore {
  const protocols = getDemoProtocols().map((protocol) => ({
    ...protocol,
    updatedAt: protocol.updatedAt.toISOString(),
  }));
  const entries = getDemoEntries().map((entry, index) => ({
    ...entry,
    updatedAt: entry.updatedAt.toISOString(),
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
    bodyText: input.bodyText?.trim() || null,
    linkedProtocolIds: Array.from(
      new Set((input.linkedProtocolIds ?? []).filter((id) => validProtocolIds.has(id))),
    ),
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
