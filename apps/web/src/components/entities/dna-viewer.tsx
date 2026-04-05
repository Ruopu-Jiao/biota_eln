"use client";

import { useMemo, useState } from "react";
import type { DNAFeature, DNAFeatureType, DNARecord, FeatureRange } from "@biota/bio";
import {
  chunkSequence,
  featureLength,
  findMotifOccurrences,
  formatFeatureRange,
  formatGcContent,
  invertFeature,
  normalizeDnaSequence,
  reverseComplement,
  rotateFeatureRange,
  rotateSequence,
  splitCircularFeatureRange,
} from "@biota/bio";

type Orientation = "forward" | "reverse";
type OriginMode = "sequence-start" | "selected-feature";
type ToolPath = "align" | "history" | "primer" | "restriction";
type FeatureFilter = DNAFeatureType | "all";

const featureFilterLabels: Record<FeatureFilter, string> = {
  all: "All features",
  promoter: "Promoters",
  cds: "Coding",
  ori: "Origins",
  primer: "Primers",
  restriction: "Restriction",
  tag: "Tags",
  misc: "Other",
};

const featureTypeOrder: DNAFeatureType[] = [
  "promoter",
  "tag",
  "cds",
  "primer",
  "restriction",
  "ori",
  "misc",
];

const featureTypeDescriptions: Record<DNAFeatureType, string> = {
  promoter: "Transcription start or control region",
  cds: "Translated coding sequence",
  ori: "Replication origin",
  primer: "Primer binding site",
  restriction: "Restriction site cluster",
  tag: "Fusion tag or terminal motif",
  misc: "Unclassified annotation",
};

const featureColors: Record<DNAFeatureType, string> = {
  promoter: "#7ad7a5",
  cds: "#7fb0ff",
  ori: "#f3be6a",
  primer: "#d9a2ff",
  restriction: "#ff8f83",
  tag: "#8edfd6",
  misc: "#c4b8a6",
};

const toolPaths: Array<{ id: ToolPath; title: string; body: string }> = [
  {
    id: "align",
    title: "Align",
    body: "Compare this construct to a reference or imported edit.",
  },
  {
    id: "history",
    title: "History",
    body: "Track sequence revisions, edits, and provenance over time.",
  },
  {
    id: "primer",
    title: "Primers",
    body: "Design primer pairs from the current sequence window.",
  },
  {
    id: "restriction",
    title: "Restriction",
    body: "Surface cut sites and digest-ready fragment previews.",
  },
];

const restrictionEnzymes = [
  { name: "EcoRI", site: "GAATTC", note: "Classic single-cutter hook." },
  { name: "BamHI", site: "GGATCC", note: "Common cloning gate." },
  { name: "HindIII", site: "AAGCTT", note: "Frequently surfaced in plasmids." },
  { name: "XhoI", site: "CTCGAG", note: "Useful for insert excision." },
  { name: "BsaI", site: "GGTCTC", note: "Golden Gate-style assembly hook." },
] as const;

const workflowSeams = [
  {
    title: "Sanger traces",
    body: "Chromatogram overlays can anchor to this sequence window.",
  },
  {
    title: "Cloning history",
    body: "Revision lineage and construct provenance can slot in here.",
  },
  {
    title: "PCR design",
    body: "Primer picking and amplicon previews can grow from the current record.",
  },
] as const;

const sampleSequence = normalizeDnaSequence(
  [
    "ATGACCATGATTACGCCAAGCTTGAATTCGGTCTCGTCTAGAGGATCC",
    "TATAAAGCGGCCGCTCGAGCTAGCGTAGCTAGGCTAATACGACTCACT",
    "AGGATGACCATGGCTAGCTTTAAACCCGGGATATCGCAGTCTGACCTA",
    "GGGCGGCCGCAAGCTTATGCGTACTGACCTGATCGTAGGCTAGATCCA",
    "GCTAGCGGATCCATGCTAGCTTTGACATATAATGCTAGCTAGTGGGGA",
    "ATGACCATGATTACGCCAAGCTTGAATTCGGTCTCGTCTAGAGGATCC",
    "TATAAAGCGGCCGCTCGAGCTAGCGTAGCTAGGCTAATACGACTCACT",
    "AGGATGACCATGGCTAGCTTTAAACCCGGGATATCGCAGTCTGACCTA",
    "GGGCGGCCGCAAGCTTATGCGTACTGACCTGATCGTAGGCTAGATCCA",
    "GCTAGCGGATCCATGCTAGCTTTGACATATAATGCTAGCTAGTGGGGA",
  ].join(""),
);

