#!/usr/bin/env node

import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { randomBytes, randomUUID } from "node:crypto";

const recordFolders = {
  entry: "Experiments",
  protocol: "Protocols",
  entity: "Entities",
};

const crockford = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function biotaId(timestamp = Date.now()) {
  let time = BigInt(timestamp);
  const encodedTime = Array(10);
  for (let index = encodedTime.length - 1; index >= 0; index -= 1) {
    encodedTime[index] = crockford[Number(time & 31n)];
    time >>= 5n;
  }

  let entropy = 0n;
  for (const byte of randomBytes(10)) {
    entropy = (entropy << 8n) | BigInt(byte);
  }
  const encodedEntropy = Array(16);
  for (let index = encodedEntropy.length - 1; index >= 0; index -= 1) {
    encodedEntropy[index] = crockford[Number(entropy & 31n)];
    entropy >>= 5n;
  }
  return [...encodedTime, ...encodedEntropy].join("");
}

function canonicalStatus(type, value) {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
    .replaceAll("_", "-");
  if (type !== "experiment") {
    return normalized || undefined;
  }
  if (["active", "in-progress", "running"].includes(normalized))
    return "active";
  if (["complete", "completed", "done"].includes(normalized)) return "complete";
  if (["finalized", "final"].includes(normalized)) return "finalized";
  if (["archived", "cancelled", "canceled"].includes(normalized))
    return "archived";
  return "planned";
}

function compactFileName(value, fallback) {
  const normalized = String(value || fallback)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/g, "");
  return normalized || fallback;
}

function yamlString(value) {
  return JSON.stringify(String(value));
}

function yamlList(values) {
  return `[${values.map((value) => yamlString(value)).join(", ")}]`;
}

function markdownTable(block) {
  const columns = block.columns?.length ? block.columns : ["A"];
  const header = `| ${columns.join(" | ")} |`;
  const separator = `| ${columns.map(() => "---").join(" | ")} |`;
  const rows = (block.rows ?? []).map(
    (row) =>
      `| ${columns
        .map((_, index) => String(row[index] ?? "").replaceAll("|", "\\|"))
        .join(" | ")} |`
  );
  return [block.name ? `### ${block.name}` : "", header, separator, ...rows]
    .filter(Boolean)
    .join("\n");
}

function entryBody(entry, protocolsById, entitiesById) {
  if (!Array.isArray(entry.blocks) || !entry.blocks.length) {
    return entry.bodyText ?? "";
  }
  return entry.blocks
    .map((block) => {
      if (block.type === "text") {
        return block.text ?? block.content ?? "";
      }
      if (block.type === "table") {
        return markdownTable(block);
      }
      if (block.type === "protocol") {
        const title =
          protocolsById.get(block.protocolId)?.title ?? block.protocolId;
        return `> Protocol: [[Protocols/${compactFileName(title, "Protocol")}]]`;
      }
      if (block.type === "entity") {
        const title =
          entitiesById.get(block.entityId)?.name ??
          block.label ??
          block.entityId;
        return `> Entity: [[Entities/${compactFileName(title, "Entity")}]]`;
      }
      return "";
    })
    .filter(Boolean)
    .join("\n\n");
}

function recordMarkdown(input) {
  const frontmatter = [
    "---",
    `biota_id: ${yamlString(input.id)}`,
    `biota_type: ${input.type}`,
    "biota_schema: 1",
    `title: ${yamlString(input.title)}`,
    `created: ${yamlString(input.created)}`,
    `modified: ${yamlString(input.modified)}`,
  ];
  if (input.status) {
    frontmatter.splice(5, 0, `status: ${input.status}`);
  }
  if (input.aliases?.length) {
    frontmatter.push(`aliases: ${yamlList(input.aliases)}`);
  }
  if (input.sequenceFile) {
    frontmatter.push(`sequence: ${yamlString(`[[${input.sequenceFile}]]`)}`);
  }
  if (input.legacyId) {
    frontmatter.push(`legacy_id: ${yamlString(input.legacyId)}`);
  }
  frontmatter.push(
    "---",
    "",
    `# ${input.title}`,
    "",
    input.body?.trim() ?? "",
    ""
  );
  return frontmatter.join("\n");
}

