import { createBiotaId } from "@biota/vault";
import type {
  BiotaTask,
  FileTreeNode,
  ParsedFrontmatter,
  RecordType,
  VaultFile,
} from "@/types";

const taskLinePattern = /^(\s*)-\s+\[([ xX])\]\s+(.+)$/;
const taskMetadataPattern = /<!--\s*biota-task\s+([^>]+?)\s*-->/;
const wikilinkPattern = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

export function parseFrontmatter(markdown: string): ParsedFrontmatter {
  if (!markdown.startsWith("---\n")) {
    return { raw: "", data: {}, body: markdown };
  }

  const closingIndex = markdown.indexOf("\n---", 4);
  if (closingIndex === -1) {
    return { raw: "", data: {}, body: markdown };
  }

  const raw = markdown.slice(4, closingIndex);
  const data: ParsedFrontmatter["data"] = {};
  const lines = raw.split("\n");

  for (let index = 0; index < lines.length; index += 1) {
    const match = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(lines[index] ?? "");
    if (!match) continue;
    const key = match[1]!;
    const value = match[2]!.trim();

    if (!value && lines[index + 1]?.trimStart().startsWith("- ")) {
      const values: string[] = [];
      while (lines[index + 1]?.trimStart().startsWith("- ")) {
        index += 1;
        values.push(
          lines[index]!.trim()
            .slice(2)
            .replace(/^["']|["']$/g, "")
        );
      }
      data[key] = values;
    } else if (value === "true" || value === "false") {
      data[key] = value === "true";
    } else if (/^\d+$/.test(value)) {
      data[key] = Number(value);
    } else {
      data[key] = value.replace(/^["']|["']$/g, "");
    }
  }

  return {
    raw,
    data,
    body: markdown.slice(closingIndex + 4).replace(/^\n/, ""),
  };
}

export function inferRecordType(path: string, content = ""): RecordType {
  const fromFrontmatter = parseFrontmatter(content).data.biota_type;
  if (
    fromFrontmatter === "note" ||
    fromFrontmatter === "daily" ||
    fromFrontmatter === "experiment" ||
    fromFrontmatter === "protocol" ||
    fromFrontmatter === "project" ||
    fromFrontmatter === "entity" ||
    fromFrontmatter === "analysis"
  ) {
    return fromFrontmatter;
  }

  const folder = path.split("/")[0]?.toLowerCase();
  const byFolder: Record<string, RecordType> = {
    experiments: "experiment",
    protocols: "protocol",
    projects: "project",
    entities: "entity",
    analyses: "analysis",
    "daily notes": "daily",
  };
  return byFolder[folder ?? ""] ?? "note";
}

export function titleFromPath(path: string) {
  const name = path.split("/").at(-1) ?? "Untitled";
  return name.replace(/\.(md|markdown)$/i, "");
}

export function titleFromDocument(path: string, content: string) {
  const frontmatterTitle = parseFrontmatter(content).data.title;
  return typeof frontmatterTitle === "string" && frontmatterTitle.trim()
    ? frontmatterTitle.trim()
    : titleFromPath(path);
}

export function extractWikilinks(markdown: string) {
  return Array.from(markdown.matchAll(wikilinkPattern), (match) => ({
    target: match[1]!.trim(),
    alias: match[2]?.trim(),
  }));
}

function parseTaskAttributes(raw: string) {
  const attributes: Record<string, string> = {};
  for (const token of raw.matchAll(/([a-z_-]+)=(?:"([^"]*)"|(\S+))/gi)) {
    attributes[token[1]!] = token[2] ?? token[3] ?? "";
  }
  return attributes;
}

export function extractTasks(
  markdown: string,
  recordPath: string,
  recordTitle = titleFromPath(recordPath)
): BiotaTask[] {
  const lines = markdown.split("\n");
  const tasks: BiotaTask[] = [];

  lines.forEach((line, index) => {
    const match = taskLinePattern.exec(line);
    if (!match) return;

    const sameLineMetadata = taskMetadataPattern.exec(line);
    const nextLineMetadata = taskMetadataPattern.exec(lines[index + 1] ?? "");
    const attributes = parseTaskAttributes(
      (sameLineMetadata ?? nextLineMetadata)?.[1] ?? ""
    );
    const rawTitle = match[3]!.replace(taskMetadataPattern, "").trim();
    const checked = match[2]!.toLowerCase() === "x";
    const links = extractWikilinks(rawTitle).map((link) => link.target);
    const visibleTitle = rawTitle.replace(
      wikilinkPattern,
      (_whole, target, alias) => alias ?? target
    );

    tasks.push({
      id: attributes.id ?? `${recordPath}:${index + 1}`,
      title: visibleTitle,
      checked,
      state: checked
        ? "done"
        : attributes.state === "scheduled" ||
            attributes.state === "waiting" ||
            attributes.state === "inbox"
          ? attributes.state
          : attributes.start || attributes.due
            ? "scheduled"
            : "inbox",
      start: attributes.start,
      due: attributes.due,
      priority:
        attributes.priority === "high" || attributes.priority === "low"
          ? attributes.priority
          : "normal",
      recordPath,
      recordTitle,
      line: index + 1,
      links,
    });
  });

  return tasks;
}

export function toggleTaskInMarkdown(
  markdown: string,
  taskId: string,
  checked: boolean
) {
  const lines = markdown.split("\n");
  let changed = false;

  for (let index = 0; index < lines.length; index += 1) {
    const taskMatch = taskLinePattern.exec(lines[index] ?? "");
    if (!taskMatch) continue;
    const metadata = `${lines[index] ?? ""}\n${lines[index + 1] ?? ""}`;
    const fallbackId = taskId.endsWith(`:${index + 1}`);
    if (!metadata.includes(`id=${taskId}`) && !fallbackId) continue;

    lines[index] = (lines[index] ?? "").replace(
      /^(\s*-\s+\[)[ xX](\])/,
      `$1${checked ? "x" : " "}$2`
    );
    if (lines[index + 1]?.includes("biota-task")) {
      lines[index + 1] = /state=(inbox|scheduled|waiting|done)/.test(
        lines[index + 1]!
      )
        ? lines[index + 1]!.replace(
            /state=(inbox|scheduled|waiting|done)/,
            `state=${checked ? "done" : "inbox"}`
          )
        : lines[index + 1]!.replace(
            /\s*-->$/,
            ` state=${checked ? "done" : "inbox"} -->`
          );
    } else if (fallbackId) {
      lines.splice(
        index + 1,
        0,
        `${taskMatch[1]}  <!-- biota-task id=${createBiotaId()} state=${
          checked ? "done" : "inbox"
        } priority=normal -->`
      );
    }
    changed = true;
    break;
  }

  return changed ? lines.join("\n") : markdown;
}

export function updateTaskStateInMarkdown(
  markdown: string,
  taskId: string,
  state: BiotaTask["state"]
) {
  const lines = markdown.split("\n");

  for (let index = 0; index < lines.length; index += 1) {
    const taskMatch = taskLinePattern.exec(lines[index] ?? "");
    if (!taskMatch) continue;
    const fallbackId = taskId.endsWith(`:${index + 1}`);
    const metadataLineIndex = lines[index]!.includes("biota-task")
      ? index
      : lines[index + 1]?.includes("biota-task")
        ? index + 1
        : -1;
    if (metadataLineIndex === -1) {
      if (!fallbackId) continue;
      lines[index] = lines[index]!.replace(
        /^(\s*-\s+\[)[ xX](\])/,
        `$1${state === "done" ? "x" : " "}$2`
      );
      lines.splice(
        index + 1,
        0,
        `${taskMatch[1]}  <!-- biota-task id=${createBiotaId()} state=${state} priority=normal -->`
      );
      return lines.join("\n");
    }
    if (!lines[metadataLineIndex]!.includes(`id=${taskId}`) && !fallbackId)
      continue;

    lines[index] = lines[index]!.replace(
      /^(\s*-\s+\[)[ xX](\])/,
      `$1${state === "done" ? "x" : " "}$2`
    );
    lines[metadataLineIndex] = /state=(inbox|scheduled|waiting|done)/.test(
      lines[metadataLineIndex]!
    )
      ? lines[metadataLineIndex]!.replace(
          /state=(inbox|scheduled|waiting|done)/,
          `state=${state}`
        )
      : lines[metadataLineIndex]!.replace(/\s*-->$/, ` state=${state} -->`);
    return lines.join("\n");
  }

  return markdown;
}

export function createRecordMarkdown(
  type: RecordType,
  title: string,
  id = createBiotaId()
) {
  const now = new Date().toISOString();
  const statusLine = type === "experiment" ? "\nstatus: planned" : "";
  const headings: Record<RecordType, string> = {
    note: "## Notes\n\nStart writing here.",
    daily: "## Notes\n\n- [ ] ",
    experiment:
      "## Objective\n\nDescribe the scientific question.\n\n## Plan\n\n- [ ] Prepare materials\n" +
      `  <!-- biota-task id=${createBiotaId()} state=inbox priority=normal -->\n\n` +
      "## Observations\n\n## Results\n",
    protocol: "## Purpose\n\n## Materials\n\n## Procedure\n\n1. ",
    project: "## Goal\n\n## Active experiments\n\n## Notes\n",
    entity: "## Description\n\n## Files\n",
    analysis:
      "## Dataset\n\n## Analysis\n\n```biota-analysis\nmodel: descriptive\ninputs: []\n```\n",
  };

  return `---
biota_id: ${id}
biota_type: ${type}
biota_schema: 1
title: ${title}${statusLine}
created: ${now}
modified: ${now}
---

# ${title}

${headings[type]}
`;
}

export function recordFolder(type: RecordType) {
  const folders: Record<RecordType, string> = {
    note: "Notes",
    daily: "Daily Notes",
    experiment: "Experiments",
    protocol: "Protocols",
    project: "Projects",
    entity: "Entities",
    analysis: "Analyses",
  };
  return folders[type];
}

export function safeFileName(title: string) {
  return (
    title
      .trim()
      .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
      .replace(/\s+/g, " ")
      .replace(/\.+$/g, "") || "Untitled"
  );
}

export function buildFileTree(files: VaultFile[]): FileTreeNode[] {
  const root: FileTreeNode[] = [];
  const explicitDirectories = new Set(
    files.filter((file) => file.kind === "directory").map((file) => file.path)
  );

  for (const file of files.filter((candidate) => candidate.kind === "file")) {
    const parts = file.path.split("/").filter(Boolean);
    let level = root;
    let currentPath = "";

    parts.forEach((part, index) => {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const isLeaf = index === parts.length - 1;
      let node = level.find((candidate) => candidate.name === part);
      if (!node) {
        node = {
          name: part,
          path: currentPath,
          kind:
            isLeaf && !explicitDirectories.has(currentPath)
              ? "file"
              : "directory",
          recordType: isLeaf ? file.recordType : undefined,
          children: [],
        };
        level.push(node);
      }
      level = node.children;
    });
  }

  return root.sort(sortTree);
}

function sortTree(a: FileTreeNode, b: FileTreeNode) {
  if (a.kind !== b.kind) return a.kind === "directory" ? -1 : 1;
  return a.name.localeCompare(b.name, undefined, { numeric: true });
}
