import { useMemo, useState } from "react";
import { Icon, type IconName } from "@/components/Icon";
import { buildFileTree, titleFromPath } from "@/lib/records";
import type {
  FileTreeNode,
  SearchHit,
  VaultFile,
  VaultInfo,
  WorkspaceArea,
} from "@/types";

const areas: Array<{ id: WorkspaceArea; label: string; icon: IconName }> = [
  { id: "notebook", label: "Notebook", icon: "notebook" },
  { id: "planning", label: "Planning", icon: "planning" },
  { id: "dna", label: "DNA studio", icon: "dna" },
  { id: "analysis", label: "Analysis", icon: "analysis" },
  { id: "graph", label: "Knowledge graph", icon: "graph" },
];

interface SidebarProps {
  vault: VaultInfo;
  area: WorkspaceArea;
  files: VaultFile[];
  activePath?: string;
  searchResults: SearchHit[];
  onAreaChange: (area: WorkspaceArea) => void;
  onOpenRecord: (path: string) => void;
  onCreate: () => void;
  onSearch: (query: string) => void;
  onOpenPalette: () => void;
  onCloseVault: () => void;
}

function recordIcon(node: FileTreeNode): IconName {
  if (node.kind === "directory") return "folder";
  if (node.recordType === "experiment") return "experiment";
  if (node.recordType === "protocol") return "protocol";
  if (node.recordType === "entity") return "dna";
  if (node.recordType === "analysis") return "analysis";
  return "document";
}

function TreeItem({
  node,
  depth,
  activePath,
  onOpen,
}: {
  node: FileTreeNode;
  depth: number;
  activePath?: string;
  onOpen: (path: string) => void;
}) {
  const [expanded, setExpanded] = useState(depth < 1);
  const isDirectory = node.kind === "directory";

  return (
    <li>
      <button
        className={`tree-row ${activePath === node.path ? "is-active" : ""}`}
        style={{ paddingLeft: `${10 + depth * 14}px` }}
        onClick={() =>
          isDirectory ? setExpanded((value) => !value) : onOpen(node.path)
        }
        title={node.path}
      >
        {isDirectory ? (
          <Icon
            name="chevron"
            size={12}
            className={`tree-chevron ${expanded ? "is-expanded" : ""}`}
          />
        ) : (
          <span className="tree-spacer" />
        )}
        <Icon name={recordIcon(node)} size={15} className="tree-type-icon" />
        <span>{isDirectory ? node.name : titleFromPath(node.name)}</span>
      </button>
      {isDirectory && expanded ? (
        <ul className="tree-children">
          {node.children.map((child) => (
            <TreeItem
              key={child.path}
              node={child}
              depth={depth + 1}
              activePath={activePath}
              onOpen={onOpen}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function Sidebar({
  vault,
  area,
  files,
  activePath,
  searchResults,
  onAreaChange,
  onOpenRecord,
  onCreate,
  onSearch,
  onOpenPalette,
  onCloseVault,
}: SidebarProps) {
  const [query, setQuery] = useState("");
  const [vaultMenu, setVaultMenu] = useState(false);
  const tree = useMemo(() => buildFileTree(files), [files]);

  function updateQuery(value: string) {
    setQuery(value);
    onSearch(value);
  }

  return (
    <>
      <nav className="area-rail" aria-label="Workspace areas">
        <div className="rail-drag-region" data-tauri-drag-region />
        <div className="rail-brand" aria-label="Biota">
          <span />
        </div>
        <div className="rail-primary">
          {areas.map((item) => (
            <button
              key={item.id}
              className={`rail-button ${area === item.id ? "is-active" : ""}`}
              onClick={() => onAreaChange(item.id)}
              aria-label={item.label}
              title={item.label}
            >
              <Icon name={item.icon} size={19} />
              {area === item.id ? <span className="rail-active-mark" /> : null}
            </button>
          ))}
        </div>
        <div className="rail-bottom">
          <button
            className="rail-button"
            aria-label="Settings"
            title="Settings"
          >
            <Icon name="settings" size={18} />
          </button>
        </div>
      </nav>

      <aside className="file-sidebar">
        <div className="sidebar-drag-region" data-tauri-drag-region />
        <div className="vault-switcher-wrap">
          <button
            className="vault-switcher"
            onClick={() => setVaultMenu((value) => !value)}
            aria-expanded={vaultMenu}
          >
            <span className="vault-avatar">
              {vault.name.slice(0, 1).toUpperCase()}
            </span>
            <span className="vault-switcher-copy">
              <strong>{vault.name}</strong>
              <small>Local vault</small>
            </span>
            <Icon name="chevron" size={13} className="vault-chevron" />
          </button>
          {vaultMenu ? (
            <div className="vault-popover">
              <div>
                <span className="status-dot status-dot-green" />
                <strong>Stored locally</strong>
              </div>
              <p title={vault.path}>{vault.path}</p>
              <button onClick={onCloseVault}>Close vault…</button>
            </div>
          ) : null}
        </div>

        <button className="quick-search" onClick={onOpenPalette}>
          <Icon name="search" size={15} />
          <span>Quick switcher</span>
          <kbd>⌘ K</kbd>
        </button>

        <div className="sidebar-section-title">
          <span>{area === "notebook" ? "Files" : "Vault files"}</span>
          <button onClick={onCreate} aria-label="New record" title="New record">
            <Icon name="add" size={16} />
          </button>
        </div>

        <label className="sidebar-filter">
          <Icon name="search" size={13} />
          <input
            value={query}
            onChange={(event) => updateQuery(event.target.value)}
            placeholder="Filter files…"
            aria-label="Filter files"
          />
          {query ? (
            <button onClick={() => updateQuery("")} aria-label="Clear search">
              <Icon name="close" size={12} />
            </button>
          ) : null}
        </label>

        <div className="file-tree-scroll">
          {query ? (
            <div className="sidebar-results">
              {searchResults.length ? (
                searchResults.map((hit) => (
                  <button key={hit.id} onClick={() => onOpenRecord(hit.path)}>
                    <Icon
                      name={
                        hit.recordType === "experiment"
                          ? "experiment"
                          : "document"
                      }
                    />
                    <span>
                      <strong>{hit.title}</strong>
                      <small>{hit.path}</small>
                    </span>
                  </button>
                ))
              ) : (
                <p>No matching notes</p>
              )}
            </div>
          ) : (
            <ul className="file-tree">
              {tree.map((node) => (
                <TreeItem
                  key={node.path}
                  node={node}
                  depth={0}
                  activePath={activePath}
                  onOpen={onOpenRecord}
                />
              ))}
            </ul>
          )}
        </div>

        <div className="sidebar-footer">
          <button onClick={onCreate}>
            <Icon name="add" size={15} />
            New record
            <kbd>⌘ N</kbd>
          </button>
          <span>
            <span className="status-dot status-dot-green" />
            Indexed locally
          </span>
        </div>
      </aside>
    </>
  );
}
