import { describe, expect, it } from "vitest";

import {
  createSpreadsheetArtifacts,
  loadSpreadsheetData,
  parseCsv,
  resolveSpreadsheetPath,
  serializeCsv,
  type SpreadsheetEmbedSpec,
} from "@/lib/spreadsheet-data";

const spec: SpreadsheetEmbedSpec = {
  id: "01KSPREADSHEET",
  title: "Dose response",
  data: "Data/Sheets/01KSPREADSHEET/dose-response.csv",
  schema: "Data/Sheets/01KSPREADSHEET/dose-response.sheet.yaml",
};

describe("spreadsheet CSV storage", () => {
  it("round-trips commas, quotes, Unicode, and embedded newlines", () => {
    const matrix = [
      ["compound", "note"],
      ["BX-17", 'line one,\nline "two"'],
      ["λ", null],
    ];
    const csv = serializeCsv(matrix);
    expect(parseCsv(csv)).toEqual([
      ["compound", "note"],
      ["BX-17", 'line one,\nline "two"'],
      ["λ", ""],
    ]);
  });

  it("keeps materialized values in CSV and formulas in schema", async () => {
    const artifacts = await createSpreadsheetArtifacts({
      spec,
      workbook: {
        id: spec.id,
        sheetOrder: ["sheet-1"],
        sheets: {
          "sheet-1": {
            id: "sheet-1",
            cellData: {
              0: {
                0: { v: 2 },
                1: { v: 3 },
                2: { v: 5, f: "=SUM(A1:B1)", s: "total-style" },
              },
            },
          },
        },
        styles: { "total-style": { bl: 1 } },
      },
      values: [[2, 3, 5]],
      formulas: [["", "", "=SUM(A1:B1)"]],
      now: "2026-07-28T12:00:00.000Z",
    });

    expect(artifacts.csv).toBe("2,3,5\n");
    expect(artifacts.schema.formulas).toEqual({ C1: "=SUM(A1:B1)" });
    expect(artifacts.schema.cell_types).toEqual({
      A1: "number",
      B1: "number",
      C1: "number",
    });
    const sheet = (
      artifacts.schema.workbook.sheets as Record<
        string,
        { cellData: Record<string, Record<string, Record<string, unknown>>> }
      >
    )["sheet-1"];
    expect(sheet.cellData["0"]["2"]).toEqual({ s: "total-style" });

    const loaded = await loadSpreadsheetData(
      artifacts.csv,
      artifacts.schemaText,
      spec
    );
    const loadedSheet = (
      loaded.workbook.sheets as Record<
        string,
        { cellData: Record<string, Record<string, Record<string, unknown>>> }
      >
    )["sheet-1"];
    expect(loaded.matrix).toEqual([[2, 3, 5]]);
    expect(loadedSheet.cellData["0"]["2"]).toMatchObject({
      v: 5,
      f: "=SUM(A1:B1)",
      s: "total-style",
      t: 2,
    });
  });

  it("preserves leading-zero identifiers as strings", async () => {
    const loaded = await loadSpreadsheetData(
      "sample,value\n0017,2.5\n",
      "",
      spec
    );
    expect(loaded.matrix).toEqual([
      ["sample", "value"],
      ["0017", 2.5],
    ]);
  });
});

describe("spreadsheet sidecar paths", () => {
  it("resolves sidecars relative to the owning Markdown record", () => {
    expect(
      resolveSpreadsheetPath(
        "Experiments/Dose response.md",
        "Data/Sheets/01KSPREADSHEET/dose-response.csv"
      )
    ).toBe("Data/Sheets/01KSPREADSHEET/dose-response.csv");
  });

  it("rejects vault traversal and absolute references", () => {
    expect(() =>
      resolveSpreadsheetPath("Experiments/Test.md", "../../outside.csv")
    ).toThrow(/cannot traverse/);
    expect(() =>
      resolveSpreadsheetPath("Experiments/Test.md", "/tmp/outside.csv")
    ).toThrow(/vault-relative/);
  });
});
