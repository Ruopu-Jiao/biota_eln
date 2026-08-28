import {
  demoVault,
  getMockRecord,
  getMockTextAsset,
  getMockTextAssetSnapshot,
  mockFiles,
  mockHistory,
  mockSearch,
  writeMockRecord,
  writeMockTextAsset,
} from "@/lib/mock-data";
import {
  extractTasks,
  extractWikilinks,
  inferRecordType,
  titleFromPath,
} from "@/lib/records";
import type {
  HistoryRevision,
  RecordDocument,
  RecordWriteInput,
  RecordWriteResult,
  SearchMetadataInput,
  SearchMetadataResult,
  VaultInfo,
  VaultScan,
} from "@/types";

type CommandName =
  | "vault_create"
  | "vault_open"
  | "vault_current"
  | "vault_close"
  | "vault_scan"
  | "record_read"
  | "record_write"
  | "record_move"
  | "sheet_read"
  | "sheet_write"
  | "file_read_binary"
  | "file_write_binary"
  | "history_checkpoint"
  | "history_create_revision"
  | "history_list"
  | "history_restore"
  | "history_finalize"
  | "search_metadata"
  | "task_list"
  | "analysis_run";

type InvokeArgs = Record<string, unknown> | undefined;

const mockLatency = 80;
let mockVaultOpen = true;

function waitForMock() {
  return new Promise((resolve) => window.setTimeout(resolve, mockLatency));
}

export function isDesktopRuntime() {
  return typeof window !== "undefined" && Boolean(window.__TAURI_INTERNALS__);
}

async function invokeCommand<T>(
  command: CommandName,
  args?: InvokeArgs
): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  try {
    return await invoke<T>(command, args);
  } catch (caught) {
    if (caught && typeof caught === "object") {
      const value = caught as Record<string, unknown>;
      if (typeof value.message === "string") {
        throw new Error(value.message);
      }
    }
    throw caught;
  }
}

function normalizeVault(raw: unknown): VaultInfo | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const manifest = (value.manifest ?? {}) as Record<string, unknown>;
  const path = String(
    value.path ??
      value.root ??
      value.rootPath ??
      value.root_path ??
      value.vault_path ??
      ""
  );
  if (!path) return null;
  return {
    id: String(
      value.id ??
        value.vault_id ??
        manifest.vaultId ??
        manifest.vault_id ??
        path
    ),
    name: String(
      value.name ?? manifest.name ?? path.split("/").at(-1) ?? "Biota Vault"
    ),
    path,
    schema: Number(
      value.schema ?? value.schema_version ?? manifest.schema ?? 1
    ),
    createdAt:
      typeof value.createdAt === "string"
        ? value.createdAt
        : typeof value.created_at === "string"
          ? value.created_at
          : typeof manifest.created === "string"
            ? manifest.created
            : undefined,
  };
}

function normalizeDocument(raw: unknown, fallbackPath: string): RecordDocument {
  if (typeof raw === "string") {
    return {
      path: fallbackPath,
      content: raw,
      hash: "",
      modifiedAt: new Date().toISOString(),
    };
  }
  const value = (raw ?? {}) as Record<string, unknown>;
  const nested = (
    value.document && typeof value.document === "object"
      ? value.document
      : value
  ) as Record<string, unknown>;
  const summary = (
    nested.summary && typeof nested.summary === "object" ? nested.summary : {}
  ) as Record<string, unknown>;
  return {
    path: String(
      nested.path ?? nested.relativePath ?? nested.relative_path ?? fallbackPath
    ),
    content: String(nested.content ?? nested.markdown ?? ""),
    hash: String(
      nested.hash ?? nested.contentHash ?? nested.content_hash ?? ""
    ),
    modifiedAt: String(
      nested.modifiedAt ??
        nested.modified_at ??
        nested.modified ??
        new Date().toISOString()
    ),
    biotaId:
      typeof nested.biotaId === "string"
        ? nested.biotaId
        : typeof summary.biotaId === "string"
          ? summary.biotaId
          : typeof summary.biota_id === "string"
            ? summary.biota_id
            : undefined,
    recordType:
      typeof nested.recordType === "string"
        ? (nested.recordType as RecordDocument["recordType"])
        : typeof summary.recordType === "string"
          ? (summary.recordType as RecordDocument["recordType"])
          : typeof summary.record_type === "string"
            ? (summary.record_type as RecordDocument["recordType"])
            : undefined,
    title:
      typeof nested.title === "string"
        ? nested.title
        : typeof summary.title === "string"
          ? summary.title
          : undefined,
    finalized: Boolean(nested.finalized),
  };
}

