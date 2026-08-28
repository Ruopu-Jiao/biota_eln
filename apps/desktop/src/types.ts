export type RecordType =
  | "note"
  | "daily"
  | "experiment"
  | "protocol"
  | "project"
  | "entity"
  | "analysis";

export type ExperimentStatus =
  | "planned"
  | "active"
  | "complete"
  | "finalized"
  | "archived";

export type SaveState =
  | "clean"
  | "dirty"
  | "saving"
  | "saved"
  | "conflict"
  | "error";

export interface VaultInfo {
  id: string;
  name: string;
  path: string;
  schema: number;
  createdAt?: string;
}

export interface VaultFile {
  name: string;
  path: string;
  kind: "file" | "directory";
  recordType?: RecordType;
  modifiedAt?: string;
  size?: number;
}

export interface VaultDiagnostic {
  id: string;
  severity: "info" | "warning" | "error";
  path?: string;
  message: string;
}

export interface VaultScan {
  files: VaultFile[];
  diagnostics: VaultDiagnostic[];
  indexedAt?: string;
}

export interface RecordDocument {
  path: string;
  content: string;
  hash: string;
  modifiedAt: string;
  biotaId?: string;
  recordType?: RecordType;
  title?: string;
  finalized?: boolean;
}

export interface RecordWriteInput {
  path: string;
  content: string;
  expectedHash?: string;
  reason?: "autosave" | "manual" | "create" | "task-update";
}

export interface RecordWriteResult {
  path: string;
  hash: string;
  modifiedAt: string;
  revisionId?: string;
}

export interface HistoryRevision {
  id: string;
  hash: string;
  createdAt: string;
  label?: string;
  kind: "autosave" | "checkpoint" | "finalization" | "restore";
  size?: number;
}

export interface SearchMetadataInput {
  query: string;
  recordTypes?: RecordType[];
  includeTasks?: boolean;
  limit?: number;
}

export interface SearchHit {
  id: string;
  path: string;
  title: string;
  recordType: RecordType;
  excerpt?: string;
  score?: number;
  tags?: string[];
}

export type TaskState = "inbox" | "scheduled" | "waiting" | "done";

export interface BiotaTask {
  id: string;
  title: string;
  checked: boolean;
  state: TaskState;
  start?: string;
  due?: string;
  priority?: "low" | "normal" | "high";
  recordPath: string;
  recordTitle: string;
  line: number;
  links: string[];
}

export interface SearchMetadataResult {
  hits: SearchHit[];
  tasks: BiotaTask[];
}

export interface WorkspaceTab extends RecordDocument {
  id: string;
  title: string;
  recordType: RecordType;
  saveState: SaveState;
  /** Last disk content this tab was cleanly based on. */
  baseContent?: string;
  conflict?: {
    baseContent: string;
    externalContent: string;
    externalHash: string;
    externalModifiedAt: string;
  };
}

export type WorkspaceArea =
  | "notebook"
  | "planning"
  | "dna"
  | "analysis"
  | "graph";

export type EditorMode = "edit" | "split" | "read";

export interface ParsedFrontmatter {
  raw: string;
  data: Record<string, string | string[] | number | boolean>;
  body: string;
}

export interface FileTreeNode {
  name: string;
  path: string;
  kind: "file" | "directory";
  recordType?: RecordType;
  children: FileTreeNode[];
}
