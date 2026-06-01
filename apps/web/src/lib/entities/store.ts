import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  normalizeDnaSequence,
  type DNAFeature,
  type SequenceEntityType,
} from "@biota/bio";
import {
  getSequenceEntityById,
  getSequenceEntityOptions,
  seedSequenceEntityCatalog,
  type SequenceEntityCatalogEntry,
} from "@/lib/entities/catalog";

export type StoredSequenceEntity = SequenceEntityCatalogEntry & {
  recordSource: "seed" | "draft";
  status: "REFERENCE" | "DRAFT";
  latestVersionNumber: number;
  repositoryId: string | null;
  repositoryName: string | null;
  folderId: string | null;
  folderName: string | null;
  createdAt: string;
  updatedAt: string;
};

type DraftStoredSequenceEntity = StoredSequenceEntity & {
  recordSource: "draft";
  status: "DRAFT";
};

type SequenceEntityDraftStore = {
  entities: DraftStoredSequenceEntity[];
};

const localDataDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../.local",
);
const entityStorePath = path.join(localDataDirectory, "demo-entities.json");
const allowedEntityTypes = new Set<SequenceEntityType>([
  "plasmid",
  "sgrna",
  "primer",
]);
const allowedFeatureTypes = new Set<DNAFeature["type"]>([
  "promoter",
  "cds",
  "ori",
  "primer",
  "restriction",
  "tag",
  "misc",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeFeature(
  feature: unknown,
  sequenceLength: number,
): DNAFeature | null {
  if (!isRecord(feature)) {
    return null;
  }

  const type = feature.type;
  const start = typeof feature.start === "number" ? feature.start : 1;
  const end = typeof feature.end === "number" ? feature.end : sequenceLength;
  const strand = feature.strand === -1 ? -1 : 1;

  if (
    typeof feature.id !== "string" ||
    typeof feature.name !== "string" ||
    !allowedFeatureTypes.has(type as DNAFeature["type"]) ||
    typeof feature.color !== "string"
  ) {
    return null;
  }

  return {
    id: feature.id,
    name: feature.name,
    type: type as DNAFeature["type"],
    start: Math.max(1, Math.min(sequenceLength, start)),
    end: Math.max(1, Math.min(sequenceLength, end)),
    strand,
    color: feature.color,
    notes: typeof feature.notes === "string" ? feature.notes : undefined,
  };
}

function normalizeHistory(
  history: unknown,
): SequenceEntityCatalogEntry["history"] {
  if (!Array.isArray(history)) {
    return [];
  }

  return history
    .map((event) => {
      if (
        !isRecord(event) ||
        typeof event.id !== "string" ||
        typeof event.title !== "string" ||
        typeof event.description !== "string" ||
        typeof event.timestamp !== "string"
      ) {
        return null;
      }

      const kind =
        event.kind === "edited" ||
        event.kind === "annotated" ||
        event.kind === "cloning" ||
        event.kind === "verified" ||
        event.kind === "imported"
          ? event.kind
          : "created";

      return {
        id: event.id,
        kind,
        title: event.title,
        description: event.description,
        timestamp: event.timestamp,
      };
    })
    .filter(
      (
        event,
      ): event is SequenceEntityCatalogEntry["history"][number] => Boolean(event),
    );
}

function normalizeReferences(
  references: unknown,
): SequenceEntityCatalogEntry["references"] {
  if (!Array.isArray(references)) {
    return [];
  }

  return references
    .map((reference) => {
      if (
        !isRecord(reference) ||
        typeof reference.title !== "string" ||
        typeof reference.href !== "string"
      ) {
        return null;
      }

      return {
        title: reference.title,
        href: reference.href,
      };
    })
    .filter(
      (
        reference,
      ): reference is SequenceEntityCatalogEntry["references"][number] =>
        Boolean(reference),
    );
}

function normalizeStoredSequenceEntity(
  entity: unknown,
): DraftStoredSequenceEntity | null {
  if (!isRecord(entity)) {
    return null;
  }

  const entityType = entity.entityType;
  const topology = entity.topology === "linear" ? "linear" : "circular";
  const sequence = normalizeDnaSequence(
    typeof entity.sequence === "string" ? entity.sequence : "ATGC",
  );

  if (
    typeof entity.id !== "string" ||
    typeof entity.name !== "string" ||
    typeof entity.description !== "string" ||
    !allowedEntityTypes.has(entityType as SequenceEntityType)
  ) {
    return null;
  }

  const safeSequence = sequence || "ATGC";
  const features = Array.isArray(entity.features)
    ? entity.features
        .map((feature) => normalizeFeature(feature, safeSequence.length))
        .filter((feature): feature is DNAFeature => Boolean(feature))
    : [];

  return {
    id: entity.id,
    entityType: entityType as SequenceEntityType,
    name: entity.name,
    description: entity.description,
    aliases: Array.isArray(entity.aliases)
      ? entity.aliases.filter((alias): alias is string => typeof alias === "string")
      : [],
    sequence: safeSequence,
    alphabet: "DNA",
    topology,
    features,
    purpose:
      typeof entity.purpose === "string"
        ? entity.purpose
        : "Draft sequence entity",
    defaultMotif: normalizeDnaSequence(
      typeof entity.defaultMotif === "string"
        ? entity.defaultMotif
        : safeSequence.slice(0, 6),
    ),
    featureSummary:
      typeof entity.featureSummary === "string"
        ? entity.featureSummary
        : "Draft entity ready for annotation.",
    notes: typeof entity.notes === "string" ? entity.notes : "",
    references: normalizeReferences(entity.references),
    history: normalizeHistory(entity.history),
    recordSource: "draft",
    status: "DRAFT",
    latestVersionNumber:
      typeof entity.latestVersionNumber === "number" &&
      Number.isFinite(entity.latestVersionNumber)
        ? Math.max(1, Math.floor(entity.latestVersionNumber))
        : 1,
    repositoryId:
      typeof entity.repositoryId === "string" ? entity.repositoryId : null,
    repositoryName:
      typeof entity.repositoryName === "string" ? entity.repositoryName : null,
    folderId: typeof entity.folderId === "string" ? entity.folderId : null,
    folderName: typeof entity.folderName === "string" ? entity.folderName : null,
    createdAt:
      typeof entity.createdAt === "string"
        ? entity.createdAt
        : new Date().toISOString(),
    updatedAt:
      typeof entity.updatedAt === "string"
        ? entity.updatedAt
        : new Date().toISOString(),
  };
}

function buildSeedStoredEntity(
  entity: SequenceEntityCatalogEntry,
): StoredSequenceEntity {
  const createdAt =
    entity.history[0]?.timestamp ?? "2025-10-01T09:00:00.000Z";
  const updatedAt =
    entity.history.at(-1)?.timestamp ?? createdAt;

  return {
    ...entity,
    recordSource: "seed",
    status: "REFERENCE",
    latestVersionNumber: 1,
    repositoryId: null,
    repositoryName: "Main notebook",
    folderId: null,
    folderName: "Root",
    createdAt,
    updatedAt,
  };
}

async function ensureEntityStore() {
  try {
    const raw = await readFile(entityStorePath, "utf8");
    const parsed = JSON.parse(raw) as { entities?: unknown };

    return {
      entities: Array.isArray(parsed.entities)
        ? parsed.entities
            .map((entity) => normalizeStoredSequenceEntity(entity))
            .filter((entity): entity is DraftStoredSequenceEntity => Boolean(entity))
        : [],
    } satisfies SequenceEntityDraftStore;
  } catch {
    const seed = {
      entities: [],
    } satisfies SequenceEntityDraftStore;
    await mkdir(localDataDirectory, { recursive: true });
    await writeFile(entityStorePath, JSON.stringify(seed, null, 2), "utf8");
    return seed;
  }
}

async function saveEntityStore(store: SequenceEntityDraftStore) {
  await mkdir(localDataDirectory, { recursive: true });
  await writeFile(entityStorePath, JSON.stringify(store, null, 2), "utf8");
}

function mergeSequenceEntities(
  draftEntities: DraftStoredSequenceEntity[],
) {
  const draftEntityIds = new Set(draftEntities.map((entity) => entity.id));

  return [
    ...draftEntities,
    ...seedSequenceEntityCatalog
      .filter((entity) => !draftEntityIds.has(entity.id))
      .map((entity) => buildSeedStoredEntity(entity)),
  ];
}

function buildEntityHistoryEvent(
  id: string,
  kind: SequenceEntityCatalogEntry["history"][number]["kind"],
  title: string,
  description: string,
) {
  return {
    id,
    kind,
    title,
    description,
    timestamp: new Date().toISOString(),
  };
}

export function buildEntityFeaturePayload(features: DNAFeature[]) {
  return JSON.stringify(
    features.map((feature) => ({
      id: feature.id,
      name: feature.name,
      type: feature.type,
      start: feature.start,
      end: feature.end,
      strand: feature.strand,
      color: feature.color,
      notes: feature.notes ?? "",
    })),
  );
}

export function parseEntityFeaturePayload(
  rawValue: string,
  sequenceLength: number,
) {
  try {
    const parsed = JSON.parse(rawValue) as unknown;

    if (!Array.isArray(parsed)) {
      return [] as DNAFeature[];
    }

    return parsed
      .map((feature) => normalizeFeature(feature, sequenceLength))
      .filter((feature): feature is DNAFeature => Boolean(feature));
  } catch {
    return [] as DNAFeature[];
  }
}

export async function listStoredSequenceEntities() {
  const store = await ensureEntityStore();
  return mergeSequenceEntities(store.entities);
}

export async function getStoredSequenceEntityById(entityId: string) {
  return getSequenceEntityById(entityId, await listStoredSequenceEntities());
}

export async function listStoredSequenceEntityOptions() {
  return getSequenceEntityOptions(await listStoredSequenceEntities());
}

export async function createSequenceEntityDraft(input?: {
  title?: string;
  entityType?: SequenceEntityType;
  sequence?: string;
  repositoryId?: string | null;
  repositoryName?: string | null;
  folderId?: string | null;
  folderName?: string | null;
}) {
  const store = await ensureEntityStore();
  const id = `entity-draft-${crypto.randomUUID()}`;
  const sequence = normalizeDnaSequence(
    input?.sequence ??
      "ATGACCATGATTACGCCAAGCTTGAATTCGGTCTCGTCTAGAGGATCC",
  );
  const now = new Date().toISOString();
  const draft: DraftStoredSequenceEntity = {
    id,
    entityType: input?.entityType ?? "plasmid",
    name: input?.title?.trim() || "Untitled plasmid",
    description:
      "Draft sequence entity created from the project navigator. Refine the sequence, annotations, and notes next.",
    aliases: [],
    sequence,
    alphabet: "DNA",
    topology: "circular",
    features: [
      {
        id: `${id}-feature-1`,
        name: "Draft region",
        type: "misc",
        start: 1,
        end: Math.min(sequence.length, 24),
        strand: 1,
        color: "#c4b8a6",
        notes: "Placeholder annotation for a newly created entity draft.",
      },
    ],
    purpose: "Draft construct",
    defaultMotif: sequence.slice(0, 6),
    featureSummary: "Draft sequence, placeholder annotation, and viewer-ready defaults.",
    notes: "",
    references: [],
    history: [
      {
        id: `${id}-created`,
        kind: "created",
        title: "Created draft entity",
        description: "Entity created from the project navigator.",
        timestamp: now,
      },
    ],
    recordSource: "draft",
    status: "DRAFT",
    latestVersionNumber: 1,
    repositoryId: input?.repositoryId ?? null,
    repositoryName: input?.repositoryName ?? "Main notebook",
    folderId: input?.folderId ?? null,
    folderName: input?.folderName ?? "Root",
    createdAt: now,
    updatedAt: now,
  };

  store.entities.unshift(draft);
  await saveEntityStore(store);

  return draft;
}

export async function updateStoredSequenceEntityDraft(input: {
  entityId: string;
  name: string;
  description: string;
  entityType: SequenceEntityType;
  topology: "linear" | "circular";
  sequence: string;
  purpose: string;
  defaultMotif: string;
  featureSummary?: string;
  notes: string;
  aliases: string[];
  features?: DNAFeature[];
}) {
  const store = await ensureEntityStore();
  const entity = store.entities.find((record) => record.id === input.entityId);

  if (!entity) {
    throw new Error(`Draft entity ${input.entityId} was not found.`);
  }

  const nextSequence = normalizeDnaSequence(input.sequence) || entity.sequence;
  entity.name = input.name.trim() || entity.name;
  entity.description = input.description.trim() || entity.description;
  entity.entityType = input.entityType;
  entity.topology = input.topology;
  entity.sequence = nextSequence;
  entity.purpose = input.purpose.trim() || entity.purpose;
  entity.defaultMotif =
    normalizeDnaSequence(input.defaultMotif) || nextSequence.slice(0, 6);
  entity.notes = input.notes.trim();
  entity.aliases = input.aliases;
  entity.updatedAt = new Date().toISOString();
  entity.features = (input.features ?? entity.features)
    .map((feature) => normalizeFeature(feature, nextSequence.length))
    .filter((feature): feature is DNAFeature => Boolean(feature));
  entity.featureSummary =
    input.featureSummary?.trim() ||
    (entity.features.length > 0
      ? entity.features.map((feature) => feature.name).slice(0, 4).join(", ")
      : "No annotations yet");
  entity.latestVersionNumber += 1;
  entity.history.unshift(
    buildEntityHistoryEvent(
      `${entity.id}-edited-${crypto.randomUUID()}`,
      "edited",
      "Edited draft metadata",
      "Updated the sequence record metadata or sequence content.",
    ),
  );

  await saveEntityStore(store);

  return entity;
}

export async function addStoredSequenceEntityFeature(input: {
  entityId: string;
  name: string;
  type: DNAFeature["type"];
  start: number;
  end: number;
  strand: 1 | -1;
  notes?: string;
}) {
  const store = await ensureEntityStore();
  const entity = store.entities.find((record) => record.id === input.entityId);

  if (!entity) {
    throw new Error(`Draft entity ${input.entityId} was not found.`);
  }

  entity.features.push({
    id: `${entity.id}-feature-${crypto.randomUUID()}`,
    name: input.name.trim() || "New feature",
    type: input.type,
    start: Math.max(1, Math.min(entity.sequence.length, input.start)),
    end: Math.max(1, Math.min(entity.sequence.length, input.end)),
    strand: input.strand,
    color:
      input.type === "promoter"
        ? "#7ad7a5"
        : input.type === "cds"
          ? "#7fb0ff"
          : input.type === "ori"
            ? "#f3be6a"
            : input.type === "primer"
              ? "#d9a2ff"
              : input.type === "restriction"
                ? "#ff8f83"
                : input.type === "tag"
                  ? "#8edfd6"
                  : "#c4b8a6",
    notes: input.notes?.trim() || undefined,
  });
  entity.updatedAt = new Date().toISOString();
  entity.featureSummary = entity.features.map((feature) => feature.name).slice(0, 4).join(", ");
  entity.latestVersionNumber += 1;
  entity.history.unshift(
    buildEntityHistoryEvent(
      `${entity.id}-annotated-${crypto.randomUUID()}`,
      "annotated",
      "Added feature annotation",
      `Annotated ${input.name.trim() || "a feature"} on the draft entity.`,
    ),
  );

  await saveEntityStore(store);

  return entity;
}

export async function removeStoredSequenceEntityFeature(input: {
  entityId: string;
  featureId: string;
}) {
  const store = await ensureEntityStore();
  const entity = store.entities.find((record) => record.id === input.entityId);

  if (!entity) {
    throw new Error(`Draft entity ${input.entityId} was not found.`);
  }

  const removedFeature = entity.features.find(
    (feature) => feature.id === input.featureId,
  );
  entity.features = entity.features.filter(
    (feature) => feature.id !== input.featureId,
  );
  entity.updatedAt = new Date().toISOString();
  entity.featureSummary =
    entity.features.length > 0
      ? entity.features.map((feature) => feature.name).slice(0, 4).join(", ")
      : "No annotations yet";
  entity.latestVersionNumber += 1;

  if (removedFeature) {
    entity.history.unshift(
      buildEntityHistoryEvent(
        `${entity.id}-feature-removed-${crypto.randomUUID()}`,
        "annotated",
        "Removed feature annotation",
        `Removed ${removedFeature.name} from the draft entity.`,
      ),
    );
  }

  await saveEntityStore(store);

  return entity;
}
