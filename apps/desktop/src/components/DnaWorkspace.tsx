import { useEffect, useMemo, useRef, useState } from "react";
import {
  exportGenbank,
  findMotifOccurrences,
  formatFeatureRange,
  gcContent,
  importSequenceFile,
  normalizeDnaSequence,
  reverseComplementRecord,
  type DNAFeature,
  type RichSequenceFeature,
  type StudioSequenceRecord,
} from "@biota/bio";
import { createBiotaId } from "@biota/vault";
import { Icon } from "@/components/Icon";
import { desktopApi, isDesktopRuntime } from "@/lib/desktop-api";
import { safeFileName } from "@/lib/records";

type DnaView = "map" | "sequence" | "split";

const seedSequence =
  "ATGGTGAGCAAGGGCGAGGAGCTGTTCACCGGGGTGGTGCCCATCCTGGTCGAGCTGGACGGCGACGTAAACGGCCACAAGTTCAGCGTGTCCGGCGAGGGCGAGGGCGATGCCACCTACGGCAAGCTGACCCTGAAGTTCATCTGCACCACCGGCAAGCTGCCCGTGCCCTGGCCCACCCTCGTGACCACCCTGACCTACGGCGTGCAGTGCTTCAGCCGCTACCCCGACCACATGAAGCAGCACGACTTCTTCAAGTCCGCCATGCCCGAAGGCTACGTCCAGGAGCGCACCATCTTCTTCAAGGACGACGGCAACTACAAGACCCGCGCCGAGGTGAAGTTCGAGGGCGACACCCTGGTGAACCGCATCGAGCTGAAGGGCATCGACTTCAAGGAGGACGGCAACATCCTGGGGCACAAGCTGGAGTACAACTACAACAGCCACAACGTCTATATCATGGCCGACAAGCAGAAGAACGGCATCAAGGTGAACTTCAAGATCCGCCACAACATCGAGGACGGCAGCGTGCAGCTCGCCGACCACTACCAGCAGAACACCCCCATCGGCGACGGCCCCGTGCTGCTGCCCGACAACCACTACCTGAGCACCCAGTCCGCCCTGAGCAAAGACCCCAACGAGAAGCGCGATCACATGGTCCTGCTGGAGTTCGTGACCGCCGCCGGGATCACTCTCGGCATGGACGAGCTGTACAAG";

const initialSequence = normalizeDnaSequence(
  `${"GCTAGCGGATCC".repeat(65)}${seedSequence}${"AAGCTTGGTCTC".repeat(500)}`
).slice(0, 7412);

const initialFeatures: DNAFeature[] = [
  {
    id: "f-cmv",
    name: "CMV promoter",
    type: "promoter",
    start: 182,
    end: 769,
    strand: 1,
    color: "#b86b59",
    notes: "Human cytomegalovirus immediate early promoter.",
  },
  {
    id: "f-gfp",
    name: "EGFP",
    type: "cds",
    start: 1011,
    end: 1730,
    strand: 1,
    color: "#5d9d78",
    notes: "Enhanced green fluorescent protein coding sequence.",
  },
  {
    id: "f-wpre",
    name: "WPRE",
    type: "misc",
    start: 1910,
    end: 2500,
    strand: 1,
    color: "#8a79ab",
    notes: "Woodchuck hepatitis virus post-transcriptional regulatory element.",
  },
  {
    id: "f-puro",
    name: "PuroR",
    type: "cds",
    start: 3240,
    end: 3839,
    strand: -1,
    color: "#c29349",
    notes: "Puromycin resistance cassette.",
  },
  {
    id: "f-amp",
    name: "AmpR",
    type: "cds",
    start: 4850,
    end: 5710,
    strand: -1,
    color: "#5f82b2",
    notes: "Beta-lactamase selection marker.",
  },
  {
    id: "f-ori",
    name: "pUC ori",
    type: "ori",
    start: 6100,
    end: 6780,
    strand: 1,
    color: "#ae7691",
    notes: "High-copy bacterial origin of replication.",
  },
];

