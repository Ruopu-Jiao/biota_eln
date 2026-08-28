import {
  TASK_STATES,
  type FrontmatterValue,
  type MarkdownLink,
  type MarkdownRecord,
  type RecordLink,
  type SidecarKind,
  type SidecarReference,
  type TaskMetadata,
  type TaskPriority,
  type TaskState,
  type VaultTask,
  type WikiLink,
} from "./types";
import { parseBiotaSheetBlocks } from "./sheets";

function isEscaped(source: string, index: number) {
  let slashes = 0;
  for (
    let cursor = index - 1;
    cursor >= 0 && source[cursor] === "\\";
    cursor -= 1
  ) {
    slashes += 1;
  }
  return slashes % 2 === 1;
}

function blankRange(characters: string[], start: number, end: number) {
  for (let index = start; index < end; index += 1) {
    if (characters[index] !== "\n" && characters[index] !== "\r") {
      characters[index] = " ";
    }
  }
}

/**
 * Blanks fenced code, inline code, and HTML comments while retaining offsets.
 * Extractors can therefore ignore non-content regions and still report ranges
 * against the original Markdown.
 */
function maskMarkdownNonContent(source: string) {
  const characters = [...source];
  const linePattern = /.*(?:\r?\n|$)/g;
  let fence:
    | {
        character: "`" | "~";
        length: number;
      }
    | undefined;

  for (const match of source.matchAll(linePattern)) {
    if (!match[0]) {
      continue;
    }
    const line = match[0].replace(/\r?\n$/, "");
    const fenceMatch = line.match(/^[ ]{0,3}(`{3,}|~{3,})/);
    const offset = match.index;

    if (!fence && fenceMatch) {
      fence = {
        character: fenceMatch[1][0] as "`" | "~",
        length: fenceMatch[1].length,
      };
      blankRange(characters, offset, offset + match[0].length);
      continue;
    }
    if (fence) {
      blankRange(characters, offset, offset + match[0].length);
      const close = line.match(/^[ ]{0,3}(`{3,}|~{3,})[ \t]*$/);
      if (
        close &&
        close[1][0] === fence.character &&
        close[1].length >= fence.length
      ) {
        fence = undefined;
      }
    }
  }

  let masked = characters.join("");
  for (const match of masked.matchAll(/(`+)([^\n]*?)\1/g)) {
    blankRange(characters, match.index, match.index + match[0].length);
  }
  masked = characters.join("");
  for (const match of masked.matchAll(/<!--[\s\S]*?-->/g)) {
    blankRange(characters, match.index, match.index + match[0].length);
  }

  return characters.join("");
}

function splitWikiTarget(target: string) {
  const headingAt = target.indexOf("#");
  const rawPath = headingAt === -1 ? target : target.slice(0, headingAt);
  const fragment = headingAt === -1 ? undefined : target.slice(headingAt + 1);

  return {
    path: rawPath.trim(),
    heading: fragment && !fragment.startsWith("^") ? fragment : undefined,
    block: fragment?.startsWith("^") ? fragment.slice(1) : undefined,
  };
}

export function extractWikiLinks(source: string): WikiLink[] {
  const masked = maskMarkdownNonContent(source);
  const links: WikiLink[] = [];
  const pattern = /!?\[\[([^\]\n]+)\]\]/g;

  for (const match of masked.matchAll(pattern)) {
    if (isEscaped(source, match.index)) {
      continue;
    }
    const raw = source.slice(match.index, match.index + match[0].length);
    const embed = raw.startsWith("!");
    const inner = raw.slice(embed ? 3 : 2, -2);
    const aliasAt = inner.indexOf("|");
    const target = (aliasAt === -1 ? inner : inner.slice(0, aliasAt)).trim();
    if (!target) {
      continue;
    }
    const alias =
      aliasAt === -1 ? undefined : inner.slice(aliasAt + 1).trim() || undefined;
    const components = splitWikiTarget(target);

    links.push({
      raw,
      target,
      ...components,
      alias,
      embed,
      start: match.index,
      end: match.index + match[0].length,
    });
  }

  return links;
}

