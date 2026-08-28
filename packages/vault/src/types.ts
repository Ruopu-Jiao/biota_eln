export const BIOTA_SCHEMA_VERSION = 1 as const;

export const BIOTA_RECORD_TYPES = [
  "note",
  "daily",
  "experiment",
  "protocol",
  "project",
  "entity",
  "analysis",
] as const;

export type BiotaRecordType = (typeof BIOTA_RECORD_TYPES)[number];

export const EXPERIMENT_STATUSES = [
  "planned",
  "active",
  "complete",
  "finalized",
  "archived",
] as const;

export type ExperimentStatus = (typeof EXPERIMENT_STATUSES)[number];

export type FrontmatterScalar = string | number | boolean | null;
export type FrontmatterValue =
  | FrontmatterScalar
  | undefined
  | FrontmatterValue[]
  | { [key: string]: FrontmatterValue };
export type FrontmatterMap = Record<string, FrontmatterValue>;

/**
 * Canonical fields understood by Biota. The index signature intentionally
 * permits user- and plugin-defined YAML fields without placing them in a
 * Biota-owned namespace.
 */
export interface BiotaFrontmatter extends FrontmatterMap {
  biota_id: string;
  biota_type: BiotaRecordType;
  biota_schema: number;
  title: string;
  status?: string;
  created: string;
  modified: string;
  aliases?: string[];
  tags?: string[];
  project?: string;
  protocols?: string[];
  entities?: string[];
  sequence?: string;
  data?: string[];
  attachments?: string[];
}

export interface MarkdownFormat {
  lineEnding: "\n" | "\r\n";
  hasFrontmatter: boolean;
  openingFence: "---";
  closingFence: "---" | "...";
  bodySeparator: "" | "\n" | "\r\n";
  rawFrontmatter: string;
}

export type DiagnosticSeverity = "error" | "warning";

export interface VaultDiagnostic {
  code:
    | "frontmatter.missing"
    | "frontmatter.invalid"
    | "frontmatter.invalid-root"
    | "record.missing-id"
    | "record.invalid-id"
    | "record.missing-type"
    | "record.invalid-type"
    | "record.missing-title"
    | "record.invalid-schema"
    | "record.invalid-status";
  message: string;
  severity: DiagnosticSeverity;
  path?: string;
  line?: number;
  column?: number;
}

export interface MarkdownRecord<
  TFrontmatter extends FrontmatterMap = FrontmatterMap,
> {
  frontmatter: TFrontmatter;
  /** Body text excluding the frontmatter fences and their terminating newline. */
  body: string;
  path?: string;
  format: MarkdownFormat;
  diagnostics: VaultDiagnostic[];
}

export interface SourceRange {
  /** UTF-16 offset, inclusive. */
  start: number;
  /** UTF-16 offset, exclusive. */
  end: number;
}

export interface WikiLink extends SourceRange {
  raw: string;
  target: string;
  path: string;
  alias?: string;
  heading?: string;
  block?: string;
  embed: boolean;
}

export interface MarkdownLink extends SourceRange {
  raw: string;
  label: string;
  target: string;
  title?: string;
  embed: boolean;
}

export interface RecordLink {
  sourceId?: string;
  sourcePath?: string;
  target: string;
  targetPath: string;
  alias?: string;
  kind: "wikilink" | "embed" | "markdown";
  range?: SourceRange;
}

export interface Backlink {
  sourceId: string;
  sourcePath: string;
  targetPath: string;
  context: string;
  range: SourceRange;
}

export const TASK_STATES = [
  "inbox",
  "scheduled",
  "waiting",
  "done",
  "cancelled",
] as const;

export type TaskState = (typeof TASK_STATES)[number];
export type TaskPriority = "low" | "normal" | "high" | "urgent";

export interface TaskMetadata {
  id?: string;
  state: TaskState;
  start?: string;
  due?: string;
  priority?: TaskPriority;
  project?: string;
  experiment?: string;
  [key: string]: string | undefined;
}

export interface VaultTask extends SourceRange {
  id?: string;
  title: string;
  checked: boolean;
  state: TaskState;
  startDate?: string;
  dueDate?: string;
  priority?: TaskPriority;
  project?: string;
  experiment?: string;
  metadata: TaskMetadata;
  links: WikiLink[];
  line: number;
  sourcePath?: string;
  raw: string;
}

export type SidecarKind =
  | "sequence"
  | "dataset"
  | "schema"
  | "analysis-output"
  | "attachment";

export interface SidecarReference {
  path: string;
  kind: SidecarKind;
  origin: "frontmatter" | "body";
  field?: string;
  range?: SourceRange;
}

export interface VaultSearchDocument {
  id: string;
  path: string;
  type: BiotaRecordType;
  title: string;
  status?: string;
  aliases: string[];
  tags: string[];
  body: string;
  links: RecordLink[];
  tasks: VaultTask[];
  modified?: string;
}

export interface VaultSearchQuery {
  text: string;
  types?: BiotaRecordType[];
  tags?: string[];
  statuses?: string[];
  pathPrefix?: string;
  includeArchived?: boolean;
  limit?: number;
}

export interface SearchMatch extends SourceRange {
  field: "title" | "alias" | "tag" | "body" | "task";
  excerpt: string;
}

export interface VaultSearchHit {
  document: VaultSearchDocument;
  score: number;
  matches: SearchMatch[];
}