function normalizeSearchHit(
  raw: unknown
): SearchMetadataResult["hits"][number] {
  const value = (raw ?? {}) as Record<string, unknown>;
  const path = String(
    value.path ?? value.relativePath ?? value.relative_path ?? ""
  );
  const rawRecordType = value.recordType ?? value.record_type;
  const recordType =
    typeof rawRecordType === "string"
      ? (rawRecordType as SearchMetadataResult["hits"][number]["recordType"])
      : inferRecordType(path);
  return {
    id: String(value.id ?? value.biotaId ?? value.biota_id ?? path),
    path,
    title: String(value.title ?? titleFromPath(path)),
    recordType,
    excerpt:
      typeof value.excerpt === "string"
        ? value.excerpt
        : typeof value.snippet === "string"
          ? value.snippet
          : undefined,
    score: typeof value.score === "number" ? value.score : undefined,
    tags: Array.isArray(value.tags) ? value.tags.map(String) : undefined,
  };
}

function normalizeHistoryEvent(raw: unknown): HistoryRevision {
  const value = (raw ?? {}) as Record<string, unknown>;
  const rawKind = String(value.kind ?? "autosave");
  const kind: HistoryRevision["kind"] =
    rawKind === "checkpoint"
      ? "checkpoint"
      : rawKind === "finalize" || rawKind === "finalization"
        ? "finalization"
        : rawKind === "restore"
          ? "restore"
          : "autosave";
  return {
    id: String(value.id ?? value.eventId ?? value.event_id ?? ""),
    hash: String(
      value.hash ??
        value.contentHash ??
        value.content_hash ??
        value.eventHash ??
        ""
    ),
    createdAt: String(
      value.createdAt ??
        value.created_at ??
        value.timestamp ??
        new Date().toISOString()
    ),
    label:
      typeof value.label === "string"
        ? value.label
        : typeof value.message === "string"
          ? value.message
          : undefined,
    kind,
    size: typeof value.size === "number" ? value.size : undefined,
  };
}

export interface SheetTextFile {
  path: string;
  content: string;
  hash: string;
}

export interface SheetBundle {
  ownerPath: string;
  data: SheetTextFile;
  schema: SheetTextFile;
}

export interface SheetWriteInput {
  ownerPath: string;
  dataPath: string;
  schemaPath: string;
  dataContent: string;
  schemaContent: string;
  expectedDataHash?: string;
  expectedSchemaHash?: string;
}

function normalizeSheetFile(raw: unknown, fallbackPath: string): SheetTextFile {
  const value = (raw ?? {}) as Record<string, unknown>;
  return {
    path: String(
      value.relativePath ?? value.relative_path ?? value.path ?? fallbackPath
    ),
    content: String(value.content ?? ""),
    hash: String(value.contentHash ?? value.content_hash ?? value.hash ?? ""),
  };
}

function normalizeSheetBundle(
  raw: unknown,
  ownerPath: string,
  dataPath: string,
  schemaPath: string
): SheetBundle {
  const value = (raw ?? {}) as Record<string, unknown>;
  return {
    ownerPath: String(
      value.ownerRelativePath ??
        value.owner_relative_path ??
        value.ownerPath ??
        ownerPath
    ),
    data: normalizeSheetFile(value.data, dataPath),
    schema: normalizeSheetFile(value.schema, schemaPath),
  };
}

async function chooseDirectory(title: string) {
  const { open } = await import("@tauri-apps/plugin-dialog");
  const selected = await open({
    title,
    directory: true,
    multiple: false,
    canCreateDirectories: true,
  });
  return typeof selected === "string" ? selected : null;
}

