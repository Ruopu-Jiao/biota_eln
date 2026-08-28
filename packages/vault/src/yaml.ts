import type {
  FrontmatterMap,
  FrontmatterScalar,
  FrontmatterValue,
  VaultDiagnostic,
} from "./types";

interface YamlLine {
  content: string;
  indent: number;
  line: number;
}

interface ParseState {
  lines: YamlLine[];
  rawLines: string[];
  diagnostics: VaultDiagnostic[];
}

interface BlockResult {
  value: FrontmatterValue;
  next: number;
}

function stripInlineComment(value: string) {
  let quote: "'" | '"' | undefined;
  let squareDepth = 0;
  let curlyDepth = 0;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    const previous = value[index - 1];

    if (quote) {
      if (character === quote) {
        if (quote === "'" && value[index + 1] === "'") {
          index += 1;
        } else if (quote === '"' && previous === "\\") {
          // Escaped quote.
        } else {
          quote = undefined;
        }
      }
      continue;
    }

    if (character === "'" || character === '"') {
      quote = character;
    } else if (character === "[") {
      squareDepth += 1;
    } else if (character === "]") {
      squareDepth -= 1;
    } else if (character === "{") {
      curlyDepth += 1;
    } else if (character === "}") {
      curlyDepth -= 1;
    } else if (
      character === "#" &&
      squareDepth === 0 &&
      curlyDepth === 0 &&
      (index === 0 || /\s/.test(previous))
    ) {
      return value.slice(0, index).trimEnd();
    }
  }

  return value.trimEnd();
}

function findTopLevelCharacter(value: string, sought: string) {
  let quote: "'" | '"' | undefined;
  let squareDepth = 0;
  let curlyDepth = 0;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    const previous = value[index - 1];

    if (quote) {
      if (character === quote) {
        if (quote === "'" && value[index + 1] === "'") {
          index += 1;
        } else if (quote === '"' && previous === "\\") {
          // Escaped quote.
        } else {
          quote = undefined;
        }
      }
      continue;
    }

    if (character === "'" || character === '"') {
      quote = character;
    } else if (character === "[") {
      squareDepth += 1;
    } else if (character === "]") {
      squareDepth -= 1;
    } else if (character === "{") {
      curlyDepth += 1;
    } else if (character === "}") {
      curlyDepth -= 1;
    } else if (character === sought && squareDepth === 0 && curlyDepth === 0) {
      return index;
    }
  }

  return -1;
}

function splitTopLevel(value: string, separator = ",") {
  const parts: string[] = [];
  let remaining = value;

  while (remaining.length > 0) {
    const splitAt = findTopLevelCharacter(remaining, separator);
    if (splitAt === -1) {
      parts.push(remaining.trim());
      break;
    }
    parts.push(remaining.slice(0, splitAt).trim());
    remaining = remaining.slice(splitAt + 1);
  }

  return parts.filter((part) => part.length > 0);
}

function parseDoubleQuoted(value: string) {
  try {
    return JSON.parse(value) as string;
  } catch {
    return value.slice(1, -1);
  }
}

function parseKey(value: string) {
  const trimmed = value.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return parseDoubleQuoted(trimmed);
  }
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1).replaceAll("''", "'");
  }
  return trimmed;
}

function parseInlineValue(rawValue: string): FrontmatterValue {
  const value = stripInlineComment(rawValue).trim();

  if (!value || value === "~" || /^(?:null|Null|NULL)$/.test(value)) {
    return null;
  }
  if (/^(?:true|True|TRUE)$/.test(value)) {
    return true;
  }
  if (/^(?:false|False|FALSE)$/.test(value)) {
    return false;
  }
  if (/^[-+]?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][-+]?\d+)?$/.test(value)) {
    const number = Number(value);
    if (Number.isFinite(number)) {
      return number;
    }
  }
  if (value.startsWith('"') && value.endsWith('"')) {
    return parseDoubleQuoted(value);
  }
  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1).replaceAll("''", "'");
  }
  // An unquoted wikilink is a string, not a nested YAML sequence.
  if (value.startsWith("[[") && value.endsWith("]]")) {
    return value;
  }
  if (value.startsWith("[") && value.endsWith("]")) {
    return splitTopLevel(value.slice(1, -1)).map(parseInlineValue);
  }
  if (value.startsWith("{") && value.endsWith("}")) {
    const object: FrontmatterMap = {};
    for (const pair of splitTopLevel(value.slice(1, -1))) {
      const colon = findTopLevelCharacter(pair, ":");
      if (colon !== -1) {
        object[parseKey(pair.slice(0, colon))] = parseInlineValue(
          pair.slice(colon + 1)
        );
      }
    }
    return object;
  }

  return value;
}

