import {
  BIOTA_RECORD_TYPES,
  type BiotaRecordType,
  type MarkdownRecord,
  type VaultSearchDocument,
} from "./types";
import { extractRecordLinks, extractTags, extractTasks } from "./extract";

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

export function createSearchDocument(
  record: MarkdownRecord,
  path = record.path
): VaultSearchDocument {
  if (!path) {
    throw new Error(
      "A vault-relative path is required to create a search document."
    );
  }
  const { frontmatter } = record;
  if (
    typeof frontmatter.biota_id !== "string" ||
    typeof frontmatter.biota_type !== "string" ||
    !BIOTA_RECORD_TYPES.includes(frontmatter.biota_type as BiotaRecordType) ||
    typeof frontmatter.title !== "string"
  ) {
    throw new Error(
      "A canonical Biota record is required to create a search document."
    );
  }

  const bodyTags = extractTags(record.body);
  const frontmatterTags = stringArray(frontmatter.tags);
  const seenTags = new Set<string>();
  const tags = [...frontmatterTags, ...bodyTags].filter((tag) => {
    const normalized = tag.toLocaleLowerCase();
    if (seenTags.has(normalized)) {
      return false;
    }
    seenTags.add(normalized);
    return true;
  });

  return {
    id: frontmatter.biota_id,
    path,
    type: frontmatter.biota_type as BiotaRecordType,
    title: frontmatter.title,
    status:
      typeof frontmatter.status === "string" ? frontmatter.status : undefined,
    aliases: stringArray(frontmatter.aliases),
    tags,
    body: record.body,
    links: extractRecordLinks(record),
    tasks: extractTasks(record.body, path),
    modified:
      typeof frontmatter.modified === "string"
        ? frontmatter.modified
        : undefined,
  };
}
