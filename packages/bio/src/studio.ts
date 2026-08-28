import {
  normalizeDnaSequence,
  reverseComplement,
  type SequenceAlphabet,
  type SequenceTopology,
} from "./index";

export type FeatureLocationOperator = "single" | "join" | "order";

export interface FeatureSegment {
  /** Zero-based, inclusive. */
  start: number;
  /** Zero-based, exclusive. */
  end: number;
}

export interface RichFeatureLocation {
  segments: FeatureSegment[];
  strand: 1 | -1;
  operator: FeatureLocationOperator;
  fuzzyStart?: "before" | "after";
  fuzzyEnd?: "before" | "after";
}

export interface RichSequenceFeature {
  id: string;
  name: string;
  type: string;
  location: RichFeatureLocation;
  color?: string;
  qualifiers: Record<string, string[]>;
}

export interface SequencePrimer {
  id: string;
  name: string;
  annealSequence: string;
  overhang5?: string;
  strand: 1 | -1;
  start?: number;
  end?: number;
  notes?: string;
}

export interface SequenceOperation {
  id: string;
  kind:
    | "import"
    | "sequence-edit"
    | "reverse-complement"
    | "rotate-origin"
    | "pcr"
    | "gibson"
    | "golden-gate"
    | "ligation";
  timestamp: string;
  parentIds: string[];
  parentHashes?: string[];
  parameters: Record<string, unknown>;
}

export interface StudioSequenceRecord {
  id: string;
  name: string;
  description?: string;
  alphabet: SequenceAlphabet;
  topology: SequenceTopology;
  sequence: string;
  features: RichSequenceFeature[];
  primers: SequencePrimer[];
  operations: SequenceOperation[];
  sourceFile?: string;
}

export interface SequenceEdit {
  start: number;
  end: number;
  replacement: string;
  operationId: string;
  timestamp: string;
}

export interface RestrictionEnzyme {
  name: string;
  recognitionSequence: string;
  forwardCut: number;
  reverseCut: number;
}

export interface RestrictionSite {
  enzyme: RestrictionEnzyme;
  start: number;
  end: number;
  strand: 1 | -1;
  forwardCut: number;
  reverseCut: number;
}

export interface GoldenGateFragment {
  record: StudioSequenceRecord;
  payload: string;
  leftOverhang: string;
  rightOverhang: string;
}

const IUPAC_BASES: Record<string, string> = {
  A: "A",
  C: "C",
  G: "G",
  T: "T",
  U: "T",
  R: "[AG]",
  Y: "[CT]",
  S: "[GC]",
  W: "[AT]",
  K: "[GT]",
  M: "[AC]",
  B: "[CGT]",
  D: "[AGT]",
  H: "[ACT]",
  V: "[ACG]",
  N: "[ACGT]",
};

export const commonRestrictionEnzymes: RestrictionEnzyme[] = [
  {
    name: "EcoRI",
    recognitionSequence: "GAATTC",
    forwardCut: 1,
    reverseCut: 5,
  },
  {
    name: "BamHI",
    recognitionSequence: "GGATCC",
    forwardCut: 1,
    reverseCut: 5,
  },
  {
    name: "HindIII",
    recognitionSequence: "AAGCTT",
    forwardCut: 1,
    reverseCut: 5,
  },
  {
    name: "BsaI",
    recognitionSequence: "GGTCTC",
    forwardCut: 7,
    reverseCut: 11,
  },
  {
    name: "BsmBI",
    recognitionSequence: "CGTCTC",
    forwardCut: 7,
    reverseCut: 11,
  },
];

