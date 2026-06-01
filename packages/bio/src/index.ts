export type SequenceAlphabet = "DNA" | "RNA" | "protein";
export type SequenceTopology = "linear" | "circular";

export interface SequenceRecord {
  sequence: string;
  alphabet: SequenceAlphabet;
  topology: SequenceTopology;
}

export type DNAFeatureType =
  | "promoter"
  | "cds"
  | "ori"
  | "primer"
  | "restriction"
  | "tag"
  | "misc";

export interface DNAFeature {
  id: string;
  name: string;
  type: DNAFeatureType;
  start: number;
  end: number;
  strand: 1 | -1;
  color: string;
  notes?: string;
}

export interface DNARecord extends SequenceRecord {
  name: string;
  features: DNAFeature[];
}

export type SequenceEntityType = "plasmid" | "sgrna" | "primer";

export interface SequenceEntityRecord extends DNARecord {
  id: string;
  entityType: SequenceEntityType;
  description: string;
  aliases: string[];
}

export interface SequenceEntityCatalog {
  entities: SequenceEntityRecord[];
}

export interface FeatureRange {
  start: number;
  end: number;
}

const DNA_CODON_TABLE: Record<string, string> = {
  TTT: "F",
  TTC: "F",
  TTA: "L",
  TTG: "L",
  TCT: "S",
  TCC: "S",
  TCA: "S",
  TCG: "S",
  TAT: "Y",
  TAC: "Y",
  TAA: "*",
  TAG: "*",
  TGT: "C",
  TGC: "C",
  TGA: "*",
  TGG: "W",
  CTT: "L",
  CTC: "L",
  CTA: "L",
  CTG: "L",
  CCT: "P",
  CCC: "P",
  CCA: "P",
  CCG: "P",
  CAT: "H",
  CAC: "H",
  CAA: "Q",
  CAG: "Q",
  CGT: "R",
  CGC: "R",
  CGA: "R",
  CGG: "R",
  ATT: "I",
  ATC: "I",
  ATA: "I",
  ATG: "M",
  ACT: "T",
  ACC: "T",
  ACA: "T",
  ACG: "T",
  AAT: "N",
  AAC: "N",
  AAA: "K",
  AAG: "K",
  AGT: "S",
  AGC: "S",
  AGA: "R",
  AGG: "R",
  GTT: "V",
  GTC: "V",
  GTA: "V",
  GTG: "V",
  GCT: "A",
  GCC: "A",
  GCA: "A",
  GCG: "A",
  GAT: "D",
  GAC: "D",
  GAA: "E",
  GAG: "E",
  GGT: "G",
  GGC: "G",
  GGA: "G",
  GGG: "G",
};

const DNA_COMPLEMENT: Record<string, string> = {
  A: "T",
  T: "A",
  C: "G",
  G: "C",
  U: "A",
  R: "Y",
  Y: "R",
  S: "S",
  W: "W",
  K: "M",
  M: "K",
  B: "V",
  D: "H",
  H: "D",
  V: "B",
  N: "N",
};

export function normalizeDnaSequence(sequence: string) {
  return sequence.replace(/[^A-Za-z]/g, "").toUpperCase().replaceAll("U", "T");
}

export function complementBase(base: string) {
  return DNA_COMPLEMENT[base.toUpperCase()] ?? "N";
}

export function reverseComplement(sequence: string) {
  return normalizeDnaSequence(sequence)
    .split("")
    .reverse()
    .map((base) => complementBase(base))
    .join("");
}

export function gcContent(sequence: string) {
  const normalized = normalizeDnaSequence(sequence);
  if (normalized.length === 0) {
    return 0;
  }

  const gcCount = normalized.split("").filter((base) => base === "G" || base === "C").length;
  return (gcCount / normalized.length) * 100;
}

export function chunkSequence(sequence: string, chunkSize: number) {
  const normalized = normalizeDnaSequence(sequence);
  const chunks: string[] = [];

  for (let index = 0; index < normalized.length; index += chunkSize) {
    chunks.push(normalized.slice(index, index + chunkSize));
  }

  return chunks;
}

