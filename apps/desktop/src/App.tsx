import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  assertExperimentStatusTransition,
  extractRecordLinks,
  extractSidecarReferences,
  parseMarkdownRecord,
  stringifyMarkdownRecord,
  type ExperimentStatus,
} from "@biota/vault";
import { CommandPalette } from "@/components/CommandPalette";
import { CreateRecordDialog } from "@/components/CreateRecordDialog";
import { Icon } from "@/components/Icon";
import { NotebookWorkspace } from "@/components/NotebookWorkspace";
import { Onboarding } from "@/components/Onboarding";
import { Sidebar } from "@/components/Sidebar";
import { WorkspaceChrome } from "@/components/WorkspaceChrome";
import { desktopApi } from "@/lib/desktop-api";
import {
  createRecordMarkdown,
  inferRecordType,
  recordFolder,
  safeFileName,
  titleFromDocument,
  titleFromPath,
  toggleTaskInMarkdown,
  updateTaskStateInMarkdown,
} from "@/lib/records";
import type {
  BiotaTask,
  EditorMode,
  RecordType,
  SearchHit,
  TaskState,
  VaultFile,
  VaultInfo,
  WorkspaceArea,
  WorkspaceTab,
} from "@/types";

type BootState = "loading" | "ready" | "no-vault" | "error";

const AnalysisWorkspace = lazy(() =>
  import("@/components/AnalysisWorkspace").then((module) => ({
    default: module.AnalysisWorkspace,
  }))
);
const DnaWorkspace = lazy(() =>
  import("@/components/DnaWorkspace").then((module) => ({
    default: module.DnaWorkspace,
  }))
);
const GraphWorkspace = lazy(() =>
  import("@/components/GraphWorkspace").then((module) => ({
    default: module.GraphWorkspace,
  }))
);
const PlanningWorkspace = lazy(() =>
  import("@/components/PlanningWorkspace").then((module) => ({
    default: module.PlanningWorkspace,
  }))
);

function normalizeVaultPath(value: string) {
  const parts: string[] = [];
  for (const part of value.replaceAll("\\", "/").split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") {
      if (!parts.length) return undefined;
      parts.pop();
    } else {
      parts.push(part);
    }
  }
  return parts.join("/");
}