function formatGenbank(entity) {
  const sequence = String(entity.sequence ?? "")
    .replace(/[^A-Za-z]/g, "")
    .toLowerCase()
    .replaceAll("u", "t");
  const topology = entity.topology === "circular" ? "circular" : "linear";
  const name = compactFileName(entity.name, "sequence")
    .replace(/\s+/g, "_")
    .slice(0, 16);
  const locus = `LOCUS       ${name.padEnd(16)} ${String(
    sequence.length
  ).padStart(7)} bp    DNA     ${topology}`;
  const featureLines = ["FEATURES             Location/Qualifiers"];
  for (const feature of entity.features ?? []) {
    const start = Math.max(1, Number(feature.start) || 1);
    const end = Math.max(start, Number(feature.end) || start);
    const range =
      feature.strand === -1
        ? `complement(${start}..${end})`
        : `${start}..${end}`;
    featureLines.push(
      `     ${(feature.type || "misc_feature").slice(0, 15).padEnd(16)}${range}`
    );
    featureLines.push(
      `                     /label=${yamlString(feature.name || "Feature")}`
    );
    if (feature.notes) {
      featureLines.push(
        `                     /note=${yamlString(String(feature.notes).replaceAll("\n", " "))}`
      );
    }
  }
  const origin = ["ORIGIN"];
  for (let offset = 0; offset < sequence.length; offset += 60) {
    const line = sequence
      .slice(offset, offset + 60)
      .match(/.{1,10}/g)
      ?.join(" ");
    origin.push(`${String(offset + 1).padStart(9)} ${line ?? ""}`);
  }
  return [
    locus,
    `DEFINITION  ${entity.description || entity.name || "Imported sequence"}.`,
    ...featureLines,
    ...origin,
    "//",
    "",
  ].join("\n");
}

async function exists(target) {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}

async function atomicWrite(target, content) {
  await mkdir(path.dirname(target), { recursive: true });
  const temporary = path.join(
    path.dirname(target),
    `.${path.basename(target)}.${randomUUID()}.tmp`
  );
  await writeFile(temporary, content, "utf8");
  await rename(temporary, target);
}

async function loadJson(target, fallback) {
  try {
    return JSON.parse(await readFile(target, "utf8"));
  } catch {
    return fallback;
  }
}

