import { describe, expect, test } from "vitest";
import {
  createBiotaId,
  createMarkdownRecord,
  isCanonicalBiotaRecord,
  parseFrontmatterYaml,
  parseMarkdownRecord,
  stringifyMarkdownRecord,
} from "./index";

const TEST_ID = createBiotaId({
  timestamp: 1_721_234_567_890,
  random: () => 0,
});

describe("Markdown records", () => {
  test("round-trips unchanged frontmatter and body byte for byte", () => {
    const source = [
      "---\r\n",
      `biota_id: ${TEST_ID}\r\n`,
      "biota_type: experiment\r\n",
      "biota_schema: 1\r\n",
      "title: Dose-response pilot\r\n",
      "status: planned\r\n",
      "created: 2026-07-27T15:00:00-05:00\r\n",
      "modified: 2026-07-27T15:00:00-05:00\r\n",
      "custom_field:\r\n",
      "  instrument: Cytation 5\r\n",
      "  flags: [alpha, beta]\r\n",
      "---\r\n",
      "# Exact body\r\n\r\n",
      "Unicode: λ and 🧬\r\n",
    ].join("");

    const record = parseMarkdownRecord(source, "Experiments/Dose response.md");

    expect(record.frontmatter.custom_field).toEqual({
      instrument: "Cytation 5",
      flags: ["alpha", "beta"],
    });
    expect(record.body).toBe("# Exact body\r\n\r\nUnicode: λ and 🧬\r\n");
    expect(record.diagnostics).toEqual([]);
    expect(isCanonicalBiotaRecord(record)).toBe(true);
    expect(stringifyMarkdownRecord(record)).toBe(source);
  });

  test("retains unknown fields and exact body after a canonical field changes", () => {
    const source = `---
biota_id: ${TEST_ID}
biota_type: note
biota_schema: 1
title: Old title
created: "2026-07-27T20:00:00.000Z"
modified: "2026-07-27T20:00:00.000Z"
aliases:
  - First alias
custom:
  owner: Ruopu
  thresholds:
    - 1
    - 2.5
lab_notes: |-
  line one

  line three
---
Body spacing stays.

`;
    const record = parseMarkdownRecord(source);
    record.frontmatter.title = "New title";

    const output = stringifyMarkdownRecord(record);
    const reparsed = parseMarkdownRecord(output);

    expect(reparsed.frontmatter.title).toBe("New title");
    expect(reparsed.frontmatter.custom).toEqual({
      owner: "Ruopu",
      thresholds: [1, 2.5],
    });
    expect(reparsed.frontmatter.lab_notes).toBe("line one\n\nline three");
    expect(reparsed.body).toBe("Body spacing stays.\n\n");
  });

  test("reports malformed and noncanonical input without throwing", () => {
    const record = parseMarkdownRecord("# Plain Markdown");
    expect(record.body).toBe("# Plain Markdown");
    expect(record.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(
      expect.arrayContaining([
        "frontmatter.missing",
        "record.missing-id",
        "record.missing-type",
      ])
    );

    const unclosed = parseMarkdownRecord("---\ntitle: Unclosed");
    expect(unclosed.diagnostics[0].code).toBe("frontmatter.invalid");
  });

  test("creates canonical records with an experiment's initial status", () => {
    const record = createMarkdownRecord({
      type: "experiment",
      title: "Pilot",
      id: TEST_ID,
      timestamp: "2026-07-27T20:00:00.000Z",
      body: "# Goal\n",
      frontmatter: { lab_field: "kept" },
    });

    expect(record.frontmatter).toMatchObject({
      biota_id: TEST_ID,
      biota_type: "experiment",
      biota_schema: 1,
      title: "Pilot",
      status: "planned",
      lab_field: "kept",
    });
    expect(
      isCanonicalBiotaRecord(
        parseMarkdownRecord(stringifyMarkdownRecord(record))
      )
    ).toBe(true);
  });
});

describe("frontmatter YAML", () => {
  test("parses block and inline collections without coercing timestamps", () => {
    const parsed = parseFrontmatterYaml(`timestamp: 2026-07-27T15:00:00-05:00
project: [[Projects/Screen]]
aliases: [one, "two"]
configuration:
  enabled: true
  retries: 3
items:
  - name: first
    value: 1
  - name: second
    value: 2
`);

    expect(parsed.diagnostics).toEqual([]);
    expect(parsed.value).toEqual({
      timestamp: "2026-07-27T15:00:00-05:00",
      project: "[[Projects/Screen]]",
      aliases: ["one", "two"],
      configuration: { enabled: true, retries: 3 },
      items: [
        { name: "first", value: 1 },
        { name: "second", value: 2 },
      ],
    });
  });
});
