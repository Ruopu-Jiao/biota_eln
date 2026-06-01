import {
  getEntryDetailForUser,
  getNotebookNavigatorForUser,
  getNotebookContextForUser,
  getProtocolDetailForUser,
  listEntriesForUser,
  listProtocolsForUser,
  type NotebookNavigatorData,
  type NotebookNavigatorFolder,
  type NotebookNavigatorRecord,
} from "@biota/db";
import { listStoredSequenceEntities } from "@/lib/entities/store";
import { isDemoAuthMode } from "@/lib/auth/demo.server";
import {
  getDemoEntryDetail,
  getDemoNotebookNavigator,
  getDemoNotebookContext,
  getDemoProtocolDetail,
  listDemoEntries,
  listDemoProtocols,
} from "@/lib/notebook/demo-store";

const entityTypeLabels = {
  plasmid: "Plasmid",
  sgrna: "sgRNA",
  primer: "Primer",
} as const;

function compactNavigatorSlug(value: string) {
  const base = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return base || "record";
}

function sortNavigatorRecords(records: NotebookNavigatorRecord[]) {
  return records.slice().sort((left, right) => {
    if (left.kind !== right.kind) {
      return left.kind === "entry" ? -1 : 1;
    }

    return left.title.localeCompare(right.title);
  });
}

function cloneNavigatorFolder(
  folder: NotebookNavigatorFolder,
): NotebookNavigatorFolder {
  return {
    ...folder,
    records: sortNavigatorRecords(folder.records),
    childFolders: folder.childFolders.map((childFolder) =>
      cloneNavigatorFolder(childFolder),
    ),
  };
}

function mergeEntitiesIntoNavigator(
  navigator: NotebookNavigatorData,
  rootFolderId: string | null,
  entities: Awaited<ReturnType<typeof listStoredSequenceEntities>>,
) {
  const folders = navigator.folders.map((folder) => cloneNavigatorFolder(folder));
  const foldersById = new Map<string, NotebookNavigatorFolder>();
  const unfiledRecords = navigator.unfiledRecords.slice();

  function indexFolders(currentFolders: NotebookNavigatorFolder[]) {
    for (const folder of currentFolders) {
      foldersById.set(folder.id, folder);
      indexFolders(folder.childFolders);
    }
  }

  indexFolders(folders);

  for (const entity of entities) {
    const record: NotebookNavigatorRecord = {
      kind: "entity",
      id: entity.id,
      title: entity.name,
      slug: compactNavigatorSlug(entity.name),
      href: `/entities/${entity.id}`,
      entityTypeLabel: entityTypeLabels[entity.entityType],
      sequenceLength: entity.sequence.length,
    };
    const targetFolderId = entity.folderId ?? rootFolderId;

    if (targetFolderId && foldersById.has(targetFolderId)) {
      foldersById.get(targetFolderId)?.records.push(record);
      continue;
    }

    unfiledRecords.push(record);
  }

  for (const folder of foldersById.values()) {
    folder.records = sortNavigatorRecords(folder.records);
  }

  return {
    ...navigator,
    folders,
    unfiledRecords: sortNavigatorRecords(unfiledRecords),
  } satisfies NotebookNavigatorData;
}

export async function getNotebookPageData(userId: string) {
  if (isDemoAuthMode()) {
    const [entries, protocols] = await Promise.all([
      listDemoEntries(),
      listDemoProtocols(),
    ]);

    return {
      context: getDemoNotebookContext(),
      entries,
      protocols,
    };
  }

  const [context, entries, protocols] = await Promise.all([
    getNotebookContextForUser(userId),
    listEntriesForUser(userId),
    listProtocolsForUser(userId),
  ]);

  return {
    context,
    entries,
    protocols,
  };
}

export async function getEntryDetailPageData(userId: string, entryId: string) {
  if (isDemoAuthMode()) {
    const entry = await getDemoEntryDetail(entryId);

    return {
      context: getDemoNotebookContext(),
      entry,
    };
  }

  const [context, entry] = await Promise.all([
    getNotebookContextForUser(userId),
    getEntryDetailForUser(userId, entryId),
  ]);

  return {
    context,
    entry,
  };
}

export async function getWorkspaceNavigatorData(userId: string) {
  if (isDemoAuthMode()) {
    const [navigator, entities] = await Promise.all([
      getDemoNotebookNavigator(),
      listStoredSequenceEntities(),
    ]);

    return mergeEntitiesIntoNavigator(
      navigator,
      getDemoNotebookContext().rootFolder?.id ?? null,
      entities,
    );
  }

  const [context, navigator, entities] = await Promise.all([
    getNotebookContextForUser(userId),
    getNotebookNavigatorForUser(userId),
    listStoredSequenceEntities(),
  ]);

  if (!navigator) {
    return null;
  }

  return mergeEntitiesIntoNavigator(
    navigator,
    context?.rootFolder?.id ?? null,
    entities,
  );
}

export async function getProtocolDetailPageData(
  userId: string,
  protocolId: string,
) {
  if (isDemoAuthMode()) {
    const protocol = await getDemoProtocolDetail(protocolId);

    return {
      context: getDemoNotebookContext(),
      protocol,
    };
  }

  const [context, protocol] = await Promise.all([
    getNotebookContextForUser(userId),
    getProtocolDetailForUser(userId, protocolId),
  ]);

  return {
    context,
    protocol,
  };
}
