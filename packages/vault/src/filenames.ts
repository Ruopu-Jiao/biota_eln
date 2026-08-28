import type { BiotaRecordType } from "./types";

export const DEFAULT_VAULT_DIRECTORIES = [
  "Experiments",
  "Protocols",
  "Projects",
  "Entities",
  "Sequences",
  "Data",
  "Attachments",
  "Daily Notes",
  "Analyses",
] as const;

export const DEFAULT_RECORD_DIRECTORIES: Readonly<
  Record<BiotaRecordType, string>
> = {
  note: "",
  daily: "Daily Notes",
  experiment: "Experiments",
  protocol: "Protocols",
  project: "Projects",
  entity: "Entities",
  analysis: "Analyses",
};

const INVALID_FILENAME_CHARACTERS = /[\u0000-\u001f\u007f<>:"/\\|?*]/g;
const WINDOWS_RESERVED_NAME =
  /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\..*)?$/i;

export function sanitizeFilename(title: string, fallback = "Untitled") {
  let filename = title
    .normalize("NFC")
    .replace(INVALID_FILENAME_CHARACTERS, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[. ]+|[. ]+$/g, "");

  if (!filename) {
    filename = fallback;
  }

  if (WINDOWS_RESERVED_NAME.test(filename)) {
    filename = `${filename}-record`;
  }

  return filename;
}

export function ensureMarkdownExtension(filename: string) {
  return /\.md$/i.test(filename) ? filename : `${filename}.md`;
}

export interface RecordFilenameOptions {
  datePrefix?: string;
  idSuffix?: string;
}

export function createRecordFilename(
  title: string,
  options: RecordFilenameOptions = {}
) {
  const prefix = options.datePrefix ? `${options.datePrefix} ` : "";
  const suffix = options.idSuffix ? ` ${options.idSuffix}` : "";
  return ensureMarkdownExtension(
    sanitizeFilename(`${prefix}${title}${suffix}`)
  );
}

export function defaultRecordPath(
  type: BiotaRecordType,
  title: string,
  options: RecordFilenameOptions = {}
) {
  const filename = createRecordFilename(title, options);
  const directory = DEFAULT_RECORD_DIRECTORIES[type];
  return directory ? `${directory}/${filename}` : filename;
}