function mappingPair(content: string) {
  const colon = findTopLevelCharacter(content, ":");
  if (colon <= 0) {
    return undefined;
  }

  return {
    key: parseKey(content.slice(0, colon)),
    rawValue: content.slice(colon + 1).trimStart(),
  };
}

interface BlockScalarIndicator {
  style: "|" | ">";
  chomp: "clip" | "keep" | "strip";
  explicitIndent?: number;
}

function parseBlockScalarIndicator(
  rawValue: string
): BlockScalarIndicator | undefined {
  const value = stripInlineComment(rawValue).trim();
  const match = value.match(/^([|>])([1-9+-]{0,2})$/);
  if (!match) {
    return undefined;
  }

  const modifiers = match[2];
  const digit = modifiers.match(/[1-9]/)?.[0];
  const chomp = modifiers.includes("+")
    ? "keep"
    : modifiers.includes("-")
      ? "strip"
      : "clip";

  return {
    style: match[1] as "|" | ">",
    chomp,
    explicitIndent: digit ? Number(digit) : undefined,
  };
}

function foldBlockScalar(lines: string[]) {
  let folded = "";
  lines.forEach((line, index) => {
    folded += line;
    if (index === lines.length - 1) {
      return;
    }
    const next = lines[index + 1];
    folded += line === "" || next === "" ? "\n" : " ";
  });
  return folded;
}

function parseBlockScalar(
  state: ParseState,
  start: number,
  parentIndent: number,
  parentLine: number,
  indicator: BlockScalarIndicator
): BlockResult {
  let next = start;
  while (next < state.lines.length && state.lines[next].indent > parentIndent) {
    next += 1;
  }

  const endLine =
    next < state.lines.length
      ? state.lines[next].line - 1
      : state.rawLines.length;
  const rawContentLines = state.rawLines.slice(parentLine, endLine);
  const inferredIndent = rawContentLines.reduce<number | undefined>(
    (minimum, line) => {
      if (!line.trim()) {
        return minimum;
      }
      const indentation = line.match(/^ */)?.[0].length ?? 0;
      return minimum === undefined
        ? indentation
        : Math.min(minimum, indentation);
    },
    undefined
  );
  const contentIndent =
    indicator.explicitIndent === undefined
      ? (inferredIndent ?? parentIndent + 1)
      : parentIndent + indicator.explicitIndent;
  const contentLines = rawContentLines.map((line) => {
    if (!line.trim()) {
      return "";
    }
    return line.slice(Math.min(contentIndent, line.length));
  });
  const content =
    indicator.style === "|"
      ? contentLines.join("\n")
      : foldBlockScalar(contentLines);
  const withoutTrailingBreaks = content.replace(/\n+$/g, "");

  if (indicator.chomp === "strip") {
    return { value: withoutTrailingBreaks, next };
  }
  if (indicator.chomp === "keep") {
    return {
      value: `${content}${rawContentLines.length > 0 ? "\n" : ""}`,
      next,
    };
  }
  return {
    value: `${withoutTrailingBreaks}${rawContentLines.length > 0 ? "\n" : ""}`,
    next,
  };
}

function parseBlock(
  state: ParseState,
  start: number,
  indent: number
): BlockResult {
  const line = state.lines[start];
  if (!line) {
    return { value: null, next: start };
  }

  if (line.indent === indent && /^-(?:\s|$)/.test(line.content)) {
    return parseSequence(state, start, indent);
  }
  return parseMapping(state, start, indent);
}