function resolveVaultReference(
  target: string,
  recordPath: string,
  knownPaths: Set<string>,
  markdown = false
) {
  const cleaned = target.trim().replace(/^<|>$/g, "").split(/[?#]/, 1)[0];
  if (
    !cleaned ||
    cleaned.startsWith("/") ||
    /^[a-z][a-z0-9+.-]*:/i.test(cleaned)
  ) {
    return undefined;
  }

  const variants =
    markdown && !/\.[a-z0-9]+$/i.test(cleaned)
      ? [cleaned, `${cleaned}.md`]
      : [cleaned];
  const recordDirectory = recordPath.includes("/")
    ? recordPath.slice(0, recordPath.lastIndexOf("/"))
    : "";

  for (const variant of variants) {
    const direct = normalizeVaultPath(variant);
    const relative = normalizeVaultPath(`${recordDirectory}/${variant}`);
    if (direct && knownPaths.has(direct)) return direct;
    if (relative && knownPaths.has(relative)) return relative;
  }

  // Return the conventionally resolved path even when it is missing so the
  // native finalizer fails closed instead of silently omitting a dependency.
  const first = variants[0]!;
  if (
    /^(?:Sequences|Data|Attachments|Analyses|Protocols|Entities)\//i.test(first)
  ) {
    return normalizeVaultPath(first);
  }
  return normalizeVaultPath(`${recordDirectory}/${first}`);
}

function finalizationDependencies(
  markdown: string,
  recordPath: string,
  files: VaultFile[]
) {
  const record = parseMarkdownRecord(markdown, recordPath);
  const knownPaths = new Set(
    files.filter((file) => file.kind === "file").map((file) => file.path)
  );
  const dependencies = new Set<string>();

  for (const reference of extractSidecarReferences(record)) {
    const resolved = resolveVaultReference(
      reference.path,
      recordPath,
      knownPaths
    );
    if (resolved && resolved !== recordPath) dependencies.add(resolved);
  }

  // Protocol and entity records are also captured so a finalized experiment
  // keeps the exact versions it was run against.
  for (const link of extractRecordLinks(record)) {
    const resolved = resolveVaultReference(
      link.targetPath,
      recordPath,
      knownPaths,
      true
    );
    if (
      resolved &&
      resolved !== recordPath &&
      /^(?:Protocols|Entities)\//i.test(resolved)
    ) {
      dependencies.add(resolved);
    }
  }

  return [...dependencies].sort();
}

function withExperimentStatus(markdown: string, status: ExperimentStatus) {
  const record = parseMarkdownRecord(markdown);
  if (record.frontmatter.biota_type !== "experiment") {
    throw new Error("Only experiment records have an experiment status.");
  }
  record.frontmatter = {
    ...record.frontmatter,
    status,
    modified: new Date().toISOString(),
  };
  return stringifyMarkdownRecord(record);
}

function LoadingScreen() {
  return (
    <main className="loading-screen">
      <div className="loading-mark">
        <span />
        <span />
        <span />
      </div>
      <strong>Biota</strong>
      <p>Opening your local workspace…</p>
    </main>
  );
}

export default function App() {
  const [bootState, setBootState] = useState<BootState>("loading");
  const [vault, setVault] = useState<VaultInfo | null>(null);
  const [files, setFiles] = useState<VaultFile[]>([]);
  const [tabs, setTabs] = useState<WorkspaceTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>();
  const [area, setArea] = useState<WorkspaceArea>("notebook");
  const [editorMode, setEditorMode] = useState<EditorMode>("read");
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchHit[]>([]);
  const [backlinks, setBacklinks] = useState<SearchHit[]>([]);
  const [tasks, setTasks] = useState<BiotaTask[]>([]);
  const [selectedAssetPath, setSelectedAssetPath] = useState<string>();
  const [toast, setToast] = useState("");
  const searchRequest = useRef(0);
  const firstOpenDone = useRef(false);
  const tabsRef = useRef<WorkspaceTab[]>([]);

  const activeTab = useMemo(
    () => tabs.find((tab) => tab.id === activeTabId),
    [activeTabId, tabs]
  );

  useEffect(() => {
    tabsRef.current = tabs;
  }, [tabs]);

  const refreshMetadata = useCallback(async () => {
    try {
      const metadata = await desktopApi.searchMetadata({
        query: "",
        includeTasks: true,
        limit: 500,
      });
      setTasks(metadata.tasks);
    } catch {
      setTasks([]);
    }
  }, []);

  const scanVault = useCallback(async () => {
    const scan = await desktopApi.scanVault();
    setFiles(scan.files);
    await refreshMetadata();
    return scan.files;
  }, [refreshMetadata]);

  const openRecord = useCallback(
    async (pathOrTarget: string) => {
      const cleanTarget = pathOrTarget.replace(/^\[\[|\]\]$/g, "");
      const exact = files.find((file) => file.path === cleanTarget);
      const withMarkdown = files.find(
        (file) => file.path === `${cleanTarget}.md`
      );
      const byStem = files.find(
        (file) =>
          titleFromPath(file.path).toLowerCase() ===
          titleFromPath(cleanTarget).toLowerCase()
      );
      const path = (exact ?? withMarkdown ?? byStem)?.path ?? cleanTarget;

      if (/\.(gb|gbk|genbank|fasta|fa|fna|ffn|faa|frn|dna|ab1)$/i.test(path)) {
        setSelectedAssetPath(path);
        setArea("dna");
        return;
      }
      if (/\.csv$/i.test(path)) {
        setSelectedAssetPath(path);
        setArea("analysis");
        return;
      }

      const existing = tabs.find((tab) => tab.path === path);
      if (existing) {
        setActiveTabId(existing.id);
        setArea("notebook");
        return;
      }

      try {
        const document = await desktopApi.readRecord(path);
        const id = document.biotaId ?? document.path;
        const tab: WorkspaceTab = {
          ...document,
          id,
          title:
            document.title ??
            titleFromDocument(document.path, document.content),
          recordType:
            document.recordType ??
            inferRecordType(document.path, document.content),
          saveState: "clean",
          baseContent: document.content,
        };
        setTabs((current) => [...current, tab]);
        setActiveTabId(id);
        setArea("notebook");
      } catch (caught) {
        setToast(
          caught instanceof Error ? caught.message : `Could not open ${path}`
        );
      }
    },
    [files, tabs]
  );

  useEffect(() => {
    let current = true;
    async function boot() {
      try {
        const currentVault = await desktopApi.currentVault();
        if (!current) return;
        if (!currentVault) {
          setBootState("no-vault");
          return;
        }
        setVault(currentVault);
        const scannedFiles = await scanVault();
        if (!current) return;
        setBootState("ready");
        const initial =
          scannedFiles.find(
            (file) => file.path === "Experiments/Dose-response pilot.md"
          ) ??
          scannedFiles.find(
            (file) => file.kind === "file" && file.path.endsWith(".md")
          );
        if (initial && !firstOpenDone.current) {
          firstOpenDone.current = true;
          window.setTimeout(() => void openRecord(initial.path), 0);
        }
      } catch (caught) {
        if (!current) return;
        setToast(
          caught instanceof Error ? caught.message : "Biota could not start."
        );
        setBootState("error");
      }
    }
    void boot();
    return () => {
      current = false;
    };
    // Opening the selected vault is an application lifecycle action, not a
    // response to tab changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanVault]);

  useEffect(() => {
    if (bootState !== "ready") return;
    let disposed = false;
    let timer: number | undefined;
    let unlisten: (() => void) | undefined;

    void desktopApi
      .watchVault((event) => {
        window.clearTimeout(timer);
        timer = window.setTimeout(() => {
          if (disposed) return;
          void scanVault();
          const changedTabs = tabsRef.current.filter((tab) =>
            event.paths.some((path) => path === tab.path)
          );
          void Promise.all(
            changedTabs.map(async (tab) => {
              try {
                const disk = await desktopApi.readRecord(tab.path);
                setTabs((current) =>
                  current.map((currentTab) => {
                    if (
                      currentTab.id !== tab.id ||
                      currentTab.hash === disk.hash
                    ) {
                      return currentTab;
                    }
                    if (
                      currentTab.saveState === "dirty" ||
                      currentTab.saveState === "conflict"
                    ) {
                      return {
                        ...currentTab,
                        saveState: "conflict",
                        conflict: {
                          baseContent:
                            currentTab.baseContent ?? currentTab.content,
                          externalContent: disk.content,
                          externalHash: disk.hash,
                          externalModifiedAt: disk.modifiedAt,
                        },
                      };
                    }
                    if (currentTab.saveState === "saving") return currentTab;
                    return {
                      ...currentTab,
                      ...disk,
                      title:
                        disk.title ??
                        titleFromDocument(disk.path, disk.content),
                      recordType:
                        disk.recordType ??
                        inferRecordType(disk.path, disk.content),
                      saveState: "clean",
                      baseContent: disk.content,
                      conflict: undefined,
                    };
                  })
                );
              } catch {
                // A move/delete is reflected by the refreshed navigator. Keep
                // an open tab intact so unsaved user text remains recoverable.
              }
            })
          );
        }, 240);
      })
      .then((stop) => {
        if (disposed) stop();
        else unlisten = stop;
      });

    return () => {
      disposed = true;
      window.clearTimeout(timer);
      unlisten?.();
    };
  }, [bootState, scanVault]);

  useEffect(() => {
    if (!activeTab) {
      setBacklinks([]);
      return;
    }
    let current = true;
    void desktopApi
      .searchMetadata({
        query: activeTab.title,
        limit: 30,
      })
      .then((result) => {
        if (current)
          setBacklinks(
            result.hits.filter((hit) => hit.path !== activeTab.path)
          );
      })
      .catch(() => {
        if (current) setBacklinks([]);
      });
    return () => {
      current = false;
    };
  }, [activeTab?.path, activeTab?.title]);

  const saveTab = useCallback(
    async (id: string) => {
      const snapshot = tabs.find((tab) => tab.id === id);
      if (
        !snapshot ||
        snapshot.saveState === "saving" ||
        snapshot.saveState === "conflict" ||
        snapshot.finalized
      ) {
        return;
      }
      setTabs((current) =>
        current.map((tab) =>
          tab.id === id ? { ...tab, saveState: "saving" } : tab
        )
      );
      try {
        const result = await desktopApi.writeRecord({
          path: snapshot.path,
          content: snapshot.content,
          expectedHash: snapshot.hash || undefined,
          reason: "autosave",
        });
        setTabs((current) =>
          current.map((tab) =>
            tab.id === id
              ? {
                  ...tab,
                  hash: result.hash,
                  modifiedAt: result.modifiedAt,
                  baseContent: snapshot.content,
                  conflict: undefined,
                  saveState:
                    tab.content === snapshot.content ? "saved" : "dirty",
                }
              : tab
          )
        );
        void refreshMetadata();
      } catch (caught) {
        const isConflict =
          caught instanceof Error &&
          caught.message.toLowerCase().includes("conflict");
        let disk: Awaited<ReturnType<typeof desktopApi.readRecord>> | undefined;
        if (isConflict) {
          try {
            disk = await desktopApi.readRecord(snapshot.path);
          } catch {
            // Preserve the local text even if the external file disappeared.
          }
        }
        setTabs((current) =>
          current.map((tab) =>
            tab.id === id
              ? {
                  ...tab,
                  saveState: isConflict ? "conflict" : "error",
                  conflict:
                    isConflict && disk
                      ? {
                          baseContent: snapshot.baseContent ?? snapshot.content,
                          externalContent: disk.content,
                          externalHash: disk.hash,
                          externalModifiedAt: disk.modifiedAt,
                        }
                      : tab.conflict,
                }
              : tab
          )
        );
        setToast(
          isConflict
            ? "This file changed outside Biota. Your local edits were kept for review."
            : "Biota could not save this record."
        );
      }
    },
    [refreshMetadata, tabs]
  );

  useEffect(() => {
    if (!activeTab || activeTab.saveState !== "dirty") return;
    const timeout = window.setTimeout(() => void saveTab(activeTab.id), 850);
    return () => window.clearTimeout(timeout);
  }, [activeTab?.content, activeTab?.id, activeTab?.saveState, saveTab]);

  const runSearch = useCallback(async (query: string) => {
    const requestId = ++searchRequest.current;
    try {
      const result = await desktopApi.searchMetadata({ query, limit: 40 });
      if (requestId === searchRequest.current) setSearchResults(result.hits);
    } catch {
      if (requestId === searchRequest.current) setSearchResults([]);
    }
  }, []);

  useEffect(() => {
    function handleKeydown(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey)) return;
      if (event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen(true);
      }
      if (event.key.toLowerCase() === "n") {
        event.preventDefault();
        setCreateOpen(true);
      }
      if (event.key.toLowerCase() === "s" && activeTabId) {
        event.preventDefault();
        void saveTab(activeTabId);
      }
    }
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [activeTabId, saveTab]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 4200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  async function activateVault(nextVault: VaultInfo) {
    setVault(nextVault);
    setBootState("loading");
    firstOpenDone.current = false;
    try {
      const scannedFiles = await scanVault();
      setBootState("ready");
      const first = scannedFiles.find(
        (file) => file.kind === "file" && file.path.endsWith(".md")
      );
      if (first) void openRecord(first.path);
    } catch (caught) {
      setToast(
        caught instanceof Error
          ? caught.message
          : "The vault could not be indexed."
      );
      setBootState("error");
    }
  }

  async function closeVault() {
    await desktopApi.closeVault();
    setVault(null);
    setFiles([]);
    setTabs([]);
    setTasks([]);
    setActiveTabId(undefined);
    setBootState("no-vault");
  }

  async function createRecord(type: RecordType, title: string) {
    const basePath = `${recordFolder(type)}/${safeFileName(title)}.md`;
    const path = files.some((file) => file.path === basePath)
      ? `${recordFolder(type)}/${safeFileName(title)} ${Date.now()}.md`
      : basePath;
    const content = createRecordMarkdown(type, title);
    const result = await desktopApi.writeRecord({
      path,
      content,
      reason: "create",
    });
    setFiles(await scanVault());
    const tab: WorkspaceTab = {
      id: /biota_id:\s*(.+)/.exec(content)?.[1] ?? path,
      path,
      content,
      hash: result.hash,
      modifiedAt: result.modifiedAt,
      title,
      recordType: type,
      saveState: "saved",
      baseContent: content,
    };
    setTabs((current) => [...current, tab]);
    setActiveTabId(tab.id);
    setArea("notebook");
    setToast(`${title} created in ${recordFolder(type)}.`);
  }

  async function updateTask(
    task: BiotaTask,
    transform: (markdown: string) => string
  ) {
    try {
      const openTab = tabs.find((tab) => tab.path === task.recordPath);
      const document =
        openTab ?? (await desktopApi.readRecord(task.recordPath));
      const content = transform(document.content);
      const result = await desktopApi.writeRecord({
        path: document.path,
        content,
        expectedHash: document.hash || undefined,
        reason: "task-update",
      });
      setTabs((current) =>
        current.map((tab) =>
          tab.path === task.recordPath
            ? {
                ...tab,
                content,
                hash: result.hash,
                modifiedAt: result.modifiedAt,
                saveState: "saved",
                baseContent: content,
                conflict: undefined,
              }
            : tab
        )
      );
      await refreshMetadata();
    } catch (caught) {
      setToast(
        caught instanceof Error
          ? caught.message
          : "The task could not be updated."
      );
    }
  }

  async function finalizeActive() {
    if (!activeTab) return;
    if (activeTab.saveState === "conflict") {
      setToast("Resolve the external edit conflict before finalizing.");
      return;
    }
    try {
      const parsed = parseMarkdownRecord(activeTab.content, activeTab.path);
      if (parsed.frontmatter.status !== "complete") {
        setToast("Mark the experiment complete before finalizing it.");
        return;
      }
      const content = withExperimentStatus(activeTab.content, "finalized");
      const dependencies = finalizationDependencies(
        content,
        activeTab.path,
        files
      );
      const existingPaths = new Set(
        files.filter((file) => file.kind === "file").map((file) => file.path)
      );
      const missing = dependencies.filter((path) => !existingPaths.has(path));
      if (missing.length) {
        throw new Error(
          `Finalization stopped because ${missing[0]} is missing from the vault.`
        );
      }
      const saved = await desktopApi.writeRecord({
        path: activeTab.path,
        content,
        expectedHash: activeTab.hash || undefined,
        reason: "manual",
      });
      await desktopApi.finalize(activeTab.path, dependencies);
      setTabs((current) =>
        current.map((tab) =>
          tab.id === activeTab.id
            ? {
                ...tab,
                content,
                hash: saved.hash,
                modifiedAt: saved.modifiedAt,
                baseContent: content,
                conflict: undefined,
                finalized: true,
                saveState: "saved",
              }
            : tab
        )
      );
      setToast(
        `Experiment finalized with ${dependencies.length + 1} content-hash manifest ${dependencies.length ? "entries" : "entry"}.`
      );
    } catch (caught) {
      setToast(
        caught instanceof Error ? caught.message : "Finalization failed."
      );
    }
  }

  async function transitionActiveExperiment(status: ExperimentStatus) {
    if (!activeTab || activeTab.recordType !== "experiment") return;
    try {
      const record = parseMarkdownRecord(activeTab.content, activeTab.path);
      const current = record.frontmatter.status;
      if (typeof current !== "string") {
        throw new Error(
          "This experiment does not have a valid current status."
        );
      }
      assertExperimentStatusTransition(current as ExperimentStatus, status);
      const content = withExperimentStatus(activeTab.content, status);
      const result = await desktopApi.writeRecord({
        path: activeTab.path,
        content,
        expectedHash: activeTab.hash || undefined,
        reason: "manual",
      });
      setTabs((allTabs) =>
        allTabs.map((tab) =>
          tab.id === activeTab.id
            ? {
                ...tab,
                content,
                hash: result.hash,
                modifiedAt: result.modifiedAt,
                baseContent: content,
                conflict: undefined,
                saveState: "saved",
              }
            : tab
        )
      );
      setToast(`Experiment is now ${status}.`);
      await refreshMetadata();
    } catch (caught) {
      setToast(
        caught instanceof Error ? caught.message : "Status update failed."
      );
    }
  }

  async function createActiveRevision() {
    if (!activeTab?.finalized) return;
    try {
      await desktopApi.createRevision(activeTab.path);
      const content = withExperimentStatus(activeTab.content, "active");
      const result = await desktopApi.writeRecord({
        path: activeTab.path,
        content,
        expectedHash: activeTab.hash || undefined,
        reason: "manual",
      });
      setTabs((current) =>
        current.map((tab) =>
          tab.id === activeTab.id
            ? {
                ...tab,
                content,
                hash: result.hash,
                modifiedAt: result.modifiedAt,
                baseContent: content,
                finalized: false,
                saveState: "saved",
              }
            : tab
        )
      );
      setToast("A new active revision is ready for editing.");
    } catch (caught) {
      setToast(
        caught instanceof Error ? caught.message : "Could not open a revision."
      );
    }
  }

  async function restoreActiveRevision(revisionId: string) {
    if (!activeTab) return;
    try {
      const restored = await desktopApi.restore(activeTab.path, revisionId);
      setTabs((current) =>
        current.map((tab) =>
          tab.id === activeTab.id
            ? {
                ...tab,
                ...restored,
                title: restored.title ?? tab.title,
                recordType: restored.recordType ?? tab.recordType,
                baseContent: restored.content,
                conflict: undefined,
                saveState: "saved",
              }
            : tab
        )
      );
      setToast("The selected revision was restored.");
      await refreshMetadata();
    } catch (caught) {
      setToast(caught instanceof Error ? caught.message : "Restore failed.");
    }
  }

  function resolveActiveConflict(strategy: "local" | "external") {
    if (!activeTab?.conflict) return;
    const conflict = activeTab.conflict;
    setTabs((current) =>
      current.map((tab) => {
        if (tab.id !== activeTab.id) return tab;
        if (strategy === "external") {
          return {
            ...tab,
            content: conflict.externalContent,
            hash: conflict.externalHash,
            modifiedAt: conflict.externalModifiedAt,
            baseContent: conflict.externalContent,
            conflict: undefined,
            saveState: "clean",
          };
        }
        return {
          ...tab,
          hash: conflict.externalHash,
          modifiedAt: conflict.externalModifiedAt,
          baseContent: conflict.externalContent,
          conflict: undefined,
          saveState: "dirty",
        };
      })
    );
    setToast(
      strategy === "external"
        ? "Reloaded the external version."
        : "Your version will be saved as a new revision."
    );
  }

  if (bootState === "loading") return <LoadingScreen />;

  if (bootState === "no-vault" || !vault) {
    return (
      <Onboarding
        onOpen={desktopApi.chooseAndOpenVault}
        onCreate={desktopApi.chooseAndCreateVault}
        onReady={(nextVault) => void activateVault(nextVault)}
      />
    );
  }

  if (bootState === "error") {
    return (
      <main className="fatal-screen">
        <Icon name="warning" size={28} />
        <h1>Biota could not open this vault.</h1>
        <p>{toast || "The local workspace is unavailable."}</p>
        <button
          className="button button-primary"
          onClick={() => void closeVault()}
        >
          Choose another vault
        </button>
      </main>
    );
  }

  return (
    <div className="desktop-shell">
      <Sidebar
        vault={vault}
        area={area}
        files={files}
        activePath={activeTab?.path}
        searchResults={searchResults}
        onAreaChange={setArea}
        onOpenRecord={(path) => void openRecord(path)}
        onCreate={() => setCreateOpen(true)}
        onSearch={(query) => void runSearch(query)}
        onOpenPalette={() => setPaletteOpen(true)}
        onCloseVault={() => void closeVault()}
      />
      <div className="workspace-shell">
        <WorkspaceChrome
          tabs={tabs}
          activeTabId={activeTabId}
          inspectorOpen={inspectorOpen}
          onActivateTab={(id) => {
            setActiveTabId(id);
            setArea("notebook");
          }}
          onCloseTab={(id) => {
            const index = tabs.findIndex((tab) => tab.id === id);
            const nextTabs = tabs.filter((tab) => tab.id !== id);
            setTabs(nextTabs);
            if (activeTabId === id) {
              setActiveTabId(nextTabs[Math.max(0, index - 1)]?.id);
            }
          }}
          onToggleInspector={() => setInspectorOpen((value) => !value)}
          onOpenPalette={() => setPaletteOpen(true)}
        />
        <div className="workspace-content">
          <Suspense
            fallback={
              <div className="workspace-module-loading">
                Opening local workspace…
              </div>
            }
          >
            {area === "notebook" ? (
              <NotebookWorkspace
                tab={activeTab}
                editorMode={editorMode}
                inspectorOpen={inspectorOpen}
                backlinks={backlinks}
                onEditorModeChange={setEditorMode}
                onChange={(content) => {
                  if (!activeTabId) return;
                  setTabs((current) =>
                    current.map((tab) =>
                      tab.id === activeTabId
                        ? {
                            ...tab,
                            content,
                            saveState: tab.conflict ? "conflict" : "dirty",
                          }
                        : tab
                    )
                  );
                }}
                onSave={() => {
                  if (activeTabId) void saveTab(activeTabId);
                }}
                onOpenWikilink={(target) => void openRecord(target)}
                onCreate={() => setCreateOpen(true)}
                onFinalize={finalizeActive}
                onStatusChange={transitionActiveExperiment}
                onCreateRevision={createActiveRevision}
                onRestoreRevision={restoreActiveRevision}
                onResolveConflict={resolveActiveConflict}
                onNotify={setToast}
              />
            ) : null}
            {area === "planning" ? (
              <PlanningWorkspace
                tasks={tasks}
                onToggle={(task, checked) =>
                  void updateTask(task, (markdown) =>
                    toggleTaskInMarkdown(markdown, task.id, checked)
                  )
                }
                onMove={(task, state: TaskState) =>
                  void updateTask(task, (markdown) =>
                    updateTaskStateInMarkdown(markdown, task.id, state)
                  )
                }
                onOpenRecord={(path) => void openRecord(path)}
                onCreateRecord={() => setCreateOpen(true)}
              />
            ) : null}
            {area === "dna" ? <DnaWorkspace path={selectedAssetPath} /> : null}
            {area === "analysis" ? (
              <AnalysisWorkspace path={selectedAssetPath} />
            ) : null}
            {area === "graph" ? (
              <GraphWorkspace
                files={files}
                onOpenRecord={(path) => void openRecord(path)}
              />
            ) : null}
          </Suspense>
        </div>
      </div>

      <CommandPalette
        open={paletteOpen}
        results={searchResults}
        onQuery={runSearch}
        onClose={() => setPaletteOpen(false)}
        onOpenRecord={(path) => void openRecord(path)}
        onCreate={() => setCreateOpen(true)}
      />
      <CreateRecordDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={createRecord}
      />
      {toast ? (
        <div className="toast" role="status">
          <span className="toast-mark">
            <Icon
              name={toast.toLowerCase().includes("could") ? "warning" : "check"}
              size={14}
            />
          </span>
          {toast}
          <button onClick={() => setToast("")} aria-label="Dismiss">
            <Icon name="close" size={13} />
          </button>
        </div>
      ) : null}
    </div>
  );
}
