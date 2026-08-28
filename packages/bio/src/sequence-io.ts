import {
  normalizeDnaSequence,
  type SequenceAlphabet,
  type SequenceTopology,
} from "./index";
import type {
  RichSequenceFeature,
  SequencePrimer,
  StudioSequenceRecord,
} from "./studio";

export type SupportedSequenceExtension =
  | "dna"
  | "gb"
  | "gbk"
  | "fa"
  | "fasta"
  | "ab1";

export interface SequenceImportDiagnostic {
  severity: "info" | "warning" | "error";
  message: string;
}

export interface SequenceImportResult {
  record: StudioSequenceRecord;
  diagnostics: SequenceImportDiagnostic[];
  chromatogram?: {
    aTrace: number[];
    cTrace: number[];
    gTrace: number[];
    tTrace: number[];
    basePositions: number[];
    baseCalls: string[];
    qualityScores?: number[];
  };
}

type TeselagenAnnotation = {
  id?: string;
  name?: string;
  type?: string;
  start?: number;
  end?: number;
  strand?: number;
  forward?: boolean;
  color?: string;
  notes?: Record<string, unknown>;
  locations?: Array<{
    start: number;
    end: number;
  }>;
};

type TeselagenSequence = {
  id?: string;
  name?: string;
  description?: string;
  sequence?: string;
  circular?: boolean;
  type?: string;
  isProtein?: boolean;
  features?: TeselagenAnnotation[];
  primers?: TeselagenAnnotation[];
  chromatogramData?: {
    aTrace?: number[];
    cTrace?: number[];
    gTrace?: number[];
    tTrace?: number[];
    basePos?: number[];
    baseCalls?: string[];
    qualNums?: number[];
  };
};

type ParserResult = {
  success?: boolean;
  messages?: string[];
  parsedSequence?: TeselagenSequence;
};

function stableFallbackId(prefix: string, index: number) {
  return `${prefix}-${String(index + 1).padStart(4, "0")}`;
}

function normalizeQualifiers(notes: Record<string, unknown> | undefined) {
  return Object.fromEntries(
    Object.entries(notes ?? {}).map(([key, value]) => [
      key,
      Array.isArray(value)
        ? value.map((item) => String(item))
        : value === undefined || value === null
          ? []
          : [String(value)],
    ])
  );
}

function annotationSegments(
  annotation: TeselagenAnnotation,
  sequenceLength: number,
  topology: SequenceTopology
) {
  if (
    !annotation.locations?.length &&
    topology === "circular" &&
    (annotation.start ?? 0) > (annotation.end ?? annotation.start ?? 0)
  ) {
    return [
      {
        start: Math.max(0, Math.floor(annotation.start ?? 0)),
        end: sequenceLength,
      },
      {
        start: 0,
        // TeselaGen's parser model uses inclusive feature ends.
        end: Math.max(0, Math.floor(annotation.end ?? 0) + 1),
      },
    ];
  }
  const rawSegments = annotation.locations?.length
    ? annotation.locations
    : [
        {
          start: annotation.start ?? 0,
          end: annotation.end ?? annotation.start ?? 0,
        },
      ];
  return rawSegments.map((segment) => ({
    start: Math.max(0, Math.floor(segment.start)),
    // TeselaGen's parser model uses inclusive feature ends.
    end: Math.max(0, Math.floor(segment.end) + 1),
  }));
}

function toFeature(
  annotation: TeselagenAnnotation,
  index: number,
  sequenceLength: number,
  topology: SequenceTopology
): RichSequenceFeature {
  const segments = annotationSegments(annotation, sequenceLength, topology);
  return {
    id: annotation.id ?? stableFallbackId("feature", index),
    name: annotation.name?.trim() || annotation.type || `Feature ${index + 1}`,
    type: annotation.type || "misc_feature",
    color: annotation.color,
    qualifiers: normalizeQualifiers(annotation.notes),
    location: {
      segments,
      strand: annotation.strand === -1 || annotation.forward === false ? -1 : 1,
      operator: segments.length > 1 ? "join" : "single",
    },
  };
}

function toPrimer(
  annotation: TeselagenAnnotation,
  index: number,
  sequenceLength: number,
  topology: SequenceTopology
): SequencePrimer {
  const [segment] = annotationSegments(annotation, sequenceLength, topology);
  return {
    id: annotation.id ?? stableFallbackId("primer", index),
    name: annotation.name?.trim() || `Primer ${index + 1}`,
    annealSequence: "",
    strand: annotation.strand === -1 || annotation.forward === false ? -1 : 1,
    start: segment.start,
    end: segment.end,
    notes: Object.entries(annotation.notes ?? {})
      .map(
        ([key, value]) =>
          `${key}: ${Array.isArray(value) ? value.join(", ") : String(value)}`
      )
      .join("\n"),
  };
}

function inferAlphabet(sequence: TeselagenSequence): SequenceAlphabet {
  if (sequence.isProtein || sequence.type?.toLowerCase() === "protein") {
    return "protein";
  }
  if (
    sequence.type?.toLowerCase() === "rna" ||
    (sequence.sequence?.includes("U") && !sequence.sequence?.includes("T"))
  ) {
    return "RNA";
  }
  return "DNA";
}

function normalizeImportedSequence(
  sequence: string,
  alphabet: SequenceAlphabet
) {
  if (alphabet === "DNA") {
    return normalizeDnaSequence(sequence);
  }
  if (alphabet === "RNA") {
    return sequence
      .replace(/[^A-Za-z]/g, "")
      .toUpperCase()
      .replaceAll("T", "U");
  }
  return sequence.replace(/[^A-Za-z*]/g, "").toUpperCase();
}