function studioFeature(feature: DNAFeature): RichSequenceFeature {
  return {
    id: feature.id,
    name: feature.name,
    type: feature.type,
    color: feature.color,
    qualifiers: feature.notes ? { note: [feature.notes] } : {},
    location: {
      operator: "single",
      strand: feature.strand,
      segments: [{ start: feature.start - 1, end: feature.end }],
    },
  };
}

const initialRecord: StudioSequenceRecord = {
  id: createBiotaId(),
  name: "pLenti-CMV-GFP",
  description: "Local sequence workspace preview",
  alphabet: "DNA",
  topology: "circular",
  sequence: initialSequence,
  features: initialFeatures.map(studioFeature),
  primers: [],
  operations: [],
};

function featureType(type: string): DNAFeature["type"] {
  const normalized = type.toLowerCase();
  if (normalized === "promoter") return "promoter";
  if (normalized === "cds") return "cds";
  if (normalized === "ori" || normalized.includes("origin")) return "ori";
  if (normalized.includes("primer")) return "primer";
  if (normalized.includes("restriction")) return "restriction";
  if (normalized.includes("tag")) return "tag";
  return "misc";
}

function displayFeatures(record: StudioSequenceRecord): DNAFeature[] {
  return record.features.flatMap((feature) => {
    const first = feature.location.segments[0];
    const last = feature.location.segments.at(-1);
    if (!first || !last) return [];
    return [
      {
        id: feature.id,
        name: feature.name,
        type: featureType(feature.type),
        start: first.start + 1,
        end: last.end,
        strand: feature.location.strand,
        color: feature.color ?? "#7c8794",
        notes: Object.entries(feature.qualifiers)
          .flatMap(([key, values]) => values.map((value) => `${key}: ${value}`))
          .join("\n"),
      },
    ];
  });
}

const constructs = [
  { name: "pLenti-CMV-GFP", meta: "7,412 bp · circular", color: "#5d9d78" },
  { name: "pUC19", meta: "2,686 bp · circular", color: "#c29349" },
  { name: "BX17-sgRNA-04", meta: "102 nt · linear", color: "#8a79ab" },
];

const enzymes = [
  { name: "EcoRI", site: "GAATTC", color: "#b86b59" },
  { name: "BamHI", site: "GGATCC", color: "#5f82b2" },
  { name: "BsaI", site: "GGTCTC", color: "#c29349" },
  { name: "HindIII", site: "AAGCTT", color: "#8a79ab" },
];

function polarPoint(cx: number, cy: number, radius: number, angle: number) {
  const radians = ((angle - 90) * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(radians),
    y: cy + radius * Math.sin(radians),
  };
}

function arcPath(
  cx: number,
  cy: number,
  radius: number,
  start: number,
  end: number
) {
  const startPoint = polarPoint(cx, cy, radius, end);
  const endPoint = polarPoint(cx, cy, radius, start);
  const large = end - start <= 180 ? 0 : 1;
  return `M ${startPoint.x} ${startPoint.y} A ${radius} ${radius} 0 ${large} 0 ${endPoint.x} ${endPoint.y}`;
}