export async function migrateLegacyVault({
  source,
  target,
  write = false,
  now = new Date().toISOString(),
}) {
  const notebook = await loadJson(path.join(source, "demo-notebook.json"), {
    entries: [],
    protocols: [],
  });
  const entityStore = await loadJson(path.join(source, "demo-entities.json"), {
    entities: [],
  });
  const entries = Array.isArray(notebook.entries) ? notebook.entries : [];
  const protocols = Array.isArray(notebook.protocols) ? notebook.protocols : [];
  const entities = Array.isArray(entityStore.entities)
    ? entityStore.entities
    : [];
  const protocolsById = new Map(protocols.map((record) => [record.id, record]));
  const entitiesById = new Map(entities.map((record) => [record.id, record]));
  const candidates = [];

  for (const protocol of protocols) {
    const title = protocol.title || "Untitled protocol";
    candidates.push({
      kind: "protocol",
      path: path.join(
        recordFolders.protocol,
        `${compactFileName(title, "Protocol")}.md`
      ),
      content: recordMarkdown({
        id: biotaId(),
        legacyId: protocol.id,
        type: "protocol",
        title,
        status: canonicalStatus("protocol", protocol.status),
        created: protocol.createdAt || protocol.updatedAt || now,
        modified: protocol.updatedAt || now,
        body: protocol.bodyText || protocol.summary || "",
      }),
    });
  }

  for (const entity of entities) {
    const title = entity.name || "Untitled sequence";
    const base = compactFileName(title, "Sequence");
    const sequencePath = path.join("Sequences", `${base}.gb`);
    candidates.push({
      kind: "sequence",
      path: sequencePath,
      content: formatGenbank(entity),
    });
    candidates.push({
      kind: "entity",
      path: path.join(recordFolders.entity, `${base}.md`),
      content: recordMarkdown({
        id: biotaId(),
        legacyId: entity.id,
        type: "entity",
        title,
        status: canonicalStatus("entity", entity.status),
        created: entity.createdAt || now,
        modified: entity.updatedAt || now,
        aliases: entity.aliases ?? [],
        sequenceFile: sequencePath.replaceAll(path.sep, "/"),
        body: [entity.description, entity.notes].filter(Boolean).join("\n\n"),
      }),
    });
  }

  for (const entry of entries) {
    const title = entry.title || "Untitled experiment";
    candidates.push({
      kind: "entry",
      path: path.join(
        recordFolders.entry,
        `${compactFileName(title, "Experiment")}.md`
      ),
      content: recordMarkdown({
        id: biotaId(),
        legacyId: entry.id,
        type: "experiment",
        title,
        status: canonicalStatus("experiment", entry.status),
        created: entry.createdAt || entry.updatedAt || now,
        modified: entry.updatedAt || now,
        body: entryBody(entry, protocolsById, entitiesById),
      }),
    });
  }

  const report = {
    source: path.resolve(source),
    target: path.resolve(target),
    dryRun: !write,
    planningRecordsSkipped: Array.isArray(notebook.planningWhiteboards)
      ? notebook.planningWhiteboards.length
      : 0,
    candidates: candidates.map(({ kind, path: relativePath }) => ({
      kind,
      path: relativePath,
    })),
    written: [],
    skipped: [],
  };

  if (!write) {
    return report;
  }

  const folders = [
    ".biota/history/objects",
    "Experiments",
    "Protocols",
    "Projects",
    "Entities",
    "Sequences",
    "Data",
    "Attachments",
    "Daily Notes",
    "Analyses",
  ];
  await Promise.all(
    folders.map((folder) =>
      mkdir(path.join(target, folder), { recursive: true })
    )
  );
  const manifestPath = path.join(target, ".biota", "vault.json");
  if (!(await exists(manifestPath))) {
    await atomicWrite(
      manifestPath,
      `${JSON.stringify(
        {
          schema: 1,
          vault_id: randomUUID(),
          name: path.basename(path.resolve(target)),
          created: now,
        },
        null,
        2
      )}\n`
    );
  }

  for (const candidate of candidates) {
    const destination = path.join(target, candidate.path);
    if (await exists(destination)) {
      report.skipped.push(candidate.path);
      continue;
    }
    await atomicWrite(destination, candidate.content);
    report.written.push(candidate.path);
  }
  return report;
}

function parseArguments(argv) {
  const values = { write: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--write") {
      values.write = true;
    } else if (argument === "--source") {
      values.source = argv[++index];
    } else if (argument === "--target") {
      values.target = argv[++index];
    } else if (argument === "--help" || argument === "-h") {
      values.help = true;
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }
  return values;
}

async function runCli() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help || !options.source || !options.target) {
    console.log(
      "Usage: node scripts/migrate-legacy-vault.mjs --source <legacy .local folder> --target <vault folder> [--write]"
    );
    console.log("Without --write, the command performs a dry run.");
    return options.help ? 0 : 1;
  }
  const report = await migrateLegacyVault(options);
  console.log(JSON.stringify(report, null, 2));
  return 0;
}

const invokedPath = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : null;

if (invokedPath === import.meta.url) {
  process.exitCode = await runCli();
}
