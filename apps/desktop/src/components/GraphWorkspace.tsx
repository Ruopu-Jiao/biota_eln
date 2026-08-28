import { useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import { titleFromPath } from "@/lib/records";
import type { RecordType, VaultFile } from "@/types";

const positions = [
  [50, 46],
  [31, 25],
  [71, 28],
  [21, 58],
  [76, 61],
  [44, 76],
  [61, 81],
  [14, 35],
  [86, 43],
];

function nodeTone(type?: RecordType) {
  if (type === "experiment") return "#b96f59";
  if (type === "protocol") return "#4f8c76";
  if (type === "project") return "#c29349";
  if (type === "entity") return "#637fa9";
  if (type === "analysis") return "#8d739a";
  if (type === "daily") return "#849068";
  return "#8a8a82";
}

export function GraphWorkspace({
  files,
  onOpenRecord,
}: {
  files: VaultFile[];
  onOpenRecord: (path: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [selectedPath, setSelectedPath] = useState<string>();
  const nodes = useMemo(
    () =>
      files
        .filter((file) => file.kind === "file" && file.path.endsWith(".md"))
        .slice(0, positions.length)
        .map((file, index) => ({
          ...file,
          x: positions[index]![0],
          y: positions[index]![1],
          title: titleFromPath(file.path),
        })),
    [files]
  );
  const center = nodes[0];
  const selected = nodes.find((node) => node.path === selectedPath) ?? center;
  const visible = (title: string) =>
    !query.trim() || title.toLowerCase().includes(query.trim().toLowerCase());

  return (
    <div className="graph-workspace">
      <header className="graph-header">
        <div>
          <p className="eyebrow">KNOWLEDGE GRAPH</p>
          <h1>Vault connections</h1>
        </div>
        <label>
          <Icon name="search" size={14} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Highlight a note…"
          />
        </label>
        <button className="button button-quiet">
          <Icon name="refresh" size={14} /> Center graph
        </button>
      </header>
      <div className="graph-body">
        <aside className="graph-filters">
          <h3>Show</h3>
          {[
            ["experiment", "#b96f59"],
            ["protocol", "#4f8c76"],
            ["project", "#c29349"],
            ["entity", "#637fa9"],
            ["analysis", "#8d739a"],
            ["note", "#8a8a82"],
          ].map(([label, color]) => (
            <label key={label}>
              <input type="checkbox" defaultChecked />
              <span style={{ background: color }} />
              {label}
            </label>
          ))}
          <div className="graph-filter-divider" />
          <label>
            <input type="checkbox" defaultChecked />
            <Icon name="link" size={13} />
            Wikilinks
          </label>
          <label>
            <input type="checkbox" defaultChecked />
            <Icon name="sparkle" size={13} />
            Unlinked mentions
          </label>
          <div className="graph-stats">
            <div>
              <strong>{nodes.length}</strong>
              <span>notes</span>
            </div>
            <div>
              <strong>{Math.max(0, nodes.length + 3)}</strong>
              <span>links</span>
            </div>
          </div>
        </aside>
        <main className="graph-canvas-wrap">
          <svg className="knowledge-graph" viewBox="0 0 1000 650">
            <defs>
              <radialGradient id="graph-bg">
                <stop offset="0%" stopColor="#fbfaf7" />
                <stop offset="100%" stopColor="#f1f0eb" />
              </radialGradient>
              <filter id="node-shadow">
                <feDropShadow
                  dx="0"
                  dy="2"
                  stdDeviation="4"
                  floodOpacity=".18"
                />
              </filter>
            </defs>
            <rect width="1000" height="650" fill="url(#graph-bg)" />
            <g className="graph-grid-lines">
              {Array.from({ length: 20 }, (_, index) => (
                <line
                  key={`v${index}`}
                  x1={index * 50}
                  y1="0"
                  x2={index * 50}
                  y2="650"
                />
              ))}
              {Array.from({ length: 13 }, (_, index) => (
                <line
                  key={`h${index}`}
                  x1="0"
                  y1={index * 50}
                  x2="1000"
                  y2={index * 50}
                />
              ))}
            </g>
            {center
              ? nodes.slice(1).map((node, index) => {
                  const secondary = nodes[(index + 2) % nodes.length];
                  return (
                    <g key={`edge-${node.path}`}>
                      <line
                        x1={center.x * 10}
                        y1={center.y * 6.5}
                        x2={node.x * 10}
                        y2={node.y * 6.5}
                        className="graph-edge"
                      />
                      {secondary ? (
                        <line
                          x1={node.x * 10}
                          y1={node.y * 6.5}
                          x2={secondary.x * 10}
                          y2={secondary.y * 6.5}
                          className="graph-edge secondary"
                        />
                      ) : null}
                    </g>
                  );
                })
              : null}
            {nodes.map((node, index) => {
              const highlighted = visible(node.title);
              const selectedNode = node.path === selected?.path;
              const radius =
                index === 0 ? 19 : node.recordType === "experiment" ? 15 : 11;
              return (
                <g
                  key={node.path}
                  className={`graph-node ${highlighted ? "" : "is-dimmed"} ${
                    selectedNode ? "is-selected" : ""
                  }`}
                  onClick={() => setSelectedPath(node.path)}
                  onDoubleClick={() => onOpenRecord(node.path)}
                >
                  {selectedNode ? (
                    <circle
                      cx={node.x * 10}
                      cy={node.y * 6.5}
                      r={radius + 8}
                      fill="none"
                      stroke={nodeTone(node.recordType)}
                      strokeWidth="2"
                      opacity=".28"
                    />
                  ) : null}
                  <circle
                    cx={node.x * 10}
                    cy={node.y * 6.5}
                    r={radius}
                    fill={nodeTone(node.recordType)}
                    filter="url(#node-shadow)"
                  />
                  <text
                    x={node.x * 10}
                    y={node.y * 6.5 + radius + 19}
                    textAnchor="middle"
                  >
                    {node.title}
                  </text>
                </g>
              );
            })}
          </svg>
          <div className="graph-controls">
            <button aria-label="Zoom in">
              <Icon name="add" size={15} />
            </button>
            <button aria-label="Zoom out">−</button>
            <button aria-label="Fit graph">
              <Icon name="refresh" size={14} />
            </button>
          </div>
          <div className="graph-hint">Double-click a node to open it</div>
        </main>
        {selected ? (
          <aside className="graph-inspector">
            <div
              className="graph-inspector-mark"
              style={{ background: nodeTone(selected.recordType) }}
            >
              <Icon
                name={
                  selected.recordType === "experiment"
                    ? "experiment"
                    : "document"
                }
                size={20}
              />
            </div>
            <span className="inspector-kicker">{selected.recordType}</span>
            <h2>{selected.title}</h2>
            <p>{selected.path}</p>
            <button
              className="button button-primary button-full"
              onClick={() => onOpenRecord(selected.path)}
            >
              Open record
            </button>
            <section>
              <h3>Connections</h3>
              {nodes
                .filter((node) => node.path !== selected.path)
                .slice(0, 3)
                .map((node) => (
                  <button
                    key={node.path}
                    onClick={() => setSelectedPath(node.path)}
                  >
                    <span style={{ background: nodeTone(node.recordType) }} />
                    <div>
                      <strong>{node.title}</strong>
                      <small>{node.recordType}</small>
                    </div>
                    <Icon name="chevron" size={12} />
                  </button>
                ))}
            </section>
            <section>
              <h3>Local graph</h3>
              <p>3 direct links · 6 second-degree connections</p>
            </section>
          </aside>
        ) : null}
      </div>
      <footer className="graph-statusbar">
        <span>
          <span className="status-dot status-dot-green" /> Index current
        </span>
        <span>{nodes.length} records visible</span>
        <span className="statusbar-spacer" />
        <span>Scroll to zoom · drag to pan</span>
      </footer>
    </div>
  );
}
