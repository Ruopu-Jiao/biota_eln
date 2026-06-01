"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormHTMLAttributes,
  type MouseEvent,
  type ReactNode,
  type SVGProps,
} from "react";
import type {
  DNAFeature,
  DNAFeatureType,
  DNARecord,
  FeatureRange,
  SequenceEntityType,
  SequenceTopology,
} from "@biota/bio";
import {
  chunkSequence,
  featureLength,
  findMotifOccurrences,
  formatFeatureRange,
  gcContent,
  invertFeature,
  normalizeDnaSequence,
  reverseComplement,
  rotateFeatureRange,
  rotateSequence,
  splitCircularFeatureRange,
} from "@biota/bio";
import {
  getSequenceEntityStats,
  toDNARecord,
} from "@/lib/entities/catalog";
import type { StoredSequenceEntity } from "@/lib/entities/store";

type DnaViewerProps = {
  initialEntityId?: string;
  initialView?: EntityView;
  entities: StoredSequenceEntity[];
  saveAction?: FormHTMLAttributes<HTMLFormElement>["action"];
};

type EntityView = "sequence" | "map" | "features" | "primers" | "enzymes" | "history";
type Orientation = "forward" | "reverse";
type OriginMode = "sequence-start" | "selected-feature";
type FeatureFilter = DNAFeatureType | "all";

type PrimerRow = {
  id: string;
  name: string;
  start: number;
  end: number;
  strand: 1 | -1;
  length: number;
  sequence: string;
  tm: string;
  gc: string;
  notes?: string;
};

type EnzymeRow = {
  id: string;
  name: string;
  site: string;
  positions: number[];
  hits: number;
  note: string;
};

type IconProps = SVGProps<SVGSVGElement>;

const viewTabs: Array<{ id: EntityView; label: string }> = [
  { id: "sequence", label: "Sequence" },
  { id: "map", label: "Map" },
  { id: "features", label: "Features" },
  { id: "primers", label: "Primers" },
  { id: "enzymes", label: "Enzymes" },
  { id: "history", label: "History" },
];

const featureFilterLabels: Record<FeatureFilter, string> = {
  all: "All",
  promoter: "Promoters",
  cds: "CDS",
  ori: "Origins",
  primer: "Primers",
  restriction: "Restriction",
  tag: "Tags",
  misc: "Other",
};

const featureTypeDescriptions: Record<DNAFeatureType, string> = {
  promoter: "Transcription control region",
  cds: "Coding sequence",
  ori: "Replication origin",
  primer: "Primer binding site",
  restriction: "Restriction hook or digest marker",
  tag: "Fusion tag or scaffold element",
  misc: "General annotation",
};

const entityTypeLabels: Record<SequenceEntityType, string> = {
  plasmid: "Plasmid",
  sgrna: "sgRNA",
  primer: "Primer",
};

const restrictionEnzymes = [
  { name: "EcoRI", site: "GAATTC", note: "Classic cloning single-cutter." },
  { name: "BamHI", site: "GGATCC", note: "Common plasmid assembly hook." },
  { name: "HindIII", site: "AAGCTT", note: "Widely used restriction marker." },
  { name: "XhoI", site: "CTCGAG", note: "Useful insert excision site." },
  { name: "BsaI", site: "GGTCTC", note: "Type IIS site for Golden Gate workflows." },
];

const codonTable: Record<string, string> = {
  TTT: "F", TTC: "F", TTA: "L", TTG: "L",
  TCT: "S", TCC: "S", TCA: "S", TCG: "S",
  TAT: "Y", TAC: "Y", TAA: "*", TAG: "*",
  TGT: "C", TGC: "C", TGA: "*", TGG: "W",
  CTT: "L", CTC: "L", CTA: "L", CTG: "L",
  CCT: "P", CCC: "P", CCA: "P", CCG: "P",
  CAT: "H", CAC: "H", CAA: "Q", CAG: "Q",
  CGT: "R", CGC: "R", CGA: "R", CGG: "R",
  ATT: "I", ATC: "I", ATA: "I", ATG: "M",
  ACT: "T", ACC: "T", ACA: "T", ACG: "T",
  AAT: "N", AAC: "N", AAA: "K", AAG: "K",
  AGT: "S", AGC: "S", AGA: "R", AGG: "R",
  GTT: "V", GTC: "V", GTA: "V", GTG: "V",
  GCT: "A", GCC: "A", GCA: "A", GCG: "A",
  GAT: "D", GAC: "D", GAA: "E", GAG: "E",
  GGT: "G", GGC: "G", GGA: "G", GGG: "G",
};

function buildEntityFeaturePayload(features: DNAFeature[]) {
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

function SequenceIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...props}>
      <path d="M8.25 4.5c3.25 0 4 2.75 7.5 2.75" />
      <path d="M8.25 19.5c3.25 0 4-2.75 7.5-2.75" />
      <path d="M8.25 4.5c0 3.25 2.75 4 2.75 7.5" />
      <path d="M15.75 19.5c0-3.25-2.75-4-2.75-7.5" />
      <path d="M7.75 8.75h8.5" />
      <path d="M7.75 15.25h8.5" />
    </svg>
  );
}

function MapIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...props}>
      <circle cx="12" cy="12" r="6.5" />
      <path d="M12 5.5v13" />
      <path d="M5.5 12h13" />
    </svg>
  );
}

function TableIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...props}>
      <path d="M5.5 6.25h13v11.5h-13z" />
      <path d="M5.5 10h13" />
      <path d="M10 6.25v11.5" />
    </svg>
  );
}

function HistoryIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...props}>
      <path d="M4.75 12a7.25 7.25 0 1 0 2.13-5.12" />
      <path d="M4.75 5.75v4.5h4.5" />
      <path d="M12 8.5v4.1l2.75 1.65" />
    </svg>
  );
}

function EyeIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...props}>
      <path d="M3.75 12c1.9-4.1 5.2-6.5 8.25-6.5s6.35 2.4 8.25 6.5c-1.9 4.1-5.2 6.5-8.25 6.5S5.65 16.1 3.75 12Z" />
      <circle cx="12" cy="12" r="2.6" />
    </svg>
  );
}

function EyeOffIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...props}>
      <path d="M4.75 5.5 19.25 18.5" />
      <path d="M9.35 7.5A8.8 8.8 0 0 1 12 7.1c3.05 0 6.35 2.4 8.25 6.5a12.5 12.5 0 0 1-2.66 3.48" />
      <path d="M6.68 9.38A12.56 12.56 0 0 0 3.75 13.6c1.9 4.1 5.2 6.5 8.25 6.5 1.16 0 2.28-.18 3.34-.53" />
      <path d="M10.47 10.49A2.6 2.6 0 0 0 13.55 13.5" />
    </svg>
  );
}

function SplitIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...props}>
      <path d="M5.5 6.75h13v10.5h-13z" />
      <path d="M5.5 12h13" />
    </svg>
  );
}

function SaveIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...props}>
      <path d="M5.5 4.75h10.25l2.75 2.75v11.75h-13z" />
      <path d="M8.25 4.75v5.5h6.5v-5.5" />
      <path d="M8.5 18h7" />
    </svg>
  );
}

function InfoIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...props}>
      <circle cx="12" cy="12" r="7.25" />
      <path d="M12 10.25v5.5" />
      <circle cx="12" cy="7.75" r="0.75" fill="currentColor" stroke="none" />
    </svg>
  );
}

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

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function baseTone(base: string) {
  switch (base) {
    case "A":
      return "text-[color:#66a86f]";
    case "T":
      return "text-[color:#bf6a5f]";
    case "G":
      return "text-[color:#b98a44]";
    case "C":
      return "text-[color:#4b74b7]";
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
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180;

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

  return ["M", start.x, start.y, "A", radius, radius, 0, largeArcFlag, 0, end.x, end.y].join(" ");
}

function sequenceSlice(sequence: string, start: number, end: number) {
  if (!sequence) {
    return "";
  }

  if (start <= end) {
    return sequence.slice(start - 1, end);
  }

  return `${sequence.slice(start - 1)}${sequence.slice(0, end)}`;
}

function wallaceTm(sequence: string) {
  const normalized = sequence.toUpperCase();
  const counts = normalized.split("").reduce(
    (result, base) => {
      if (base === "A" || base === "T") {
        result.at += 1;
      }

      if (base === "G" || base === "C") {
        result.gc += 1;
      }

      return result;
    },
    { at: 0, gc: 0 },
  );

  return `${counts.at * 2 + counts.gc * 4}°C`;
}

function translateSequence(sequence: string, frameOffset = 0) {
  const normalized = sequence.toUpperCase();
  const prefix = " ".repeat(frameOffset);
  const codons = normalized.match(/.{1,3}/g) ?? [];

  return `${prefix}${codons
    .map((codon) =>
      codon.length === 3 ? `${codonTable[codon] ?? "X"}  ` : "   ",
    )
    .join("")}`;
}

function buildPrimerRows(features: DNAFeature[], sequence: string): PrimerRow[] {
  return features
    .filter((feature) => feature.type === "primer")
    .map((feature) => {
      const primerSequence = sequenceSlice(sequence, feature.start, feature.end);

      return {
        id: feature.id,
        name: feature.name,
        start: feature.start,
        end: feature.end,
        strand: feature.strand,
        length: featureLength(feature, sequence.length),
        sequence: primerSequence,
        tm: wallaceTm(primerSequence),
        gc: `${gcContent(primerSequence).toFixed(1)}%`,
        notes: feature.notes,
      };
    });
}

function buildEnzymeRows(sequence: string): EnzymeRow[] {
  return restrictionEnzymes.map((enzyme) => {
    const positions = findMotifOccurrences(sequence, enzyme.site).map(
      (occurrence) => occurrence.start,
    );

    return {
      id: enzyme.name,
      name: enzyme.name,
      site: enzyme.site,
      positions,
      hits: positions.length,
      note: enzyme.note,
    };
  });
}

function formatEntityIdentifier(entityId: string) {
  const compact = entityId.replace(/[^a-z0-9]/gi, "").toUpperCase();
  return `DNA-${compact.slice(0, 12)}`;
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
    const width = 980;
    const height = 220;
    const left = 56;
    const right = width - 56;
    const scale = (position: number) => left + ((position - 1) / Math.max(sequenceLength, 1)) * (right - left);

    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full">
        <rect
          x="0"
          y="0"
          width={width}
          height={height}
          fill="var(--surface)"
          stroke="var(--line)"
        />
        <line
          x1={left}
          y1="110"
          x2={right}
          y2="110"
          stroke="var(--line-strong)"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <line
          x1={scale(originPosition)}
          y1="58"
          x2={scale(originPosition)}
          y2="164"
          stroke="var(--accent-strong)"
          strokeWidth="1.5"
          strokeDasharray="4 4"
        />
        {features.map((feature, index) => {
          const start = scale(feature.start);
          const end = scale(feature.end);
          const barX = Math.min(start, end);
          const widthValue = Math.max(12, Math.abs(end - start));
          const y = 60 + (index % 3) * 32;
          const isSelected = feature.id === selectedFeatureId;

          return (
            <g
              key={feature.id}
              onClick={() => onSelectFeature(feature.id)}
              className="cursor-pointer"
            >
              <rect
                x={barX}
                y={y}
                width={widthValue}
                height="18"
                fill={feature.color}
                stroke={isSelected ? "var(--text-primary)" : "transparent"}
                strokeWidth={isSelected ? 1.5 : 0}
              />
              <text x={barX + 6} y={y + 12} fontSize="11" fill="#0f1112">
                {feature.name}
              </text>
            </g>
          );
        })}
        <text x={left} y="194" fontSize="11" fill="var(--text-soft)">
          1
        </text>
        <text x={right - 28} y="194" fontSize="11" fill="var(--text-soft)">
          {sequenceLength.toLocaleString()}
        </text>
      </svg>
    );
  }

  const width = 520;
  const height = 460;
  const center = 260;
  const outerRadius = 148;
  const innerRadius = 110;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full">
      <rect
        x="0"
        y="0"
        width={width}
        height={height}
        fill="var(--surface)"
        stroke="var(--line)"
      />
      <circle
        cx={center}
        cy={center}
        r={outerRadius}
        fill="none"
        stroke="var(--line-strong)"
        strokeWidth="14"
      />
      <circle
        cx={center}
        cy={center}
        r={innerRadius}
        fill="var(--bg)"
        stroke="var(--line)"
      />
      <line
        x1={center}
        y1={center}
        x2={center}
        y2={center - outerRadius - 24}
        stroke="var(--accent-strong)"
        strokeWidth="1.5"
        strokeDasharray="4 4"
      />
      <text x={center} y="54" textAnchor="middle" fontSize="11" fill="var(--text-soft)">
        Origin {originPosition.toLocaleString()}
      </text>
      <text x={center} y={center + 8} textAnchor="middle" fontSize="16" fill="var(--text-primary)">
        {selectedFeature?.name ?? "No selection"}
      </text>
      <text x={center} y={center + 30} textAnchor="middle" fontSize="11" fill="var(--text-soft)">
        {selectedFeature
          ? `${featureLength(selectedFeature, Math.max(sequenceLength, 1)).toLocaleString()} bp`
          : "Select a feature from the map or tables"}
      </text>
      {features.map((feature) => {
        const isSelected = feature.id === selectedFeatureId;
        const strokeWidth = isSelected ? 18 : 12;
        const opacity = isSelected ? 1 : 0.72;
        const segments = splitCircularFeatureRange(
          { start: feature.start, end: feature.end },
          Math.max(sequenceLength, 1),
        );

        return segments.map((segment, index) => {
          const startAngle = ((segment.start - 1) / Math.max(sequenceLength, 1)) * 360;
          const endAngle = (segment.end / Math.max(sequenceLength, 1)) * 360;

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

function ToolbarToggle({
  label,
  active,
  onClick,
  Icon,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  Icon: (props: IconProps) => ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={label}
      className={`inline-flex h-9 w-9 items-center justify-center border transition ${
        active
          ? "border-[color:var(--accent-soft)] bg-[color:var(--accent-muted)] text-[color:var(--text-primary)]"
          : "border-[color:var(--line)] bg-[color:var(--surface)] text-[color:var(--text-muted)] hover:border-[color:var(--line-strong)] hover:text-[color:var(--text-primary)]"
      }`}
    >
      <Icon className="h-4 w-4" />
      <span className="sr-only">{label}</span>
    </button>
  );
}

function SectionCard({
  title,
  eyebrow,
  children,
  actions,
  className = "",
}: {
  title: string;
  eyebrow: string;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`border border-[color:var(--line)] bg-[color:var(--surface)] ${className}`}>
      <div className="flex items-start justify-between gap-4 border-b border-[color:var(--line)] px-4 py-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[color:var(--text-soft)]">
            {eyebrow}
          </p>
          <h2 className="mt-2 text-base font-semibold text-[color:var(--text-primary)]">
            {title}
          </h2>
        </div>
        {actions}
      </div>
      <div className="px-4 py-4">{children}</div>
    </section>
  );
}

function SequenceMinimap({
  sequenceLength,
  features,
  focusStart,
  lineWidth,
  onSelectPosition,
}: {
  sequenceLength: number;
  features: DNAFeature[];
  focusStart: number;
  lineWidth: number;
  onSelectPosition: (position: number) => void;
}) {
  const viewportLength = Math.min(sequenceLength, lineWidth * 10);
  const focusEnd = clamp(focusStart + viewportLength - 1, 1, Math.max(sequenceLength, 1));

  function handleClick(event: MouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    onSelectPosition(Math.round(ratio * Math.max(sequenceLength, 1)));
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 font-mono text-[10px] uppercase tracking-[0.16em] text-[color:var(--text-soft)]">
        <span>Minimap</span>
        <span>
          {focusStart.toLocaleString()}-{focusEnd.toLocaleString()}
        </span>
      </div>
      <div
        role="button"
        tabIndex={0}
        onClick={handleClick}
        className="relative h-14 cursor-pointer border border-[color:var(--line)] bg-[color:var(--surface-muted)]"
      >
        {features.map((feature) => {
          const left = ((feature.start - 1) / Math.max(sequenceLength, 1)) * 100;
          const width =
            (featureLength(feature, Math.max(sequenceLength, 1)) / Math.max(sequenceLength, 1)) * 100;

          return (
            <div
              key={feature.id}
              className="absolute top-4 h-6"
              style={{
                left: `${left}%`,
                width: `${Math.max(width, 1)}%`,
                backgroundColor: feature.color,
                opacity: 0.85,
              }}
            />
          );
        })}
        <div
          className="absolute inset-y-1 border border-[color:var(--text-primary)] bg-[color:var(--accent-muted)]/40"
          style={{
            left: `${((focusStart - 1) / Math.max(sequenceLength, 1)) * 100}%`,
            width: `${(viewportLength / Math.max(sequenceLength, 1)) * 100}%`,
          }}
        />
      </div>
    </div>
  );
}

function GcPlot({
  sequence,
}: {
  sequence: string;
}) {
  const windowSize = 40;
  const values = useMemo(() => {
    const windows: number[] = [];

    for (let index = 0; index < sequence.length; index += windowSize) {
      windows.push(gcContent(sequence.slice(index, index + windowSize)));
    }

    return windows;
  }, [sequence]);

  return (
    <div className="space-y-2">
      <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[color:var(--text-soft)]">
        GC plot
      </div>
      <div className="flex h-14 items-end gap-px border border-[color:var(--line)] bg-[color:var(--surface-muted)] px-1 py-1">
        {values.map((value, index) => (
          <div
            key={`${index}-${value}`}
            className="min-w-0 flex-1 bg-[color:var(--accent-soft)]"
            style={{ height: `${Math.max(6, value)}%` }}
            title={`Window ${index + 1}: ${value.toFixed(1)}%`}
          />
        ))}
      </div>
    </div>
  );
}

function SequenceViewport({
  sequence,
  features,
  selectedFeatureId,
  primers,
  enzymes,
  motifQuery,
  lineWidth,
  groupSize,
  showTranslations,
  translationMode,
  showFeatures,
  showPrimers,
  showEnzymes,
  showReverseComplement,
  focusStart,
  onSelectFeature,
}: {
  sequence: string;
  features: DNAFeature[];
  selectedFeatureId: string;
  primers: PrimerRow[];
  enzymes: EnzymeRow[];
  motifQuery: string;
  lineWidth: number;
  groupSize: number;
  showTranslations: boolean;
  translationMode: "single" | "frames";
  showFeatures: boolean;
  showPrimers: boolean;
  showEnzymes: boolean;
  showReverseComplement: boolean;
  focusStart: number;
  onSelectFeature: (featureId: string) => void;
}) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const motifRanges = useMemo(
    () => findMotifOccurrences(sequence, motifQuery),
    [motifQuery, sequence],
  );
  const lines = useMemo(() => chunkSequence(sequence, lineWidth), [lineWidth, sequence]);

  useEffect(() => {
    const viewport = viewportRef.current;

    if (!viewport) {
      return;
    }

    const lineStart = Math.max(1, Math.floor((focusStart - 1) / lineWidth) * lineWidth + 1);
    const target = viewport.querySelector<HTMLElement>(`[data-line-start="${lineStart}"]`);

    if (target) {
      target.scrollIntoView({ block: "center" });
    }
  }, [focusStart, lineWidth]);

  function renderSequenceLine(
    lineSequence: string,
    startPosition: number,
    lineFeatures: DNAFeature[],
    selectedId: string,
    motifRangesForLine = motifRanges,
    reverse = false,
  ) {
    const bases = reverse
      ? reverseComplement(lineSequence).split("")
      : lineSequence.split("");

    return bases.flatMap((base, baseIndex) => {
      const position = reverse
        ? startPosition + (lineSequence.length - baseIndex - 1)
        : startPosition + baseIndex;
      const feature = lineFeatures.find((candidate) =>
        rangeContainsPosition(candidate, position),
      );
      const motifHit = motifRangesForLine.find((range) =>
        rangeContainsPosition(range, position),
      );
      const isSelected = feature?.id === selectedId;
      const keyPrefix = reverse ? "reverse" : "forward";
      const nodes = [
        <span
          key={`${keyPrefix}-${position}-${base}`}
          className={`px-[1px] ${baseTone(base)} ${isSelected ? "bg-[color:var(--accent-soft)]" : ""} ${
            motifHit ? "bg-[color:var(--accent-muted)]" : ""
          }`}
          style={{
            boxShadow: feature
              ? `inset 0 -1px 0 ${feature.color}`
              : undefined,
          }}
          title={feature?.name ?? `${position.toLocaleString()} ${base}`}
        >
          {base}
        </span>,
      ];

      if ((baseIndex + 1) % groupSize === 0 && baseIndex < bases.length - 1) {
        nodes.push(
          <span
            key={`${keyPrefix}-gap-${position}`}
            className="inline-block w-2"
            aria-hidden="true"
          />,
        );
      }

      return nodes;
    });
  }

  return (
    <div
      ref={viewportRef}
      className="max-h-[42rem] overflow-auto border border-[color:var(--line)] bg-[color:var(--surface-muted)]"
    >
      {lines.map((line, index) => {
        const startPosition = index * lineWidth + 1;
        const endPosition = startPosition + line.length - 1;
        const lineFeatures = features.filter((feature) =>
          rangeContainsPosition(feature, startPosition) ||
          rangeContainsPosition(feature, endPosition) ||
          (feature.start >= startPosition && feature.start <= endPosition),
        );
        const linePrimers = primers.filter(
          (primer) => primer.start <= endPosition && primer.end >= startPosition,
        );
        const lineEnzymes = enzymes.filter((enzyme) =>
          enzyme.positions.some((position) => position >= startPosition && position <= endPosition),
        );

        return (
          <div
            key={`${startPosition}-${line}`}
            data-line-start={startPosition}
            className="grid grid-cols-[5rem_minmax(0,1fr)_4rem] gap-3 border-b border-[color:var(--line)] px-3 py-3 last:border-b-0"
          >
            <div className="pt-1 font-mono text-[11px] text-[color:var(--text-soft)]">
              {startPosition.toLocaleString()}
            </div>
            <div className="space-y-2">
              {showFeatures && lineFeatures.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {lineFeatures.map((feature) => (
                    <button
                      key={feature.id}
                      type="button"
                      onClick={() => onSelectFeature(feature.id)}
                      className={`inline-flex items-center gap-1 border px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] ${
                        feature.id === selectedFeatureId
                          ? "border-[color:var(--text-primary)] bg-[color:var(--accent-muted)] text-[color:var(--text-primary)]"
                          : "border-[color:var(--line)] text-[color:var(--text-muted)]"
                      }`}
                      style={{ boxShadow: `inset 2px 0 0 ${feature.color}` }}
                    >
                      <span>{feature.name}</span>
                    </button>
                  ))}
                </div>
              ) : null}

              {showPrimers && linePrimers.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {linePrimers.map((primer) => (
                    <span
                      key={primer.id}
                      className="inline-flex items-center gap-1 border border-[color:var(--line)] px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-[color:var(--text-muted)]"
                    >
                      <span>{primer.name}</span>
                      <span>{primer.strand === 1 ? "F" : "R"}</span>
                    </span>
                  ))}
                </div>
              ) : null}

              {showEnzymes && lineEnzymes.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {lineEnzymes.map((enzyme) => (
                    <span
                      key={enzyme.id}
                      className="inline-flex items-center gap-1 border border-[color:var(--line)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-[color:var(--text-soft)]"
                    >
                      <span>{enzyme.name}</span>
                      <span>{enzyme.positions.filter((position) => position >= startPosition && position <= endPosition).join(",")}</span>
                    </span>
                  ))}
                </div>
              ) : null}

              {showTranslations ? (
                translationMode === "frames" ? (
                  <div className="space-y-1 font-mono text-[10px] text-[color:var(--text-soft)]">
                    {[0, 1, 2].map((frameOffset) => (
                      <div
                        key={`${startPosition}-frame-${frameOffset}`}
                        className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-2"
                      >
                        <span className="uppercase tracking-[0.16em]">
                          +{frameOffset + 1}
                        </span>
                        <span className="whitespace-pre tracking-[0.24em]">
                          {translateSequence(line.slice(frameOffset), frameOffset)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-2 font-mono text-[10px] text-[color:var(--text-soft)]">
                    <span className="uppercase tracking-[0.16em]">AA</span>
                    <span className="whitespace-pre tracking-[0.24em]">
                      {translateSequence(line)}
                    </span>
                  </div>
                )
              ) : null}

              <div className="flex flex-wrap gap-0.5 font-mono text-[14px] tracking-[0.18em]">
                {renderSequenceLine(
                  line,
                  startPosition,
                  lineFeatures,
                  selectedFeatureId,
                )}
              </div>

              {showReverseComplement ? (
                <div className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-2 font-mono text-[12px] text-[color:var(--text-soft)]">
                  <span className="uppercase tracking-[0.16em]">RC</span>
                  <div className="flex flex-wrap gap-0.5 tracking-[0.18em]">
                    {renderSequenceLine(
                      line,
                      startPosition,
                      lineFeatures,
                      selectedFeatureId,
                      [],
                      true,
                    )}
                  </div>
                </div>
              ) : null}
            </div>
            <div className="pt-1 text-right font-mono text-[11px] text-[color:var(--text-soft)]">
              {endPosition.toLocaleString()}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TableHeader({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <th className="border-b border-[color:var(--line)] px-3 py-2 text-left font-mono text-[10px] uppercase tracking-[0.16em] text-[color:var(--text-soft)]">
      {children}
    </th>
  );
}

function DataCell({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <td className="border-b border-[color:var(--line)] px-3 py-2 text-sm text-[color:var(--text-primary)]">
      {children}
    </td>
  );
}

export function DnaViewer({
  initialEntityId,
  initialView = "sequence",
  entities,
  saveAction,
}: DnaViewerProps) {
  const fallbackEntityId = entities[0]?.id ?? initialEntityId ?? "";
  const [activeEntityId, setActiveEntityId] = useState(
    initialEntityId ?? fallbackEntityId,
  );
  const [activeView, setActiveView] = useState<EntityView>(initialView);
  const [orientation, setOrientation] = useState<Orientation>("forward");
  const [originMode, setOriginMode] = useState<OriginMode>("sequence-start");
  const [featureFilter, setFeatureFilter] = useState<FeatureFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [motifQuery, setMotifQuery] = useState("");
  const [jumpPosition, setJumpPosition] = useState("");
  const [selectedFeatureId, setSelectedFeatureId] = useState("");
  const [lineWidth, setLineWidth] = useState(60);
  const [groupSize, setGroupSize] = useState(10);
  const [focusStart, setFocusStart] = useState(1);
  const [showSplitView, setShowSplitView] = useState(false);
  const [showFeatureTracks, setShowFeatureTracks] = useState(true);
  const [showPrimerTracks, setShowPrimerTracks] = useState(true);
  const [showEnzymeTracks, setShowEnzymeTracks] = useState(true);
  const [showTranslations, setShowTranslations] = useState(true);
  const [translationMode, setTranslationMode] = useState<"single" | "frames">(
    "frames",
  );
  const [showReverseComplement, setShowReverseComplement] = useState(false);
  const [showMinimap, setShowMinimap] = useState(true);
  const [showGcPlot, setShowGcPlot] = useState(false);
  const [showInfoPanel, setShowInfoPanel] = useState(true);
  const [hiddenFeatureIds, setHiddenFeatureIds] = useState<string[]>([]);
  const [hiddenPrimerIds, setHiddenPrimerIds] = useState<string[]>([]);
  const [hiddenEnzymeNames, setHiddenEnzymeNames] = useState<string[]>([]);
  const activeEntity = useMemo(
    () => entities.find((entity) => entity.id === activeEntityId) ?? entities[0] ?? null,
    [activeEntityId, entities],
  );
  const [draftName, setDraftName] = useState(activeEntity?.name ?? "");
  const [draftDescription, setDraftDescription] = useState(activeEntity?.description ?? "");
  const [draftAliases, setDraftAliases] = useState(
    activeEntity?.aliases.join(", ") ?? "",
  );
  const [draftPurpose, setDraftPurpose] = useState(activeEntity?.purpose ?? "");
  const [draftFeatureSummary, setDraftFeatureSummary] = useState(
    activeEntity?.featureSummary ?? "",
  );
  const [draftDefaultMotif, setDraftDefaultMotif] = useState(
    activeEntity?.defaultMotif ?? "",
  );
  const [draftTopology, setDraftTopology] = useState<SequenceTopology>(
    activeEntity?.topology ?? "circular",
  );
  const [draftSequence, setDraftSequence] = useState(activeEntity?.sequence ?? "");
  const [draftNotes, setDraftNotes] = useState(activeEntity?.notes ?? "");

  const workingEntity = useMemo(() => {
    if (!activeEntity) {
      return null;
    }

    const nextSequence = normalizeDnaSequence(draftSequence) || activeEntity.sequence;
    const nextDefaultMotif =
      normalizeDnaSequence(draftDefaultMotif) || nextSequence.slice(0, 6);
    const nextAliases = draftAliases
      .split(",")
      .map((alias) => alias.trim())
      .filter(Boolean);

    return {
      ...activeEntity,
      name: draftName.trim() || activeEntity.name,
      description: draftDescription.trim() || activeEntity.description,
      aliases: nextAliases,
      sequence: nextSequence,
      topology: draftTopology,
      purpose: draftPurpose.trim() || activeEntity.purpose,
      defaultMotif: nextDefaultMotif,
      featureSummary:
        draftFeatureSummary.trim() || activeEntity.featureSummary,
      notes: draftNotes,
    } satisfies StoredSequenceEntity;
  }, [
    activeEntity,
    draftAliases,
    draftDefaultMotif,
    draftDescription,
    draftFeatureSummary,
    draftName,
    draftNotes,
    draftPurpose,
    draftSequence,
    draftTopology,
  ]);

  const activeRecord = useMemo(
    () => (workingEntity ? toDNARecord(workingEntity) : null),
    [workingEntity],
  );
  const entityStats = useMemo(
    () =>
      workingEntity
        ? getSequenceEntityStats(workingEntity)
        : { gc: "0.0%", length: 0 },
    [workingEntity],
  );
  const sequenceLength = activeRecord?.sequence.length ?? 0;

  useEffect(() => {
    if (!initialEntityId) {
      return;
    }

    setActiveEntityId(initialEntityId);
  }, [initialEntityId]);

  useEffect(() => {
    setActiveView(initialView);
  }, [initialView]);

  useEffect(() => {
    if (!activeEntity) {
      return;
    }

    setDraftName(activeEntity.name);
    setDraftDescription(activeEntity.description);
    setDraftAliases(activeEntity.aliases.join(", "));
    setDraftPurpose(activeEntity.purpose);
    setDraftFeatureSummary(activeEntity.featureSummary);
    setDraftDefaultMotif(activeEntity.defaultMotif);
    setDraftTopology(activeEntity.topology);
    setDraftSequence(activeEntity.sequence);
    setDraftNotes(activeEntity.notes);
    setActiveView(initialView);
    setOrientation("forward");
    setOriginMode("sequence-start");
    setFeatureFilter("all");
    setSearchQuery("");
    setMotifQuery(activeEntity.defaultMotif);
    setJumpPosition("");
    setSelectedFeatureId(activeEntity.features[0]?.id ?? "");
    setFocusStart(1);
    setGroupSize(10);
    setHiddenFeatureIds([]);
    setHiddenPrimerIds([]);
    setHiddenEnzymeNames([]);
    setShowFeatureTracks(true);
    setShowPrimerTracks(true);
    setShowEnzymeTracks(true);
    setShowTranslations(true);
    setTranslationMode("frames");
    setShowReverseComplement(false);
    setShowMinimap(true);
    setShowGcPlot(false);
    setShowInfoPanel(true);
    setShowSplitView(false);
  }, [activeEntity, initialView]);
  const oriented = useMemo(() => {
    if (!activeRecord) {
      return { sequence: "", features: [] as DNAFeature[] };
    }

    const sequence =
      orientation === "forward"
        ? activeRecord.sequence
        : reverseComplement(activeRecord.sequence);
    const features =
      orientation === "forward"
        ? activeRecord.features
        : activeRecord.features.map((feature) =>
            invertFeature(feature, activeRecord.sequence.length),
          );

    return { sequence, features };
  }, [activeRecord, orientation]);

  const originFeature = useMemo(() => {
    if (originMode !== "selected-feature") {
      return null;
    }

    return oriented.features.find((feature) => feature.id === selectedFeatureId) ?? null;
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
        ...rotateFeatureRange(
          { start: feature.start, end: feature.end },
          originOffset,
          Math.max(oriented.sequence.length, 1),
        ),
      })),
    [oriented.features, originOffset, oriented.sequence.length],
  );

  const visibleFeatures = useMemo(
    () =>
      displayFeatures.filter((feature) => !hiddenFeatureIds.includes(feature.id)),
    [displayFeatures, hiddenFeatureIds],
  );
  const filteredFeatures = useMemo(
    () =>
      visibleFeatures
        .filter((feature) => featureFilter === "all" || feature.type === featureFilter)
        .filter((feature) => featureMatchesQuery(feature, searchQuery)),
    [featureFilter, searchQuery, visibleFeatures],
  );
  const primerRows = useMemo(
    () =>
      buildPrimerRows(
        visibleFeatures.filter((feature) => !hiddenPrimerIds.includes(feature.id)),
        displaySequence,
      ),
    [displaySequence, hiddenPrimerIds, visibleFeatures],
  );
  const enzymeRows = useMemo(
    () =>
      buildEnzymeRows(displaySequence).filter(
        (enzyme) => !hiddenEnzymeNames.includes(enzyme.name),
      ),
    [displaySequence, hiddenEnzymeNames],
  );
  const filteredPrimerRows = useMemo(
    () =>
      primerRows.filter((primer) => {
        if (!searchQuery) {
          return true;
        }

        const normalized = searchQuery.toLowerCase();
        return (
          primer.name.toLowerCase().includes(normalized) ||
          primer.sequence.toLowerCase().includes(normalized) ||
          primer.notes?.toLowerCase().includes(normalized) === true
        );
      }),
    [primerRows, searchQuery],
  );
  const filteredEnzymeRows = useMemo(
    () =>
      enzymeRows.filter((enzyme) => {
        if (!searchQuery) {
          return true;
        }

        const normalized = searchQuery.toLowerCase();
        return (
          enzyme.name.toLowerCase().includes(normalized) ||
          enzyme.site.toLowerCase().includes(normalized) ||
          enzyme.note.toLowerCase().includes(normalized)
        );
      }),
    [enzymeRows, searchQuery],
  );
  const selectedFeature =
    visibleFeatures.find((feature) => feature.id === selectedFeatureId) ??
    visibleFeatures[0] ??
    null;

  const entityTypeLabel = activeEntity
    ? entityTypeLabels[activeEntity.entityType]
    : "Entity";
  const entityIdentifier = activeEntity
    ? formatEntityIdentifier(activeEntity.id)
    : "DNA";
  const statusLabel = activeEntity?.status ?? "ACTIVE";
  const selectedFeatureDescription = selectedFeature
    ? `${featureFilterLabels[selectedFeature.type]} · ${
        selectedFeature.notes ?? featureTypeDescriptions[selectedFeature.type]
      }`
    : "Select a feature from the sequence, map, or annotation tables.";

  function focusPosition(position: number) {
    const nextPosition = clamp(position, 1, Math.max(displaySequence.length, 1));
    setFocusStart(Math.floor((nextPosition - 1) / lineWidth) * lineWidth + 1);
  }

  function focusFeature(featureId: string) {
    const feature = visibleFeatures.find((candidate) => candidate.id === featureId);

    if (!feature) {
      return;
    }

    setSelectedFeatureId(feature.id);
    focusPosition(feature.start);
  }

  function toggleHiddenFeature(featureId: string) {
    setHiddenFeatureIds((current) =>
      current.includes(featureId)
        ? current.filter((id) => id !== featureId)
        : [...current, featureId],
    );
  }

  function toggleHiddenPrimer(featureId: string) {
    setHiddenPrimerIds((current) =>
      current.includes(featureId)
        ? current.filter((id) => id !== featureId)
        : [...current, featureId],
    );
  }

  function toggleHiddenEnzyme(enzymeName: string) {
    setHiddenEnzymeNames((current) =>
      current.includes(enzymeName)
        ? current.filter((name) => name !== enzymeName)
        : [...current, enzymeName],
    );
  }

  if (!activeEntity) {
    return null;
  }

  return (
    <form action={saveAction} className="space-y-5">
      <input type="hidden" name="entityId" value={activeEntity.id} />
      <input type="hidden" name="view" value={activeView} />
      <input type="hidden" name="name" value={draftName} />
      <input type="hidden" name="description" value={draftDescription} />
      <input type="hidden" name="entityType" value={activeEntity.entityType} />
      <input type="hidden" name="aliases" value={draftAliases} />
      <input type="hidden" name="purpose" value={draftPurpose} />
      <input type="hidden" name="featureSummary" value={draftFeatureSummary} />
      <input type="hidden" name="defaultMotif" value={draftDefaultMotif} />
      <input type="hidden" name="topology" value={draftTopology} />
      <input type="hidden" name="sequence" value={draftSequence} />
      <input type="hidden" name="notes" value={draftNotes} />
      <input
        type="hidden"
        name="featuresJson"
        value={buildEntityFeaturePayload(activeEntity.features)}
      />

      <header className="space-y-4 border-b border-[color:var(--line)] pb-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[color:var(--accent-strong)]">
              Sequence entity
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-[color:var(--text-primary)]">
              {draftName}
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[color:var(--text-muted)]">
              {draftDescription}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-[color:var(--text-soft)]">
            <span className="border border-[color:var(--line)] px-3 py-1">
              {entityTypeLabel}
            </span>
            <span className="border border-[color:var(--line)] px-3 py-1">
              {statusLabel}
            </span>
            <span className="border border-[color:var(--line)] px-3 py-1">
              {entityIdentifier}
            </span>
            <span className="border border-[color:var(--line)] px-3 py-1">
              v{activeEntity.latestVersionNumber}
            </span>
            <span className="border border-[color:var(--line)] px-3 py-1">
              {sequenceLength.toLocaleString()} bp
            </span>
            <span className="border border-[color:var(--line)] px-3 py-1">
              GC {entityStats.gc}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-y border-[color:var(--line)] py-2">
          {viewTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveView(tab.id)}
              className={`border px-3 py-1.5 text-xs uppercase tracking-[0.16em] transition ${
                activeView === tab.id
                  ? "border-[color:var(--accent-soft)] bg-[color:var(--accent-muted)] text-[color:var(--text-primary)]"
                  : "border-[color:var(--line)] text-[color:var(--text-muted)] hover:border-[color:var(--line-strong)] hover:text-[color:var(--text-primary)]"
              }`}
            >
              {tab.label}
            </button>
          ))}

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <ToolbarToggle
              label="Show feature tracks"
              active={showFeatureTracks}
              onClick={() => setShowFeatureTracks((current) => !current)}
              Icon={showFeatureTracks ? EyeIcon : EyeOffIcon}
            />
            <ToolbarToggle
              label="Show primer tracks"
              active={showPrimerTracks}
              onClick={() => setShowPrimerTracks((current) => !current)}
              Icon={showPrimerTracks ? TableIcon : EyeOffIcon}
            />
            <ToolbarToggle
              label="Show enzyme tracks"
              active={showEnzymeTracks}
              onClick={() => setShowEnzymeTracks((current) => !current)}
              Icon={showEnzymeTracks ? MapIcon : EyeOffIcon}
            />
            <ToolbarToggle
              label="Show translations"
              active={showTranslations}
              onClick={() => setShowTranslations((current) => !current)}
              Icon={showTranslations ? SequenceIcon : EyeOffIcon}
            />
            <ToolbarToggle
              label="Split content"
              active={showSplitView}
              onClick={() => setShowSplitView((current) => !current)}
              Icon={SplitIcon}
            />
            <ToolbarToggle
              label="Toggle info panel"
              active={showInfoPanel}
              onClick={() => setShowInfoPanel((current) => !current)}
              Icon={InfoIcon}
            />
          </div>
        </div>
      </header>

      <div
        className={`grid gap-5 ${
          showInfoPanel ? "xl:grid-cols-[minmax(0,1fr)_340px]" : ""
        }`}
      >
        <div className="space-y-5">
          {activeView === "sequence" ? (
            <SectionCard
              eyebrow="Sequence"
              title="Default sequence view"
              actions={
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setOrientation((current) => current === "forward" ? "reverse" : "forward")}
                    className="border border-[color:var(--line)] px-3 py-1.5 text-xs uppercase tracking-[0.16em] text-[color:var(--text-muted)] transition hover:border-[color:var(--line-strong)] hover:text-[color:var(--text-primary)]"
                  >
                    {orientation === "forward" ? "Forward" : "Reverse"}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setOriginMode((current) =>
                        current === "sequence-start" ? "selected-feature" : "sequence-start",
                      )
                    }
                    className="border border-[color:var(--line)] px-3 py-1.5 text-xs uppercase tracking-[0.16em] text-[color:var(--text-muted)] transition hover:border-[color:var(--line-strong)] hover:text-[color:var(--text-primary)]"
                  >
                    {originMode === "sequence-start" ? "Sequence origin" : "Feature origin"}
                  </button>
                </div>
              }
            >
              <div className="space-y-4">
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_260px]">
                  <label className="space-y-2">
                    <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[color:var(--text-soft)]">
                      Search annotations
                    </span>
                    <input
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="feature name, notes, type..."
                      className="w-full border border-[color:var(--line)] bg-[color:var(--surface-muted)] px-3 py-2 text-sm text-[color:var(--text-primary)] outline-none focus:border-[color:var(--accent-soft)]"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[color:var(--text-soft)]">
                      Motif
                    </span>
                    <input
                      value={motifQuery}
                      onChange={(event) => setMotifQuery(event.target.value)}
                      placeholder="GAATTC"
                      className="w-full border border-[color:var(--line)] bg-[color:var(--surface-muted)] px-3 py-2 text-sm text-[color:var(--text-primary)] outline-none focus:border-[color:var(--accent-soft)]"
                    />
                  </label>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {(Object.keys(featureFilterLabels) as FeatureFilter[]).map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setFeatureFilter(filter)}
                      className={`border px-3 py-1 text-[10px] uppercase tracking-[0.16em] transition ${
                        featureFilter === filter
                          ? "border-[color:var(--accent-soft)] bg-[color:var(--accent-muted)] text-[color:var(--text-primary)]"
                          : "border-[color:var(--line)] text-[color:var(--text-muted)] hover:border-[color:var(--line-strong)] hover:text-[color:var(--text-primary)]"
                      }`}
                    >
                      {featureFilterLabels[filter]}
                    </button>
                  ))}

                  <div className="ml-auto flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-[color:var(--text-soft)]">
                    <span>Line width</span>
                    <button
                      type="button"
                      onClick={() => setLineWidth((current) => clamp(current - 10, 40, 120))}
                      className="border border-[color:var(--line)] px-2 py-1"
                    >
                      -
                    </button>
                    <span>{lineWidth}</span>
                    <button
                      type="button"
                      onClick={() => setLineWidth((current) => clamp(current + 10, 40, 120))}
                      className="border border-[color:var(--line)] px-2 py-1"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="grid gap-3 lg:grid-cols-[auto_auto_auto_minmax(0,1fr)]">
                  <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-[color:var(--text-soft)]">
                    <span>Groups</span>
                    {[10, 3].map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setGroupSize(value)}
                        className={`border px-2 py-1 ${
                          groupSize === value
                            ? "border-[color:var(--accent-soft)] bg-[color:var(--accent-muted)] text-[color:var(--text-primary)]"
                            : "border-[color:var(--line)]"
                        }`}
                      >
                        {value}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-[color:var(--text-soft)]">
                    <span>Translation</span>
                    <button
                      type="button"
                      onClick={() =>
                        setTranslationMode((current) =>
                          current === "frames" ? "single" : "frames",
                        )
                      }
                      className="border border-[color:var(--line)] px-2 py-1"
                    >
                      {translationMode === "frames" ? "3 frames" : "1 frame"}
                    </button>
                  </div>

                  <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-[color:var(--text-soft)]">
                    <span>Reverse complement</span>
                    <button
                      type="button"
                      onClick={() =>
                        setShowReverseComplement((current) => !current)
                      }
                      className="border border-[color:var(--line)] px-2 py-1"
                    >
                      {showReverseComplement ? "On" : "Off"}
                    </button>
                  </div>

                  <label className="flex items-center justify-end gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-[color:var(--text-soft)]">
                    <span>Jump to bp</span>
                    <input
                      value={jumpPosition}
                      onChange={(event) => setJumpPosition(event.target.value)}
                      placeholder="1200"
                      inputMode="numeric"
                      className="w-24 border border-[color:var(--line)] bg-[color:var(--surface-muted)] px-2 py-1 text-right text-[11px] text-[color:var(--text-primary)] outline-none focus:border-[color:var(--accent-soft)]"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const nextPosition = Number(jumpPosition);

                        if (Number.isFinite(nextPosition) && nextPosition > 0) {
                          focusPosition(nextPosition);
                        }
                      }}
                      className="border border-[color:var(--line)] px-2 py-1"
                    >
                      Go
                    </button>
                  </label>
                </div>

                {showSplitView ? (
                  <div className="border border-[color:var(--line)] bg-[color:var(--surface-muted)] p-4">
                    <SequenceMap
                      sequenceLength={displaySequence.length}
                      features={visibleFeatures}
                      selectedFeatureId={selectedFeatureId}
                      topology={draftTopology}
                      originPosition={originFeature?.start ?? 1}
                      onSelectFeature={focusFeature}
                    />
                  </div>
                ) : null}

                {showMinimap ? (
                  <SequenceMinimap
                    sequenceLength={displaySequence.length}
                    features={visibleFeatures}
                    focusStart={focusStart}
                    lineWidth={lineWidth}
                    onSelectPosition={focusPosition}
                  />
                ) : null}

                {showGcPlot ? <GcPlot sequence={displaySequence} /> : null}

                <SequenceViewport
                  sequence={displaySequence}
                  features={filteredFeatures}
                  selectedFeatureId={selectedFeatureId}
                  primers={primerRows}
                  enzymes={enzymeRows}
                  motifQuery={motifQuery}
                  lineWidth={lineWidth}
                  groupSize={groupSize}
                  showTranslations={showTranslations}
                  translationMode={translationMode}
                  showFeatures={showFeatureTracks}
                  showPrimers={showPrimerTracks}
                  showEnzymes={showEnzymeTracks}
                  showReverseComplement={showReverseComplement}
                  focusStart={focusStart}
                  onSelectFeature={focusFeature}
                />
              </div>
            </SectionCard>
          ) : null}

          {activeView === "map" ? (
            <SectionCard
              eyebrow="Map"
              title={draftTopology === "circular" ? "Circular map" : "Linear map"}
              actions={
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setDraftTopology((current) => current === "circular" ? "linear" : "circular")
                    }
                    className="border border-[color:var(--line)] px-3 py-1.5 text-xs uppercase tracking-[0.16em] text-[color:var(--text-muted)] transition hover:border-[color:var(--line-strong)] hover:text-[color:var(--text-primary)]"
                  >
                    {draftTopology === "circular" ? "Show linear" : "Show circular"}
                  </button>
                </div>
              }
            >
              <div className="space-y-4">
                <div className="grid gap-4 lg:grid-cols-[68px_minmax(0,1fr)]">
                  <div className="flex flex-col gap-2">
                    <ToolbarToggle
                      label="Feature visibility"
                      active={showFeatureTracks}
                      onClick={() => setShowFeatureTracks((current) => !current)}
                      Icon={showFeatureTracks ? EyeIcon : EyeOffIcon}
                    />
                    <ToolbarToggle
                      label="Primer visibility"
                      active={showPrimerTracks}
                      onClick={() => setShowPrimerTracks((current) => !current)}
                      Icon={showPrimerTracks ? TableIcon : EyeOffIcon}
                    />
                    <ToolbarToggle
                      label="Enzyme visibility"
                      active={showEnzymeTracks}
                      onClick={() => setShowEnzymeTracks((current) => !current)}
                      Icon={showEnzymeTracks ? MapIcon : EyeOffIcon}
                    />
                    <ToolbarToggle
                      label="Split content"
                      active={showSplitView}
                      onClick={() => setShowSplitView((current) => !current)}
                      Icon={SplitIcon}
                    />
                  </div>
                  <div className="space-y-4">
                    <div className="border border-[color:var(--line)] bg-[color:var(--surface-muted)] p-4">
                      <SequenceMap
                        sequenceLength={displaySequence.length}
                        features={showFeatureTracks ? visibleFeatures : []}
                        selectedFeatureId={selectedFeatureId}
                        topology={draftTopology}
                        originPosition={originFeature?.start ?? 1}
                        onSelectFeature={focusFeature}
                      />
                    </div>
                    {showSplitView ? (
                      <SequenceViewport
                        sequence={displaySequence}
                        features={filteredFeatures}
                        selectedFeatureId={selectedFeatureId}
                        primers={primerRows}
                        enzymes={enzymeRows}
                        motifQuery={motifQuery}
                        lineWidth={lineWidth}
                        groupSize={groupSize}
                        showTranslations={showTranslations}
                        translationMode={translationMode}
                        showFeatures={showFeatureTracks}
                        showPrimers={showPrimerTracks}
                        showEnzymes={showEnzymeTracks}
                        showReverseComplement={showReverseComplement}
                        focusStart={focusStart}
                        onSelectFeature={focusFeature}
                      />
                    ) : null}
                  </div>
                </div>
              </div>
            </SectionCard>
          ) : null}

          {activeView === "features" ? (
            <SectionCard eyebrow="Features" title="Annotation table">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--line)] pb-3 text-sm text-[color:var(--text-muted)]">
                <span>
                  {displayFeatures.filter((feature) => featureMatchesQuery(feature, searchQuery)).length.toLocaleString()} visible annotations
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[color:var(--text-soft)]">
                  Search filters features, primers, and enzymes
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse">
                  <thead>
                    <tr>
                      <TableHeader>Show</TableHeader>
                      <TableHeader>Name</TableHeader>
                      <TableHeader>Type</TableHeader>
                      <TableHeader>Range</TableHeader>
                      <TableHeader>Strand</TableHeader>
                      <TableHeader>Length</TableHeader>
                      <TableHeader>Notes</TableHeader>
                    </tr>
                  </thead>
                  <tbody>
                    {displayFeatures
                      .filter((feature) => featureMatchesQuery(feature, searchQuery))
                      .map((feature) => {
                        const hidden = hiddenFeatureIds.includes(feature.id);
                        const selected = feature.id === selectedFeatureId;

                        return (
                          <tr
                            key={feature.id}
                            className={selected ? "bg-[color:var(--accent-muted)]" : ""}
                          >
                            <DataCell>
                              <button
                                type="button"
                                onClick={() => toggleHiddenFeature(feature.id)}
                                className="inline-flex items-center text-[color:var(--text-muted)]"
                              >
                                {hidden ? (
                                  <EyeOffIcon className="h-4 w-4" />
                                ) : (
                                  <EyeIcon className="h-4 w-4" />
                                )}
                              </button>
                            </DataCell>
                            <DataCell>
                              <button
                                type="button"
                                onClick={() => focusFeature(feature.id)}
                                className="flex items-center gap-2 text-left"
                              >
                                <span
                                  className="h-2.5 w-2.5"
                                  style={{ backgroundColor: feature.color }}
                                />
                                <span>{feature.name}</span>
                              </button>
                            </DataCell>
                            <DataCell>{featureFilterLabels[feature.type]}</DataCell>
                            <DataCell>{formatFeatureRange(feature)}</DataCell>
                            <DataCell>{feature.strand === 1 ? "+" : "-"}</DataCell>
                            <DataCell>
                              {featureLength(feature, displaySequence.length).toLocaleString()} bp
                            </DataCell>
                            <DataCell>{feature.notes ?? featureTypeDescriptions[feature.type]}</DataCell>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          ) : null}

          {activeView === "primers" ? (
            <SectionCard eyebrow="Primers" title="Primer table">
              <div className="mb-4 flex items-center justify-between gap-3 border-b border-[color:var(--line)] pb-3 text-sm text-[color:var(--text-muted)]">
                <span>{filteredPrimerRows.length.toLocaleString()} primers in view</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[color:var(--text-soft)]">
                  Filtered by current search
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse">
                  <thead>
                    <tr>
                      <TableHeader>Show</TableHeader>
                      <TableHeader>Name</TableHeader>
                      <TableHeader>Direction</TableHeader>
                      <TableHeader>Range</TableHeader>
                      <TableHeader>Length</TableHeader>
                      <TableHeader>Tm</TableHeader>
                      <TableHeader>GC</TableHeader>
                      <TableHeader>Sequence</TableHeader>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPrimerRows.map((primer) => {
                      const hidden = hiddenPrimerIds.includes(primer.id);

                      return (
                        <tr key={primer.id}>
                          <DataCell>
                            <button
                              type="button"
                              onClick={() => toggleHiddenPrimer(primer.id)}
                              className="inline-flex items-center text-[color:var(--text-muted)]"
                            >
                              {hidden ? (
                                <EyeOffIcon className="h-4 w-4" />
                              ) : (
                                <EyeIcon className="h-4 w-4" />
                              )}
                            </button>
                          </DataCell>
                          <DataCell>{primer.name}</DataCell>
                          <DataCell>{primer.strand === 1 ? "Forward" : "Reverse"}</DataCell>
                          <DataCell>
                            {primer.start.toLocaleString()}-{primer.end.toLocaleString()}
                          </DataCell>
                          <DataCell>{primer.length}</DataCell>
                          <DataCell>{primer.tm}</DataCell>
                          <DataCell>{primer.gc}</DataCell>
                          <DataCell>
                            <span className="font-mono text-xs">{primer.sequence}</span>
                          </DataCell>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          ) : null}

          {activeView === "enzymes" ? (
            <SectionCard eyebrow="Enzymes" title="Restriction site table">
              <div className="mb-4 flex items-center justify-between gap-3 border-b border-[color:var(--line)] pb-3 text-sm text-[color:var(--text-muted)]">
                <span>{filteredEnzymeRows.length.toLocaleString()} restriction patterns</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[color:var(--text-soft)]">
                  Filtered by current search
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse">
                  <thead>
                    <tr>
                      <TableHeader>Show</TableHeader>
                      <TableHeader>Enzyme</TableHeader>
                      <TableHeader>Site</TableHeader>
                      <TableHeader>Hits</TableHeader>
                      <TableHeader>Positions</TableHeader>
                      <TableHeader>Notes</TableHeader>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEnzymeRows.map((enzyme) => {
                      const hidden = hiddenEnzymeNames.includes(enzyme.name);

                      return (
                        <tr key={enzyme.id}>
                          <DataCell>
                            <button
                              type="button"
                              onClick={() => toggleHiddenEnzyme(enzyme.name)}
                              className="inline-flex items-center text-[color:var(--text-muted)]"
                            >
                              {hidden ? (
                                <EyeOffIcon className="h-4 w-4" />
                              ) : (
                                <EyeIcon className="h-4 w-4" />
                              )}
                            </button>
                          </DataCell>
                          <DataCell>{enzyme.name}</DataCell>
                          <DataCell>
                            <span className="font-mono text-xs">{enzyme.site}</span>
                          </DataCell>
                          <DataCell>{enzyme.hits}</DataCell>
                          <DataCell>
                            <button
                              type="button"
                              onClick={() => {
                                if (enzyme.positions[0]) {
                                  focusPosition(enzyme.positions[0]);
                                }
                              }}
                              className="text-left font-mono text-xs text-[color:var(--text-primary)]"
                            >
                              {enzyme.positions.length
                                ? enzyme.positions.join(", ")
                                : "No sites"}
                            </button>
                          </DataCell>
                          <DataCell>{enzyme.note}</DataCell>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          ) : null}

          {activeView === "history" ? (
            <SectionCard eyebrow="History" title="Record history">
              <div className="space-y-3">
                {activeEntity.history.map((event) => (
                  <div
                    key={event.id}
                    className="grid gap-2 border-l border-[color:var(--line)] pl-4"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-[color:var(--text-primary)]">
                        {event.title}
                      </span>
                      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[color:var(--text-soft)]">
                        {event.kind}
                      </span>
                      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[color:var(--text-soft)]">
                        {new Date(event.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm leading-7 text-[color:var(--text-muted)]">
                      {event.description}
                    </p>
                  </div>
                ))}
              </div>
            </SectionCard>
          ) : null}
        </div>

        {showInfoPanel ? (
          <aside className="space-y-5">
          <SectionCard eyebrow="Selection" title="Current selection">
            <div className="space-y-4 text-sm text-[color:var(--text-muted)]">
              <div>
                <p className="text-base font-medium text-[color:var(--text-primary)]">
                  {selectedFeature?.name ?? "No feature selected"}
                </p>
                <p className="mt-2 leading-7">{selectedFeatureDescription}</p>
              </div>
              <dl className="space-y-3">
                <div className="flex items-center justify-between gap-3 border-b border-[color:var(--line)] pb-2">
                  <dt>Range</dt>
                  <dd className="font-mono text-xs text-[color:var(--text-primary)]">
                    {selectedFeature ? formatFeatureRange(selectedFeature) : "None"}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3 border-b border-[color:var(--line)] pb-2">
                  <dt>Strand</dt>
                  <dd className="text-[color:var(--text-primary)]">
                    {selectedFeature ? (selectedFeature.strand === 1 ? "+" : "-") : "None"}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3 border-b border-[color:var(--line)] pb-2">
                  <dt>Focus</dt>
                  <dd className="font-mono text-xs text-[color:var(--text-primary)]">
                    {focusStart.toLocaleString()}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt>Current view</dt>
                  <dd className="text-[color:var(--text-primary)]">
                    {viewTabs.find((tab) => tab.id === activeView)?.label}
                  </dd>
                </div>
              </dl>
            </div>
          </SectionCard>

          <SectionCard eyebrow="Display" title="Workspace controls">
            <div className="space-y-3 text-sm text-[color:var(--text-muted)]">
              <div className="flex items-center justify-between gap-3">
                <span>Minimap</span>
                <button
                  type="button"
                  onClick={() => setShowMinimap((current) => !current)}
                  className="border border-[color:var(--line)] px-2 py-1 text-[10px] uppercase tracking-[0.16em]"
                >
                  {showMinimap ? "On" : "Off"}
                </button>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>GC plot</span>
                <button
                  type="button"
                  onClick={() => setShowGcPlot((current) => !current)}
                  className="border border-[color:var(--line)] px-2 py-1 text-[10px] uppercase tracking-[0.16em]"
                >
                  {showGcPlot ? "On" : "Off"}
                </button>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Feature tracks</span>
                <button
                  type="button"
                  onClick={() => setShowFeatureTracks((current) => !current)}
                  className="border border-[color:var(--line)] px-2 py-1 text-[10px] uppercase tracking-[0.16em]"
                >
                  {showFeatureTracks ? "On" : "Off"}
                </button>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Primer tracks</span>
                <button
                  type="button"
                  onClick={() => setShowPrimerTracks((current) => !current)}
                  className="border border-[color:var(--line)] px-2 py-1 text-[10px] uppercase tracking-[0.16em]"
                >
                  {showPrimerTracks ? "On" : "Off"}
                </button>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Reverse complement</span>
                <button
                  type="button"
                  onClick={() => setShowReverseComplement((current) => !current)}
                  className="border border-[color:var(--line)] px-2 py-1 text-[10px] uppercase tracking-[0.16em]"
                >
                  {showReverseComplement ? "On" : "Off"}
                </button>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Translation mode</span>
                <button
                  type="button"
                  onClick={() =>
                    setTranslationMode((current) =>
                      current === "frames" ? "single" : "frames",
                    )
                  }
                  className="border border-[color:var(--line)] px-2 py-1 text-[10px] uppercase tracking-[0.16em]"
                >
                  {translationMode === "frames" ? "3 frames" : "1 frame"}
                </button>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            eyebrow="Record"
            title="Entity metadata"
            actions={
              saveAction ? (
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 border border-[color:var(--accent-soft)] bg-[color:var(--accent-muted)] px-3 py-2 text-xs uppercase tracking-[0.16em] text-[color:var(--text-primary)]"
                >
                  <SaveIcon className="h-4 w-4" />
                  Save entity
                </button>
              ) : null
            }
          >
            <div className="space-y-4">
              <label className="block space-y-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[color:var(--text-soft)]">
                  Name
                </span>
                <input
                  value={draftName}
                  onChange={(event) => setDraftName(event.target.value)}
                  className="w-full border border-[color:var(--line)] bg-[color:var(--surface-muted)] px-3 py-2 text-sm text-[color:var(--text-primary)] outline-none focus:border-[color:var(--accent-soft)]"
                />
              </label>

              <label className="block space-y-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[color:var(--text-soft)]">
                  Description
                </span>
                <textarea
                  value={draftDescription}
                  onChange={(event) => setDraftDescription(event.target.value)}
                  rows={4}
                  className="w-full resize-y border border-[color:var(--line)] bg-[color:var(--surface-muted)] px-3 py-2 text-sm text-[color:var(--text-primary)] outline-none focus:border-[color:var(--accent-soft)]"
                />
              </label>

              <label className="block space-y-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[color:var(--text-soft)]">
                  Aliases
                </span>
                <input
                  value={draftAliases}
                  onChange={(event) => setDraftAliases(event.target.value)}
                  placeholder="comma-separated"
                  className="w-full border border-[color:var(--line)] bg-[color:var(--surface-muted)] px-3 py-2 text-sm text-[color:var(--text-primary)] outline-none focus:border-[color:var(--accent-soft)]"
                />
              </label>

              <label className="block space-y-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[color:var(--text-soft)]">
                  Topology
                </span>
                <select
                  value={draftTopology}
                  onChange={(event) => setDraftTopology(event.target.value as SequenceTopology)}
                  className="w-full border border-[color:var(--line)] bg-[color:var(--surface-muted)] px-3 py-2 text-sm text-[color:var(--text-primary)] outline-none focus:border-[color:var(--accent-soft)]"
                >
                  <option value="circular">Circular</option>
                  <option value="linear">Linear</option>
                </select>
              </label>

              <label className="block space-y-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[color:var(--text-soft)]">
                  Purpose
                </span>
                <input
                  value={draftPurpose}
                  onChange={(event) => setDraftPurpose(event.target.value)}
                  className="w-full border border-[color:var(--line)] bg-[color:var(--surface-muted)] px-3 py-2 text-sm text-[color:var(--text-primary)] outline-none focus:border-[color:var(--accent-soft)]"
                />
              </label>

              <label className="block space-y-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[color:var(--text-soft)]">
                  Feature summary
                </span>
                <input
                  value={draftFeatureSummary}
                  onChange={(event) => setDraftFeatureSummary(event.target.value)}
                  className="w-full border border-[color:var(--line)] bg-[color:var(--surface-muted)] px-3 py-2 text-sm text-[color:var(--text-primary)] outline-none focus:border-[color:var(--accent-soft)]"
                />
              </label>

              <label className="block space-y-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[color:var(--text-soft)]">
                  Default motif
                </span>
                <input
                  value={draftDefaultMotif}
                  onChange={(event) => setDraftDefaultMotif(event.target.value.toUpperCase())}
                  className="w-full border border-[color:var(--line)] bg-[color:var(--surface-muted)] px-3 py-2 font-mono text-sm text-[color:var(--text-primary)] outline-none focus:border-[color:var(--accent-soft)]"
                />
              </label>

              <label className="block space-y-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[color:var(--text-soft)]">
                  Sequence
                </span>
                <textarea
                  value={draftSequence}
                  onChange={(event) => setDraftSequence(event.target.value.toUpperCase())}
                  rows={8}
                  spellCheck={false}
                  className="w-full resize-y border border-[color:var(--line)] bg-[color:var(--surface-muted)] px-3 py-2 font-mono text-xs tracking-[0.18em] text-[color:var(--text-primary)] outline-none focus:border-[color:var(--accent-soft)]"
                />
              </label>

              <label className="block space-y-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[color:var(--text-soft)]">
                  Notes
                </span>
                <textarea
                  value={draftNotes}
                  onChange={(event) => setDraftNotes(event.target.value)}
                  rows={5}
                  className="w-full resize-y border border-[color:var(--line)] bg-[color:var(--surface-muted)] px-3 py-2 text-sm text-[color:var(--text-primary)] outline-none focus:border-[color:var(--accent-soft)]"
                />
              </label>
            </div>
          </SectionCard>

          <SectionCard eyebrow="Record history" title="Recent activity">
            <div className="space-y-3">
              {activeEntity.history.slice(0, 4).map((event) => (
                <div key={event.id} className="space-y-1 border-l border-[color:var(--line)] pl-3">
                  <div className="flex items-center gap-2">
                    <HistoryIcon className="h-3.5 w-3.5 text-[color:var(--text-soft)]" />
                    <span className="text-sm font-medium text-[color:var(--text-primary)]">
                      {event.title}
                    </span>
                  </div>
                  <p className="text-xs leading-6 text-[color:var(--text-muted)]">
                    {event.description}
                  </p>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard eyebrow="References" title="Linked references">
            <div className="space-y-3 text-sm text-[color:var(--text-muted)]">
              {activeEntity.references.length ? (
                activeEntity.references.map((reference) => (
                  <a
                    key={reference.href}
                    href={reference.href}
                    target="_blank"
                    rel="noreferrer"
                    className="block border-l border-[color:var(--line)] pl-3 transition hover:text-[color:var(--text-primary)]"
                  >
                    <span className="block font-medium text-[color:var(--text-primary)]">
                      {reference.title}
                    </span>
                    <span className="mt-1 block font-mono text-[10px] uppercase tracking-[0.16em] text-[color:var(--text-soft)]">
                      External
                    </span>
                  </a>
                ))
              ) : (
                <p className="leading-7">
                  Add references or notes to keep sequence provenance, construct intent, and validation context close to the map.
                </p>
              )}
            </div>
          </SectionCard>
          </aside>
        ) : null}
      </div>
    </form>
  );
}