export const desktopApi = {
  async currentVault(): Promise<VaultInfo | null> {
    if (!isDesktopRuntime()) {
      await waitForMock();
      return mockVaultOpen ? demoVault : null;
    }
    return normalizeVault(await invokeCommand<unknown>("vault_current"));
  },

  async chooseAndOpenVault(): Promise<VaultInfo | null> {
    if (!isDesktopRuntime()) {
      await waitForMock();
      mockVaultOpen = true;
      return demoVault;
    }
    const path = await chooseDirectory("Open a Biota vault");
    if (!path) return null;
    return normalizeVault(await invokeCommand("vault_open", { path }));
  },

  async chooseAndCreateVault(): Promise<VaultInfo | null> {
    if (!isDesktopRuntime()) {
      await waitForMock();
      mockVaultOpen = true;
      return demoVault;
    }
    const path = await chooseDirectory("Choose a folder for your Biota vault");
    if (!path) return null;
    const name = path.split("/").filter(Boolean).at(-1);
    return normalizeVault(
      await invokeCommand("vault_create", {
        request: { path, name, createDefaultFolders: true },
      })
    );
  },

  async closeVault() {
    if (!isDesktopRuntime()) {
      mockVaultOpen = false;
      return;
    }
    await invokeCommand("vault_close");
  },

  async scanVault(): Promise<VaultScan> {
    if (!isDesktopRuntime()) {
      await waitForMock();
      return {
        files: mockFiles(),
        diagnostics: [],
        indexedAt: new Date().toISOString(),
      };
    }
    const raw = await invokeCommand<unknown>("vault_scan");
    if (Array.isArray(raw))
      return { files: raw as VaultScan["files"], diagnostics: [] };
    const value = (raw ?? {}) as Record<string, unknown>;
    const records = Array.isArray(value.records)
      ? (value.records as Array<Record<string, unknown>>)
      : [];
    const summariesByPath = new Map(
      records.map((record) => [
        String(record.relativePath ?? record.relative_path ?? ""),
        record,
      ])
    );
    const recordFiles = records.map((record) => {
      const path = String(record.relativePath ?? record.relative_path ?? "");
      const rawRecordType = record.recordType ?? record.record_type;
      return {
        name: String(
          record.fileName ?? record.file_name ?? path.split("/").at(-1) ?? path
        ),
        path,
        kind: "file" as const,
        recordType:
          typeof rawRecordType === "string"
            ? (rawRecordType as VaultScan["files"][number]["recordType"])
            : inferRecordType(path),
        modifiedAt: String(record.modified ?? new Date().toISOString()),
        size: typeof record.size === "number" ? record.size : undefined,
      };
    });
    const rawFiles = Array.isArray(value.files)
      ? (value.files as Array<Record<string, unknown>>)
      : [];
    const physicalFiles = rawFiles.map((file) => {
      const path = String(file.relativePath ?? file.relative_path ?? "");
      const summary = summariesByPath.get(path);
      const rawRecordType = summary?.recordType ?? summary?.record_type;
      return {
        name: String(
          file.fileName ?? file.file_name ?? path.split("/").at(-1) ?? path
        ),
        path,
        kind:
          file.kind === "directory"
            ? ("directory" as const)
            : ("file" as const),
        recordType:
          typeof rawRecordType === "string"
            ? (rawRecordType as VaultScan["files"][number]["recordType"])
            : path.endsWith(".md")
              ? inferRecordType(path)
              : undefined,
        modifiedAt: String(file.modified ?? new Date().toISOString()),
        size: typeof file.size === "number" ? file.size : undefined,
      };
    });
    const mergedFiles = physicalFiles.length ? physicalFiles : recordFiles;
    const knownPaths = new Set(mergedFiles.map((file) => file.path));
    for (const recordFile of recordFiles) {
      if (!knownPaths.has(recordFile.path)) mergedFiles.push(recordFile);
    }
    return {
      files: mergedFiles,
      diagnostics: Array.isArray(value.diagnostics)
        ? (value.diagnostics as Array<Record<string, unknown>>).map(
            (diagnostic) => ({
              id: String(
                diagnostic.id ?? diagnostic.code ?? crypto.randomUUID()
              ),
              severity:
                diagnostic.severity === "error" ||
                diagnostic.severity === "warning"
                  ? diagnostic.severity
                  : "info",
              path:
                typeof diagnostic.relativePath === "string"
                  ? diagnostic.relativePath
                  : typeof diagnostic.relative_path === "string"
                    ? diagnostic.relative_path
                    : undefined,
              message: String(diagnostic.message ?? "Vault diagnostic"),
            })
          )
        : [],
      indexedAt: String(
        ((value.index ?? {}) as Record<string, unknown>).generatedAt ??
          ((value.index ?? {}) as Record<string, unknown>).generated_at ??
          new Date().toISOString()
      ),
    };
  },

  async readRecord(path: string): Promise<RecordDocument> {
    if (!isDesktopRuntime()) {
      await waitForMock();
      return getMockRecord(path);
    }
    return normalizeDocument(
      await invokeCommand("record_read", { relativePath: path }),
      path
    );
  },

  async readText(path: string): Promise<string> {
    if (!isDesktopRuntime()) {
      await waitForMock();
      return getMockTextAsset(path);
    }
    return normalizeDocument(
      await invokeCommand("record_read", { relativePath: path }),
      path
    ).content;
  },

  async writeText(path: string, content: string, expectedHash?: string) {
    if (!isDesktopRuntime()) {
      await waitForMock();
      return writeMockTextAsset(path, content, expectedHash);
    }
    const raw = await invokeCommand<unknown>("record_write", {
      request: {
        relativePath: path,
        content,
        expectedHash,
        message: "Updated spreadsheet sidecar",
      },
    });
    const normalized = normalizeDocument(raw, path);
    return {
      path: normalized.path,
      hash: normalized.hash,
      modifiedAt: normalized.modifiedAt,
    };
  },

  async readSheet(
    ownerPath: string,
    dataPath: string,
    schemaPath: string
  ): Promise<SheetBundle> {
    if (!isDesktopRuntime()) {
      await waitForMock();
      return {
        ownerPath,
        data: (() => {
          const file = getMockTextAssetSnapshot(dataPath);
          return {
            path: file.relativePath,
            content: file.content,
            hash: file.contentHash,
          };
        })(),
        schema: (() => {
          const file = getMockTextAssetSnapshot(schemaPath);
          return {
            path: file.relativePath,
            content: file.content,
            hash: file.contentHash,
          };
        })(),
      };
    }
    return normalizeSheetBundle(
      await invokeCommand("sheet_read", {
        request: {
          ownerRelativePath: ownerPath,
          dataRelativePath: dataPath,
          schemaRelativePath: schemaPath,
        },
      }),
      ownerPath,
      dataPath,
      schemaPath
    );
  },

  async writeSheet(input: SheetWriteInput): Promise<SheetBundle> {
    if (!isDesktopRuntime()) {
      await waitForMock();
      let currentData: ReturnType<typeof getMockTextAssetSnapshot> | undefined;
      let currentSchema:
        | ReturnType<typeof getMockTextAssetSnapshot>
        | undefined;
      try {
        currentData = getMockTextAssetSnapshot(input.dataPath);
      } catch {
        // A missing sidecar is valid when a new embedded sheet is created.
      }
      try {
        currentSchema = getMockTextAssetSnapshot(input.schemaPath);
      } catch {
        // A missing sidecar is valid when a new embedded sheet is created.
      }
      if (
        input.expectedDataHash &&
        input.expectedDataHash !== currentData?.contentHash
      ) {
        throw new Error("CONFLICT: The spreadsheet CSV changed outside Biota.");
      }
      if (
        input.expectedSchemaHash &&
        input.expectedSchemaHash !== currentSchema?.contentHash
      ) {
        throw new Error(
          "CONFLICT: The spreadsheet schema changed outside Biota."
        );
      }
      const data = writeMockTextAsset(input.dataPath, input.dataContent);
      const schema = writeMockTextAsset(input.schemaPath, input.schemaContent);
      return {
        ownerPath: input.ownerPath,
        data: {
          path: data.path,
          content: input.dataContent,
          hash: data.hash,
        },
        schema: {
          path: schema.path,
          content: input.schemaContent,
          hash: schema.hash,
        },
      };
    }
    return normalizeSheetBundle(
      await invokeCommand("sheet_write", {
        request: {
          ownerRelativePath: input.ownerPath,
          dataRelativePath: input.dataPath,
          schemaRelativePath: input.schemaPath,
          dataContent: input.dataContent,
          schemaContent: input.schemaContent,
          expectedDataHash: input.expectedDataHash,
          expectedSchemaHash: input.expectedSchemaHash,
        },
      }),
      input.ownerPath,
      input.dataPath,
      input.schemaPath
    );
  },

  async writeRecord(input: RecordWriteInput): Promise<RecordWriteResult> {
    if (!isDesktopRuntime()) {
      await waitForMock();
      return writeMockRecord(input.path, input.content, input.expectedHash);
    }
    const raw = await invokeCommand<unknown>("record_write", {
      request: {
        relativePath: input.path,
        content: input.content,
        expectedHash: input.expectedHash,
        message: input.reason,
      },
    });
    const normalized = normalizeDocument(raw, input.path);
    const event = ((raw ?? {}) as Record<string, unknown>).historyEvent as
      | Record<string, unknown>
      | undefined;
    return {
      path: normalized.path,
      hash: normalized.hash,
      modifiedAt: normalized.modifiedAt,
      revisionId:
        typeof event?.eventId === "string"
          ? event.eventId
          : typeof event?.event_id === "string"
            ? event.event_id
            : undefined,
    };
  },

  async moveRecord(path: string, destination: string) {
    if (!isDesktopRuntime()) return { path: destination };
    const raw = await invokeCommand<unknown>("record_move", {
      request: { fromPath: path, toPath: destination },
    });
    return normalizeDocument(raw, destination);
  },

  async readBinary(path: string): Promise<Uint8Array> {
    if (!isDesktopRuntime()) {
      throw new Error("Binary vault reads require the desktop runtime.");
    }
    const bytes = await invokeCommand<number[]>("file_read_binary", {
      relativePath: path,
    });
    return Uint8Array.from(bytes);
  },

  async writeBinary(path: string, bytes: Uint8Array, expectedHash?: string) {
    if (!isDesktopRuntime()) {
      return {
        path,
        hash: "sha256:browser-preview",
        size: bytes.byteLength,
      };
    }
    const raw = await invokeCommand<Record<string, unknown>>(
      "file_write_binary",
      {
        request: {
          relativePath: path,
          bytes: Array.from(bytes),
          expectedHash,
          message: "Imported original binary file",
        },
      }
    );
    return {
      path: String(raw.relativePath ?? raw.relative_path ?? path),
      hash: String(raw.contentHash ?? raw.content_hash ?? ""),
      size: Number(raw.size ?? bytes.byteLength),
    };
  },

  async searchMetadata(
    input: SearchMetadataInput
  ): Promise<SearchMetadataResult> {
    if (!isDesktopRuntime()) {
      await waitForMock();
      return mockSearch(input.query);
    }
    const raw = input.query.trim()
      ? await invokeCommand<unknown>("search_metadata", {
          request: {
            query: input.query,
            recordTypes: input.recordTypes,
            limit: input.limit,
          },
        })
      : [];
    const rawHits = Array.isArray(raw)
      ? raw
      : Array.isArray((raw as Record<string, unknown> | null)?.hits)
        ? ((raw as Record<string, unknown>).hits as unknown[])
        : [];
    const hits = rawHits.map(normalizeSearchHit);
    let tasks: SearchMetadataResult["tasks"] = [];
    if (input.includeTasks) {
      const rawTasks = await invokeCommand<unknown>("task_list");
      tasks = (Array.isArray(rawTasks) ? rawTasks : []).map((rawTask) => {
        const value = (rawTask ?? {}) as Record<string, unknown>;
        const sourcePath = String(value.sourcePath ?? value.source_path ?? "");
        const line = Number(value.lineNumber ?? value.line_number ?? 0);
        const text = String(value.text ?? "").replace(
          /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,
          (_match, target: string, alias?: string) => alias ?? target
        );
        const completed = Boolean(value.completed);
        const rawState = value.state;
        const state =
          completed || rawState === "done"
            ? ("done" as const)
            : rawState === "scheduled" ||
                rawState === "waiting" ||
                rawState === "inbox"
              ? rawState
              : value.start || value.due
                ? ("scheduled" as const)
                : ("inbox" as const);
        const rawPriority = value.priority;
        return {
          id: String(value.taskId ?? value.task_id ?? `${sourcePath}:${line}`),
          title: text,
          checked: completed,
          state,
          start: typeof value.start === "string" ? value.start : undefined,
          due: typeof value.due === "string" ? value.due : undefined,
          priority:
            rawPriority === "high" || rawPriority === "low"
              ? rawPriority
              : "normal",
          recordPath: sourcePath,
          recordTitle: String(
            value.sourceTitle ?? value.source_title ?? titleFromPath(sourcePath)
          ),
          line,
          links: extractWikilinks(String(value.text ?? "")).map(
            (link) => link.target
          ),
        };
      });
    }
    return { hits, tasks };
  },

  async watchVault(
    callback: (event: { kind: string; paths: string[] }) => void
  ): Promise<() => void> {
    if (!isDesktopRuntime()) return () => undefined;
    const { listen } = await import("@tauri-apps/api/event");
    return listen<{ kind?: string; paths?: string[] }>(
      "vault://changed",
      (event) => {
        callback({
          kind: event.payload.kind ?? "modify",
          paths: Array.isArray(event.payload.paths) ? event.payload.paths : [],
        });
      }
    );
  },

  async runAnalysis<T = unknown>(request: Record<string, unknown>): Promise<T> {
    if (!isDesktopRuntime()) {
      await waitForMock();
      return {
        ok: true,
        engine: "browser-preview",
        result: request,
      } as T;
    }
    return invokeCommand<T>("analysis_run", { request });
  },

  async listHistory(path: string): Promise<HistoryRevision[]> {
    if (!isDesktopRuntime()) {
      await waitForMock();
      return mockHistory(path);
    }
    const raw = await invokeCommand<unknown>("history_list", {
      relativePath: path,
    });
    const events = Array.isArray(raw)
      ? raw
      : (((raw as Record<string, unknown> | null)?.revisions as unknown[]) ??
        []);
    return events.map(normalizeHistoryEvent);
  },

  async checkpoint(path: string, label: string) {
    if (!isDesktopRuntime()) {
      await waitForMock();
      return { id: crypto.randomUUID() };
    }
    const raw = await invokeCommand<unknown>("history_checkpoint", {
      request: { relativePath: path, message: label },
    });
    const revision = normalizeHistoryEvent(raw);
    return { id: revision.id };
  },

  async restore(path: string, revisionId: string) {
    if (!isDesktopRuntime()) {
      await waitForMock();
      return getMockRecord(path);
    }
    return normalizeDocument(
      await invokeCommand("history_restore", {
        request: { relativePath: path, eventId: revisionId },
      }),
      path
    );
  },

  async finalize(path: string, dependencies: string[] = []) {
    if (!isDesktopRuntime()) {
      await waitForMock();
      return { manifestHash: "sha256:mock-finalized" };
    }
    const raw = (await invokeCommand("history_finalize", {
      request: {
        relativePath: path,
        dependencies,
        message: "Finalized in Biota",
      },
    })) as Record<string, unknown>;
    return {
      manifestHash: String(
        raw.eventHash ?? raw.event_hash ?? raw.contentHash ?? ""
      ),
    };
  },

  async createRevision(path: string) {
    if (!isDesktopRuntime()) {
      await waitForMock();
      return { id: crypto.randomUUID() };
    }
    const raw = await invokeCommand<unknown>("history_create_revision", {
      request: {
        relativePath: path,
        message: "Opened a new revision in Biota",
      },
    });
    const revision = normalizeHistoryEvent(raw);
    return { id: revision.id };
  },
};

export type DesktopApi = typeof desktopApi;
