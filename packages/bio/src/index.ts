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

export interface FeatureRange {
  start: number;
  end: number;
}

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
