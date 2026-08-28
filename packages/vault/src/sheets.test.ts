import { describe, expect, test } from "vitest";
import {
  createBiotaId,
  extractSidecarReferences,
  formatBiotaSheetBlock,
  parseBiotaSheetBlocks,
  parseMarkdownRecord,
  validateBiotaSheetSpec,
} from "./index";

const id = createBiotaId({
  timestamp: 1_721_234_567_890,
  random: () => 0.25,
});

describe("portable Biota sheet blocks", () => {
  test("parses longer and tilded fences, CRLF, ranges, and unknown fields", () => {
    const source = [
      "Before\r\n",
      "~~~~biota-sheet\r\n",
      `id: ${id}\r\n`,
      "title: Plate calculations\r\n",
      "data: Data/Sheets/plate.csv\r\n",
      "schema: Data/Sheets/plate.sheet.yaml\r\n",
      "view:\r\n",
      "  height: 420\r\n",
      "~~~~~\r\n",
      "After\r\n",
    ].join("");
    const [block] = parseBiotaSheetBlocks(source);

    expect(block?.valid).toBe(true);
    expect(block?.diagnostics).toEqual([]);
    expect(block?.spec).toMatchObject({
      id,
      title: "Plate calculations",
      data: "Data/Sheets/plate.csv",
      schema: "Data/Sheets/plate.sheet.yaml",
      view: { height: 420 },
    });
    expect(source.slice(block!.from, block!.to)).toBe(block!.raw);
    expect(source.slice(block!.contentStart, block!.contentEnd)).toContain(
      "title: Plate calculations"
    );
    expect(block?.fenceCharacter).toBe("~");
    expect(block?.fenceLength).toBe(4);
  });

  test("formats and reparses the required contract without dropping extensions", () => {
    const formatted = formatBiotaSheetBlock(
      {
        id,
        title: "Dose response",
        data: "Renamed data/experiment 7.csv",
        schema: "Renamed data/experiment 7.sheet.yaml",
        view: {
          frozen_rows: 1,
          filters: true,
        },
      },
      { lineEnding: "\r\n" }
    );
    const [roundTrip] = parseBiotaSheetBlocks(formatted);

    expect(formatted).toContain("```biota-sheet\r\n");
    expect(roundTrip?.diagnostics).toEqual([]);
    expect(roundTrip?.spec).toMatchObject({
      id,
      title: "Dose response",
      view: {
        frozen_rows: 1,
        filters: true,
      },
    });
  });

  test.each([
    ["../Data/table.csv", "Data/table.sheet.yaml"],
    ["/tmp/table.csv", "Data/table.sheet.yaml"],
    ["https://example.org/table.csv", "Data/table.sheet.yaml"],
    [".biota/history/table.csv", "Data/table.sheet.yaml"],
    ["Data\\table.csv", "Data/table.sheet.yaml"],
    ["Data//table.csv", "Data/table.sheet.yaml"],
    ["Data/table.tsv", "Data/table.sheet.yaml"],
    ["Data/table.csv", "Data/table.yaml"],
  ])("rejects unsafe or noncanonical sidecar paths", (data, schema) => {
    const result = validateBiotaSheetSpec({
      id,
      title: "Unsafe table",
      data,
      schema,
    });

    expect(result.spec).toBeUndefined();
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "sheet.invalid-path" }),
      ])
    );
  });

  test("reports duplicate fields, malformed YAML, and unclosed fences", () => {
    const [duplicate] = parseBiotaSheetBlocks(`\`\`\`biota-sheet
id: ${id}
id: ${id}
title: Duplicate
data: Data/table.csv
schema: Data/table.sheet.yaml
\`\`\`
`);
    const [unclosed] = parseBiotaSheetBlocks(`\`\`\`biota-sheet
id: ${id}
title:
  - invalid
data: Data/table.csv
schema: Data/table.sheet.yaml
`);

    expect(duplicate?.valid).toBe(false);
    expect(duplicate?.spec).toBeUndefined();
    expect(duplicate?.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "sheet.duplicate-field" }),
      ])
    );
    expect(unclosed?.spec).toBeUndefined();
    expect(unclosed?.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "sheet.unclosed-fence" }),
        expect.objectContaining({
          code: "sheet.invalid-field",
          field: "title",
        }),
      ])
    );
  });

  test("does not discover lookalike sheet fences nested inside another fence", () => {
    const source = `\`\`\`\`markdown
\`\`\`biota-sheet
id: ${id}
title: Hidden
data: Data/hidden.csv
schema: Data/hidden.sheet.yaml
\`\`\`
\`\`\`\`
`;

    expect(parseBiotaSheetBlocks(source)).toEqual([]);
  });

  test("contributes data and schema sidecars to finalization dependencies", () => {
    const markdown = `---
biota_id: ${id}
biota_type: experiment
biota_schema: 1
title: Sheet experiment
status: active
created: 2026-07-28T00:00:00Z
modified: 2026-07-28T00:00:00Z
---

\`\`\`biota-sheet
id: ${id}
title: Calculations
data: Data/Sheets/calculations.csv
schema: Data/Sheets/calculations.sheet.yaml
\`\`\`
`;
    const references = extractSidecarReferences(parseMarkdownRecord(markdown));

    expect(references).toEqual([
      expect.objectContaining({
        path: "Data/Sheets/calculations.csv",
        kind: "dataset",
        origin: "body",
        field: "biota-sheet.data",
      }),
      expect.objectContaining({
        path: "Data/Sheets/calculations.sheet.yaml",
        kind: "schema",
        origin: "body",
        field: "biota-sheet.schema",
      }),
    ]);
    expect(references[0]?.range).toEqual(references[1]?.range);
  });
});
