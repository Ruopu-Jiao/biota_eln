import {
  parseFrontmatterYaml,
  stringifyFrontmatterYaml,
  type FrontmatterMap,
} from "@biota/vault";

export const BIOTA_SPREADSHEET_SCHEMA_VERSION = 1;
export const BIOTA_SPREADSHEET_ENGINE_VERSION = "0.25.1";

export interface SpreadsheetEmbedSpec {
  id: string;
  title: string;
  data: string;
  schema: string;
}

export type SpreadsheetCellValue = string | number | boolean | null;
export type SpreadsheetCellType = "string" | "number" | "boolean";

export interface SpreadsheetHashes {
  data_sha256: string;
  metadata_sha256: string;
}

export interface SpreadsheetSchemaDocument {
  biota_sheet_schema: typeof BIOTA_SPREADSHEET_SCHEMA_VERSION;
  sheet_id: string;
  title: string;
  created: string;
  modified: string;
  calculation: {
    engine: "univer";
    engine_version: string;
    mode: "automatic";
    locale: "en-US";
  };
  hashes: SpreadsheetHashes;
  dimensions: {
    rows: number;
    columns: number;
  };
  formulas: Record<string, string>;
  cell_types: Record<string, SpreadsheetCellType>;
  /**
   * A Univer workbook snapshot with cell inputs removed. It retains workbook
   * structure, sparse styles, dimensions, validation resources, filters, and
   * other plugin metadata without making Univer's opaque snapshot the data
   * source of truth.
   */
  workbook: Record<string, unknown>;
  [unknownField: string]: unknown;
}

export interface SpreadsheetLoadResult {
  csv: string;
  matrix: SpreadsheetCellValue[][];
  schema: SpreadsheetSchemaDocument;
  workbook: Record<string, unknown>;
  integrityWarning?: string;
}

export interface SpreadsheetArtifactInput {
  spec: Pick<SpreadsheetEmbedSpec, "id" | "title">;
  workbook: Record<string, unknown>;
  values: SpreadsheetCellValue[][];
  formulas: string[][];
  previousSchema?: SpreadsheetSchemaDocument;
  now?: string;
}

export interface SpreadsheetArtifacts {
  csv: string;
  schema: SpreadsheetSchemaDocument;
  schemaText: string;
}

const numericPattern = /^[+-]?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function stringCell(value: SpreadsheetCellValue): string {
  if (value === null) return "";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  return String(value);
}