function parseMarkdownTarget(raw: string) {
  const trimmed = raw.trim();
  if (trimmed.startsWith("<")) {
    const closing = trimmed.indexOf(">");
    if (closing !== -1) {
      return {
        target: trimmed.slice(1, closing),
        title:
          trimmed
            .slice(closing + 1)
            .trim()
            .replace(/^["']|["']$/g, "") || undefined,
      };
    }
  }

  const title = trimmed.match(/^(\S+)(?:\s+["'](.+)["'])$/);
  return {
    target: title?.[1] ?? trimmed,
    title: title?.[2],
  };
}

export function extractMarkdownLinks(source: string): MarkdownLink[] {
  const masked = maskMarkdownNonContent(source);
  const links: MarkdownLink[] = [];
  const pattern = /!?\[([^\]\n]*)\]\(([^)\n]+)\)/g;

  for (const match of masked.matchAll(pattern)) {
    if (isEscaped(source, match.index)) {
      continue;
    }
    const raw = source.slice(match.index, match.index + match[0].length);
    const embed = raw.startsWith("!");
    const parsed = parseMarkdownTarget(match[2]);
    if (!parsed.target) {
      continue;
    }
    links.push({
      raw,
      label: match[1],
      target: parsed.target,
      title: parsed.title,
      embed,
      start: match.index,
      end: match.index + match[0].length,
    });
  }

  return links;
}

export function extractTags(source: string) {
  const masked = maskMarkdownNonContent(source);
  const tags: string[] = [];
  const seen = new Set<string>();
  const pattern = /(^|[\s(,;])#([\p{L}\p{N}_][\p{L}\p{N}_/-]*)/gu;

  for (const match of masked.matchAll(pattern)) {
    const hashIndex = match.index + match[1].length;
    if (isEscaped(source, hashIndex)) {
      continue;
    }
    const tag = match[2];
    const normalized = tag.toLocaleLowerCase();
    if (!seen.has(normalized)) {
      seen.add(normalized);
      tags.push(tag);
    }
  }

  return tags;
}

function parseTaskAttributes(source: string) {
  const attributes: Record<string, string> = {};
  const pattern = /([A-Za-z][A-Za-z0-9_-]*)=(?:"([^"]*)"|'([^']*)'|([^\s]+))/g;
  for (const match of source.matchAll(pattern)) {
    attributes[match[1]] = match[2] ?? match[3] ?? match[4];
  }
  return attributes;
}

function taskState(value: string | undefined, checked: boolean): TaskState {
  if (value && TASK_STATES.includes(value as TaskState)) {
    return value as TaskState;
  }
  return checked ? "done" : "inbox";
}

function taskPriority(value: string | undefined): TaskPriority | undefined {
  return value === "low" ||
    value === "normal" ||
    value === "high" ||
    value === "urgent"
    ? value
    : undefined;
}

interface MarkdownLine {
  text: string;
  raw: string;
  start: number;
}

function markdownLines(source: string) {
  const lines: MarkdownLine[] = [];
  const pattern = /.*(?:\r?\n|$)/g;
  for (const match of source.matchAll(pattern)) {
    if (!match[0]) {
      continue;
    }
    lines.push({
      text: match[0].replace(/\r?\n$/, ""),
      raw: match[0],
      start: match.index,
    });
  }
  return lines;
}

export function extractTasks(source: string, sourcePath?: string): VaultTask[] {
  const lines = markdownLines(source);
  const tasks: VaultTask[] = [];
  let inFence:
    | {
        character: string;
        length: number;
      }
    | undefined;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const fence = line.text.match(/^[ ]{0,3}(`{3,}|~{3,})/);
    if (fence) {
      if (!inFence) {
        inFence = { character: fence[1][0], length: fence[1].length };
      } else if (
        fence[1][0] === inFence.character &&
        fence[1].length >= inFence.length
      ) {
        inFence = undefined;
      }
      continue;
    }
    if (inFence) {
      continue;
    }

    const task = line.text.match(/^([ \t]*)([-*+])\s+\[([ xX])\]\s*(.*?)\s*$/);
    if (!task) {
      continue;
    }

    const inlineMetadata = task[4].match(
      /^(.*?)[ \t]*<!--\s*biota-task(?:\s+([\s\S]*?))?\s*-->[ \t]*$/
    );
    let title = (inlineMetadata?.[1] ?? task[4]).trimEnd();
    let attributeSource = inlineMetadata?.[2] ?? "";
    let end = line.start + line.raw.length;
    let raw = line.raw.replace(/\r?\n$/, "");

    const following = lines[index + 1];
    const metadataLine = following?.text.match(
      /^[ \t]*<!--\s*biota-task(?:\s+([\s\S]*?))?\s*-->[ \t]*$/
    );
    if (!inlineMetadata && following && metadataLine) {
      attributeSource = metadataLine[1] ?? "";
      end = following.start + following.raw.length;
      raw = `${line.raw}${following.raw}`.replace(/\r?\n$/, "");
      index += 1;
    }

    // Avoid treating an inline HTML comment as task title content.
    title = title.replace(/[ \t]*<!--[\s\S]*?-->[ \t]*$/, "").trimEnd();
    const attributes = parseTaskAttributes(attributeSource);
    const checked = task[3].toLowerCase() === "x";
    const state = taskState(attributes.state, checked);
    const metadata: TaskMetadata = {
      ...attributes,
      state,
    };
    const titleOffset = line.text.indexOf(task[4]);
    const links = extractWikiLinks(title).map((link) => ({
      ...link,
      start: line.start + titleOffset + link.start,
      end: line.start + titleOffset + link.end,
    }));

    tasks.push({
      id: attributes.id,
      title,
      checked,
      state,
      startDate: attributes.start,
      dueDate: attributes.due,
      priority: taskPriority(attributes.priority),
      project: attributes.project,
      experiment: attributes.experiment,
      metadata,
      links,
      line: index + (metadataLine ? 0 : 1),
      sourcePath,
      raw,
      start: line.start,
      end,
    });
  }

  return tasks;
}

function normalizedSidecarPath(target: string) {
  return target
    .trim()
    .replace(/^<|>$/g, "")
    .split(/[?#]/, 1)[0]
    .replace(/\\/g, "/");
}

export function classifySidecar(path: string): SidecarKind | undefined {
  const normalized = normalizedSidecarPath(path).toLocaleLowerCase();
  if (
    /^\d{4}-\d{2}-\d{2}t\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:z|[+-]\d{2}:\d{2})$/i.test(
      normalized
    ) ||
    /^[a-z][a-z0-9+.-]*:/i.test(normalized)
  ) {
    return undefined;
  }
  if (
    /\.(?:gb|gbk|genbank|fa|fasta|fna|ffn|faa|frn|dna|ab1)$/.test(normalized)
  ) {
    return "sequence";
  }
  if (/\.(?:csv|tsv|xlsx|xls)$/.test(normalized)) {
    return "dataset";
  }
  if (/(?:\.schema)?\.(?:yaml|yml)$/.test(normalized)) {
    return "schema";
  }
  if (/\.(?:svg|png|pdf|json|html)$/.test(normalized)) {
    return "analysis-output";
  }
  if (/\.[A-Za-z0-9]{1,10}$/.test(normalized)) {
    return "attachment";
  }
  return undefined;
}

function walkFrontmatter(
  value: FrontmatterValue,
  field: string,
  visit: (value: string, field: string) => void
) {
  if (typeof value === "string") {
    visit(value, field);
  } else if (Array.isArray(value)) {
    value.forEach((item) => walkFrontmatter(item, field, visit));
  } else if (typeof value === "object" && value !== null) {
    Object.entries(value).forEach(([key, nested]) => {
      walkFrontmatter(nested, field ? `${field}.${key}` : key, visit);
    });
  }
}

export function extractSidecarReferences(
  record: Pick<MarkdownRecord, "frontmatter" | "body">
): SidecarReference[] {
  const references: SidecarReference[] = [];
  const seen = new Set<string>();
  const append = (reference: SidecarReference) => {
    const key = `${reference.origin}:${reference.field ?? ""}:${reference.path}`;
    if (!seen.has(key)) {
      seen.add(key);
      references.push(reference);
    }
  };

  Object.entries(record.frontmatter).forEach(([field, value]) => {
    walkFrontmatter(value, field, (candidate, nestedField) => {
      const wikiLinks = extractWikiLinks(candidate);
      const paths =
        wikiLinks.length > 0 ? wikiLinks.map((link) => link.path) : [candidate];
      paths.forEach((path) => {
        const normalized = normalizedSidecarPath(path);
        const kind = classifySidecar(normalized);
        const forcedAttachment = /(?:^|\.)(?:attachment|attachments)$/.test(
          nestedField
        );
        if (kind || forcedAttachment) {
          append({
            path: normalized,
            kind: kind ?? "attachment",
            origin: "frontmatter",
            field: nestedField,
          });
        }
      });
    });
  });

  for (const block of parseBiotaSheetBlocks(record.body)) {
    if (!block.spec) continue;
    append({
      path: block.spec.data,
      kind: "dataset",
      origin: "body",
      field: "biota-sheet.data",
      range: { start: block.from, end: block.to },
    });
    append({
      path: block.spec.schema,
      kind: "schema",
      origin: "body",
      field: "biota-sheet.schema",
      range: { start: block.from, end: block.to },
    });
  }

  for (const link of extractWikiLinks(record.body)) {
    const kind = classifySidecar(link.path);
    if (kind) {
      append({
        path: normalizedSidecarPath(link.path),
        kind,
        origin: "body",
        range: { start: link.start, end: link.end },
      });
    }
  }
  for (const link of extractMarkdownLinks(record.body)) {
    const kind = classifySidecar(link.target);
    if (kind) {
      append({
        path: normalizedSidecarPath(link.target),
        kind,
        origin: "body",
        range: { start: link.start, end: link.end },
      });
    }
  }

  return references;
}

function appendFrontmatterWikiLinks(
  value: FrontmatterValue,
  links: RecordLink[],
  sourceId?: string,
  sourcePath?: string
) {
  if (typeof value === "string") {
    for (const link of extractWikiLinks(value)) {
      links.push({
        sourceId,
        sourcePath,
        target: link.target,
        targetPath: link.path,
        alias: link.alias,
        kind: link.embed ? "embed" : "wikilink",
      });
    }
  } else if (Array.isArray(value)) {
    value.forEach((item) =>
      appendFrontmatterWikiLinks(item, links, sourceId, sourcePath)
    );
  } else if (typeof value === "object" && value !== null) {
    Object.values(value).forEach((item) =>
      appendFrontmatterWikiLinks(item, links, sourceId, sourcePath)
    );
  }
}

export function extractRecordLinks(record: MarkdownRecord): RecordLink[] {
  const links: RecordLink[] = [];
  const sourceId =
    typeof record.frontmatter.biota_id === "string"
      ? record.frontmatter.biota_id
      : undefined;

  Object.values(record.frontmatter).forEach((value) => {
    appendFrontmatterWikiLinks(value, links, sourceId, record.path);
  });
  for (const link of extractWikiLinks(record.body)) {
    links.push({
      sourceId,
      sourcePath: record.path,
      target: link.target,
      targetPath: link.path,
      alias: link.alias,
      kind: link.embed ? "embed" : "wikilink",
      range: { start: link.start, end: link.end },
    });
  }
  for (const link of extractMarkdownLinks(record.body)) {
    if (/\.md(?:$|[?#])/i.test(link.target)) {
      links.push({
        sourceId,
        sourcePath: record.path,
        target: link.target,
        targetPath: link.target.replace(/\.md(?=$|[?#])/i, ""),
        kind: "markdown",
        range: { start: link.start, end: link.end },
      });
    }
  }

  return links;
}
