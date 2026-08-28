import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  createBiotaId,
  formatBiotaSheetBlock,
  sanitizeFilename,
  stringifyFrontmatterYaml,
  type ExperimentStatus,
} from "@biota/vault";
import { Icon } from "@/components/Icon";
import type { MarkdownEditorHandle } from "@/components/MarkdownEditor";
import { desktopApi } from "@/lib/desktop-api";
import {
  extractTasks,
  extractWikilinks,
  parseFrontmatter,
  titleFromPath,
} from "@/lib/records";
import type {
  EditorMode,
  HistoryRevision,
  SearchHit,
  WorkspaceTab,
} from "@/types";

const MarkdownEditor = lazy(() =>
  import("@/components/MarkdownEditor").then((module) => ({
    default: module.MarkdownEditor,
  }))
);
const MarkdownPreview = lazy(() =>
  import("@/components/MarkdownPreview").then((module) => ({
    default: module.MarkdownPreview,
  }))
);

interface NotebookWorkspaceProps {
  tab?: WorkspaceTab;
  editorMode: EditorMode;
  inspectorOpen: boolean;
  backlinks: SearchHit[];
  onEditorModeChange: (mode: EditorMode) => void;
  onChange: (content: string) => void;
  onSave: () => void;
  onOpenWikilink: (target: string) => void;
  onCreate: () => void;
  onFinalize: () => Promise<void>;
  onStatusChange: (status: ExperimentStatus) => Promise<void>;
  onCreateRevision: () => Promise<void>;
  onRestoreRevision: (revisionId: string) => Promise<void>;
  onResolveConflict: (strategy: "local" | "external") => void;
  onNotify: (message: string) => void;
}

