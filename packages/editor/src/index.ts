export type EntryBlockKind =
  | "paragraph"
  | "heading"
  | "checklist"
  | "callout"
  | "protocol"
  | "table"
  | "entity-reference"
  | "entry-reference"
  | "attachment";

export interface EntryBlock {
  kind: EntryBlockKind;
  id: string;
}