export function findMotifOccurrences(sequence: string, motif: string) {
  const normalizedSequence = normalizeDnaSequence(sequence);
  const normalizedMotif = normalizeDnaSequence(motif);

  if (!normalizedMotif) {
    return [];
  }

  const occurrences: FeatureRange[] = [];
  let searchIndex = 0;

  while (searchIndex <= normalizedSequence.length - normalizedMotif.length) {
    const foundIndex = normalizedSequence.indexOf(normalizedMotif, searchIndex);

    if (foundIndex === -1) {
      break;
    }

    occurrences.push({
      start: foundIndex + 1,
      end: foundIndex + normalizedMotif.length,
    });
    searchIndex = foundIndex + 1;
  }

  return occurrences;
}

export function rotateSequence(sequence: string, offset: number) {
  const normalized = normalizeDnaSequence(sequence);
  if (normalized.length === 0) {
    return normalized;
  }

  const shift = ((offset % normalized.length) + normalized.length) % normalized.length;
  return `${normalized.slice(shift)}${normalized.slice(0, shift)}`;
}

export function rotatePosition(position: number, offset: number, sequenceLength: number) {
  const zeroBased = position - 1;
  const shift = ((offset % sequenceLength) + sequenceLength) % sequenceLength;
  return ((zeroBased - shift + sequenceLength) % sequenceLength) + 1;
}

export function sliceSequenceRange(
  sequence: string,
  start: number,
  end: number,
  topology: SequenceTopology = "linear",
) {
  const normalized = normalizeDnaSequence(sequence);

  if (!normalized.length) {
    return "";
  }

  if (topology === "linear" || start <= end) {
    return normalized.slice(Math.max(0, start - 1), Math.max(0, end));
  }

  return `${normalized.slice(Math.max(0, start - 1))}${normalized.slice(0, Math.max(0, end))}`;
}

export function rotateFeatureRange(
  range: FeatureRange,
  offset: number,
  sequenceLength: number,
) {
  return {
    start: rotatePosition(range.start, offset, sequenceLength),
    end: rotatePosition(range.end, offset, sequenceLength),
  };
}

export function featureLength(feature: Pick<DNAFeature, "start" | "end">, sequenceLength: number) {
  if (feature.start <= feature.end) {
    return feature.end - feature.start + 1;
  }

  return sequenceLength - feature.start + 1 + feature.end;
}

export function splitCircularFeatureRange(
  range: FeatureRange,
  sequenceLength: number,
): FeatureRange[] {
  if (range.start <= range.end) {
    return [range];
  }

  return [
    { start: range.start, end: sequenceLength },
    { start: 1, end: range.end },
  ];
}

export function invertFeature(feature: DNAFeature, sequenceLength: number): DNAFeature {
  return {
    ...feature,
    strand: feature.strand === 1 ? -1 : 1,
    start: sequenceLength - feature.end + 1,
    end: sequenceLength - feature.start + 1,
  };
}

export function formatFeatureRange(feature: Pick<DNAFeature, "start" | "end">) {
  return feature.start <= feature.end
    ? `${feature.start.toLocaleString()}-${feature.end.toLocaleString()}`
    : `${feature.start.toLocaleString()}-${feature.end.toLocaleString()} (wrap)`;
}

export function formatGcContent(sequence: string) {
  return `${gcContent(sequence).toFixed(1)}%`;
}

export function translateCodon(codon: string) {
  const normalized = normalizeDnaSequence(codon);

  if (normalized.length !== 3) {
    return "";
  }

  return DNA_CODON_TABLE[normalized] ?? "X";
}

export function translateDna(sequence: string, frame = 0) {
  const normalized = normalizeDnaSequence(sequence);
  let protein = "";

  for (let index = frame; index <= normalized.length - 3; index += 3) {
    protein += translateCodon(normalized.slice(index, index + 3));
  }

  return protein;
}

export function estimatePrimerTm(sequence: string) {
  const normalized = normalizeDnaSequence(sequence);
  const atCount = normalized.split("").filter((base) => base === "A" || base === "T").length;
  const gcCount = normalized.length - atCount;

  return 2 * atCount + 4 * gcCount;
}
