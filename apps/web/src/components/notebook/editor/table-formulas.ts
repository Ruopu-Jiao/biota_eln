import type { EntryTableBlock } from "./types";

type FormulaToken =
  | { type: "number"; value: number }
  | { type: "cell"; value: string }
  | { type: "identifier"; value: string }
  | { type: "symbol"; value: string };

type FormulaRangeValue = number | null;
type TableFormulaValue = number | FormulaRangeValue[];

export interface TableCellDisplay {
  displayValue: string;
  error: string | null;
  formula: string | null;
  isFormula: boolean;
}

type EvaluationContext = {
  block: EntryTableBlock;
  cache: Map<string, TableCellDisplay>;
  stack: Set<string>;
};

const tokenPattern =
  /\s*([A-Za-z]+[0-9]+|[A-Za-z_][A-Za-z0-9_]*|\d+\.\d*|\.\d+|\d+|[()+\-*/,:])\s*/y;

function cellKey(rowIndex: number, columnIndex: number) {
  return `${rowIndex}:${columnIndex}`;
}

function parseCellReference(reference: string) {
  const match = reference.match(/^([A-Za-z]+)(\d+)$/);

  if (!match) {
    return null;
  }

  const [, columnLabel, rowLabel] = match;
  let columnIndex = 0;

  for (const character of columnLabel.toUpperCase()) {
    columnIndex = columnIndex * 26 + (character.charCodeAt(0) - 64);
  }

  return {
    rowIndex: Number.parseInt(rowLabel, 10) - 1,
    columnIndex: columnIndex - 1,
  };
}

function tokenizeFormula(formula: string) {
  const tokens: FormulaToken[] = [];
  let index = 0;

  while (index < formula.length) {
    tokenPattern.lastIndex = index;
    const match = tokenPattern.exec(formula);

    if (!match) {
      if (formula.slice(index).trim() === "") {
        break;
      }

      throw new Error("Unsupported formula syntax.");
    }

    const tokenValue = match[1] ?? "";
    index = tokenPattern.lastIndex;

    if (/^(?:\d|\.\d)/.test(tokenValue)) {
      tokens.push({
        type: "number",
        value: Number.parseFloat(tokenValue),
      });
      continue;
    }

    if (/^[A-Za-z]+[0-9]+$/.test(tokenValue)) {
      tokens.push({
        type: "cell",
        value: tokenValue.toUpperCase(),
      });
      continue;
    }

    if (/^[A-Za-z_]/.test(tokenValue)) {
      tokens.push({
        type: "identifier",
        value: tokenValue.toUpperCase(),
      });
      continue;
    }

    tokens.push({
      type: "symbol",
      value: tokenValue,
    });
  }

  return tokens;
}

function rawCellValue(block: EntryTableBlock, rowIndex: number, columnIndex: number) {
  return block.rows[rowIndex]?.[columnIndex] ?? "";
}

function coerceNumber(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return 0;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatNumber(value: number) {
  if (!Number.isFinite(value)) {
    throw new Error("Formula produced a non-finite value.");
  }

  const rounded = Math.round((value + Number.EPSILON) * 1_000_000) / 1_000_000;
  return `${rounded}`;
}

function flattenFormulaValues(values: TableFormulaValue[]) {
  return values.flatMap((value) => (Array.isArray(value) ? value : [value]));
}

function flattenNumericValues(values: TableFormulaValue[]) {
  return flattenFormulaValues(values).filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value),
  );
}

function readScalarValue(value: TableFormulaValue | undefined, name: string) {
  if (value === undefined) {
    throw new Error(`Function ${name} expects at least one value.`);
  }

  if (Array.isArray(value)) {
    const numericValues = value.filter(
      (entry): entry is number => typeof entry === "number" && Number.isFinite(entry),
    );

    if (numericValues.length !== 1) {
      throw new Error(`Function ${name} expects a single value.`);
    }

    return numericValues[0];
  }

  if (!Number.isFinite(value)) {
    throw new Error(`Function ${name} expects a numeric value.`);
  }

  return value;
}

