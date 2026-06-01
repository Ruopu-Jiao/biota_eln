import {
  estimatePrimerTm,
  formatGcContent,
  gcContent,
  normalizeDnaSequence,
  reverseComplement,
  sliceSequenceRange,
  type DNAFeature,
  type DNARecord,
  type SequenceEntityRecord,
  type SequenceEntityType,
} from "@biota/bio";

type EntityFeature = DNAFeature;

export type SequenceEntityCatalogEntry = SequenceEntityRecord & {
  purpose: string;
  defaultMotif: string;
  featureSummary: string;
  notes: string;
  references: Array<{
    title: string;
    href: string;
  }>;
  history: Array<{
    id: string;
    kind: "created" | "edited" | "annotated" | "cloning" | "verified" | "imported";
    title: string;
    description: string;
    timestamp: string;
  }>;
};

export interface SequenceEntityOption {
  id: string;
  title: string;
  slug: string;
  typeLabel: string;
  summary: string | null;
  sequenceLength: number;
  topology: DNARecord["topology"];
}

export interface SequenceEntityPrimer {
  id: string;
  name: string;
  sequence: string;
  start: number;
  end: number;
  strand: 1 | -1;
  length: number;
  gc: string;
  tm: string;
  notes?: string;
}

function repeatSequence(sequence: string, times: number) {
  return normalizeDnaSequence(sequence.repeat(times));
}

function compactSlug(value: string) {
  const base = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return base || "entity";
}

function makeFeature(
  id: string,
  name: string,
  type: EntityFeature["type"],
  start: number,
  end: number,
  strand: 1 | -1,
  color: string,
  notes?: string,
): EntityFeature {
  return {
    id,
    name,
    type,
    start,
    end,
    strand,
    color,
    notes,
  };
}

function makeEntity(input: {
  id: string;
  entityType: SequenceEntityType;
  name: string;
  description: string;
  aliases: string[];
  sequence: string;
  topology: DNARecord["topology"];
  purpose: string;
  defaultMotif: string;
  featureSummary: string;
  features: EntityFeature[];
  notes?: string;
  references?: Array<{
    title: string;
    href: string;
  }>;
  history?: SequenceEntityCatalogEntry["history"];
}): SequenceEntityCatalogEntry {
  return {
    id: input.id,
    entityType: input.entityType,
    name: input.name,
    description: input.description,
    aliases: input.aliases,
    sequence: normalizeDnaSequence(input.sequence),
    alphabet: "DNA",
    topology: input.topology,
    features: input.features,
    purpose: input.purpose,
    defaultMotif: normalizeDnaSequence(input.defaultMotif),
    featureSummary: input.featureSummary,
    notes: input.notes ?? "",
    references: input.references ?? [],
    history: input.history ?? [],
  };
}

function makeHistoryEvent(
  id: string,
  kind: SequenceEntityCatalogEntry["history"][number]["kind"],
  title: string,
  description: string,
  timestamp: string,
) {
  return {
    id,
    kind,
    title,
    description,
    timestamp,
  };
}

const featureColors = {
  promoter: "#7ad7a5",
  cds: "#7fb0ff",
  ori: "#f3be6a",
  primer: "#d9a2ff",
  restriction: "#ff8f83",
  tag: "#8edfd6",
  misc: "#c4b8a6",
} as const;

const entityTypeLabels: Record<SequenceEntityType, string> = {
  plasmid: "Plasmid",
  sgrna: "sgRNA",
  primer: "Primer",
};

export function getSequenceEntityTypeLabel(entityType: SequenceEntityType) {
  return entityTypeLabels[entityType];
}

const plasmidSequence = repeatSequence(
  [
    "ATGACCATGATTACGCCAAGCTTGAATTCGGTCTCGTCTAGAGGATCC",
    "TATAAAGCGGCCGCTCGAGCTAGCGTAGCTAGGCTAATACGACTCACT",
    "AGGATGACCATGGCTAGCTTTAAACCCGGGATATCGCAGTCTGACCTA",
    "GGGCGGCCGCAAGCTTATGCGTACTGACCTGATCGTAGGCTAGATCCA",
    "GCTAGCGGATCCATGCTAGCTTTGACATATAATGCTAGCTAGTGGGGA",
  ].join(""),
  4,
);

const sgrnaSequence = normalizeDnaSequence(
  "GTTTTAGAGCTAGAAATAGCAAGTTAAAATAAGGCTAGTCC".repeat(4),
);

const primerSequence = normalizeDnaSequence("AGCTGATCGGATCCGATCGTTAACGATCGTAGCTA");