const sampleRecord: DNARecord = {
  name: "pBiota-Helix",
  sequence: sampleSequence.repeat(4),
  alphabet: "DNA",
  topology: "circular",
  features: [
    {
      id: "promoter",
      name: "CMV promoter",
      type: "promoter",
      start: 45,
      end: 210,
      strand: 1,
      color: featureColors.promoter,
      notes: "Strong mammalian expression control region.",
    },
    {
      id: "tag",
      name: "N-terminal tag",
      type: "tag",
      start: 225,
      end: 318,
      strand: 1,
      color: featureColors.tag,
      notes: "Fusion tag and linker section.",
    },
    {
      id: "cds",
      name: "Reporter CDS",
      type: "cds",
      start: 320,
      end: 1088,
      strand: 1,
      color: featureColors.cds,
      notes: "Main payload sequence.",
    },
    {
      id: "primer-f",
      name: "Forward primer",
      type: "primer",
      start: 1125,
      end: 1151,
      strand: 1,
      color: featureColors.primer,
      notes: "PCR entry point.",
    },
    {
      id: "restriction-cluster",
      name: "Restriction cluster",
      type: "restriction",
      start: 1190,
      end: 1268,
      strand: -1,
      color: featureColors.restriction,
      notes: "Common cloning sites in one block.",
    },
    {
      id: "ori",
      name: "pUC origin",
      type: "ori",
      start: 1302,
      end: 1526,
      strand: -1,
      color: featureColors.ori,
      notes: "Plasmid replication origin.",
    },
    {
      id: "primer-r",
      name: "Reverse primer",
      type: "primer",
      start: 1560,
      end: 1588,
      strand: -1,
      color: featureColors.primer,
      notes: "Downstream confirmation primer.",
    },
    {
      id: "misc",
      name: "Intergenic spacer",
      type: "misc",
      start: 1604,
      end: 1690,
      strand: 1,
      color: featureColors.misc,
      notes: "Spacer region with lower annotation confidence.",
    },
  ],
};

function rangeContainsPosition(range: FeatureRange, position: number) {
  return range.start <= range.end
    ? position >= range.start && position <= range.end
    : position >= range.start || position <= range.end;
}

function featureMatchesQuery(feature: DNAFeature, query: string) {
  if (!query) {
    return true;
  }

  const normalized = query.toLowerCase();
  return (
    feature.name.toLowerCase().includes(normalized) ||
    feature.type.toLowerCase().includes(normalized) ||
    feature.notes?.toLowerCase().includes(normalized) === true
  );
}

function featureCoveragePercent(features: DNAFeature[], sequenceLength: number) {
  const covered = new Set<number>();

  for (const feature of features) {
    if (feature.start <= feature.end) {
      for (let position = feature.start; position <= feature.end; position += 1) {
        covered.add(position);
      }
      continue;
    }

    for (let position = feature.start; position <= sequenceLength; position += 1) {
      covered.add(position);
    }

    for (let position = 1; position <= feature.end; position += 1) {
      covered.add(position);
    }
  }

  return Math.round((covered.size / sequenceLength) * 100);
}

function featureTypeLabel(type: DNAFeatureType) {
  return featureFilterLabels[type];
}

function baseTone(base: string) {
  switch (base) {
    case "A":
      return "text-[color:#7ad7a5]";
    case "T":
      return "text-[color:#ff8f83]";
    case "G":
      return "text-[color:#f3be6a]";
    case "C":
      return "text-[color:#7fb0ff]";
    default:
      return "text-[color:var(--text-muted)]";
  }
}

function polarToCartesian(
  centerX: number,
  centerY: number,
  radius: number,
  angleInDegrees: number,
) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
}

