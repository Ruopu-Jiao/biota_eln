export type SequenceAlphabet = "DNA" | "RNA" | "protein";
export type SequenceTopology = "linear" | "circular";

export interface SequenceRecord {
  sequence: string;
  alphabet: SequenceAlphabet;
  topology: SequenceTopology;
}