export const seedSequenceEntityCatalog = [
  makeEntity({
    id: "entity-plasmid-helix",
    entityType: "plasmid",
    name: "pBiota-Helix",
    description:
      "Circular reporter plasmid with a compact expression cassette, cloning sites, and an origin ready for map-style inspection.",
    aliases: ["Reporter plasmid", "Helix vector"],
    sequence: plasmidSequence,
    topology: "circular",
    purpose: "Plasmid backbone",
    defaultMotif: "GAATTC",
    featureSummary: "Promoter, reporter cassette, primer hooks, and replication origin",
    notes:
      "Bench plasmid draft for expression and cloning walkthroughs. Used as the reference construct in the current workspace demos.",
    references: [
      {
        title: "CMV promoter reference",
        href: "https://www.snapgene.com/",
      },
    ],
    history: [
      makeHistoryEvent(
        "helix-import",
        "imported",
        "Imported reference plasmid",
        "Loaded as the seed plasmid reference for the workspace DNA viewer.",
        "2025-11-05T14:00:00.000Z",
      ),
      makeHistoryEvent(
        "helix-annotate",
        "annotated",
        "Annotated expression cassette",
        "Promoter, CDS, primer hooks, and origin annotations were added to the construct.",
        "2025-11-07T09:30:00.000Z",
      ),
      makeHistoryEvent(
        "helix-verify",
        "verified",
        "Verified cloning map",
        "Restriction cluster and primer positions were reviewed against the current sequence.",
        "2025-11-09T16:15:00.000Z",
      ),
    ],
    features: [
      makeFeature(
        "promoter",
        "CMV promoter",
        "promoter",
        45,
        210,
        1,
        featureColors.promoter,
        "Strong expression control region.",
      ),
      makeFeature(
        "tag",
        "N-terminal tag",
        "tag",
        225,
        318,
        1,
        featureColors.tag,
        "Fusion tag and linker section.",
      ),
      makeFeature(
        "cds",
        "Reporter CDS",
        "cds",
        320,
        1088,
        1,
        featureColors.cds,
        "Main payload sequence.",
      ),
      makeFeature(
        "primer-f",
        "Forward primer",
        "primer",
        1125,
        1151,
        1,
        featureColors.primer,
        "PCR entry point.",
      ),
      makeFeature(
        "restriction-cluster",
        "Restriction cluster",
        "restriction",
        1190,
        1268,
        -1,
        featureColors.restriction,
        "Common cloning sites in one block.",
      ),
      makeFeature(
        "ori",
        "pUC origin",
        "ori",
        1302,
        1526,
        -1,
        featureColors.ori,
        "Plasmid replication origin.",
      ),
      makeFeature(
        "primer-r",
        "Reverse primer",
        "primer",
        1560,
        1588,
        -1,
        featureColors.primer,
        "Downstream confirmation primer.",
      ),
      makeFeature(
        "misc",
        "Intergenic spacer",
        "misc",
        1604,
        1690,
        1,
        featureColors.misc,
        "Spacer region with lower annotation confidence.",
      ),
    ],
  }),
  makeEntity({
    id: "entity-sgrna-pilot",
    entityType: "sgrna",
    name: "sgRNA pilot cassette",
    description:
      "Sequence-backed guide construct with a compact promoter-to-scaffold layout and a guide window that is easy to inspect.",
    aliases: ["Guide cassette", "Pilot sgRNA"],
    sequence: sgrnaSequence,
    topology: "linear",
    purpose: "Guide RNA construct",
    defaultMotif: "GTTTTAGAGC",
    featureSummary: "Promoter, guide window, scaffold, and primer anchor",
    notes:
      "Guide cassette seed record used to exercise linear sequence workflows, guide windows, and primer overlays.",
    references: [
      {
        title: "Guide design workspace",
        href: "https://www.snapgene.com/",
      },
    ],
    history: [
      makeHistoryEvent(
        "sgrna-create",
        "created",
        "Created guide cassette",
        "Initial guide cassette assembled from promoter, spacer, scaffold, and validation primer regions.",
        "2025-12-02T11:00:00.000Z",
      ),
      makeHistoryEvent(
        "sgrna-annotate",
        "annotated",
        "Annotated guide window",
        "Spacer, scaffold, and primer anchor annotations were added for review.",
        "2025-12-02T12:10:00.000Z",
      ),
    ],
    features: [
      makeFeature(
        "u6-promoter",
        "U6 promoter",
        "promoter",
        1,
        40,
        1,
        featureColors.promoter,
        "RNA polymerase III promoter driving guide expression.",
      ),
      makeFeature(
        "guide",
        "Guide spacer",
        "misc",
        41,
        60,
        1,
        featureColors.misc,
        "Twenty-base targeting window.",
      ),
      makeFeature(
        "scaffold",
        "Guide scaffold",
        "tag",
        61,
        122,
        1,
        featureColors.tag,
        "Structural scaffold for Cas9 binding.",
      ),
      makeFeature(
        "primer-anchor",
        "Amplification primer",
        "primer",
        123,
        150,
        -1,
        featureColors.primer,
        "Short primer anchor for cassette validation.",
      ),
    ],
  }),
  makeEntity({
    id: "entity-primer-amplicon",
    entityType: "primer",
    name: "PCR primer oligo",
    description:
      "Short primer entity that can be browsed like a first-class sequence record instead of a text string.",
    aliases: ["Amplicon primer", "Validation oligo"],
    sequence: primerSequence,
    topology: "linear",
    purpose: "PCR primer",
    defaultMotif: "GATCCGATC",
    featureSummary: "Single primer span with a restriction-adjacent motif",
    notes:
      "Short oligo record used to check primer-length sequence rendering and motif overlays.",
    references: [
      {
        title: "Primer design note",
        href: "https://www.snapgene.com/",
      },
    ],
    history: [
      makeHistoryEvent(
        "primer-create",
        "created",
        "Created oligo record",
        "Primer imported as a standalone linear sequence for quick review.",
        "2026-01-12T08:45:00.000Z",
      ),
    ],
    features: [
      makeFeature(
        "primer-body",
        "Primer body",
        "primer",
        1,
        primerSequence.length,
        1,
        featureColors.primer,
        "Primary oligo body used for amplification.",
      ),
      makeFeature(
        "motif",
        "BamHI-adjacent motif",
        "restriction",
        6,
        11,
        1,
        featureColors.restriction,
        "A compact hook for sequence inspection.",
      ),
    ],
  }),
] satisfies SequenceEntityCatalogEntry[];