function CircularMap({
  name,
  topology,
  sequence,
  features,
  selectedId,
  onSelect,
}: {
  name: string;
  topology: "linear" | "circular";
  sequence: string;
  features: DNAFeature[];
  selectedId?: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="circular-map-wrap">
      <svg
        className="circular-map"
        viewBox="0 0 620 620"
        role="img"
        aria-label="Plasmid map"
      >
        <defs>
          <filter id="map-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity=".12" />
          </filter>
        </defs>
        <circle
          cx="310"
          cy="310"
          r="202"
          fill="none"
          stroke="#d8d6ce"
          strokeWidth="3"
        />
        <circle
          cx="310"
          cy="310"
          r="196"
          fill="none"
          stroke="#efeee9"
          strokeWidth="1"
        />
        {Array.from({ length: 12 }, (_, index) => {
          const pointA = polarPoint(310, 310, 207, index * 30);
          const pointB = polarPoint(
            310,
            310,
            index % 3 ? 214 : 220,
            index * 30
          );
          return (
            <line
              key={index}
              x1={pointA.x}
              y1={pointA.y}
              x2={pointB.x}
              y2={pointB.y}
              stroke="#c7c5bd"
              strokeWidth={index % 3 ? 1 : 1.5}
            />
          );
        })}
        {features.map((feature, index) => {
          const start = (feature.start / sequence.length) * 360;
          const end =
            ((feature.end < feature.start
              ? feature.end + sequence.length
              : feature.end) /
              sequence.length) *
            360;
          const radius = 184 + (index % 2) * 18;
          const middle = start + (end - start) / 2;
          const labelPoint = polarPoint(310, 310, radius + 52, middle);
          const edgePoint = polarPoint(310, 310, radius + 9, middle);
          const selected = feature.id === selectedId;
          return (
            <g
              key={feature.id}
              className={`map-feature ${selected ? "is-selected" : ""}`}
              onClick={() => onSelect(feature.id)}
            >
              <path
                d={arcPath(310, 310, radius, start, end)}
                fill="none"
                stroke={feature.color}
                strokeWidth={selected ? 17 : 13}
                strokeLinecap="round"
                filter={selected ? "url(#map-shadow)" : undefined}
              />
              <line
                x1={edgePoint.x}
                y1={edgePoint.y}
                x2={labelPoint.x}
                y2={labelPoint.y}
                stroke={feature.color}
                strokeWidth="1"
                opacity=".55"
              />
              <text
                x={labelPoint.x}
                y={labelPoint.y}
                textAnchor={labelPoint.x < 310 ? "end" : "start"}
                dominantBaseline="middle"
              >
                {feature.name}
              </text>
            </g>
          );
        })}
        <circle cx="310" cy="310" r="112" fill="#fff" stroke="#eceae4" />
        <text x="310" y="285" textAnchor="middle" className="map-title">
          {name}
        </text>
        <text x="310" y="316" textAnchor="middle" className="map-length">
          {sequence.length.toLocaleString()} bp
        </text>
        <text x="310" y="341" textAnchor="middle" className="map-subtitle">
          {topology} · dsDNA
        </text>
      </svg>
      <div className="map-scale">1,000 bp</div>
    </div>
  );
}

