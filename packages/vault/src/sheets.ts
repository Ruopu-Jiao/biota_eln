import { isBiotaId } from "./ids";
import type { FrontmatterMap, FrontmatterValue } from "./types";
import { parseFrontmatterYaml, stringifyFrontmatterYaml } from "./yaml";

export const BIOTA_SHEET_BLOCK_LANGUAGE = "biota-sheet";
export const BIOTA_SHEET_SCHEMA_VERSION = 1 as const;

export type BiotaSheetField = "id" | "title" | "data" | "schema";

export interface BiotaSheetSpec extends FrontmatterMap {
  id: string;
  title: string;
  data: string;
  schema: string;
}

export type BiotaSheetDiagnosticCode =
  | "sheet.unclosed-fence"
  | "sheet.invalid-yaml"
  | "sheet.duplicate-field"
  | "sheet.missing-field"
  | "sheet.invalid-field"
  | "sheet.invalid-path";

export interface BiotaSheetDiagnostic {
  code: BiotaSheetDiagnosticCode;
  message: string;
  severity: "error";
  field?: BiotaSheetField;
  line?: number;
  column?: number;
}

export interface BiotaSheetValidation {
  valid: boolean;
  spec?: BiotaSheetSpec;
  diagnostics: BiotaSheetDiagnostic[];
}

export interface ParsedBiotaSheetBlock extends BiotaSheetValidation {
  /** Full source range, including opening and closing fences. */
  from: number;
  to: number;
  /** @deprecated Prefer `from`. */
  start: number;
  /** @deprecated Prefer `to`. */
  end: number;
  /** YAML source range, excluding the fences. */
  contentStart: number;
  contentEnd: number;
  raw: string;
  yaml: string;
  fields: FrontmatterMap;
  fenceCharacter: "`" | "~";
  fenceLength: number;
}

export interface FormatBiotaSheetBlockOptions {
  lineEnding?: "\n" | "\r\n";
}

interface MarkdownLine {
  text: string;
  raw: string;
  start: number;
  end: number;
}

interface OpenFence {
  character: "`" | "~";
  length: number;
  indent: number;
  language: string;
  start: number;
  contentStart: number;
}

const REQUIRED_FIELDS: readonly BiotaSheetField[] = [
  "id",
  "title",
  "data",
  "schema",
];

function markdownLines(source: string): MarkdownLine[] {
  const lines: MarkdownLine[] = [];
  for (const match of source.matchAll(/.*(?:\r\n|\n|$)/g)) {
    if (!match[0]) continue;
    lines.push({
      text: match[0].replace(/\r?\n$/, ""),
      raw: match[0],
      start: match.index,
      end: match.index + match[0].length,
    });
  }
  return lines;
}

function openingFence(line: string) {
  const match = /^( {0,3})(`{3,}|~{3,})(.*)$/.exec(line);
  if (!match) return undefined;

  const marker = match[2]!;
  const information = match[3]!.trim();
  if (marker[0] === "`" && information.includes("`")) return undefined;

  return {
    character: marker[0] as "`" | "~",
    length: marker.length,
    indent: match[1]!.length,
    language: information.split(/\s+/, 1)[0] ?? "",
  };
}