function normalizeForAlphabet(sequence: string, alphabet: SequenceAlphabet) {
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

function validateRange(start: number, end: number, sequenceLength: number) {
  if (
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start < 0 ||
    end < start ||
    end > sequenceLength
  ) {
    throw new RangeError(
      `Invalid zero-based half-open range ${start}..${end} for length ${sequenceLength}`
    );
  }
}

export function validateStudioRecord(record: StudioSequenceRecord) {
  const normalized = normalizeForAlphabet(record.sequence, record.alphabet);
  if (normalized !== record.sequence) {
    throw new Error("Sequence is not normalized for its alphabet");
  }
  for (const feature of record.features) {
    if (!feature.location.segments.length) {
      throw new Error(`Feature ${feature.id} has no location segments`);
    }
    for (const segment of feature.location.segments) {
      validateRange(segment.start, segment.end, record.sequence.length);
      if (segment.start === segment.end) {
        throw new Error(`Feature ${feature.id} contains an empty segment`);
      }
    }
  }
  return record;
}

function transformSegmentForEdit(
  segment: FeatureSegment,
  editStart: number,
  editEnd: number,
  replacementLength: number
): FeatureSegment | null {
  const replacedLength = editEnd - editStart;
  const delta = replacementLength - replacedLength;

  if (segment.end <= editStart) {
    return { ...segment };
  }
  if (segment.start >= editEnd) {
    return {
      start: segment.start + delta,
      end: segment.end + delta,
    };
  }

  const mappedStart =
    segment.start <= editStart
      ? segment.start
      : segment.start >= editEnd
        ? segment.start + delta
        : editStart;
  const mappedEnd =
    segment.end <= editStart
      ? segment.end
      : segment.end >= editEnd
        ? segment.end + delta
        : editStart + replacementLength;

  if (mappedEnd <= mappedStart) {
    return null;
  }
  return { start: mappedStart, end: mappedEnd };
}

export function applySequenceEdit(
  record: StudioSequenceRecord,
  edit: SequenceEdit
): StudioSequenceRecord {
  validateRange(edit.start, edit.end, record.sequence.length);
  const replacement = normalizeForAlphabet(edit.replacement, record.alphabet);
  const sequence = `${record.sequence.slice(0, edit.start)}${replacement}${record.sequence.slice(
    edit.end
  )}`;
  const features = record.features.flatMap((feature) => {
    const segments = feature.location.segments
      .map((segment) =>
        transformSegmentForEdit(
          segment,
          edit.start,
          edit.end,
          replacement.length
        )
      )
      .filter((segment): segment is FeatureSegment => Boolean(segment));
    if (!segments.length) {
      return [];
    }
    return [
      {
        ...feature,
        location: {
          ...feature.location,
          segments,
        },
      },
    ];
  });

  return validateStudioRecord({
    ...record,
    sequence,
    features,
    operations: [
      ...record.operations,
      {
        id: edit.operationId,
        kind: "sequence-edit",
        timestamp: edit.timestamp,
        parentIds: [record.id],
        parameters: {
          start: edit.start,
          end: edit.end,
          replacementLength: replacement.length,
        },
      },
    ],
  });
}

export function reverseComplementRecord(
  record: StudioSequenceRecord,
  operationId: string,
  timestamp: string
): StudioSequenceRecord {
  if (record.alphabet !== "DNA") {
    throw new Error("Reverse complement currently requires a DNA record");
  }
  const length = record.sequence.length;
  return validateStudioRecord({
    ...record,
    sequence: reverseComplement(record.sequence),
    features: record.features.map((feature) => ({
      ...feature,
      location: {
        ...feature.location,
        strand: feature.location.strand === 1 ? -1 : 1,
        segments: feature.location.segments
          .map((segment) => ({
            start: length - segment.end,
            end: length - segment.start,
          }))
          .reverse(),
      },
    })),
    primers: record.primers.map((primer) => ({
      ...primer,
      strand: primer.strand === 1 ? -1 : 1,
      start: primer.end === undefined ? undefined : length - primer.end,
      end: primer.start === undefined ? undefined : length - primer.start,
    })),
    operations: [
      ...record.operations,
      {
        id: operationId,
        kind: "reverse-complement",
        timestamp,
        parentIds: [record.id],
        parameters: {},
      },
    ],
  });
}

function rotateCoordinate(coordinate: number, origin: number, length: number) {
  return (coordinate - origin + length) % length;
}

function rotateSegment(
  segment: FeatureSegment,
  origin: number,
  length: number
): FeatureSegment[] {
  const start = rotateCoordinate(segment.start, origin, length);
  const lastIncluded = rotateCoordinate(segment.end - 1, origin, length);
  if (start <= lastIncluded) {
    return [{ start, end: lastIncluded + 1 }];
  }
  return [
    { start, end: length },
    { start: 0, end: lastIncluded + 1 },
  ];
}

export function rotateRecordOrigin(
  record: StudioSequenceRecord,
  origin: number,
  operationId: string,
  timestamp: string
): StudioSequenceRecord {
  if (record.topology !== "circular") {
    throw new Error("Origin rotation requires a circular record");
  }
  validateRange(origin, origin, record.sequence.length);
  if (origin === record.sequence.length) {
    origin = 0;
  }
  const sequence = `${record.sequence.slice(origin)}${record.sequence.slice(0, origin)}`;
  return validateStudioRecord({
    ...record,
    sequence,
    features: record.features.map((feature) => ({
      ...feature,
      location: {
        ...feature.location,
        operator: "join",
        segments: feature.location.segments.flatMap((segment) =>
          rotateSegment(segment, origin, record.sequence.length)
        ),
      },
    })),
    operations: [
      ...record.operations,
      {
        id: operationId,
        kind: "rotate-origin",
        timestamp,
        parentIds: [record.id],
        parameters: { origin },
      },
    ],
  });
}

function recognitionRegex(sequence: string) {
  const pattern = normalizeDnaSequence(sequence)
    .split("")
    .map((base) => IUPAC_BASES[base] ?? IUPAC_BASES.N)
    .join("");
  return new RegExp(`(?=(${pattern}))`, "g");
}

function findPattern(sequence: string, pattern: string) {
  return Array.from(
    sequence.matchAll(recognitionRegex(pattern)),
    (match) => match.index ?? 0
  );
}

export function findRestrictionSites(
  record: Pick<StudioSequenceRecord, "sequence" | "topology" | "alphabet">,
  enzymes: RestrictionEnzyme[] = commonRestrictionEnzymes
): RestrictionSite[] {
  if (record.alphabet !== "DNA") {
    return [];
  }
  const maxRecognitionLength = Math.max(
    1,
    ...enzymes.map((enzyme) => enzyme.recognitionSequence.length)
  );
  const searchSequence =
    record.topology === "circular"
      ? `${record.sequence}${record.sequence.slice(0, maxRecognitionLength - 1)}`
      : record.sequence;
  const sites: RestrictionSite[] = [];

  for (const enzyme of enzymes) {
    const forward = normalizeDnaSequence(enzyme.recognitionSequence);
    const reverse = reverseComplement(forward);
    for (const [strand, pattern] of [
      [1, forward],
      [-1, reverse],
    ] as const) {
      for (const start of findPattern(searchSequence, pattern)) {
        if (start >= record.sequence.length) {
          continue;
        }
        if (
          strand === -1 &&
          reverse === forward &&
          findPattern(searchSequence, forward).includes(start)
        ) {
          continue;
        }
        const rawEnd = start + pattern.length;
        const rawForwardCut =
          strand === 1
            ? start + enzyme.forwardCut
            : start + pattern.length - enzyme.reverseCut;
        const rawReverseCut =
          strand === 1
            ? start + enzyme.reverseCut
            : start + pattern.length - enzyme.forwardCut;
        const wrap = (coordinate: number) =>
          record.topology === "circular"
            ? ((coordinate % record.sequence.length) + record.sequence.length) %
              record.sequence.length
            : coordinate;
        sites.push({
          enzyme,
          start,
          end: wrap(rawEnd),
          strand,
          forwardCut: wrap(rawForwardCut),
          reverseCut: wrap(rawReverseCut),
        });
      }
    }
  }
  return sites.sort(
    (left, right) =>
      left.start - right.start ||
      left.enzyme.name.localeCompare(right.enzyme.name)
  );
}

function circularSlice(sequence: string, start: number, end: number) {
  if (start <= end) {
    return sequence.slice(start, end);
  }
  return `${sequence.slice(start)}${sequence.slice(0, end)}`;
}

export function simulatePcr(input: {
  template: StudioSequenceRecord;
  forwardPrimer: SequencePrimer;
  reversePrimer: SequencePrimer;
  outputId: string;
  outputName: string;
  operationId: string;
  timestamp: string;
}): StudioSequenceRecord {
  const { template, forwardPrimer, reversePrimer } = input;
  if (template.alphabet !== "DNA") {
    throw new Error("PCR simulation requires a DNA template");
  }
  const forwardAnneal = normalizeDnaSequence(forwardPrimer.annealSequence);
  const reverseAnneal = normalizeDnaSequence(reversePrimer.annealSequence);
  const forwardStart = template.sequence.indexOf(forwardAnneal);
  const reverseBinding = reverseComplement(reverseAnneal);
  const reverseStart = template.sequence.indexOf(reverseBinding);
  if (forwardStart < 0 || reverseStart < 0) {
    throw new Error("Primer annealing sequence was not found in the template");
  }
  const reverseEnd = reverseStart + reverseBinding.length;
  if (template.topology === "linear" && forwardStart >= reverseEnd) {
    throw new Error("Primers do not face one another on the linear template");
  }
  const amplicon = circularSlice(template.sequence, forwardStart, reverseEnd);
  const sequence = `${normalizeDnaSequence(forwardPrimer.overhang5 ?? "")}${amplicon}${reverseComplement(
    normalizeDnaSequence(reversePrimer.overhang5 ?? "")
  )}`;
  return {
    id: input.outputId,
    name: input.outputName,
    alphabet: "DNA",
    topology: "linear",
    sequence,
    features: [],
    primers: [forwardPrimer, reversePrimer],
    operations: [
      {
        id: input.operationId,
        kind: "pcr",
        timestamp: input.timestamp,
        parentIds: [template.id],
        parameters: {
          forwardPrimerId: forwardPrimer.id,
          reversePrimerId: reversePrimer.id,
          templateRange: [forwardStart, reverseEnd],
        },
      },
    ],
  };
}

function suffixPrefixOverlap(
  left: string,
  right: string,
  minimumOverlap: number
) {
  const maximum = Math.min(left.length, right.length);
  for (let size = maximum; size >= minimumOverlap; size -= 1) {
    if (left.slice(-size) === right.slice(0, size)) {
      return size;
    }
  }
  return 0;
}

export function simulateGibsonAssembly(input: {
  fragments: StudioSequenceRecord[];
  minimumOverlap?: number;
  circular?: boolean;
  outputId: string;
  outputName: string;
  operationId: string;
  timestamp: string;
}): StudioSequenceRecord {
  if (input.fragments.length < 2) {
    throw new Error("Gibson assembly requires at least two fragments");
  }
  const minimumOverlap = input.minimumOverlap ?? 15;
  let sequence = input.fragments[0].sequence;
  const overlaps: number[] = [];
  for (const fragment of input.fragments.slice(1)) {
    const overlap = suffixPrefixOverlap(
      sequence,
      fragment.sequence,
      minimumOverlap
    );
    if (!overlap) {
      throw new Error(
        `No overlap of at least ${minimumOverlap} bp joins the requested Gibson fragments`
      );
    }
    overlaps.push(overlap);
    sequence += fragment.sequence.slice(overlap);
  }
  if (input.circular) {
    const closure = suffixPrefixOverlap(
      sequence,
      input.fragments[0].sequence,
      minimumOverlap
    );
    if (closure > 0 && closure < sequence.length) {
      sequence = sequence.slice(0, -closure);
      overlaps.push(closure);
    }
  }
  return {
    id: input.outputId,
    name: input.outputName,
    alphabet: "DNA",
    topology: input.circular ? "circular" : "linear",
    sequence,
    features: [],
    primers: [],
    operations: [
      {
        id: input.operationId,
        kind: "gibson",
        timestamp: input.timestamp,
        parentIds: input.fragments.map((fragment) => fragment.id),
        parameters: { minimumOverlap, overlaps },
      },
    ],
  };
}

export function simulateGoldenGateAssembly(input: {
  fragments: GoldenGateFragment[];
  circular?: boolean;
  outputId: string;
  outputName: string;
  operationId: string;
  timestamp: string;
}): StudioSequenceRecord {
  if (input.fragments.length < 2) {
    throw new Error("Golden Gate assembly requires at least two fragments");
  }
  for (let index = 0; index < input.fragments.length - 1; index += 1) {
    const current = normalizeDnaSequence(input.fragments[index].rightOverhang);
    const next = normalizeDnaSequence(input.fragments[index + 1].leftOverhang);
    if (current !== next) {
      throw new Error(`Golden Gate overhang mismatch at junction ${index + 1}`);
    }
  }
  if (input.circular) {
    const last = normalizeDnaSequence(
      input.fragments.at(-1)?.rightOverhang ?? ""
    );
    const first = normalizeDnaSequence(input.fragments[0].leftOverhang);
    if (last !== first) {
      throw new Error("Golden Gate terminal overhangs do not close the circle");
    }
  }
  return {
    id: input.outputId,
    name: input.outputName,
    alphabet: "DNA",
    topology: input.circular ? "circular" : "linear",
    sequence: input.fragments
      .map((fragment) => normalizeDnaSequence(fragment.payload))
      .join(""),
    features: [],
    primers: [],
    operations: [
      {
        id: input.operationId,
        kind: "golden-gate",
        timestamp: input.timestamp,
        parentIds: input.fragments.map((fragment) => fragment.record.id),
        parameters: {
          overhangs: input.fragments.map((fragment) => ({
            left: normalizeDnaSequence(fragment.leftOverhang),
            right: normalizeDnaSequence(fragment.rightOverhang),
          })),
        },
      },
    ],
  };
}