function formatRelativeTime(value: string) {
  const delta = Date.now() - new Date(value).getTime();
  if (delta < 60_000) return "just now";
  if (delta < 3_600_000)
    return `${Math.max(1, Math.floor(delta / 60_000))}m ago`;
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)}h ago`;
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function SaveCopy({ tab }: { tab: WorkspaceTab }) {
  if (tab.saveState === "saving") return <>Saving locally…</>;
  if (tab.saveState === "dirty") return <>Unsaved changes</>;
  if (tab.saveState === "conflict") return <>External conflict</>;
  if (tab.saveState === "error") return <>Save failed</>;
  return (
    <>
      <Icon name="check" size={12} /> Saved locally
    </>
  );
}

function EmptyNotebook({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="workspace-empty">
      <div className="empty-illustration">
        <Icon name="notebook" size={37} />
        <span className="empty-spark spark-one" />
        <span className="empty-spark spark-two" />
      </div>
      <p className="eyebrow">YOUR LAB NOTEBOOK</p>
      <h2>Make the work traceable.</h2>
      <p>
        Open a record from the vault, or begin a new experiment. Every change
        stays local and recoverable.
      </p>
      <button className="button button-primary" onClick={onCreate}>
        <Icon name="add" size={16} /> New record
      </button>
      <div className="empty-shortcuts">
        <span>
          <kbd>⌘K</kbd> Quick switcher
        </span>
        <span>
          <kbd>⌘N</kbd> New record
        </span>
      </div>
    </div>
  );
}

export function NotebookWorkspace({
  tab,
  editorMode,
  inspectorOpen,
  backlinks,
  onEditorModeChange,
  onChange,
  onSave,
  onOpenWikilink,
  onCreate,
  onFinalize,
  onStatusChange,
  onCreateRevision,
  onRestoreRevision,
  onResolveConflict,
  onNotify,
}: NotebookWorkspaceProps) {
  const [inspectorTab, setInspectorTab] = useState<
    "details" | "backlinks" | "history"
  >("details");
  const [history, setHistory] = useState<HistoryRevision[]>([]);
  const [checkpointing, setCheckpointing] = useState(false);
  const [insertingSheet, setInsertingSheet] = useState(false);
  const [sheetDialogOpen, setSheetDialogOpen] = useState(false);
  const [sheetTitle, setSheetTitle] = useState("Experiment calculations");
  const editorRef = useRef<MarkdownEditorHandle>(null);
  const parsed = useMemo(
    () => parseFrontmatter(tab?.content ?? ""),
    [tab?.content]
  );
  const links = useMemo(
    () => extractWikilinks(tab?.content ?? ""),
    [tab?.content]
  );
  const tasks = useMemo(
    () => (tab ? extractTasks(tab.content, tab.path, tab.title) : []),
    [tab]
  );

  useEffect(() => {
    if (!tab || inspectorTab !== "history") return;
    let current = true;
    void desktopApi.listHistory(tab.path).then((revisions) => {
      if (current) setHistory(revisions);
    });
    return () => {
      current = false;
    };
  }, [inspectorTab, tab?.finalized, tab?.hash, tab?.path]);

  if (!tab) return <EmptyNotebook onCreate={onCreate} />;

  const status =
    typeof parsed.data.status === "string"
      ? parsed.data.status
      : tab.recordType;
  const tags = Array.isArray(parsed.data.tags) ? parsed.data.tags : [];
  const bodyWords = parsed.body.trim()
    ? parsed.body.trim().split(/\s+/).length
    : 0;

  async function createCheckpoint() {
    if (!tab) return;
    const label = window.prompt("Checkpoint name", "Working checkpoint");
    if (!label?.trim()) return;
    setCheckpointing(true);
    try {
      await desktopApi.checkpoint(tab.path, label.trim());
      setHistory(await desktopApi.listHistory(tab.path));
      setInspectorTab("history");
    } finally {
      setCheckpointing(false);
    }
  }

  async function insertSpreadsheet(requestedTitle: string) {
    if (!tab || tab.finalized || insertingSheet) return;
    const title = requestedTitle.trim() || "Untitled spreadsheet";
    const sheetId = createBiotaId();
    const filename = sanitizeFilename(title, "Spreadsheet");
    const directory = `Data/Sheets/${sheetId}`;
    const dataPath = `${directory}/${filename}.csv`;
    const schemaPath = `${directory}/${filename}.sheet.yaml`;
    const now = new Date().toISOString();
    const csv = [
      "Column 1,Column 2,Column 3,Result",
      ",,,",
      ",,,",
      ",,,",
      ",,,",
      ",,,",
    ].join("\n");
    const schema = `${stringifyFrontmatterYaml({
      biota_sheet_schema: 1,
      sheet_id: sheetId,
      title,
      modified: now,
      calculation: {
        engine: "univer",
        engine_version: "0.25.1",
        mode: "automatic",
        locale: "en-US",
      },
      formulas: {},
      workbook: {},
    })}\n`;
    const block = formatBiotaSheetBlock({
      id: sheetId,
      title,
      data: dataPath,
      schema: schemaPath,
    });

    setInsertingSheet(true);
    try {
      await desktopApi.writeSheet({
        ownerPath: tab.path,
        dataPath,
        schemaPath,
        dataContent: `${csv}\n`,
        schemaContent: schema,
      });
      if (editorRef.current) {
        editorRef.current.insertText(block);
      } else {
        onChange(`${tab.content.replace(/\s*$/, "")}\n\n${block}\n`);
      }
      window.setTimeout(() => onEditorModeChange("read"), 0);
      setSheetDialogOpen(false);
      onNotify(
        `"${title}" was inserted. Its CSV and schema live in ${directory}.`
      );
    } catch (caught) {
      onNotify(
        caught instanceof Error
          ? caught.message
          : "The spreadsheet could not be created."
      );
    } finally {
      setInsertingSheet(false);
    }
  }

  return (
    <div
      className={`notebook-workspace ${inspectorOpen ? "with-inspector" : ""}`}
      data-record={tab.path}
    >
      <section className={`record-pane ${tab.conflict ? "has-conflict" : ""}`}>
        <header className="record-toolbar">
          <div className="record-breadcrumb">
            <span>{tab.path.split("/")[0]}</span>
            <Icon name="chevron" size={11} />
            <strong>{titleFromPath(tab.path)}</strong>
          </div>
          <div className="record-toolbar-center">
            <button
              className="insert-sheet-button"
              onClick={() => {
                setSheetTitle("Experiment calculations");
                setSheetDialogOpen(true);
              }}
              aria-label="Insert spreadsheet"
              title="Insert an Excel-like spreadsheet at the cursor"
              disabled={tab.finalized || insertingSheet}
            >
              <Icon name="table" size={14} />
              <span>{insertingSheet ? "Adding…" : "Spreadsheet"}</span>
            </button>
            <div className="segmented-control" aria-label="Editor mode">
              <button
                className={editorMode === "edit" ? "is-active" : ""}
                onClick={() => onEditorModeChange("edit")}
                aria-label="Edit"
                title="Edit"
              >
                <Icon name="edit" size={14} />
              </button>
              <button
                className={editorMode === "split" ? "is-active" : ""}
                onClick={() => onEditorModeChange("split")}
                aria-label="Split view"
                title="Split view"
              >
                <Icon name="split" size={14} />
              </button>
              <button
                className={editorMode === "read" ? "is-active" : ""}
                onClick={() => onEditorModeChange("read")}
                aria-label="Live preview"
                title="Live preview — edit formatted Markdown directly"
              >
                <Icon name="document" size={14} />
              </button>
            </div>
          </div>
          <div className="record-toolbar-actions">
            <span className="save-copy">
              <SaveCopy tab={tab} />
            </span>
            <button
              className="toolbar-button"
              onClick={onSave}
              title="Save now (⌘S)"
            >
              Save
            </button>
            <button
              className="icon-button"
              onClick={() => void createCheckpoint()}
              title="Create checkpoint"
              aria-label="Create checkpoint"
              disabled={checkpointing}
            >
              <Icon name="history" size={16} />
            </button>
          </div>
        </header>

        {sheetDialogOpen ? (
          <div
            className="sheet-dialog-backdrop"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget && !insertingSheet) {
                setSheetDialogOpen(false);
              }
            }}
          >
            <form
              className="sheet-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="sheet-dialog-title"
              onSubmit={(event) => {
                event.preventDefault();
                void insertSpreadsheet(sheetTitle);
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape" && !insertingSheet) {
                  setSheetDialogOpen(false);
                }
              }}
            >
              <span className="sheet-dialog-mark">
                <Icon name="table" size={18} />
              </span>
              <div>
                <p className="eyebrow">EMBEDDED SPREADSHEET</p>
                <h2 id="sheet-dialog-title">Insert a local spreadsheet</h2>
                <p>
                  The grid appears here in the entry. Values stay in CSV and
                  formulas, formatting, and validation stay in a readable YAML
                  sidecar.
                </p>
                <label htmlFor="sheet-title-input">Spreadsheet name</label>
                <input
                  id="sheet-title-input"
                  autoFocus
                  value={sheetTitle}
                  onChange={(event) => setSheetTitle(event.target.value)}
                  onFocus={(event) => event.currentTarget.select()}
                  disabled={insertingSheet}
                />
                <div className="sheet-dialog-actions">
                  <button
                    type="button"
                    className="button button-quiet"
                    onClick={() => setSheetDialogOpen(false)}
                    disabled={insertingSheet}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="button button-primary"
                    disabled={insertingSheet}
                  >
                    <Icon name="table" size={14} />
                    {insertingSheet ? "Creating…" : "Insert spreadsheet"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        ) : null}

        {tab.conflict ? (
          <section
            className="conflict-resolution"
            aria-label="External edit conflict"
          >
            <div className="conflict-resolution-heading">
              <span className="conflict-mark">
                <Icon name="warning" size={16} />
              </span>
              <div>
                <strong>This file changed in another editor</strong>
                <p>
                  Compare the common base, your local text, and the external
                  file. Nothing will be overwritten until you choose.
                </p>
              </div>
              <button
                className="button button-quiet"
                onClick={() => onResolveConflict("external")}
              >
                Reload external
              </button>
              <button
                className="button button-primary"
                onClick={() => onResolveConflict("local")}
              >
                Keep mine as new revision
              </button>
            </div>
            <div className="conflict-three-way">
              <details>
                <summary>Common base</summary>
                <pre>{tab.conflict.baseContent}</pre>
              </details>
              <details open>
                <summary>Your local edits</summary>
                <pre>{tab.content}</pre>
              </details>
              <details>
                <summary>External version</summary>
                <pre>{tab.conflict.externalContent}</pre>
              </details>
            </div>
          </section>
        ) : null}

        <div className={`editor-surface mode-${editorMode}`}>
          <Suspense
            fallback={
              <div className="editor-module-loading">
                Opening Markdown editor…
              </div>
            }
          >
            {editorMode !== "read" ? (
              <MarkdownEditor
                key={`${tab.id}-editor`}
                ref={editorRef}
                value={tab.content}
                onChange={onChange}
                readOnly={tab.finalized}
                presentation="source"
                recordPath={tab.path}
              />
            ) : (
              <MarkdownEditor
                key={`${tab.id}-editor`}
                ref={editorRef}
                value={tab.content}
                onChange={onChange}
                onOpenWikilink={onOpenWikilink}
                readOnly={tab.finalized}
                presentation="live"
                ariaLabel="Visual Markdown editor"
                recordPath={tab.path}
              />
            )}
            {editorMode === "split" ? (
              <MarkdownPreview
                markdown={tab.content}
                onOpenWikilink={onOpenWikilink}
              />
            ) : null}
          </Suspense>
          {tab.finalized ? (
            <div className="finalized-banner">
              <Icon name="archive" size={15} />
              <span>
                This record is finalized. Create a new revision to continue
                editing.
              </span>
              <button
                className="button button-secondary"
                onClick={() => void onCreateRevision()}
              >
                Create active revision
              </button>
            </div>
          ) : null}
        </div>

        <footer className="record-statusbar">
          <span>
            <span className="status-dot status-dot-green" />
            <SaveCopy tab={tab} />
          </span>
          <span>{bodyWords.toLocaleString()} words</span>
          <span>{links.length} links</span>
          <span>{tasks.filter((task) => !task.checked).length} open tasks</span>
          <span className="statusbar-spacer" />
          <span>{editorMode === "read" ? "Visual Markdown" : "Markdown"}</span>
          <span>UTF-8</span>
        </footer>
      </section>

      {inspectorOpen ? (
        <aside className="record-inspector">
          <div className="inspector-tabs">
            <button
              className={inspectorTab === "details" ? "is-active" : ""}
              onClick={() => setInspectorTab("details")}
            >
              Details
            </button>
            <button
              className={inspectorTab === "backlinks" ? "is-active" : ""}
              onClick={() => setInspectorTab("backlinks")}
            >
              Backlinks <span>{backlinks.length}</span>
            </button>
            <button
              className={inspectorTab === "history" ? "is-active" : ""}
              onClick={() => setInspectorTab("history")}
            >
              History
            </button>
          </div>

          <div className="inspector-scroll">
            {inspectorTab === "details" ? (
              <>
                <section className="inspector-section record-summary">
                  <div className={`record-type-mark type-${tab.recordType}`}>
                    <Icon
                      name={
                        tab.recordType === "experiment"
                          ? "experiment"
                          : "document"
                      }
                    />
                  </div>
                  <div>
                    <span className="inspector-kicker">{tab.recordType}</span>
                    <strong>{tab.title}</strong>
                    <small>{tab.path}</small>
                  </div>
                </section>
                <section className="inspector-section metadata-list">
                  <h3>Record</h3>
                  <dl>
                    <div>
                      <dt>Status</dt>
                      <dd>
                        <span className={`status-pill status-${status}`}>
                          {status}
                        </span>
                      </dd>
                    </div>
                    <div>
                      <dt>Created</dt>
                      <dd>{String(parsed.data.created ?? "—").slice(0, 10)}</dd>
                    </div>
                    <div>
                      <dt>Modified</dt>
                      <dd>{formatRelativeTime(tab.modifiedAt)}</dd>
                    </div>
                    <div>
                      <dt>Record ID</dt>
                      <dd className="mono-value">
                        {String(parsed.data.biota_id ?? "—")}
                      </dd>
                    </div>
                  </dl>
                </section>
                <section className="inspector-section">
                  <h3>Tags</h3>
                  <div className="tag-list">
                    {tags.length ? (
                      tags.map((tag) => (
                        <span key={tag}>
                          <Icon name="tag" size={11} /> {tag}
                        </span>
                      ))
                    ) : (
                      <button className="text-button">+ Add tag</button>
                    )}
                  </div>
                </section>
                <section className="inspector-section">
                  <h3>Outgoing links</h3>
                  <div className="link-list">
                    {links.map((link, index) => (
                      <button
                        key={`${link.target}-${link.alias ?? ""}-${index}`}
                        onClick={() => onOpenWikilink(link.target)}
                      >
                        <Icon name="link" size={13} />
                        <span>{link.alias ?? titleFromPath(link.target)}</span>
                      </button>
                    ))}
                  </div>
                </section>
                {tab.recordType === "experiment" ? (
                  <section className="inspector-section finalization-panel">
                    <h3>Experiment integrity</h3>
                    <p>
                      Finalizing records the file and linked sidecar hashes in a
                      sealed manifest.
                    </p>
                    <button
                      className="button button-secondary button-full"
                      onClick={() => {
                        if (tab.finalized) void onCreateRevision();
                        else if (status === "planned")
                          void onStatusChange("active");
                        else if (status === "active")
                          void onStatusChange("complete");
                        else void onFinalize();
                      }}
                      disabled={
                        !tab.finalized &&
                        status !== "planned" &&
                        status !== "active" &&
                        status !== "complete"
                      }
                    >
                      <Icon name="archive" size={14} />
                      {tab.finalized
                        ? "Create active revision"
                        : status === "planned"
                          ? "Start experiment"
                          : status === "active"
                            ? "Mark complete"
                            : "Finalize experiment"}
                    </button>
                  </section>
                ) : null}
              </>
            ) : null}

            {inspectorTab === "backlinks" ? (
              <section className="inspector-section backlink-panel">
                <div className="inspector-section-heading">
                  <h3>Linked mentions</h3>
                  <span>{backlinks.length}</span>
                </div>
                {backlinks.length ? (
                  backlinks.map((hit) => (
                    <button
                      key={hit.id}
                      onClick={() => onOpenWikilink(hit.path)}
                    >
                      <span className="backlink-icon">
                        <Icon name="document" size={14} />
                      </span>
                      <span>
                        <strong>{hit.title}</strong>
                        <small>{hit.excerpt || hit.path}</small>
                      </span>
                    </button>
                  ))
                ) : (
                  <div className="inspector-empty">
                    <Icon name="link" size={22} />
                    <strong>No backlinks yet</strong>
                    <span>
                      Link here from another note with [[{tab.title}]].
                    </span>
                  </div>
                )}
              </section>
            ) : null}

            {inspectorTab === "history" ? (
              <section className="inspector-section history-panel">
                <div className="inspector-section-heading">
                  <h3>Revision history</h3>
                  <button onClick={() => void createCheckpoint()}>
                    <Icon name="add" size={13} /> Checkpoint
                  </button>
                </div>
                <div className="history-timeline">
                  {history.map((revision, index) => (
                    <article key={revision.id}>
                      <span
                        className={`history-node ${index === 0 ? "is-current" : ""}`}
                      />
                      <div>
                        <strong>{revision.label ?? revision.kind}</strong>
                        <span>{formatRelativeTime(revision.createdAt)}</span>
                        <small>{revision.hash.slice(0, 20)}</small>
                      </div>
                      {index ? (
                        <button
                          onClick={() => void onRestoreRevision(revision.id)}
                          disabled={tab.finalized}
                          title={
                            tab.finalized
                              ? "Create an active revision before restoring history"
                              : "Restore this revision"
                          }
                        >
                          Restore
                        </button>
                      ) : (
                        <em>Current</em>
                      )}
                    </article>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        </aside>
      ) : null}
    </div>
  );
}