function SequenceView({
  sequence,
  features,
}: {
  sequence: string;
  features: DNAFeature[];
}) {
  const rows = useMemo(() => {
    const result: Array<{ offset: number; groups: string[] }> = [];
    for (let offset = 0; offset < sequence.length; offset += 60) {
      const line = sequence.slice(offset, offset + 60);
      result.push({
        offset,
        groups: Array.from({ length: 6 }, (_, index) =>
          line.slice(index * 10, index * 10 + 10)
        ),
      });
    }
    return result;
  }, [sequence]);

  return (
    <div className="sequence-viewer">
      <div className="sequence-ruler">
        <span>Forward strand</span>
        <span>{sequence.length.toLocaleString()} bp</span>
      </div>
      <div className="sequence-scroll">
        {rows.map((row) => {
          const activeFeature = features.find((feature) =>
            feature.start <= feature.end
              ? row.offset + 1 <= feature.end &&
                row.offset + 60 >= feature.start
              : row.offset + 60 >= feature.start ||
                row.offset + 1 <= feature.end
          );
          return (
            <div className="sequence-row" key={row.offset}>
              <span className="sequence-offset">
                {(row.offset + 1).toLocaleString()}
              </span>
              <code>
                {row.groups.map((group, index) => (
                  <span
                    key={index}
                    style={
                      activeFeature
                        ? {
                            background: `${activeFeature.color}16`,
                            borderBottomColor: activeFeature.color,
                          }
                        : undefined
                    }
                  >
                    {group}
                  </span>
                ))}
              </code>
              <span className="sequence-offset end">
                {Math.min(sequence.length, row.offset + 60).toLocaleString()}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function DnaWorkspace({ path }: { path?: string }) {
  const [view, setView] = useState<DnaView>("split");
  const [record, setRecord] = useState<StudioSequenceRecord>(initialRecord);
  const [selectedFeatureId, setSelectedFeatureId] = useState("f-gfp");
  const [query, setQuery] = useState("");
  const [selectedConstruct, setSelectedConstruct] = useState(0);
  const [vaultPath, setVaultPath] = useState<string>();
  const [vaultHash, setVaultHash] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("GenBank sidecar preview");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sequence = record.sequence;
  const features = useMemo(() => displayFeatures(record), [record]);

  const selectedFeature = features.find(
    (feature) => feature.id === selectedFeatureId
  );
  const motifHits = useMemo(
    () => (query ? findMotifOccurrences(sequence, query) : []),
    [query, sequence]
  );
  const enzymeHits = useMemo(
    () =>
      enzymes.map((enzyme) => ({
        ...enzyme,
        hits: findMotifOccurrences(sequence, enzyme.site).length,
      })),
    [sequence]
  );

  async function parseSequence(
    fileName: string,
    contents: string | Uint8Array | ArrayBuffer | Blob,
    sourcePath?: string,
    sourceHash?: string
  ) {
    setBusy(true);
    try {
      const imported = await importSequenceFile({
        fileName,
        contents,
        recordId: createBiotaId(),
        importedAt: new Date().toISOString(),
      });
      setRecord(imported.record);
      setSelectedFeatureId(imported.record.features[0]?.id ?? "");
      setVaultPath(sourcePath);
      setVaultHash(sourceHash);
      setNotice(
        imported.diagnostics.find(
          (diagnostic) => diagnostic.severity === "warning"
        )?.message ??
          `${fileName} imported with ${imported.record.features.length} features`
      );
    } catch (caught) {
      setNotice(
        caught instanceof Error
          ? caught.message
          : `Could not import ${fileName}`
      );
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!path || !isDesktopRuntime()) return;
    let current = true;
    setBusy(true);
    const load = async () => {
      try {
        if (
          path.toLowerCase().endsWith(".dna") ||
          path.toLowerCase().endsWith(".ab1")
        ) {
          const bytes = await desktopApi.readBinary(path);
          if (current)
            await parseSequence(path.split("/").at(-1) ?? path, bytes, path);
        } else {
          const document = await desktopApi.readRecord(path);
          if (current) {
            await parseSequence(
              path.split("/").at(-1) ?? path,
              document.content,
              path,
              document.hash
            );
          }
        }
      } catch (caught) {
        if (current) {
          setNotice(
            caught instanceof Error ? caught.message : `Could not open ${path}`
          );
        }
      } finally {
        if (current) setBusy(false);
      }
    };
    void load();
    return () => {
      current = false;
    };
  }, [path]);

  async function importSequence(file: File) {
    await parseSequence(file.name, file);
    if (/\.(dna|ab1)$/i.test(file.name) && isDesktopRuntime()) {
      const dot = file.name.lastIndexOf(".");
      const stem = dot > 0 ? file.name.slice(0, dot) : file.name;
      const extension = dot > 0 ? file.name.slice(dot).toLowerCase() : "";
      const retainedPath = `Attachments/imports/${safeFileName(stem)}-${createBiotaId().slice(
        -6
      )}${extension}`;
      try {
        await desktopApi.writeBinary(
          retainedPath,
          new Uint8Array(await file.arrayBuffer())
        );
        setNotice(
          `Imported ${file.name}; original retained at ${retainedPath}`
        );
      } catch (caught) {
        setNotice(
          caught instanceof Error
            ? `Sequence converted, but the original could not be retained: ${caught.message}`
            : "Sequence converted, but the original could not be retained."
        );
      }
    }
  }

  async function saveSequence() {
    setBusy(true);
    try {
      const content = await exportGenbank(record);
      const existingGenbank =
        vaultPath && /\.(gb|gbk|genbank)$/i.test(vaultPath)
          ? vaultPath
          : undefined;
      const outputPath =
        existingGenbank ??
        `Sequences/${safeFileName(record.name)}-${record.id.slice(0, 6)}.gb`;
      const result = await desktopApi.writeRecord({
        path: outputPath,
        content,
        expectedHash: existingGenbank ? vaultHash : undefined,
        reason: "manual",
      });
      setVaultPath(outputPath);
      setVaultHash(result.hash);
      setNotice(`Saved editable GenBank sidecar to ${outputPath}`);
    } catch (caught) {
      setNotice(
        caught instanceof Error
          ? caught.message
          : "The sequence could not be saved."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dna-workspace">
      <aside className="dna-library">
        <div className="specialized-sidebar-heading">
          <span>Sequences</span>
          <button>
            <Icon name="add" size={15} />
          </button>
        </div>
        <label className="specialized-search">
          <Icon name="search" size={13} />
          <input placeholder="Find a construct…" />
        </label>
        <div className="sequence-list-label">RECENT</div>
        <div className="construct-list">
          {constructs.map((construct, index) => (
            <button
              key={construct.name}
              className={selectedConstruct === index ? "is-active" : ""}
              onClick={() => setSelectedConstruct(index)}
            >
              <span
                className="construct-map-icon"
                style={
                  {
                    "--construct-color": construct.color,
                  } as React.CSSProperties
                }
              >
                <span />
              </span>
              <span>
                <strong>{construct.name}</strong>
                <small>{construct.meta}</small>
              </span>
            </button>
          ))}
        </div>
        <div className="sequence-list-label">COLLECTIONS</div>
        <button className="collection-row">
          <Icon name="folder" size={14} />
          Lentiviral vectors
          <span>8</span>
        </button>
        <button className="collection-row">
          <Icon name="folder" size={14} />
          Screening primers
          <span>24</span>
        </button>
        <div className="dna-library-footer">
          <button onClick={() => fileInputRef.current?.click()}>
            <Icon name="external" size={14} />
            Import sequence
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".gb,.gbk,.fasta,.fa,.dna,.ab1"
            hidden
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              if (file) void importSequence(file);
            }}
          />
        </div>
      </aside>

      <section className="dna-main">
        <header className="dna-document-header">
          <div>
            <span className="dna-file-icon">
              <Icon name="dna" size={18} />
            </span>
            <div>
              <div>
                <h1>{record.name}</h1>
                <span className="status-pill status-active">verified</span>
              </div>
              <p>
                {sequence.length.toLocaleString()} bp <span>·</span>{" "}
                {record.topology === "circular" ? "Circular" : "Linear"}{" "}
                {record.alphabet}
                <span>·</span> GC {gcContent(sequence).toFixed(1)}%
              </p>
            </div>
          </div>
          <div className="dna-header-actions">
            <button className="button button-quiet">
              <Icon name="history" size={14} /> History
            </button>
            <button
              className="button button-primary"
              onClick={() => void saveSequence()}
              disabled={busy}
            >
              <Icon name="check" size={14} /> Save
            </button>
          </div>
        </header>

        <div className="dna-toolbar">
          <div className="segmented-control labeled">
            <button
              className={view === "map" ? "is-active" : ""}
              onClick={() => setView("map")}
            >
              Map
            </button>
            <button
              className={view === "sequence" ? "is-active" : ""}
              onClick={() => setView("sequence")}
            >
              Sequence
            </button>
            <button
              className={view === "split" ? "is-active" : ""}
              onClick={() => setView("split")}
            >
              Split
            </button>
          </div>
          <span className="toolbar-divider" />
          <button>
            <Icon name="add" size={14} /> Feature
          </button>
          <button>
            <Icon name="sequence" size={14} /> Primer
          </button>
          <button>
            <Icon name="experiment" size={14} /> Clone
          </button>
          <span className="toolbar-divider" />
          <label className="dna-find">
            <Icon name="search" size={13} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Find motif…"
            />
            {query ? <span>{motifHits.length}</span> : null}
          </label>
          <span className="toolbar-spacer" />
          <button
            title="Reverse complement"
            disabled={record.alphabet !== "DNA"}
            onClick={() =>
              setRecord((current) =>
                reverseComplementRecord(
                  current,
                  createBiotaId(),
                  new Date().toISOString()
                )
              )
            }
          >
            <Icon name="refresh" size={14} />
          </button>
          <button title="More options">
            <Icon name="dots" size={16} />
          </button>
        </div>

        <div className={`dna-canvas view-${view}`}>
          {view !== "sequence" ? (
            <CircularMap
              name={record.name}
              topology={record.topology}
              sequence={sequence}
              features={features}
              selectedId={selectedFeatureId}
              onSelect={setSelectedFeatureId}
            />
          ) : null}
          {view !== "map" ? (
            <SequenceView sequence={sequence} features={features} />
          ) : null}
        </div>

        <footer className="dna-statusbar">
          <span>
            <span className="status-dot status-dot-green" />{" "}
            {busy ? "Working…" : notice}
          </span>
          <span>{features.length} features</span>
          <span>
            {enzymeHits.reduce((sum, enzyme) => sum + enzyme.hits, 0)} enzyme
            sites
          </span>
          <span className="statusbar-spacer" />
          <span>
            Selection:{" "}
            {selectedFeature ? formatFeatureRange(selectedFeature) : "—"}
          </span>
        </footer>
      </section>

      <aside className="dna-inspector">
        <div className="inspector-tabs">
          <button className="is-active">Features</button>
          <button>Enzymes</button>
          <button>Primers</button>
        </div>
        <div className="feature-list">
          <header>
            <span>{features.length} annotations</span>
            <button>
              <Icon name="add" size={14} />
            </button>
          </header>
          {features.map((feature) => (
            <button
              key={feature.id}
              className={selectedFeatureId === feature.id ? "is-active" : ""}
              onClick={() => setSelectedFeatureId(feature.id)}
            >
              <span
                className="feature-swatch"
                style={{ background: feature.color }}
              />
              <span>
                <strong>{feature.name}</strong>
                <small>
                  {feature.type.toUpperCase()} · {formatFeatureRange(feature)}
                </small>
              </span>
              <Icon name="chevron" size={12} />
            </button>
          ))}
        </div>
        {selectedFeature ? (
          <section className="feature-inspector-card">
            <div className="feature-card-heading">
              <span style={{ background: selectedFeature.color }} />
              <div>
                <small>SELECTED FEATURE</small>
                <strong>{selectedFeature.name}</strong>
              </div>
              <button>
                <Icon name="edit" size={14} />
              </button>
            </div>
            <dl>
              <div>
                <dt>Type</dt>
                <dd>{selectedFeature.type.toUpperCase()}</dd>
              </div>
              <div>
                <dt>Range</dt>
                <dd>{formatFeatureRange(selectedFeature)}</dd>
              </div>
              <div>
                <dt>Strand</dt>
                <dd>
                  {selectedFeature.strand === 1 ? "Forward →" : "Reverse ←"}
                </dd>
              </div>
              <div>
                <dt>Length</dt>
                <dd>
                  {(selectedFeature.start <= selectedFeature.end
                    ? selectedFeature.end - selectedFeature.start + 1
                    : sequence.length -
                      selectedFeature.start +
                      1 +
                      selectedFeature.end
                  ).toLocaleString()}{" "}
                  bp
                </dd>
              </div>
            </dl>
            <p>{selectedFeature.notes}</p>
          </section>
        ) : null}
        <section className="enzyme-summary">
          <h3>Restriction sites</h3>
          {enzymeHits.map((enzyme) => (
            <div key={enzyme.name}>
              <span style={{ background: enzyme.color }} />
              <strong>{enzyme.name}</strong>
              <code>{enzyme.site}</code>
              <em>{enzyme.hits}</em>
            </div>
          ))}
        </section>
      </aside>
    </div>
  );
}