export const defaultSequenceEntityId =
  seedSequenceEntityCatalog[0]?.id ?? "entity-plasmid-helix";

function listSeedSequenceEntities() {
  return seedSequenceEntityCatalog.slice();
}

export function getSequenceEntityById(
  entityId: string,
  entities: SequenceEntityCatalogEntry[] = seedSequenceEntityCatalog,
) {
  return (
    entities.find((entity) => entity.id === entityId) ??
    entities[0] ??
    null
  );
}

export function getSequenceEntityCatalog() {
  return listSeedSequenceEntities();
}

export function getSequenceEntityOptions(
  entities: SequenceEntityCatalogEntry[] = seedSequenceEntityCatalog,
): SequenceEntityOption[] {
  return entities.map((entity) => ({
    id: entity.id,
    title: entity.name,
    slug: compactSlug(entity.name),
    typeLabel: getSequenceEntityTypeLabel(entity.entityType),
    summary: entity.description,
    sequenceLength: entity.sequence.length,
    topology: entity.topology,
  }));
}

export function toDNARecord(entity: SequenceEntityCatalogEntry): DNARecord {
  return {
    name: entity.name,
    sequence: entity.sequence,
    alphabet: entity.alphabet,
    topology: entity.topology,
    features: entity.features,
  };
}

export function getSequenceEntityPrimers(
  entity: SequenceEntityCatalogEntry,
): SequenceEntityPrimer[] {
  return entity.features
    .filter((feature) => feature.type === "primer")
    .map((feature) => {
      const sequence =
        feature.strand === 1
          ? sliceSequenceRange(
              entity.sequence,
              feature.start,
              feature.end,
              entity.topology,
            )
          : reverseComplement(
              sliceSequenceRange(
                entity.sequence,
                feature.start,
                feature.end,
                entity.topology,
              ),
            );

      return {
        id: feature.id,
        name: feature.name,
        sequence,
        start: feature.start,
        end: feature.end,
        strand: feature.strand,
        length: sequence.length,
        gc: formatGcContent(sequence),
        tm: `${estimatePrimerTm(sequence)} C`,
        notes: feature.notes,
      };
    });
}

export function getSequenceEntityStats(entity: SequenceEntityCatalogEntry) {
  return {
    gc: `${gcContent(entity.sequence).toFixed(1)}%`,
    length: entity.sequence.length,
    primers: getSequenceEntityPrimers(entity).length,
    annotations: entity.features.length,
  };
}