function describeArc(
  centerX: number,
  centerY: number,
  radius: number,
  startAngle: number,
  endAngle: number,
) {
  const start = polarToCartesian(centerX, centerY, radius, endAngle);
  const end = polarToCartesian(centerX, centerY, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  return ["M", start.x, start.y, "A", radius, radius, 0, largeArcFlag, 0, end.x, end.y].join(
    " ",
  );
}

function SequenceMap({
  sequenceLength,
  features,
  selectedFeatureId,
  topology,
  originPosition,
  onSelectFeature,
}: {
  sequenceLength: number;
  features: DNAFeature[];
  selectedFeatureId: string;
  topology: DNARecord["topology"];
  originPosition: number;
  onSelectFeature: (featureId: string) => void;
}) {
  const selectedFeature = features.find((feature) => feature.id === selectedFeatureId) ?? null;

  if (topology === "linear") {
    const width = 920;
    const height = 180;
    const left = 48;
    const right = width - 48;
    const scale = (position: number) => left + ((position - 1) / sequenceLength) * (right - left);

    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full">
        <rect
          x="0"
          y="0"
          width={width}
          height={height}
          rx="24"
          fill="rgba(255,255,255,0.02)"
          stroke="rgba(255,255,255,0.08)"
        />
        <line
          x1={left}
          y1="92"
          x2={right}
          y2="92"
          stroke="rgba(255,255,255,0.26)"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <line
          x1={scale(originPosition)}
          y1="58"
          x2={scale(originPosition)}
          y2="126"
          stroke="var(--accent-strong)"
          strokeWidth="2"
          strokeDasharray="6 4"
        />
        {features.map((feature, index) => {
          const x1 = scale(feature.start);
          const x2 = scale(feature.end);
          const isSelected = feature.id === selectedFeatureId;
          const barY = 56 + (index % 2) * 24;
          return (
            <g key={feature.id} onClick={() => onSelectFeature(feature.id)} className="cursor-pointer">
              <rect
                x={Math.min(x1, x2)}
                y={barY}
                width={Math.max(12, Math.abs(x2 - x1))}
                height="18"
                rx="9"
                fill={feature.color}
                opacity={isSelected ? 1 : 0.78}
                stroke={isSelected ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.2)"}
                strokeWidth={isSelected ? 2 : 1}
              />
              <text x={Math.min(x1, x2) + 8} y={barY + 12} fill="#0d1112" fontSize="11" fontWeight="600">
                {feature.name}
              </text>
            </g>
          );
        })}
        <text x={left} y="152" fill="var(--text-soft)" fontSize="12">
          1
        </text>
        <text x={right - 20} y="152" fill="var(--text-soft)" fontSize="12">
          {sequenceLength.toLocaleString()}
        </text>
        <text x={left} y="28" fill="var(--accent-strong)" fontSize="12" fontWeight="600">
          Linear construct overview
        </text>
      </svg>
    );
  }

  const width = 420;
  const height = 420;
  const center = 210;
  const outerRadius = 132;
  const innerRadius = 96;
  const selectedColor = selectedFeature?.color ?? "var(--accent-strong)";

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full">
      <rect
        x="0"
        y="0"
        width={width}
        height={height}
        rx="24"
        fill="rgba(255,255,255,0.02)"
        stroke="rgba(255,255,255,0.08)"
      />
      <circle cx={center} cy={center} r={outerRadius} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="14" />
      <circle cx={center} cy={center} r={innerRadius} fill="rgba(17,21,24,0.92)" stroke="rgba(255,255,255,0.08)" />
      <line
        x1={center}
        y1={center}
        x2={center}
        y2={center - outerRadius - 8}
        stroke="var(--accent-strong)"
        strokeWidth="2"
        strokeDasharray="6 4"
      />
      <text x={center} y={28} textAnchor="middle" fill="var(--accent-strong)" fontSize="12" fontWeight="600">
        Circular construct map
      </text>
      <text x={center} y={246} textAnchor="middle" fill="var(--text-soft)" fontSize="12">
        Origin at {originPosition.toLocaleString()}
      </text>
      <text x={center} y={208} textAnchor="middle" fill="var(--text-primary)" fontSize="14" fontWeight="700">
        {selectedFeature ? selectedFeature.name : "No feature selected"}
      </text>
      <text x={center} y={228} textAnchor="middle" fill="var(--text-muted)" fontSize="11">
        {selectedFeature ? featureLength(selectedFeature, sequenceLength).toLocaleString() : "Feature detail ready"}
      </text>
      <line
        x1={center}
        y1={center}
        x2={center}
        y2={center - outerRadius - 20}
        stroke={selectedColor}
        strokeWidth="1.5"
        opacity="0.9"
      />
      {features.map((feature) => {
        const isSelected = feature.id === selectedFeatureId;
        const strokeWidth = isSelected ? 18 : 12;
        const opacity = isSelected ? 1 : 0.72;
        const segments = splitCircularFeatureRange({ start: feature.start, end: feature.end }, sequenceLength);

        return segments.map((segment, index) => {
          const startAngle = ((segment.start - 1) / sequenceLength) * 360;
          const endAngle = (segment.end / sequenceLength) * 360;
          return (
            <path
              key={`${feature.id}-${index}`}
              d={describeArc(center, center, outerRadius, startAngle, endAngle)}
              fill="none"
              stroke={feature.color}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              opacity={opacity}
              onClick={() => onSelectFeature(feature.id)}
              className="cursor-pointer"
            />
          );
        });
      })}
    </svg>
  );
}