function executeFunction(name: string, values: TableFormulaValue[]) {
  const numericValues = flattenNumericValues(values);

  switch (name) {
    case "SUM":
      return numericValues.reduce((sum, value) => sum + value, 0);
    case "AVERAGE":
      return numericValues.length
        ? numericValues.reduce((sum, value) => sum + value, 0) /
            numericValues.length
        : 0;
    case "MIN":
      return numericValues.length ? Math.min(...numericValues) : 0;
    case "MAX":
      return numericValues.length ? Math.max(...numericValues) : 0;
    case "COUNT":
      return numericValues.length;
    case "ABS":
      return Math.abs(readScalarValue(values[0], name));
    case "ROUND": {
      if (values.length > 2) {
        throw new Error("Function ROUND expects one or two values.");
      }

      const number = readScalarValue(values[0], name);
      const precision = values[1] === undefined ? 0 : Math.trunc(readScalarValue(values[1], name));
      const factor = 10 ** precision;
      const rounded = Math.round(Math.abs(number) * factor) / factor;
      return number < 0 ? -rounded : rounded;
    }
    default:
      throw new Error(`Unsupported function ${name}.`);
  }
}

function evaluateCellReference(reference: string, context: EvaluationContext): number {
  const coordinates = parseCellReference(reference);

  if (!coordinates) {
    throw new Error(`Unknown cell reference ${reference}.`);
  }

  const { rowIndex, columnIndex } = coordinates;
  const referenceKey = cellKey(rowIndex, columnIndex);

  if (context.stack.has(referenceKey)) {
    throw new Error("Circular cell reference.");
  }

  const cell = rawCellValue(context.block, rowIndex, columnIndex);
  const trimmedValue = cell.trim();

  if (!trimmedValue.startsWith("=")) {
    return coerceNumber(cell);
  }

  const nestedContext: EvaluationContext = {
    ...context,
    stack: new Set([...context.stack, referenceKey]),
  };
  const display = evaluateFormulaCell(rowIndex, columnIndex, nestedContext);

  if (display.error) {
    throw new Error(display.error);
  }

  return coerceNumber(display.displayValue);
}

function evaluateRange(
  startReference: string,
  endReference: string,
  context: EvaluationContext,
) {
  const start = parseCellReference(startReference);
  const end = parseCellReference(endReference);

  if (!start || !end) {
    throw new Error("Invalid range reference.");
  }

  const values: FormulaRangeValue[] = [];
  const rowStart = Math.min(start.rowIndex, end.rowIndex);
  const rowEnd = Math.max(start.rowIndex, end.rowIndex);
  const columnStart = Math.min(start.columnIndex, end.columnIndex);
  const columnEnd = Math.max(start.columnIndex, end.columnIndex);

  for (let rowIndex = rowStart; rowIndex <= rowEnd; rowIndex += 1) {
    for (
      let columnIndex = columnStart;
      columnIndex <= columnEnd;
      columnIndex += 1
    ) {
      const rawValue = rawCellValue(context.block, rowIndex, columnIndex);
      const trimmedValue = rawValue.trim();

      if (!trimmedValue) {
        values.push(null);
        continue;
      }

      if (trimmedValue.startsWith("=")) {
        const display = evaluateFormulaCell(rowIndex, columnIndex, context);

        if (display.error) {
          throw new Error(display.error);
        }

        values.push(Number(display.displayValue));
        continue;
      }

      const parsedValue = Number(trimmedValue);
      values.push(Number.isFinite(parsedValue) ? parsedValue : null);
    }
  }

  return values;
}

class FormulaParser {
  constructor(
    private readonly tokens: FormulaToken[],
    private readonly context: EvaluationContext,
  ) {}

  private index = 0;

  parse() {
    const value = this.parseExpression();

    if (this.peek()) {
      throw new Error("Unexpected trailing formula input.");
    }

    return value;
  }

  private parseExpression(): number {
    let value = this.parseTerm();

    while (true) {
      const token = this.peek();

      if (token?.type === "symbol" && (token.value === "+" || token.value === "-")) {
        this.index += 1;
        const right = this.parseTerm();
        value = token.value === "+" ? value + right : value - right;
        continue;
      }

      return value;
    }
  }

