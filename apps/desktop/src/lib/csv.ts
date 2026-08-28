export type AnalysisDataRow = {
  id: number;
  x: number;
  values: number[];
};

export type ParsedAnalysisDataset = {
  rows: AnalysisDataRow[];
  headers: string[];
  xHeader: string;
  valueHeaders: string[];
  sourceRowCount: number;
  columnCount: number;
  delimiter: "," | "\t" | ";";
  warnings: string[];
};

const delimiters = [",", "\t", ";"] as const;
const missingValues = new Set([
  "",
  "-",
  ".",
  "na",
  "n/a",
  "nan",
  "null",
  "none",
  "undefined",
]);

function isBlankRow(row: string[]) {
  return row.every((cell) => !cell.trim());
}

function parseDelimited(text: string, delimiter: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]!;
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === delimiter && !quoted) {
      row.push(field);
      field = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      row.push(field);
      if (!isBlankRow(row)) rows.push(row);
      row = [];
      field = "";
      if (character === "\r" && text[index + 1] === "\n") index += 1;
    } else {
      field += character;
    }
  }

  if (quoted) {
    throw new Error("The CSV contains an unterminated quoted field.");
  }
  row.push(field);
  if (!isBlankRow(row)) rows.push(row);
  return rows;
}

function detectDelimiter(text: string) {
  let best: { delimiter: (typeof delimiters)[number]; score: number } = {
    delimiter: ",",
    score: -1,
  };

  for (const delimiter of delimiters) {
    const rows = parseDelimited(text, delimiter).slice(0, 25);
    const widths = rows.map((row) => row.length).filter((width) => width > 1);
    const counts = new Map<number, number>();
    for (const width of widths) counts.set(width, (counts.get(width) ?? 0) + 1);
    const [modalWidth, modalCount] = [...counts].sort(
      (left, right) => right[1] - left[1] || right[0] - left[0]
    )[0] ?? [1, 0];
    const score = modalCount * 100 + widths.length * 10 + modalWidth;
    if (score > best.score) best = { delimiter, score };
  }

  return best.delimiter;
}

function parseNumericCell(value: string): number | undefined {
  let normalized = value.trim().replace(/\u00a0/g, " ");
  if (missingValues.has(normalized.toLowerCase())) return undefined;

  let negative = false;
  if (/^\(.*\)$/.test(normalized)) {
    negative = true;
    normalized = normalized.slice(1, -1).trim();
  }
  if (normalized.endsWith("%")) normalized = normalized.slice(0, -1).trim();
  normalized = normalized.replace(/\s+(?=\d{3}(?:\D|$))/g, "");

  if (/^[+-]?\d{1,3}(?:,\d{3})+(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(normalized)) {
    normalized = normalized.replaceAll(",", "");
  } else if (/^[+-]?(?:\d+,\d+|,\d+)(?:e[+-]?\d+)?$/i.test(normalized)) {
    normalized = normalized.replace(",", ".");
  }

  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(normalized)) {
    return undefined;
  }
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return undefined;
  return negative ? -parsed : parsed;
}

function hasHeader(rows: string[][]) {
  const first = rows[0];
  if (!first || rows.length < 2) return false;
  const later = rows.slice(1, 12);
  let headerSignals = 0;

  for (let column = 0; column < first.length; column += 1) {
    if (parseNumericCell(first[column] ?? "") !== undefined) continue;
    const laterNumeric = later.filter(
      (row) => parseNumericCell(row[column] ?? "") !== undefined
    ).length;
    if (laterNumeric >= Math.min(2, later.length)) headerSignals += 1;
  }

  return headerSignals > 0;
}

function uniqueHeaders(raw: string[], width: number) {
  const used = new Map<string, number>();
  return Array.from({ length: width }, (_, index) => {
    const base = raw[index]?.trim() || `Column ${index + 1}`;
    const count = (used.get(base.toLowerCase()) ?? 0) + 1;
    used.set(base.toLowerCase(), count);
    return count === 1 ? base : `${base} ${count}`;
  });
}

function normalizedHeader(header: string) {
  return header
    .toLowerCase()
    .replaceAll(/[_./()[\]-]+/g, " ")
    .replaceAll(/\s+/g, " ")
    .trim();
}

