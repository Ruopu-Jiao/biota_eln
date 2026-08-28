import { describe, expect, it } from "vitest";
import { parseAnalysisCsv } from "./csv";

describe("analysis CSV parsing", () => {
  it("parses BOMs, quoted values, scientific notation, and missing wide values", () => {
    const parsed = parseAnalysisCsv(
      '\uFEFF"Dose, nM","Replicate 1","Replicate 2","Replicate 3"\r\n' +
        '1e-2,"1,200",NA,1250\r\n' +
        "1e-1,1800,1750,.\r\n" +
        "1,2200,2300,2250\r\n"
    );

    expect(parsed.xHeader).toBe("Dose, nM");
    expect(parsed.rows).toEqual([
      { id: 1, x: 0.01, values: [1200, 1250] },
      { id: 2, x: 0.1, values: [1800, 1750] },
      { id: 3, x: 1, values: [2200, 2300, 2250] },
    ]);
    expect(parsed.valueHeaders).toEqual([
      "Replicate 1",
      "Replicate 2",
      "Replicate 3",
    ]);
  });

  it("groups repeated long-format measurements without treating replicate IDs as Y", () => {
    const parsed = parseAnalysisCsv(`dose,replicate,response
0.1,1,12.4
0.1,2,11.9
0.1,3,12.7
1,1,44.2
1,2,45.1
1,3,43.8
`);

    expect(parsed.valueHeaders).toEqual(["response"]);
    expect(parsed.rows).toEqual([
      { id: 1, x: 0.1, values: [12.4, 11.9, 12.7] },
      { id: 2, x: 1, values: [44.2, 45.1, 43.8] },
    ]);
  });

  it("accepts headerless tab-separated numeric data", () => {
    const parsed = parseAnalysisCsv(
      "1e-3\t2.5\t2.7\n1e-2\t4.1\t4.3\n1e-1\t9.8\t10.2\n"
    );

    expect(parsed.delimiter).toBe("\t");
    expect(parsed.xHeader).toBe("Column 1");
    expect(parsed.rows[2]).toEqual({ id: 3, x: 0.1, values: [9.8, 10.2] });
  });

  it("accepts semicolon-delimited files with decimal commas", () => {
    const parsed = parseAnalysisCsv(
      "concentration;response\n0,1;2,25\n1,0;5,5\n10,0;9,75\n"
    );

    expect(parsed.delimiter).toBe(";");
    expect(parsed.rows).toEqual([
      { id: 1, x: 0.1, values: [2.25] },
      { id: 2, x: 1, values: [5.5] },
      { id: 3, x: 10, values: [9.75] },
    ]);
  });

  it("reports files without a usable numeric response", () => {
    expect(() =>
      parseAnalysisCsv("dose,label\n0.1,control\n1,treated\n")
    ).toThrow(/numeric response column/i);
  });
});
