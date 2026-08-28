declare module "@teselagen/bio-parsers" {
  export function anyToJson(
    contents: string | Uint8Array | ArrayBuffer | Blob,
    options?: Record<string, unknown>
  ): Promise<unknown[]>;

  export function jsonToGenbank(
    sequence: Record<string, unknown>,
    options?: Record<string, unknown>
  ): string;

  export function jsonToFasta(
    sequence: Record<string, unknown>,
    options?: Record<string, unknown>
  ): string;
}