function xHeaderScore(header: string) {
  const value = normalizedHeader(header);
  if (value === "x") return 120;
  if (
    /^(concentration|dose|time|elapsed time|amount|temperature|wavelength|distance|dilution)( |$)/.test(
      value
    )
  ) {
    return 100;
  }
  if (
    /\b(concentration|dose|timepoint|time point|elapsed|amount|temperature|wavelength|distance|dilution)\b/.test(
      value
    )
  ) {
    return 80;
  }
  return 0;
}

function isIdentityHeader(header: string) {
  const value = normalizedHeader(header);
  return /^(replicate|rep|trial|well|sample|sample id|subject|subject id|id|index|row|group|condition)( number| no| #)?$/.test(
    value
  );
}

function responseHeaderScore(header: string) {
  const value = normalizedHeader(header);
  if (value === "y") return 120;
  if (/^(rep|replicate|repeat|r) ?\d+$/.test(value)) return 110;
  if (
    /\b(response|signal|fluorescence|luminescence|absorbance|intensity|viability|activity|value|measurement|readout|count|rate|velocity|ratio)\b/.test(
      value
    )
  ) {
    return 90;
  }
  return 0;
}

function numericColumns(rows: string[][], width: number) {
  return Array.from({ length: width }, (_, index) => {
    let nonMissing = 0;
    let numeric = 0;
    for (const row of rows) {
      const raw = row[index]?.trim() ?? "";
      if (missingValues.has(raw.toLowerCase())) continue;
      nonMissing += 1;
      if (parseNumericCell(raw) !== undefined) numeric += 1;
    }
    return {
      index,
      numeric,
      ratio: numeric / Math.max(1, nonMissing),
    };
  }).filter((column) => column.numeric >= 2 && column.ratio >= 0.65);
}

export function parseAnalysisCsv(input: string): ParsedAnalysisDataset {
  const text = input.replace(/^\uFEFF/, "");
  if (!text.trim()) throw new Error("The selected data file is empty.");

  const delimiter = detectDelimiter(text);
  const parsedRows = parseDelimited(text, delimiter);
  if (parsedRows.length < 2) {
    throw new Error("The data file needs at least two rows.");
  }

  const headerPresent = hasHeader(parsedRows);
  const sourceRows = headerPresent ? parsedRows.slice(1) : parsedRows;
  const width = Math.max(...parsedRows.map((row) => row.length));
  const headers = uniqueHeaders(
    headerPresent ? (parsedRows[0] ?? []) : [],
    width
  );
  const numeric = numericColumns(sourceRows, width);
  if (numeric.length < 2) {
    throw new Error(
      "Biota could not find both an X column and a numeric response column."
    );
  }

  const scoredX = numeric
    .map((column) => ({
      ...column,
      score: xHeaderScore(headers[column.index] ?? ""),
    }))
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.ratio - left.ratio ||
        left.index - right.index
    );
  const xIndex = scoredX[0]!.index;
  const remaining = numeric.filter(
    (column) =>
      column.index !== xIndex && !isIdentityHeader(headers[column.index] ?? "")
  );
  if (!remaining.length) {
    throw new Error("Biota could not find a numeric response column.");
  }
  const preferredResponses = remaining.filter(
    (column) => responseHeaderScore(headers[column.index] ?? "") > 0
  );
  const responseColumns = preferredResponses.length
    ? preferredResponses
    : remaining;

  const groups = new Map<number, number[]>();
  let skippedRows = 0;
  for (const row of sourceRows) {
    const x = parseNumericCell(row[xIndex] ?? "");
    const values = responseColumns
      .map((column) => parseNumericCell(row[column.index] ?? ""))
      .filter((value): value is number => value !== undefined);
    if (x === undefined || !values.length) {
      skippedRows += 1;
      continue;
    }
    groups.set(x, [...(groups.get(x) ?? []), ...values]);
  }

  if (groups.size < 2) {
    throw new Error(
      "The data file needs at least two distinct X values with numeric measurements."
    );
  }

  const rows = [...groups]
    .sort(([left], [right]) => left - right)
    .map(([x, values], index) => ({ id: index + 1, x, values }));
  const warnings: string[] = [];
  if (skippedRows) {
    warnings.push(
      `${skippedRows} source ${skippedRows === 1 ? "row was" : "rows were"} skipped because X or response values were missing.`
    );
  }

  return {
    rows,
    headers,
    xHeader: headers[xIndex]!,
    valueHeaders: responseColumns.map((column) => headers[column.index]!),
    sourceRowCount: sourceRows.length,
    columnCount: width,
    delimiter,
    warnings,
  };
}
