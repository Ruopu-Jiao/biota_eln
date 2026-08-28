import { createBiotaId, isBiotaId } from "./ids";
import {
  BIOTA_RECORD_TYPES,
  BIOTA_SCHEMA_VERSION,
  EXPERIMENT_STATUSES,
  type BiotaFrontmatter,
  type BiotaRecordType,
  type FrontmatterMap,
  type MarkdownFormat,
  type MarkdownRecord,
  type VaultDiagnostic,
} from "./types";
import { parseFrontmatterYaml, stringifyFrontmatterYaml } from "./yaml";

function detectLineEnding(source: string): "\n" | "\r\n" {
  return source.includes("\r\n") ? "\r\n" : "\n";
}

function valuesEqual(left: unknown, right: unknown): boolean {
  if (left === right) {
    return true;
  }
  if (
    typeof left !== "object" ||
    left === null ||
    typeof right !== "object" ||
    right === null
  ) {
    return false;
  }
  if (Array.isArray(left) !== Array.isArray(right)) {
    return false;
  }
  if (Array.isArray(left) && Array.isArray(right)) {
    return (
      left.length === right.length &&
      left.every((value, index) => valuesEqual(value, right[index]))
    );
  }

  const leftEntries = Object.entries(left);
  const rightObject = right as Record<string, unknown>;
  return (
    leftEntries.length === Object.keys(rightObject).length &&
    leftEntries.every(([key, value]) => valuesEqual(value, rightObject[key]))
  );
}

function recordDiagnostics(
  frontmatter: FrontmatterMap,
  path?: string
): VaultDiagnostic[] {
  const diagnostics: VaultDiagnostic[] = [];

  if (typeof frontmatter.biota_id !== "string" || !frontmatter.biota_id) {
    diagnostics.push({
      code: "record.missing-id",
      message: "The record is missing a biota_id.",
      severity: "error",
      path,
    });
  } else if (!isBiotaId(frontmatter.biota_id)) {
    diagnostics.push({
      code: "record.invalid-id",
      message: `"${frontmatter.biota_id}" is not a valid Biota ULID.`,
      severity: "error",
      path,
    });
  }

  if (typeof frontmatter.biota_type !== "string") {
    diagnostics.push({
      code: "record.missing-type",
      message: "The record is missing a biota_type.",
      severity: "error",
      path,
    });
  } else if (
    !BIOTA_RECORD_TYPES.includes(frontmatter.biota_type as BiotaRecordType)
  ) {
    diagnostics.push({
      code: "record.invalid-type",
      message: `"${frontmatter.biota_type}" is not a supported Biota record type.`,
      severity: "error",
      path,
    });
  }

  if (typeof frontmatter.title !== "string" || !frontmatter.title.trim()) {
    diagnostics.push({
      code: "record.missing-title",
      message: "The record is missing a title.",
      severity: "error",
      path,
    });
  }

  if (
    typeof frontmatter.biota_schema !== "number" ||
    !Number.isInteger(frontmatter.biota_schema) ||
    frontmatter.biota_schema < 1
  ) {
    diagnostics.push({
      code: "record.invalid-schema",
      message: "biota_schema must be a positive integer.",
      severity: "error",
      path,
    });
  }

  if (
    frontmatter.biota_type === "experiment" &&
    (typeof frontmatter.status !== "string" ||
      !EXPERIMENT_STATUSES.includes(
        frontmatter.status as (typeof EXPERIMENT_STATUSES)[number]
      ))
  ) {
    diagnostics.push({
      code: "record.invalid-status",
      message: "Experiments require a supported status.",
      severity: "error",
      path,
    });
  }

  return diagnostics;
}

