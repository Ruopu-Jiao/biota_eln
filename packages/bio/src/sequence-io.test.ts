import { describe, expect, it } from "vitest";
import { exportFasta, exportGenbank, importSequenceFile } from "./sequence-io";

const originSpanningGenbank = `LOCUS       ORIGIN_TEST              12 bp    DNA     circular SYN 27-JUL-2026
DEFINITION  Origin-spanning fixture.
FEATURES             Location/Qualifiers
     CDS             complement(join(10..12,1..3))
                     /label="origin span"
                     /translation="MK"
ORIGIN
        1 atgcgtatgcgt
//
`;

describe("sequence file adapter", () => {
  it("converts circular GenBank coordinates to zero-based half-open segments", async () => {
    const imported = await importSequenceFile({
      fileName: "origin-spanning.gb",
      contents: originSpanningGenbank,
      recordId: "sequence-1",
      importedAt: "2026-07-27T00:00:00Z",
    });

    expect(imported.record.topology).toBe("circular");
    expect(imported.record.sequence).toBe("ATGCGTATGCGT");
    expect(imported.record.features[0]).toMatchObject({
      name: "origin span",
      type: "CDS",
      location: {
        operator: "join",
        strand: -1,
        segments: [
          { start: 9, end: 12 },
          { start: 0, end: 3 },
        ],
      },
      qualifiers: { translation: ["MK"] },
    });
  });

  it("round-trips topology, sequence, qualifiers, and compound locations", async () => {
    const first = await importSequenceFile({
      fileName: "origin-spanning.gb",
      contents: originSpanningGenbank,
      recordId: "sequence-1",
      importedAt: "2026-07-27T00:00:00Z",
    });
    const exported = await exportGenbank(first.record);
    const second = await importSequenceFile({
      fileName: "roundtrip.gb",
      contents: exported,
      recordId: "sequence-2",
      importedAt: "2026-07-27T00:01:00Z",
    });

    expect(second.record.sequence).toBe(first.record.sequence);
    expect(second.record.topology).toBe(first.record.topology);
    expect(second.record.features[0]?.location).toEqual(
      first.record.features[0]?.location
    );
    expect(second.record.features[0]?.qualifiers.translation).toEqual(["MK"]);
  });

  it("exports a portable FASTA representation", async () => {
    const imported = await importSequenceFile({
      fileName: "fixture.fa",
      contents: ">fixture description\nATGC GTAA\n",
      recordId: "sequence-fasta",
      importedAt: "2026-07-27T00:00:00Z",
    });

    const exported = await exportFasta(imported.record);
    expect(exported).toContain(">fixture");
    expect(exported.replaceAll(/\s/g, "").toUpperCase()).toContain("ATGCGTAA");
  });
});