function csvField(value: SpreadsheetCellValue): string {
  const raw = stringCell(value);
  return /[",\r\n]/.test(raw) || raw.trim() !== raw
    ? `"${raw.replaceAll('"', '""')}"`
    : raw;
}

/**
 * Parse RFC 4180-style CSV, including escaped quotes and embedded newlines.
 * A final line ending does not create an extra empty row.
 */
export function parseCsv(input: string): string[][] {
  if (input.length === 0) return [];

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];

    if (quoted) {
      if (character === '"') {
        if (input[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"' && field.length === 0) {
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n" || character === "\r") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      if (character === "\r" && input[index + 1] === "\n") index += 1;
    } else {
      field += character;
    }
  }

  if (quoted) throw new Error("CSV contains an unterminated quoted field.");

  const endsWithLineBreak = /(?:\r\n|\r|\n)$/.test(input);
  if (!endsWithLineBreak || field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export function serializeCsv(matrix: SpreadsheetCellValue[][]): string {
  if (matrix.length === 0) return "";
  const width = matrix.reduce(
    (maximum, row) => Math.max(maximum, row.length),
    0
  );
  if (width === 0) return "";
  return `${matrix
    .map((row) =>
      Array.from({ length: width }, (_, column) =>
        csvField(row[column] ?? null)
      ).join(",")
    )
    .join("\n")}\n`;
}

export function columnName(column: number): string {
  if (!Number.isInteger(column) || column < 0) {
    throw new Error(`Invalid zero-based spreadsheet column: ${column}`);
  }
  let remaining = column + 1;
  let result = "";
  while (remaining > 0) {
    const digit = (remaining - 1) % 26;
    result = String.fromCharCode(65 + digit) + result;
    remaining = Math.floor((remaining - 1) / 26);
  }
  return result;
}

export function cellAddress(row: number, column: number): string {
  if (!Number.isInteger(row) || row < 0) {
    throw new Error(`Invalid zero-based spreadsheet row: ${row}`);
  }
  return `${columnName(column)}${row + 1}`;
}

function inferCellValue(raw: string): SpreadsheetCellValue {
  if (raw === "") return null;
  if (raw === "TRUE") return true;
  if (raw === "FALSE") return false;
  if (
    numericPattern.test(raw) &&
    !/^[+-]?0\d/.test(raw) &&
    Number.isFinite(Number(raw))
  ) {
    return Number(raw);
  }
  return raw;
}

function typedCellValue(
  raw: string,
  type: SpreadsheetCellType | undefined
): SpreadsheetCellValue {
  if (raw === "") return null;
  if (type === "string") return raw;
  if (type === "number") {
    const value = Number(raw);
    return Number.isFinite(value) ? value : raw;
  }
  if (type === "boolean") {
    if (raw === "TRUE") return true;
    if (raw === "FALSE") return false;
    return raw;
  }
  return inferCellValue(raw);
}

function typeForCell(
  value: SpreadsheetCellValue
): SpreadsheetCellType | undefined {
  if (value === null) return undefined;
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  return "string";
}

function normalizeMatrix(
  matrix: SpreadsheetCellValue[][]
): SpreadsheetCellValue[][] {
  let lastRow = matrix.length - 1;
  while (
    lastRow >= 0 &&
    matrix[lastRow].every((value) => value === null || value === "")
  ) {
    lastRow -= 1;
  }
  if (lastRow < 0) return [];

  let lastColumn = 0;
  for (let row = 0; row <= lastRow; row += 1) {
    for (let column = matrix[row].length - 1; column >= 0; column -= 1) {
      if (matrix[row][column] !== null && matrix[row][column] !== "") {
        lastColumn = Math.max(lastColumn, column);
        break;
      }
    }
  }

  return matrix
    .slice(0, lastRow + 1)
    .map((row) =>
      Array.from({ length: lastColumn + 1 }, (_, column) => row[column] ?? null)
    );
}

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}

export async function sha256Text(value: string): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error("The local runtime does not provide Web Crypto SHA-256.");
  }
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value)
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

function firstSheetId(
  workbook: Record<string, unknown>,
  fallback: string
): string {
  const order = Array.isArray(workbook.sheetOrder)
    ? workbook.sheetOrder.filter(
        (item): item is string => typeof item === "string"
      )
    : [];
  if (order[0]) return order[0];
  if (isRecord(workbook.sheets)) {
    const first = Object.keys(workbook.sheets)[0];
    if (first) return first;
  }
  return fallback;
}

function blankWorkbook(
  spec: Pick<SpreadsheetEmbedSpec, "id" | "title">,
  rows: number,
  columns: number
): Record<string, unknown> {
  const sheetId = `${spec.id}-sheet-1`;
  return {
    id: spec.id,
    name: spec.title,
    appVersion: BIOTA_SPREADSHEET_ENGINE_VERSION,
    locale: "enUS",
    styles: {},
    sheetOrder: [sheetId],
    sheets: {
      [sheetId]: {
        id: sheetId,
        name: "Table",
        rowCount: Math.max(rows, 24),
        columnCount: Math.max(columns, 8),
        cellData: {},
      },
    },
  };
}

function stripCellInputs(
  workbookInput: Record<string, unknown>
): Record<string, unknown> {
  const workbook = cloneJson(workbookInput);
  if (!isRecord(workbook.sheets)) return workbook;

  for (const sheetValue of Object.values(workbook.sheets)) {
    if (!isRecord(sheetValue) || !isRecord(sheetValue.cellData)) continue;
    const strippedRows: Record<string, unknown> = {};
    for (const [rowKey, rowValue] of Object.entries(sheetValue.cellData)) {
      if (!isRecord(rowValue)) continue;
      const strippedColumns: Record<string, unknown> = {};
      for (const [columnKey, cellValue] of Object.entries(rowValue)) {
        if (!isRecord(cellValue)) continue;
        const cell = { ...cellValue };
        delete cell.v;
        delete cell.f;
        delete cell.t;
        delete cell.p;
        delete cell.ref;
        delete cell.si;
        delete cell.xf;
        if (Object.keys(cell).length > 0) strippedColumns[columnKey] = cell;
      }
      if (Object.keys(strippedColumns).length > 0) {
        strippedRows[rowKey] = strippedColumns;
      }
    }
    sheetValue.cellData = strippedRows;
  }
  return workbook;
}

function injectCellInputs(
  workbookInput: Record<string, unknown>,
  spec: Pick<SpreadsheetEmbedSpec, "id" | "title">,
  matrix: SpreadsheetCellValue[][],
  formulas: Record<string, string>,
  cellTypes: Record<string, SpreadsheetCellType>
): Record<string, unknown> {
  const workbook =
    Object.keys(workbookInput).length > 0
      ? cloneJson(workbookInput)
      : blankWorkbook(
          spec,
          matrix.length,
          matrix.reduce((maximum, row) => Math.max(maximum, row.length), 0)
        );

  workbook.id = spec.id;
  workbook.name = spec.title;
  workbook.appVersion =
    typeof workbook.appVersion === "string"
      ? workbook.appVersion
      : BIOTA_SPREADSHEET_ENGINE_VERSION;
  workbook.locale =
    typeof workbook.locale === "string" ? workbook.locale : "enUS";
  workbook.styles = isRecord(workbook.styles) ? workbook.styles : {};

  const sheetId = firstSheetId(workbook, `${spec.id}-sheet-1`);
  workbook.sheetOrder = [sheetId];
  const sheets = isRecord(workbook.sheets) ? workbook.sheets : {};
  const sheet = isRecord(sheets[sheetId])
    ? (sheets[sheetId] as Record<string, unknown>)
    : {};
  const priorCells = isRecord(sheet.cellData) ? sheet.cellData : {};
  const cellData = cloneJson(priorCells);

  for (let row = 0; row < matrix.length; row += 1) {
    const rowKey = String(row);
    const rowData = isRecord(cellData[rowKey])
      ? (cellData[rowKey] as Record<string, unknown>)
      : {};
    for (let column = 0; column < matrix[row].length; column += 1) {
      const address = cellAddress(row, column);
      const value = matrix[row][column];
      const formula = formulas[address];
      const columnKey = String(column);
      const cell = isRecord(rowData[columnKey])
        ? { ...(rowData[columnKey] as Record<string, unknown>) }
        : {};
      if (value !== null) cell.v = value;
      if (formula) cell.f = formula;
      const type = cellTypes[address] ?? typeForCell(value);
      if (type === "string") cell.t = 1;
      if (type === "number") cell.t = 2;
      if (type === "boolean") cell.t = 3;
      if (Object.keys(cell).length > 0) rowData[columnKey] = cell;
    }
    if (Object.keys(rowData).length > 0) cellData[rowKey] = rowData;
  }

  sheet.id = sheetId;
  sheet.name = typeof sheet.name === "string" ? sheet.name : "Table";
  sheet.rowCount = Math.max(
    typeof sheet.rowCount === "number" ? sheet.rowCount : 0,
    matrix.length,
    24
  );
  sheet.columnCount = Math.max(
    typeof sheet.columnCount === "number" ? sheet.columnCount : 0,
    matrix.reduce((maximum, row) => Math.max(maximum, row.length), 0),
    8
  );
  sheet.cellData = cellData;
  sheets[sheetId] = sheet;
  workbook.sheets = { [sheetId]: sheet };
  return workbook;
}

function emptySchema(
  spec: Pick<SpreadsheetEmbedSpec, "id" | "title">,
  now: string
): SpreadsheetSchemaDocument {
  return {
    biota_sheet_schema: BIOTA_SPREADSHEET_SCHEMA_VERSION,
    sheet_id: spec.id,
    title: spec.title,
    created: now,
    modified: now,
    calculation: {
      engine: "univer",
      engine_version: BIOTA_SPREADSHEET_ENGINE_VERSION,
      mode: "automatic",
      locale: "en-US",
    },
    hashes: { data_sha256: "", metadata_sha256: "" },
    dimensions: { rows: 0, columns: 0 },
    formulas: {},
    cell_types: {},
    workbook: {},
  };
}

export function parseSpreadsheetSchema(
  input: string,
  spec: Pick<SpreadsheetEmbedSpec, "id" | "title">,
  now = new Date().toISOString()
): SpreadsheetSchemaDocument {
  if (!input.trim()) return emptySchema(spec, now);

  const result = parseFrontmatterYaml(input);
  if (result.diagnostics.length > 0) {
    throw new Error(
      `Spreadsheet schema is not valid YAML: ${result.diagnostics
        .map((diagnostic) => diagnostic.message)
        .join(" ")}`
    );
  }
  const parsed = result.value;
  if (parsed.biota_sheet_schema !== BIOTA_SPREADSHEET_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported spreadsheet schema version: ${String(
        parsed.biota_sheet_schema ?? "missing"
      )}.`
    );
  }
  if (parsed.sheet_id !== spec.id) {
    throw new Error(
      `Spreadsheet schema ID ${String(
        parsed.sheet_id
      )} does not match embed ID ${spec.id}.`
    );
  }

  return {
    ...parsed,
    biota_sheet_schema: BIOTA_SPREADSHEET_SCHEMA_VERSION,
    sheet_id: spec.id,
    title: typeof parsed.title === "string" ? parsed.title : spec.title,
    created: typeof parsed.created === "string" ? parsed.created : now,
    modified: typeof parsed.modified === "string" ? parsed.modified : now,
    calculation: isRecord(parsed.calculation)
      ? {
          engine: "univer",
          engine_version:
            typeof parsed.calculation.engine_version === "string"
              ? parsed.calculation.engine_version
              : BIOTA_SPREADSHEET_ENGINE_VERSION,
          mode: "automatic",
          locale: "en-US",
        }
      : {
          engine: "univer",
          engine_version: BIOTA_SPREADSHEET_ENGINE_VERSION,
          mode: "automatic",
          locale: "en-US",
        },
    hashes: isRecord(parsed.hashes)
      ? {
          data_sha256:
            typeof parsed.hashes.data_sha256 === "string"
              ? parsed.hashes.data_sha256
              : "",
          metadata_sha256:
            typeof parsed.hashes.metadata_sha256 === "string"
              ? parsed.hashes.metadata_sha256
              : "",
        }
      : { data_sha256: "", metadata_sha256: "" },
    dimensions: isRecord(parsed.dimensions)
      ? {
          rows:
            typeof parsed.dimensions.rows === "number"
              ? Math.max(0, parsed.dimensions.rows)
              : 0,
          columns:
            typeof parsed.dimensions.columns === "number"
              ? Math.max(0, parsed.dimensions.columns)
              : 0,
        }
      : { rows: 0, columns: 0 },
    formulas: isRecord(parsed.formulas)
      ? Object.fromEntries(
          Object.entries(parsed.formulas).filter(
            (entry): entry is [string, string] => typeof entry[1] === "string"
          )
        )
      : {},
    cell_types: isRecord(parsed.cell_types)
      ? Object.fromEntries(
          Object.entries(parsed.cell_types).filter(
            (entry): entry is [string, SpreadsheetCellType] =>
              entry[1] === "string" ||
              entry[1] === "number" ||
              entry[1] === "boolean"
          )
        )
      : {},
    workbook: isRecord(parsed.workbook) ? parsed.workbook : {},
  };
}

export async function loadSpreadsheetData(
  csv: string,
  schemaText: string,
  spec: Pick<SpreadsheetEmbedSpec, "id" | "title">
): Promise<SpreadsheetLoadResult> {
  const schema = parseSpreadsheetSchema(schemaText, spec);
  const rawRows = parseCsv(csv);
  const requestedRows = Math.max(rawRows.length, schema.dimensions.rows);
  const requestedColumns = Math.max(
    rawRows.reduce((maximum, row) => Math.max(maximum, row.length), 0),
    schema.dimensions.columns
  );
  const matrix = Array.from({ length: requestedRows }, (_, row) =>
    Array.from({ length: requestedColumns }, (_, column) => {
      const raw = rawRows[row]?.[column] ?? "";
      return typedCellValue(raw, schema.cell_types[cellAddress(row, column)]);
    })
  );
  const dataSha256 = await sha256Text(csv);
  const integrityWarning =
    schema.hashes.data_sha256 && schema.hashes.data_sha256 !== dataSha256
      ? "The CSV changed outside Biota. The external values were loaded; saving will create a new indexed revision."
      : undefined;
  return {
    csv,
    matrix,
    schema,
    workbook: injectCellInputs(
      schema.workbook,
      spec,
      matrix,
      schema.formulas,
      schema.cell_types
    ),
    integrityWarning,
  };
}

function formulasByAddress(formulas: string[][]): Record<string, string> {
  const result: Record<string, string> = {};
  for (let row = 0; row < formulas.length; row += 1) {
    for (let column = 0; column < formulas[row].length; column += 1) {
      const formula = formulas[row][column];
      if (formula) result[cellAddress(row, column)] = formula;
    }
  }
  return result;
}

function typesByAddress(
  values: SpreadsheetCellValue[][]
): Record<string, SpreadsheetCellType> {
  const result: Record<string, SpreadsheetCellType> = {};
  for (let row = 0; row < values.length; row += 1) {
    for (let column = 0; column < values[row].length; column += 1) {
      const type = typeForCell(values[row][column]);
      if (type) result[cellAddress(row, column)] = type;
    }
  }
  return result;
}

export async function createSpreadsheetArtifacts({
  spec,
  workbook,
  values,
  formulas,
  previousSchema,
  now = new Date().toISOString(),
}: SpreadsheetArtifactInput): Promise<SpreadsheetArtifacts> {
  const normalizedValues = normalizeMatrix(values);
  const csv = serializeCsv(normalizedValues);
  const cleanWorkbook = stripCellInputs(workbook);
  const formulaMap = formulasByAddress(formulas);
  const cellTypes = typesByAddress(normalizedValues);
  const dimensions = {
    rows: normalizedValues.length,
    columns: normalizedValues.reduce(
      (maximum, row) => Math.max(maximum, row.length),
      0
    ),
  };
  const metadataSha256 = await sha256Text(
    stableStringify({
      dimensions,
      formulas: formulaMap,
      cellTypes,
      workbook: cleanWorkbook,
    })
  );
  const dataSha256 = await sha256Text(csv);

  const schema: SpreadsheetSchemaDocument = {
    ...(previousSchema ?? emptySchema(spec, now)),
    biota_sheet_schema: BIOTA_SPREADSHEET_SCHEMA_VERSION,
    sheet_id: spec.id,
    title: spec.title,
    created: previousSchema?.created ?? now,
    modified: now,
    calculation: {
      engine: "univer",
      engine_version: BIOTA_SPREADSHEET_ENGINE_VERSION,
      mode: "automatic",
      locale: "en-US",
    },
    hashes: {
      data_sha256: dataSha256,
      metadata_sha256: metadataSha256,
    },
    dimensions,
    formulas: formulaMap,
    cell_types: cellTypes,
    workbook: cleanWorkbook,
  };

  return {
    csv,
    schema,
    schemaText: `${stringifyFrontmatterYaml(
      schema as unknown as FrontmatterMap
    )}\n`,
  };
}

/**
 * Resolve a vault-relative embed sidecar from the owning Markdown file without
 * relying on Node path APIs in the Tauri webview.
 */
export function resolveSpreadsheetPath(
  ownerPath: string,
  reference: string
): string {
  const owner = ownerPath.replaceAll("\\", "/");
  const target = reference.replaceAll("\\", "/");
  if (
    !owner ||
    !target ||
    owner.startsWith("/") ||
    target.startsWith("/") ||
    /^[a-z][a-z\d+.-]*:/i.test(target)
  ) {
    throw new Error(
      "Spreadsheet paths must be non-empty vault-relative paths."
    );
  }

  if (!owner || owner.startsWith("/")) {
    throw new Error(
      "The spreadsheet owner must be a vault-relative Markdown path."
    );
  }
  const segments = target.split("/");
  if (
    segments.some(
      (segment) =>
        !segment ||
        segment === "." ||
        segment === ".." ||
        segment.toLocaleLowerCase() === ".biota"
    )
  ) {
    throw new Error(
      "Spreadsheet paths cannot traverse or reference Biota's reserved metadata."
    );
  }
  return segments.join("/");
}
