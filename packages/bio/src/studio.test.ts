import { describe, expect, it } from "vitest";
import {
  applySequenceEdit,
  findRestrictionSites,
  reverseComplementRecord,
  rotateRecordOrigin,
  simulateGibsonAssembly,
  simulateGoldenGateAssembly,
  simulatePcr,
  type StudioSequenceRecord,
} from "./studio";

function record(
  sequence: string,
  overrides: Partial<StudioSequenceRecord> = {}
): StudioSequenceRecord {
  return {
    id: "record-1",
    name: "Record",
    alphabet: "DNA",
    topology: "linear",
    sequence,
    features: [],
    primers: [],
    operations: [],
    ...overrides,
  };
}

describe("sequence studio", () => {
  it("updates feature coordinates after an insertion", () => {
    const original = record("AAAACCCC", {
      features: [
        {
          id: "feature",
          name: "CDS",
          type: "CDS",
          qualifiers: {},
          location: {
            operator: "single",
            strand: 1,
            segments: [{ start: 4, end: 8 }],
          },
        },
      ],
    });
    const edited = applySequenceEdit(original, {
      start: 2,
      end: 2,
      replacement: "GG",
      operationId: "edit",
      timestamp: "2026-07-27T00:00:00Z",
    });
    expect(edited.sequence).toBe("AAGGAACCCC");
    expect(edited.features[0].location.segments).toEqual([
      { start: 6, end: 10 },
    ]);
  });

  it("reverse complements compound feature coordinates", () => {
    const result = reverseComplementRecord(
      record("AAAACCCC", {
        features: [
          {
            id: "feature",
            name: "join",
            type: "misc_feature",
            qualifiers: {},
            location: {
              operator: "join",
              strand: 1,
              segments: [
                { start: 0, end: 2 },
                { start: 5, end: 8 },
              ],
            },
          },
        ],
      }),
      "reverse",
      "2026-07-27T00:00:00Z"
    );
    expect(result.sequence).toBe("GGGGTTTT");
    expect(result.features[0].location.strand).toBe(-1);
    expect(result.features[0].location.segments).toEqual([
      { start: 0, end: 3 },
      { start: 6, end: 8 },
    ]);
  });

  it("splits origin-spanning features after circular rotation", () => {
    const result = rotateRecordOrigin(
      record("AAAACCCC", {
        topology: "circular",
        features: [
          {
            id: "feature",
            name: "origin span",
            type: "misc_feature",
            qualifiers: {},
            location: {
              operator: "single",
              strand: 1,
              segments: [{ start: 2, end: 6 }],
            },
          },
        ],
      }),
      4,
      "rotate",
      "2026-07-27T00:00:00Z"
    );
    expect(result.sequence).toBe("CCCCAAAA");
    expect(result.features[0].location.segments).toEqual([
      { start: 6, end: 8 },
      { start: 0, end: 2 },
    ]);
  });

  it("finds circular and Type IIS restriction sites", () => {
    const result = findRestrictionSites(
      record("AAGGTCTCTTGAATTC", { topology: "circular" })
    );
    expect(result.map((site) => site.enzyme.name)).toContain("BsaI");
    expect(result.map((site) => site.enzyme.name)).toContain("EcoRI");
  });

  it("keeps a linear restriction feature end at sequence length", () => {
    const result = findRestrictionSites(record("AAGAATTC"));
    const ecoRi = result.find((site) => site.enzyme.name === "EcoRI");
    expect(ecoRi).toMatchObject({
      start: 2,
      end: 8,
      forwardCut: 3,
      reverseCut: 7,
    });
  });

  it("simulates PCR with primer overhangs", () => {
    const result = simulatePcr({
      template: record("AAAACCCCGGGGTTTT"),
      forwardPrimer: {
        id: "f",
        name: "F",
        annealSequence: "AAAA",
        overhang5: "GG",
        strand: 1,
      },
      reversePrimer: {
        id: "r",
        name: "R",
        annealSequence: "AAAA",
        overhang5: "CC",
        strand: -1,
      },
      outputId: "amplicon",
      outputName: "Amplicon",
      operationId: "pcr",
      timestamp: "2026-07-27T00:00:00Z",
    });
    expect(result.sequence).toBe("GGAAAACCCCGGGGTTTTGG");
    expect(result.topology).toBe("linear");
  });

  it("assembles overlapping Gibson fragments", () => {
    const result = simulateGibsonAssembly({
      fragments: [
        record("AAAACCCCGGGG"),
        record("CCCCGGGGTTTT", { id: "record-2" }),
      ],
      minimumOverlap: 8,
      outputId: "gibson",
      outputName: "Gibson",
      operationId: "gibson-op",
      timestamp: "2026-07-27T00:00:00Z",
    });
    expect(result.sequence).toBe("AAAACCCCGGGGTTTT");
  });

  it("removes the terminal overlap when a Gibson assembly closes a circle", () => {
    const result = simulateGibsonAssembly({
      fragments: [
        record("AAAACCCCGGGG", { id: "record-1" }),
        record("CCCCGGGGTTTTAAAA", { id: "record-2" }),
      ],
      minimumOverlap: 4,
      circular: true,
      outputId: "gibson-circle",
      outputName: "Gibson circle",
      operationId: "gibson-circle-op",
      timestamp: "2026-07-27T00:00:00Z",
    });
    expect(result.sequence).toBe("AAAACCCCGGGGTTTT");
    expect(result.topology).toBe("circular");
  });

  it("validates and assembles Golden Gate overhangs", () => {
    const first = record("AAAA", { id: "first" });
    const second = record("CCCC", { id: "second" });
    const result = simulateGoldenGateAssembly({
      fragments: [
        {
          record: first,
          payload: "AAAA",
          leftOverhang: "AATG",
          rightOverhang: "GGCC",
        },
        {
          record: second,
          payload: "CCCC",
          leftOverhang: "GGCC",
          rightOverhang: "TTAA",
        },
      ],
      outputId: "golden",
      outputName: "Golden Gate",
      operationId: "golden-op",
      timestamp: "2026-07-27T00:00:00Z",
    });
    expect(result.sequence).toBe("AAAACCCC");
    expect(result.operations[0].parentIds).toEqual(["first", "second"]);
  });
});