export function parseMarkdownRecord(
  source: string,
  path?: string
): MarkdownRecord {
  const lineEnding = detectLineEnding(source);
  const opening = source.match(/^---[ \t]*(\r?\n|$)/);

  if (!opening || opening[1] === "") {
    const format: MarkdownFormat = {
      lineEnding,
      hasFrontmatter: false,
      openingFence: "---",
      closingFence: "---",
      bodySeparator: "",
      rawFrontmatter: "",
    };
    return {
      frontmatter: {},
      body: source,
      path,
      format,
      diagnostics: [
        {
          code: "frontmatter.missing",
          message: "The Markdown file does not have YAML frontmatter.",
          severity: "warning",
          path,
          line: 1,
          column: 1,
        },
        ...recordDiagnostics({}, path),
      ],
    };
  }

  const frontmatterStart = opening[0].length;
  const closingPattern = /^(---|\.\.\.)[ \t]*(\r?\n|$)/gm;
  closingPattern.lastIndex = frontmatterStart;
  const closing = closingPattern.exec(source);

  if (!closing) {
    const format: MarkdownFormat = {
      lineEnding,
      hasFrontmatter: true,
      openingFence: "---",
      closingFence: "---",
      bodySeparator: "",
      rawFrontmatter: source.slice(frontmatterStart),
    };
    return {
      frontmatter: {},
      body: "",
      path,
      format,
      diagnostics: [
        {
          code: "frontmatter.invalid",
          message: "The YAML frontmatter is missing its closing fence.",
          severity: "error",
          path,
          line: 1,
          column: 1,
        },
        ...recordDiagnostics({}, path),
      ],
    };
  }

  const rawFrontmatter = source.slice(frontmatterStart, closing.index);
  const parsed = parseFrontmatterYaml(rawFrontmatter);
  const bodySeparator = (closing[2] ?? "") as "" | "\n" | "\r\n";
  const body = source.slice(closing.index + closing[0].length);
  const frontmatter = parsed.value;
  const format: MarkdownFormat = {
    lineEnding,
    hasFrontmatter: true,
    openingFence: "---",
    closingFence: closing[1] as "---" | "...",
    bodySeparator,
    rawFrontmatter,
  };

  return {
    frontmatter,
    body,
    path,
    format,
    diagnostics: [
      ...parsed.diagnostics.map((diagnostic) => ({ ...diagnostic, path })),
      ...recordDiagnostics(frontmatter, path),
    ],
  };
}

export interface StringifyMarkdownOptions {
  lineEnding?: "\n" | "\r\n";
  preserveUnchangedFrontmatter?: boolean;
}

export function stringifyMarkdownRecord(
  record: MarkdownRecord,
  options: StringifyMarkdownOptions = {}
) {
  if (
    !record.format.hasFrontmatter &&
    Object.keys(record.frontmatter).length === 0
  ) {
    return record.body;
  }

  const lineEnding = options.lineEnding ?? record.format.lineEnding;
  const preserveUnchanged = options.preserveUnchangedFrontmatter ?? true;
  let serializedFrontmatter: string;

  if (preserveUnchanged && record.format.hasFrontmatter) {
    const original = parseFrontmatterYaml(record.format.rawFrontmatter);
    serializedFrontmatter =
      original.diagnostics.length === 0 &&
      valuesEqual(original.value, record.frontmatter)
        ? record.format.rawFrontmatter
        : `${stringifyFrontmatterYaml(record.frontmatter)}${lineEnding}`;
  } else {
    serializedFrontmatter = `${stringifyFrontmatterYaml(record.frontmatter)}${lineEnding}`;
  }

  const separator =
    record.format.bodySeparator || (record.body.length > 0 ? lineEnding : "");

  return [
    "---",
    lineEnding,
    serializedFrontmatter,
    record.format.closingFence,
    separator,
    record.body,
  ].join("");
}

export interface CreateMarkdownRecordOptions {
  type: BiotaRecordType;
  title: string;
  body?: string;
  id?: string;
  timestamp?: string | Date;
  frontmatter?: FrontmatterMap;
}

export function createMarkdownRecord(
  options: CreateMarkdownRecordOptions
): MarkdownRecord<BiotaFrontmatter> {
  const timestamp =
    options.timestamp instanceof Date
      ? options.timestamp.toISOString()
      : (options.timestamp ?? new Date().toISOString());
  const canonical: BiotaFrontmatter = {
    ...(options.frontmatter ?? {}),
    biota_id: options.id ?? createBiotaId(),
    biota_type: options.type,
    biota_schema: BIOTA_SCHEMA_VERSION,
    title: options.title,
    created: timestamp,
    modified: timestamp,
  } as BiotaFrontmatter;

  if (options.type === "experiment" && typeof canonical.status !== "string") {
    canonical.status = "planned";
  }

  return {
    frontmatter: canonical,
    body: options.body ?? "",
    format: {
      lineEnding: "\n",
      hasFrontmatter: true,
      openingFence: "---",
      closingFence: "---",
      bodySeparator: options.body ? "\n" : "",
      rawFrontmatter: "",
    },
    diagnostics: recordDiagnostics(canonical),
  };
}

export function isCanonicalBiotaRecord(
  record: MarkdownRecord
): record is MarkdownRecord<BiotaFrontmatter> {
  return !recordDiagnostics(record.frontmatter, record.path).some(
    (diagnostic) => diagnostic.severity === "error"
  );
}

export function validateMarkdownRecord(record: MarkdownRecord) {
  return [
    ...record.diagnostics.filter((diagnostic) =>
      diagnostic.code.startsWith("frontmatter.")
    ),
    ...recordDiagnostics(record.frontmatter, record.path),
  ];
}