function isClosingFence(line: string, fence: OpenFence) {
  const match = /^( {0,3})(`{3,}|~{3,})[ \t]*$/.exec(line);
  return Boolean(
    match &&
    match[2]![0] === fence.character &&
    match[2]!.length >= fence.length
  );
}

function deindentFenceContent(source: string, indent: number) {
  if (indent === 0) return source;
  return source
    .split(/(\r\n|\n)/)
    .map((part, index) => {
      if (index % 2 === 1) return part;
      const removable = Math.min(indent, part.match(/^ */)?.[0].length ?? 0);
      return part.slice(removable);
    })
    .join("");
}

function duplicateTopLevelFields(yaml: string) {
  const seen = new Map<string, number>();
  const duplicates: Array<{ field: string; line: number }> = [];

  yaml.split(/\r?\n/).forEach((line, index) => {
    const match = /^([A-Za-z_][A-Za-z0-9_-]*)\s*:/.exec(line);
    if (!match) return;
    const field = match[1]!;
    if (seen.has(field)) {
      duplicates.push({ field, line: index + 1 });
    } else {
      seen.set(field, index + 1);
    }
  });

  return duplicates;
}

function stringField(
  fields: FrontmatterMap,
  field: BiotaSheetField,
  diagnostics: BiotaSheetDiagnostic[]
) {
  const value = fields[field];
  if (value === undefined || value === null || value === "") {
    diagnostics.push({
      code: "sheet.missing-field",
      message: `A ${BIOTA_SHEET_BLOCK_LANGUAGE} block requires "${field}".`,
      severity: "error",
      field,
    });
    return undefined;
  }
  if (typeof value !== "string") {
    diagnostics.push({
      code: "sheet.invalid-field",
      message: `"${field}" must be a string.`,
      severity: "error",
      field,
    });
    return undefined;
  }
  const normalized = value.trim();
  if (!normalized) {
    diagnostics.push({
      code: "sheet.missing-field",
      message: `"${field}" cannot be empty.`,
      severity: "error",
      field,
    });
    return undefined;
  }
  return normalized;
}

function pathProblem(path: string, role: "data" | "schema") {
  if (path.includes("\0") || /[\u0001-\u001f\u007f]/.test(path)) {
    return "contains control characters";
  }
  if (path.includes("\\")) return "must use POSIX forward slashes";
  if (
    path.startsWith("/") ||
    path.startsWith("//") ||
    /^[A-Za-z][A-Za-z0-9+.-]*:/.test(path)
  ) {
    return "must be a vault-relative path, not an absolute path or URL";
  }
  if (path.includes("?") || path.includes("#")) {
    return "cannot contain a query string or fragment";
  }

  const components = path.split("/");
  if (
    components.some(
      (component) => component === "" || component === "." || component === ".."
    )
  ) {
    return "cannot contain empty, current-directory, or parent-directory segments";
  }
  if (
    components.some((component) => component.toLocaleLowerCase() === ".biota")
  ) {
    return "cannot reference Biota's reserved .biota directory";
  }
  if (role === "data" && !path.toLocaleLowerCase().endsWith(".csv")) {
    return 'must end with ".csv"';
  }
  if (role === "schema" && !path.toLocaleLowerCase().endsWith(".sheet.yaml")) {
    return 'must end with ".sheet.yaml"';
  }
  return undefined;
}

export function validateBiotaSheetSpec(
  fields: FrontmatterMap
): BiotaSheetValidation {
  const diagnostics: BiotaSheetDiagnostic[] = [];
  const id = stringField(fields, "id", diagnostics);
  const title = stringField(fields, "title", diagnostics);
  const data = stringField(fields, "data", diagnostics);
  const schema = stringField(fields, "schema", diagnostics);

  if (id && !isBiotaId(id)) {
    diagnostics.push({
      code: "sheet.invalid-field",
      message: '"id" must be a 26-character Biota ULID.',
      severity: "error",
      field: "id",
    });
  }
  if (data) {
    const problem = pathProblem(data, "data");
    if (problem) {
      diagnostics.push({
        code: "sheet.invalid-path",
        message: `"data" ${problem}.`,
        severity: "error",
        field: "data",
      });
    }
  }
  if (schema) {
    const problem = pathProblem(schema, "schema");
    if (problem) {
      diagnostics.push({
        code: "sheet.invalid-path",
        message: `"schema" ${problem}.`,
        severity: "error",
        field: "schema",
      });
    }
  }

  if (diagnostics.length > 0 || !id || !title || !data || !schema) {
    return { valid: false, diagnostics };
  }
  return {
    valid: true,
    diagnostics,
    spec: {
      ...fields,
      id,
      title,
      data,
      schema,
    },
  };
}

function parseSheetYaml(yaml: string): BiotaSheetValidation & {
  fields: FrontmatterMap;
} {
  const parsed = parseFrontmatterYaml(yaml);
  const diagnostics: BiotaSheetDiagnostic[] = parsed.diagnostics.map(
    (diagnostic) => ({
      code: "sheet.invalid-yaml",
      message: diagnostic.message,
      severity: "error",
      line: diagnostic.line,
      column: diagnostic.column,
    })
  );

  for (const duplicate of duplicateTopLevelFields(yaml)) {
    diagnostics.push({
      code: "sheet.duplicate-field",
      message: `The top-level field "${duplicate.field}" is repeated.`,
      severity: "error",
      line: duplicate.line,
      column: 1,
    });
  }

  const validation = validateBiotaSheetSpec(parsed.value);
  diagnostics.push(...validation.diagnostics);
  return {
    fields: parsed.value,
    valid: diagnostics.length === 0 && validation.valid,
    diagnostics,
    spec: diagnostics.length === 0 ? validation.spec : undefined,
  };
}

function completedSheetBlock(
  source: string,
  fence: OpenFence,
  closing: MarkdownLine
): ParsedBiotaSheetBlock {
  const contentEnd = closing.start;
  const yaml = deindentFenceContent(
    source.slice(fence.contentStart, contentEnd),
    fence.indent
  ).replace(/\r?\n$/, "");
  const parsed = parseSheetYaml(yaml);
  return {
    ...parsed,
    from: fence.start,
    to: closing.end,
    start: fence.start,
    end: closing.end,
    contentStart: fence.contentStart,
    contentEnd,
    raw: source.slice(fence.start, closing.end),
    yaml,
    fenceCharacter: fence.character,
    fenceLength: fence.length,
  };
}

export function parseBiotaSheetBlocks(source: string): ParsedBiotaSheetBlock[] {
  const blocks: ParsedBiotaSheetBlock[] = [];
  const lines = markdownLines(source);
  let fence: OpenFence | undefined;

  for (const line of lines) {
    if (!fence) {
      const opening = openingFence(line.text);
      if (!opening) continue;
      fence = {
        ...opening,
        start: line.start,
        contentStart: line.end,
      };
      continue;
    }

    if (!isClosingFence(line.text, fence)) continue;
    if (fence.language === BIOTA_SHEET_BLOCK_LANGUAGE) {
      blocks.push(completedSheetBlock(source, fence, line));
    }
    fence = undefined;
  }

  if (fence?.language === BIOTA_SHEET_BLOCK_LANGUAGE) {
    const yaml = deindentFenceContent(
      source.slice(fence.contentStart),
      fence.indent
    );
    const parsed = parseSheetYaml(yaml);
    blocks.push({
      ...parsed,
      valid: false,
      spec: undefined,
      diagnostics: [
        {
          code: "sheet.unclosed-fence",
          message: `The ${BIOTA_SHEET_BLOCK_LANGUAGE} block is missing its closing fence.`,
          severity: "error",
        },
        ...parsed.diagnostics,
      ],
      from: fence.start,
      to: source.length,
      start: fence.start,
      end: source.length,
      contentStart: fence.contentStart,
      contentEnd: source.length,
      raw: source.slice(fence.start),
      yaml,
      fenceCharacter: fence.character,
      fenceLength: fence.length,
    });
  }

  return blocks;
}

function canonicalSheetFields(spec: BiotaSheetSpec): FrontmatterMap {
  const unknown = Object.fromEntries(
    Object.entries(spec).filter(
      ([field, value]) =>
        !REQUIRED_FIELDS.includes(field as BiotaSheetField) &&
        value !== undefined
    )
  ) as Record<string, FrontmatterValue>;
  return {
    id: spec.id,
    title: spec.title,
    data: spec.data,
    schema: spec.schema,
    ...unknown,
  };
}

export function formatBiotaSheetBlock(
  spec: BiotaSheetSpec,
  options: FormatBiotaSheetBlockOptions = {}
) {
  const validation = validateBiotaSheetSpec(spec);
  if (!validation.spec) {
    throw new TypeError(
      validation.diagnostics.map((diagnostic) => diagnostic.message).join(" ")
    );
  }
  const lineEnding = options.lineEnding ?? "\n";
  const yaml = stringifyFrontmatterYaml(
    canonicalSheetFields(validation.spec)
  ).replaceAll("\n", lineEnding);
  return [
    `\`\`\`${BIOTA_SHEET_BLOCK_LANGUAGE}`,
    lineEnding,
    yaml,
    lineEnding,
    "```",
  ].join("");
}