function parseNestedOrNull(
  state: ParseState,
  next: number,
  parentIndent: number
): BlockResult {
  const following = state.lines[next];
  if (following && following.indent > parentIndent) {
    return parseBlock(state, next, following.indent);
  }
  return { value: null, next };
}

function parseMapping(
  state: ParseState,
  start: number,
  indent: number
): BlockResult {
  const object: FrontmatterMap = {};
  let index = start;

  while (index < state.lines.length) {
    const line = state.lines[index];
    if (
      line.indent < indent ||
      line.indent !== indent ||
      /^-(?:\s|$)/.test(line.content)
    ) {
      break;
    }

    const pair = mappingPair(line.content);
    if (!pair) {
      state.diagnostics.push({
        code: "frontmatter.invalid",
        message: `Expected a YAML mapping entry on line ${line.line}.`,
        severity: "error",
        line: line.line,
        column: line.indent + 1,
      });
      index += 1;
      continue;
    }

    const blockScalar = parseBlockScalarIndicator(pair.rawValue);
    if (blockScalar) {
      const parsed = parseBlockScalar(
        state,
        index + 1,
        indent,
        line.line,
        blockScalar
      );
      object[pair.key] = parsed.value;
      index = parsed.next;
    } else if (pair.rawValue === "") {
      const nested = parseNestedOrNull(state, index + 1, indent);
      object[pair.key] = nested.value;
      index = nested.next;
    } else {
      object[pair.key] = parseInlineValue(pair.rawValue);
      index += 1;
    }
  }

  return { value: object, next: index };
}

function parseSequenceObject(
  state: ParseState,
  pair: { key: string; rawValue: string },
  start: number,
  sequenceIndent: number
) {
  const object: FrontmatterMap = {};
  let index = start;

  const blockScalar = parseBlockScalarIndicator(pair.rawValue);
  if (blockScalar) {
    const parentLine = state.lines[Math.max(0, start - 1)]?.line ?? 1;
    const parsed = parseBlockScalar(
      state,
      index,
      sequenceIndent,
      parentLine,
      blockScalar
    );
    object[pair.key] = parsed.value;
    index = parsed.next;
  } else if (pair.rawValue === "") {
    const nested = parseNestedOrNull(state, index, sequenceIndent + 1);
    object[pair.key] = nested.value;
    index = nested.next;
  } else {
    object[pair.key] = parseInlineValue(pair.rawValue);
  }

  const nextLine = state.lines[index];
  if (
    nextLine &&
    nextLine.indent > sequenceIndent &&
    !/^-(?:\s|$)/.test(nextLine.content)
  ) {
    const remainder = parseMapping(state, index, nextLine.indent);
    if (
      typeof remainder.value === "object" &&
      remainder.value !== null &&
      !Array.isArray(remainder.value)
    ) {
      Object.assign(object, remainder.value);
    }
    index = remainder.next;
  }

  return { value: object, next: index };
}

function parseSequence(
  state: ParseState,
  start: number,
  indent: number
): BlockResult {
  const values: FrontmatterValue[] = [];
  let index = start;

  while (index < state.lines.length) {
    const line = state.lines[index];
    if (line.indent !== indent || !/^-(?:\s|$)/.test(line.content)) {
      break;
    }

    const rawValue = line.content.slice(1).trimStart();
    index += 1;

    if (rawValue === "") {
      const nested = parseNestedOrNull(state, index, indent);
      values.push(nested.value);
      index = nested.next;
      continue;
    }

    const pair = mappingPair(rawValue);
    if (pair) {
      const object = parseSequenceObject(state, pair, index, indent);
      values.push(object.value);
      index = object.next;
    } else {
      values.push(parseInlineValue(rawValue));
    }
  }

  return { value: values, next: index };
}

export interface YamlParseResult {
  value: FrontmatterMap;
  diagnostics: VaultDiagnostic[];
}