function SequenceBrowser({
  sequence,
  features,
  selectedFeatureId,
  motifQuery,
  onSelectFeature,
}: {
  sequence: string;
  features: DNAFeature[];
  selectedFeatureId: string;
  motifQuery: string;
  onSelectFeature: (featureId: string) => void;
}) {
  const lineLength = 60;
  const lines = chunkSequence(sequence, lineLength);
  const motifRanges = findMotifOccurrences(sequence, motifQuery);
  const selectedFeature = features.find((feature) => feature.id === selectedFeatureId) ?? null;

  function hitLabel(position: number) {
    const feature = features.find((candidate) => rangeContainsPosition(candidate, position));
    if (feature) {
      return feature.name;
    }

    const motif = motifRanges.find((range) => rangeContainsPosition(range, position));
    return motif ? `Motif hit: ${motifQuery}` : null;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-[color:var(--text-soft)]">
        <span className="rounded-full border border-[color:var(--line)] px-2 py-1 text-[color:var(--accent-strong)]">
          Sequence browser
        </span>
        <span>Selected feature: {selectedFeature ? selectedFeature.name : "none"}</span>
      </div>

      <div className="max-h-[680px] space-y-4 overflow-auto pr-2">
        {lines.map((line, index) => {
          const startPosition = index * lineLength + 1;
          return (
            <div
              key={`${startPosition}-${line}`}
              className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-3 border-b border-[color:var(--line)] pb-3 last:border-b-0 last:pb-0"
            >
              <div className="pt-1 font-mono text-[11px] text-[color:var(--text-soft)]">
                {startPosition.toLocaleString()}
              </div>
              <div className="flex flex-wrap gap-0.5 font-mono text-[14px] leading-7 tracking-[0.14em]">
                {line.split("").map((base, baseIndex) => {
                  const position = startPosition + baseIndex;
                  const feature = features.find((candidate) => rangeContainsPosition(candidate, position));
                  const motifHit = motifRanges.find((range) => rangeContainsPosition(range, position));
                  const isSelected = feature?.id === selectedFeatureId;
                  const label = hitLabel(position);

                  return (
                    <span
                      key={`${position}-${base}`}
                      className={`rounded px-[1px] ${baseTone(base)} ${motifHit ? "bg-[color:var(--accent-muted)]" : ""} ${
                        isSelected ? "bg-[color:var(--accent-soft)]" : ""
                      }`}
                      style={{
                        boxShadow: feature ? `inset 0 -1px 0 ${feature.color}` : undefined,
                      }}
                      title={label ?? `${position.toLocaleString()} ${base}`}
                      onClick={() => feature && onSelectFeature(feature.id)}
                    >
                      {base}
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function DnaViewer() {
  const [topology, setTopology] = useState<DNARecord["topology"]>(sampleRecord.topology);
  const [orientation, setOrientation] = useState<Orientation>("forward");
  const [originMode, setOriginMode] = useState<OriginMode>("sequence-start");
  const [featureFilter, setFeatureFilter] = useState<FeatureFilter>("all");
  const [featureQuery, setFeatureQuery] = useState("");
  const [motifQuery, setMotifQuery] = useState("GAATTC");
  const [selectedFeatureId, setSelectedFeatureId] = useState(sampleRecord.features[0]?.id ?? "");
  const [activeTool, setActiveTool] = useState<ToolPath>("primer");

  const sequenceLength = sampleRecord.sequence.length;

  const oriented = useMemo(() => {
    const sequence = orientation === "forward" ? sampleRecord.sequence : reverseComplement(sampleRecord.sequence);
    const features =
      orientation === "forward"
        ? sampleRecord.features
        : sampleRecord.features.map((feature) => invertFeature(feature, sequenceLength));

    return { sequence, features };
  }, [orientation, sequenceLength]);

  const originFeature = useMemo(() => {
    if (originMode !== "selected-feature") {
      return null;
    }

    return oriented.features.find((feature) => feature.id === selectedFeatureId) ?? oriented.features[0] ?? null;
  }, [originMode, oriented.features, selectedFeatureId]);

  const originOffset = originFeature ? originFeature.start - 1 : 0;

  const displaySequence = useMemo(
    () => rotateSequence(oriented.sequence, originOffset),
    [oriented.sequence, originOffset],
  );

  const displayFeatures = useMemo(
    () =>
      oriented.features.map((feature) => ({
        ...feature,
        ...rotateFeatureRange({ start: feature.start, end: feature.end }, originOffset, sequenceLength),
      })),
    [oriented.features, originOffset, sequenceLength],
  );

  const selectedFeature = displayFeatures.find((feature) => feature.id === selectedFeatureId) ?? displayFeatures[0] ?? null;

  const filteredFeatures = useMemo(() => {
    return displayFeatures
      .filter((feature) => featureFilter === "all" || feature.type === featureFilter)
      .filter((feature) => featureMatchesQuery(feature, featureQuery));
  }, [displayFeatures, featureFilter, featureQuery]);

  const motifOccurrences = useMemo(
    () => findMotifOccurrences(displaySequence, motifQuery),
    [displaySequence, motifQuery],
  );

  const restrictionHookHits = useMemo(
    () =>
      restrictionEnzymes.map((enzyme) => ({
        ...enzyme,
        hits: findMotifOccurrences(displaySequence, enzyme.site).length,
      })),
    [displaySequence],
  );

  const visibleFeatureCount = filteredFeatures.length;
  const gcPercent = formatGcContent(displaySequence);
  const featureCoverage = featureCoveragePercent(displayFeatures, sequenceLength);
  const selectedFeatureDescription = selectedFeature
    ? `${featureTypeLabel(selectedFeature.type)} · ${selectedFeature.notes ?? "Ready for downstream inspection."}`
    : "Pick a feature to inspect its coordinates, strand, and downstream tool entry points.";
  const originLabel = originMode === "sequence-start" ? "Sequence start" : "Selected feature";

  return (
    <section className="space-y-6">
      <header className="border-b border-[color:var(--line)] pb-5">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[color:var(--accent-strong)]">
          DNA viewer foundation
        </p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-[-0.04em] text-[color:var(--text-primary)]">
              SnapGene-inspired sequence workspace
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[color:var(--text-muted)]">
              Dual map and sequence views, feature annotations, circular and linear modes, origin control,
              reverse-complement orientation, and entry points for the next analysis tools.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.16em] text-[color:var(--text-soft)]">
            <span className="rounded-full border border-[color:var(--line)] px-3 py-1">{sampleRecord.name}</span>
            <span className="rounded-full border border-[color:var(--line)] px-3 py-1">
              {sequenceLength.toLocaleString()} bp
            </span>
            <span className="rounded-full border border-[color:var(--line)] px-3 py-1">GC {gcPercent}</span>
            <span className="rounded-full border border-[color:var(--line)] px-3 py-1">
              {visibleFeatureCount} features visible
            </span>
          </div>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(280px,0.82fr)]">
        <div className="space-y-6">
          <section className="border border-[color:var(--line)] bg-[color:var(--surface)] p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[color:var(--line)] pb-4">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[color:var(--text-soft)]">
                  Record inspector
                </p>
                <h2 className="mt-2 text-xl font-semibold text-[color:var(--text-primary)]">{sampleRecord.name}</h2>
                <p className="mt-2 max-w-2xl text-sm leading-7 text-[color:var(--text-muted)]">
                  Feature annotations are live and selectable, with the map and sequence browser staying in sync.
                </p>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <ToggleGroup
                  label="Topology"
                  options={[
                    { value: "circular", label: "Circular" },
                    { value: "linear", label: "Linear" },
                  ]}
                  value={topology}
                  onChange={(value) => setTopology(value as DNARecord["topology"])}
                />
                <ToggleGroup
                  label="Orientation"
                  options={[
                    { value: "forward", label: "Forward" },
                    { value: "reverse", label: "Reverse complement" },
                  ]}
                  value={orientation}
                  onChange={(value) => setOrientation(value as Orientation)}
                />
                <ToggleGroup
                  label="Origin"
                  options={[
                    { value: "sequence-start", label: "Sequence start" },
                    { value: "selected-feature", label: "Selected feature" },
                  ]}
                  value={originMode}
                  onChange={(value) => setOriginMode(value as OriginMode)}
                />
                <ToggleGroup
                  label="Tools"
                  options={toolPaths.map((tool) => ({ value: tool.id, label: tool.title }))}
                  value={activeTool}
                  onChange={(value) => setActiveTool(value as ToolPath)}
                />
              </div>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1fr)]">
              <div className="space-y-4">
                <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-strong)] p-4">
                  <SequenceMap
                    sequenceLength={sequenceLength}
                    features={displayFeatures}
                    selectedFeatureId={selectedFeatureId}
                    topology={topology}
                    originPosition={originMode === "selected-feature" && originFeature ? originFeature.start : 1}
                    onSelectFeature={setSelectedFeatureId}
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <StatCard label="Annotations" value={`${displayFeatures.length}`} helper="Feature definitions in the record" />
                  <StatCard label="Coverage" value={`${featureCoverage}%`} helper="Approximate base coverage by annotations" />
                  <StatCard label="Motif hits" value={`${motifOccurrences.length}`} helper={`Search for ${motifQuery || "a motif"}`} />
                </div>
              </div>

              <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-strong)] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[color:var(--text-soft)]">
                      Sequence browser
                    </p>
                    <h3 className="mt-2 text-lg font-semibold text-[color:var(--text-primary)]">
                      Dual-pane sequence inspection
                    </h3>
                  </div>
                  <div className="rounded-full border border-[color:var(--line)] px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-[color:var(--text-soft)]">
                    Origin: {originLabel}
                  </div>
                </div>

                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-[11px] uppercase tracking-[0.16em] text-[color:var(--text-soft)]">
                      Search features
                    </span>
                    <input
                      value={featureQuery}
                      onChange={(event) => setFeatureQuery(event.target.value)}
                      placeholder="promoter, ori, primer..."
                      className="w-full border border-[color:var(--line)] bg-[color:var(--surface-muted)] px-3 py-2 text-sm text-[color:var(--text-primary)] outline-none transition focus:border-[color:var(--accent-soft)]"
                    />
                  </label>

                  <label className="space-y-2">
                    <span className="text-[11px] uppercase tracking-[0.16em] text-[color:var(--text-soft)]">
                      Find motif
                    </span>
                    <input
                      value={motifQuery}
                      onChange={(event) => setMotifQuery(event.target.value)}
                      placeholder="GAATTC"
                      className="w-full border border-[color:var(--line)] bg-[color:var(--surface-muted)] px-3 py-2 text-sm text-[color:var(--text-primary)] outline-none transition focus:border-[color:var(--accent-soft)]"
                    />
                  </label>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {(Object.keys(featureFilterLabels) as FeatureFilter[]).map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setFeatureFilter(filter)}
                      className={`border px-3 py-1.5 text-xs uppercase tracking-[0.16em] transition ${
                        featureFilter === filter
                          ? "border-[color:var(--accent-soft)] bg-[color:var(--accent-muted)] text-[color:var(--text-primary)]"
                          : "border-[color:var(--line)] bg-transparent text-[color:var(--text-muted)] hover:border-[color:var(--accent-soft)] hover:text-[color:var(--text-primary)]"
                      }`}
                    >
                      {featureFilterLabels[filter]}
                    </button>
                  ))}
                </div>

                <div className="mt-5 max-h-[660px] overflow-auto pr-1">
                  <SequenceBrowser
                    sequence={displaySequence}
                    features={displayFeatures.filter(
                      (feature) => featureFilter === "all" || feature.type === featureFilter,
                    )}
                    selectedFeatureId={selectedFeatureId}
                    motifQuery={motifQuery}
                    onSelectFeature={setSelectedFeatureId}
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1fr)]">
            <div className="border border-[color:var(--line)] bg-[color:var(--surface)] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[color:var(--text-soft)]">
                    Feature annotations
                  </p>
                  <h3 className="mt-2 text-lg font-semibold text-[color:var(--text-primary)]">
                    Searchable feature library
                  </h3>
                </div>
                <span className="rounded-full border border-[color:var(--line)] px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-[color:var(--text-soft)]">
                  {filteredFeatures.length} matched
                </span>
              </div>

              <div className="mt-4 space-y-3">
                {filteredFeatures.map((feature) => {
                  const isSelected = feature.id === selectedFeatureId;
                  return (
                    <button
                      key={feature.id}
                      type="button"
                      onClick={() => setSelectedFeatureId(feature.id)}
                      className={`w-full border px-3 py-3 text-left transition ${
                        isSelected
                          ? "border-[color:var(--accent-soft)] bg-[color:var(--accent-muted)]"
                          : "border-[color:var(--line)] bg-[color:var(--surface-muted)] hover:border-[color:var(--accent-soft)]"
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: feature.color }} />
                          <span className="text-sm font-medium text-[color:var(--text-primary)]">
                            {feature.name}
                          </span>
                        </div>
                        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[color:var(--text-soft)]">
                          {featureTypeLabel(feature.type)}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-[color:var(--text-muted)]">
                        <span>{formatFeatureRange(feature)}</span>
                        <span>Strand {feature.strand === 1 ? "+" : "-"}</span>
                        <span>{featureTypeDescriptions[feature.type]}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="border border-[color:var(--line)] bg-[color:var(--surface)] p-4">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[color:var(--text-soft)]">
                Tool path
              </p>
              <h3 className="mt-2 text-lg font-semibold text-[color:var(--text-primary)]">
                Obvious next steps for analysis
              </h3>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-[color:var(--text-muted)]">
                This foundation leaves clear room for alignment, revision history, primer design, and restriction analysis.
              </p>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {toolPaths.map((tool) => {
                  const active = tool.id === activeTool;
                  return (
                    <div
                      key={tool.id}
                      className={`border p-3 ${
                        active
                          ? "border-[color:var(--accent-soft)] bg-[color:var(--accent-muted)]"
                          : "border-[color:var(--line)] bg-[color:var(--surface-muted)]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-sm font-medium text-[color:var(--text-primary)]">{tool.title}</h4>
                        <span className="rounded-full border border-[color:var(--line)] px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-[color:var(--text-soft)]">
                          {active ? "Ready next" : "Planned"}
                        </span>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-[color:var(--text-muted)]">{tool.body}</p>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 border-t border-[color:var(--line)] pt-4">
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[color:var(--text-soft)]">
                  Workflow seams
                </p>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  {workflowSeams.map((item) => (
                    <div key={item.title} className="border border-[color:var(--line)] bg-[color:var(--surface-muted)] p-3">
                      <h4 className="text-sm font-medium text-[color:var(--text-primary)]">{item.title}</h4>
                      <p className="mt-2 text-sm leading-6 text-[color:var(--text-muted)]">{item.body}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>

        <aside className="space-y-4 border border-[color:var(--line)] bg-[color:var(--surface)] p-4">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[color:var(--text-soft)]">Inspector</p>
            <h3 className="mt-2 text-lg font-semibold text-[color:var(--text-primary)]">Selected feature detail</h3>
          </div>

          <div className="border border-[color:var(--line)] bg-[color:var(--surface-muted)] p-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-[color:var(--text-primary)]">
                {selectedFeature?.name ?? "No feature selected"}
              </span>
              {selectedFeature ? <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: selectedFeature.color }} /> : null}
            </div>
            <p className="mt-2 text-sm leading-7 text-[color:var(--text-muted)]">{selectedFeatureDescription}</p>
          </div>

          <div className="grid gap-3 text-sm text-[color:var(--text-muted)]">
            <dl className="space-y-3">
              <div className="flex items-center justify-between gap-3 border-b border-[color:var(--line)] pb-3">
                <dt>Topology</dt>
                <dd className="font-medium text-[color:var(--text-primary)]">{topology === "circular" ? "Circular" : "Linear"}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 border-b border-[color:var(--line)] pb-3">
                <dt>Orientation</dt>
                <dd className="font-medium text-[color:var(--text-primary)]">
                  {orientation === "forward" ? "Forward" : "Reverse complement"}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 border-b border-[color:var(--line)] pb-3">
                <dt>Origin</dt>
                <dd className="font-medium text-[color:var(--text-primary)]">{originLabel}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 border-b border-[color:var(--line)] pb-3">
                <dt>Motif search</dt>
                <dd className="font-mono text-xs text-[color:var(--accent-strong)]">{motifQuery || "none"}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt>Feature filter</dt>
                <dd className="font-medium text-[color:var(--text-primary)]">{featureFilterLabels[featureFilter]}</dd>
              </div>
            </dl>
          </div>

          <div className="border-t border-[color:var(--line)] pt-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[color:var(--text-soft)]">
              Restriction hooks
            </p>
            <div className="mt-3 space-y-2 text-sm text-[color:var(--text-muted)]">
              {restrictionHookHits.map((enzyme) => (
                <div key={enzyme.name} className="flex items-center justify-between gap-3 border-b border-[color:var(--line)] pb-2 last:border-b-0 last:pb-0">
                  <div>
                    <span className="block text-[color:var(--text-primary)]">{enzyme.name}</span>
                    <span className="block font-mono text-[11px] uppercase tracking-[0.16em] text-[color:var(--text-soft)]">
                      {enzyme.site}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="block font-medium text-[color:var(--text-primary)]">{enzyme.hits}</span>
                    <span className="block text-[11px] uppercase tracking-[0.14em] text-[color:var(--text-soft)]">
                      site hits
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-[color:var(--line)] pt-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[color:var(--text-soft)]">
              Feature scope
            </p>
            <div className="mt-3 space-y-2 text-sm text-[color:var(--text-muted)]">
              {featureTypeOrder.map((type) => (
                <div key={type} className="flex items-center justify-between gap-3">
                  <span>{featureTypeLabel(type)}</span>
                  <span className="font-medium text-[color:var(--text-primary)]">
                    {displayFeatures.filter((feature) => feature.type === type).length}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}

function ToggleGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="text-[11px] uppercase tracking-[0.16em] text-[color:var(--text-soft)]">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={`border px-3 py-1.5 text-xs uppercase tracking-[0.14em] transition ${
                active
                  ? "border-[color:var(--accent-soft)] bg-[color:var(--accent-muted)] text-[color:var(--text-primary)]"
                  : "border-[color:var(--line)] bg-[color:var(--surface-muted)] text-[color:var(--text-muted)] hover:border-[color:var(--accent-soft)] hover:text-[color:var(--text-primary)]"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StatCard({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <div className="border border-[color:var(--line)] bg-[color:var(--surface-muted)] p-3">
      <p className="text-[11px] uppercase tracking-[0.16em] text-[color:var(--text-soft)]">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[color:var(--text-primary)]">{value}</p>
      <p className="mt-1 text-xs leading-5 text-[color:var(--text-muted)]">{helper}</p>
    </div>
  );
}