  private parseTerm(): number {
    let value = this.parseFactor();

    while (true) {
      const token = this.peek();

      if (token?.type === "symbol" && (token.value === "*" || token.value === "/")) {
        this.index += 1;
        const right = this.parseFactor();

        if (token.value === "/" && right === 0) {
          throw new Error("Division by zero.");
        }

        value = token.value === "*" ? value * right : value / right;
        continue;
      }

      return value;
    }
  }

  private parseFactor(): number {
    const token = this.peek();

    if (!token) {
      throw new Error("Incomplete formula.");
    }

    if (token.type === "symbol" && token.value === "(") {
      this.index += 1;
      const value = this.parseExpression();
      this.expectSymbol(")");
      return value;
    }

    if (token.type === "symbol" && (token.value === "+" || token.value === "-")) {
      this.index += 1;
      const value = this.parseFactor();
      return token.value === "-" ? -value : value;
    }

    if (token.type === "number") {
      this.index += 1;
      return token.value;
    }

    if (token.type === "cell") {
      this.index += 1;
      return evaluateCellReference(token.value, this.context);
    }

    if (token.type === "identifier") {
      this.index += 1;
      this.expectSymbol("(");
      const values = this.parseFunctionArguments();
      this.expectSymbol(")");
      return executeFunction(token.value, values);
    }

    throw new Error("Unsupported formula token.");
  }

  private parseFunctionArguments(): TableFormulaValue[] {
    const values: TableFormulaValue[] = [];

    if (this.peek()?.type === "symbol" && this.peek()?.value === ")") {
      return values;
    }

    while (true) {
      const token = this.peek();
      const next = this.peek(1);
      const third = this.peek(2);

      if (
        token?.type === "cell" &&
        next?.type === "symbol" &&
        next.value === ":" &&
        third?.type === "cell"
      ) {
        this.index += 3;
        values.push(evaluateRange(token.value, third.value, this.context));
      } else {
        values.push(this.parseExpression());
      }

      if (this.peek()?.type === "symbol" && this.peek()?.value === ",") {
        this.index += 1;
        continue;
      }

      return values;
    }
  }

  private expectSymbol(symbol: string) {
    const token = this.peek();

    if (token?.type !== "symbol" || token.value !== symbol) {
      throw new Error(`Expected ${symbol}.`);
    }

    this.index += 1;
  }

  private peek(offset = 0) {
    return this.tokens[this.index + offset];
  }
}

function evaluateFormulaCell(
  rowIndex: number,
  columnIndex: number,
  context: EvaluationContext,
): TableCellDisplay {
  const key = cellKey(rowIndex, columnIndex);
  const cached = context.cache.get(key);

  if (cached) {
    return cached;
  }

  const rawValue = rawCellValue(context.block, rowIndex, columnIndex);
  const trimmedValue = rawValue.trim();

  if (!trimmedValue.startsWith("=")) {
    const display = {
      displayValue: rawValue,
      error: null,
      formula: null,
      isFormula: false,
    } satisfies TableCellDisplay;
    context.cache.set(key, display);
    return display;
  }

  try {
    const parser = new FormulaParser(
      tokenizeFormula(trimmedValue.slice(1)),
      context,
    );
    const value = parser.parse();
    const display = {
      displayValue: formatNumber(value),
      error: null,
      formula: trimmedValue,
      isFormula: true,
    } satisfies TableCellDisplay;

    context.cache.set(key, display);
    return display;
  } catch (error) {
    const display = {
      displayValue: "#ERROR",
      error: error instanceof Error ? error.message : "Formula error.",
      formula: trimmedValue,
      isFormula: true,
    } satisfies TableCellDisplay;

    context.cache.set(key, display);
    return display;
  }
}

export function createTableFormulaResolver(block: EntryTableBlock) {
  const cache = new Map<string, TableCellDisplay>();

  return (rowIndex: number, columnIndex: number) =>
    evaluateFormulaCell(rowIndex, columnIndex, {
      block,
      cache,
      stack: new Set([cellKey(rowIndex, columnIndex)]),
    });
}