/**
 * Parses the conservative YAML subset Biota writes: mappings, sequences,
 * nested mappings/sequences, inline collections, and block/scalar values.
 * Unsupported syntax is reported as a diagnostic rather than evaluated.
 */
export function parseFrontmatterYaml(source: string): YamlParseResult {
  const diagnostics: VaultDiagnostic[] = [];
  const lines: YamlLine[] = [];
  const rawLines = source.split(/\r?\n/);

  rawLines.forEach((rawLine, index) => {
    if (!rawLine.trim() || rawLine.trimStart().startsWith("#")) {
      return;
    }
    if (/^\t+/.test(rawLine)) {
      diagnostics.push({
        code: "frontmatter.invalid",
        message: `Tabs are not supported for YAML indentation on line ${index + 1}.`,
        severity: "error",
        line: index + 1,
        column: 1,
      });
    }

    const indent = rawLine.match(/^ */)?.[0].length ?? 0;
    lines.push({
      content: rawLine.slice(indent),
      indent,
      line: index + 1,
    });
  });

  if (lines.length === 0) {
    return { value: {}, diagnostics };
  }

  if (lines[0].indent !== 0 || /^-(?:\s|$)/.test(lines[0].content)) {
    diagnostics.push({
      code: "frontmatter.invalid-root",
      message: "Biota frontmatter must be a top-level YAML mapping.",
      severity: "error",
      line: lines[0].line,
      column: lines[0].indent + 1,
    });
    return { value: {}, diagnostics };
  }

  const parsed = parseMapping({ lines, rawLines, diagnostics }, 0, 0);
  if (parsed.next < lines.length) {
    const line = lines[parsed.next];
    diagnostics.push({
      code: "frontmatter.invalid",
      message: `Could not parse YAML content on line ${line.line}.`,
      severity: "error",
      line: line.line,
      column: line.indent + 1,
    });
  }

  return {
    value:
      typeof parsed.value === "object" &&
      parsed.value !== null &&
      !Array.isArray(parsed.value)
        ? parsed.value
        : {},
    diagnostics,
  };
}

function serializeKey(key: string) {
  return /^[A-Za-z_][A-Za-z0-9_-]*$/.test(key) ? key : JSON.stringify(key);
}

function serializeScalar(value: FrontmatterScalar | undefined) {
  if (value === null || value === undefined) {
    return "null";
  }
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  return String(value);
}

function serializeValue(value: FrontmatterValue, indent: number): string[] {
  const indentation = " ".repeat(indent);

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return [`${indentation}[]`];
    }
    const lines: string[] = [];
    for (const item of value) {
      if (typeof item !== "object" || item === null) {
        lines.push(`${indentation}- ${serializeScalar(item)}`);
      } else {
        lines.push(`${indentation}-`);
        lines.push(...serializeValue(item, indent + 2));
      }
    }
    return lines;
  }

  if (typeof value === "object" && value !== null) {
    const entries = Object.entries(value);
    if (entries.length === 0) {
      return [`${indentation}{}`];
    }
    const lines: string[] = [];
    for (const [key, nested] of entries) {
      if (typeof nested !== "object" || nested === null) {
        lines.push(
          `${indentation}${serializeKey(key)}: ${serializeScalar(nested)}`
        );
      } else if (
        (Array.isArray(nested) && nested.length === 0) ||
        (!Array.isArray(nested) && Object.keys(nested).length === 0)
      ) {
        lines.push(
          `${indentation}${serializeKey(key)}: ${Array.isArray(nested) ? "[]" : "{}"}`
        );
      } else {
        lines.push(`${indentation}${serializeKey(key)}:`);
        lines.push(...serializeValue(nested, indent + 2));
      }
    }
    return lines;
  }

  return [`${indentation}${serializeScalar(value)}`];
}

export function stringifyFrontmatterYaml(frontmatter: FrontmatterMap) {
  return serializeValue(
    Object.fromEntries(
      Object.entries(frontmatter).filter(
        (entry): entry is [string, FrontmatterValue] => entry[1] !== undefined
      )
    ),
    0
  ).join("\n");
}