function normalizeDiagnostic(message: string): SequenceImportDiagnostic {
  const lower = message.toLowerCase();
  return {
    severity:
      lower.includes("error") || lower.includes("invalid")
        ? "error"
        : lower.includes("warn")
          ? "warning"
          : "info",
    message,
  };
}

function parseExtension(fileName: string): SupportedSequenceExtension {
  const extension = fileName.split(".").at(-1)?.toLowerCase();
  if (
    extension === "dna" ||
    extension === "gb" ||
    extension === "gbk" ||
    extension === "fa" ||
    extension === "fasta" ||
    extension === "ab1"
  ) {
    return extension;
  }
  throw new Error(
    `Unsupported sequence file extension: ${extension || "(none)"}`
  );
}

export async function importSequenceFile(input: {
  fileName: string;
  contents: string | Uint8Array | ArrayBuffer | Blob;
  recordId: string;
  importedAt: string;
}): Promise<SequenceImportResult> {
  const extension = parseExtension(input.fileName);
  const binaryInput =
    extension === "dna" || extension === "ab1"
      ? input.contents instanceof Blob
        ? input.contents
        : typeof Blob !== "undefined"
          ? new Blob([
              input.contents instanceof Uint8Array
                ? new Uint8Array(input.contents)
                : input.contents,
            ])
          : input.contents
      : input.contents;
  const parsers = await import("@teselagen/bio-parsers");
  const results = (await parsers.anyToJson(binaryInput, {
    fileName: input.fileName,
    parseFastaAsCircular: false,
    acceptParts: false,
  })) as ParserResult[];
  const first = results[0];
  if (!first?.success || !first.parsedSequence) {
    const details =
      first?.messages?.join("; ") || "The parser returned no sequence";
    throw new Error(`Unable to import ${input.fileName}: ${details}`);
  }
  const parsed = first.parsedSequence;
  const alphabet = inferAlphabet(parsed);
  const topology: SequenceTopology = parsed.circular ? "circular" : "linear";
  const normalizedSequence = normalizeImportedSequence(
    parsed.sequence ?? "",
    alphabet
  );
  const record: StudioSequenceRecord = {
    id: input.recordId,
    name: parsed.name?.trim() || input.fileName.replace(/\.[^.]+$/, ""),
    description: parsed.description,
    alphabet,
    topology,
    sequence: normalizedSequence,
    features: (parsed.features ?? []).map((feature, index) =>
      toFeature(feature, index, normalizedSequence.length, topology)
    ),
    primers: (parsed.primers ?? []).map((primer, index) =>
      toPrimer(primer, index, normalizedSequence.length, topology)
    ),
    sourceFile: input.fileName,
    operations: [
      {
        id: `${input.recordId}-import`,
        kind: "import",
        timestamp: input.importedAt,
        parentIds: [],
        parameters: {
          sourceFile: input.fileName,
          sourceFormat: parseExtension(input.fileName),
        },
      },
    ],
  };
  const chromatogram = parsed.chromatogramData
    ? {
        aTrace: parsed.chromatogramData.aTrace ?? [],
        cTrace: parsed.chromatogramData.cTrace ?? [],
        gTrace: parsed.chromatogramData.gTrace ?? [],
        tTrace: parsed.chromatogramData.tTrace ?? [],
        basePositions: parsed.chromatogramData.basePos ?? [],
        baseCalls: parsed.chromatogramData.baseCalls ?? [],
        qualityScores: parsed.chromatogramData.qualNums,
      }
    : undefined;
  return {
    record,
    diagnostics: (first.messages ?? []).map(normalizeDiagnostic),
    chromatogram,
  };
}

function toTeselagenRecord(record: StudioSequenceRecord): TeselagenSequence {
  return {
    id: record.id,
    name: record.name,
    description: record.description,
    sequence: record.sequence.toLowerCase(),
    circular: record.topology === "circular",
    type: record.alphabet,
    isProtein: record.alphabet === "protein",
    features: record.features.map((feature) => ({
      id: feature.id,
      name: feature.name,
      type: feature.type,
      start: feature.location.segments[0]?.start ?? 0,
      end: Math.max(0, (feature.location.segments.at(-1)?.end ?? 1) - 1),
      strand: feature.location.strand,
      forward: feature.location.strand === 1,
      color: feature.color,
      notes: feature.qualifiers,
      locations: feature.location.segments.map((segment) => ({
        start: segment.start,
        end: segment.end - 1,
      })),
    })),
    primers: record.primers.map((primer) => ({
      id: primer.id,
      name: primer.name,
      type: "primer",
      start: primer.start,
      end: primer.end === undefined ? undefined : primer.end - 1,
      strand: primer.strand,
      forward: primer.strand === 1,
      notes: primer.notes ? { note: [primer.notes] } : {},
    })),
  };
}

export async function exportGenbank(record: StudioSequenceRecord) {
  const parsers = await import("@teselagen/bio-parsers");
  const result = parsers.jsonToGenbank(toTeselagenRecord(record), {
    isProtein: record.alphabet === "protein",
    inclusive1BasedStart: false,
    inclusive1BasedEnd: false,
  });
  if (typeof result !== "string") {
    throw new Error(`Unable to export ${record.name} as GenBank`);
  }
  return result;
}

export async function exportFasta(record: StudioSequenceRecord) {
  const parsers = await import("@teselagen/bio-parsers");
  const result = parsers.jsonToFasta(toTeselagenRecord(record), {
    isProtein: record.alphabet === "protein",
  });
  if (typeof result !== "string") {
    throw new Error(`Unable to export ${record.name} as FASTA`);
  }
  return result;
}
