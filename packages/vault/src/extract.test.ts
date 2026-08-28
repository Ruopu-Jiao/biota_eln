import { describe, expect, test } from "vitest";
import {
  createBiotaId,
  createSearchDocument,
  extractMarkdownLinks,
  extractRecordLinks,
  extractSidecarReferences,
  extractTags,
  extractTasks,
  extractWikiLinks,
  parseMarkdownRecord,
} from "./index";

describe("Markdown extraction", () => {
  test("extracts wikilinks, aliases, headings, block references, and embeds", () => {
    const source = `See [[Projects/Receptor screen|the screen]] and ![[Sequences/pReporter.gbk]].
Jump to [[Protocols/Transfection#Materials]] or [[Notes/Result#^block-1]].
\`[[Ignored/Inline]]\`
<!-- [[Ignored/Comment]] -->
\`\`\`md
[[Ignored/Fence]]
\`\`\`
`;
    const links = extractWikiLinks(source);

    expect(
      links.map(({ target, alias, embed, path, heading, block }) => ({
        target,
        alias,
        embed,
        path,
        heading,
        block,
      }))
    ).toEqual([
      {
        target: "Projects/Receptor screen",
        alias: "the screen",
        embed: false,
        path: "Projects/Receptor screen",
        heading: undefined,
        block: undefined,
      },
      {
        target: "Sequences/pReporter.gbk",
        alias: undefined,
        embed: true,
        path: "Sequences/pReporter.gbk",
        heading: undefined,
        block: undefined,
      },
      {
        target: "Protocols/Transfection#Materials",
        alias: undefined,
        embed: false,
        path: "Protocols/Transfection",
        heading: "Materials",
        block: undefined,
      },
      {
        target: "Notes/Result#^block-1",
        alias: undefined,
        embed: false,
        path: "Notes/Result",
        heading: undefined,
        block: "block-1",
      },
    ]);
    expect(source.slice(links[0].start, links[0].end)).toBe(links[0].raw);
  });

  test("extracts ordinary links and content tags but ignores code and comments", () => {
    const source = `# Heading
See [dataset](<Data/raw values.csv> "input") with #Assay/Primary and #assay/primary.
\`#not-a-tag\`
<!-- #also-not -->
`;
    expect(extractMarkdownLinks(source)).toMatchObject([
      {
        label: "dataset",
        target: "Data/raw values.csv",
        title: "input",
        embed: false,
      },
    ]);
    expect(extractTags(source)).toEqual(["Assay/Primary"]);
  });

  test("extracts GFM tasks and adjacent Biota metadata", () => {
    const source = `- [ ] Run transfection [[Experiments/Dose-response pilot]]
  <!-- biota-task id=01KTASK state=scheduled start=2026-08-01 due=2026-08-02 priority=high -->
- [x] Review results
- [ ] Waiting item <!-- biota-task id="task 3" state=waiting project="Receptor screen" -->
\`\`\`
- [ ] ignored
\`\`\`
`;
    const tasks = extractTasks(source, "Daily Notes/2026-08-01.md");

    expect(tasks).toHaveLength(3);
    expect(tasks[0]).toMatchObject({
      id: "01KTASK",
      title: "Run transfection [[Experiments/Dose-response pilot]]",
      checked: false,
      state: "scheduled",
      startDate: "2026-08-01",
      dueDate: "2026-08-02",
      priority: "high",
      line: 1,
      sourcePath: "Daily Notes/2026-08-01.md",
    });
    expect(tasks[0].links[0].target).toBe("Experiments/Dose-response pilot");
    expect(source.slice(tasks[0].start, tasks[0].end)).toContain("biota-task");
    expect(tasks[1]).toMatchObject({
      title: "Review results",
      checked: true,
      state: "done",
      line: 3,
    });
    expect(tasks[2]).toMatchObject({
      id: "task 3",
      state: "waiting",
      project: "Receptor screen",
      line: 4,
    });
  });
});

describe("record relationships and indexing", () => {
  const id = createBiotaId({ timestamp: 1_721_234_567_890, random: () => 0 });
  const source = `---
biota_id: ${id}
biota_type: experiment
biota_schema: 1
title: Dose response
status: active
created: "2026-07-27T20:00:00.000Z"
modified: "2026-07-27T21:00:00.000Z"
tags:
  - screen
aliases:
  - DR pilot
project: "[[Projects/Receptor screen]]"
protocols:
  - "[[Protocols/Transfection]]"
sequence: "Sequences/pReporter.gbk"
data:
  - "Data/readout.csv"
attachments:
  - "Attachments/notebook scan.tiff"
---
#Experiment #screen

Use [[Entities/pReporter]] and [schema](Data/readout.schema.yaml).
- [ ] Analyze #analysis
  <!-- biota-task id=01KTASK state=inbox -->
`;

  test("finds frontmatter and body sidecar references", () => {
    const references = extractSidecarReferences(parseMarkdownRecord(source));
    expect(references).toEqual(
      expect.arrayContaining([
        {
          path: "Sequences/pReporter.gbk",
          kind: "sequence",
          origin: "frontmatter",
          field: "sequence",
        },
        {
          path: "Data/readout.csv",
          kind: "dataset",
          origin: "frontmatter",
          field: "data",
        },
        {
          path: "Attachments/notebook scan.tiff",
          kind: "attachment",
          origin: "frontmatter",
          field: "attachments",
        },
        expect.objectContaining({
          path: "Data/readout.schema.yaml",
          kind: "schema",
          origin: "body",
        }),
      ])
    );
  });

  test("does not mistake timestamps or URLs for sidecar paths", () => {
    const record = parseMarkdownRecord(`---
biota_id: ${id}
biota_type: experiment
biota_schema: 1
title: Timed experiment
status: active
created: 2026-07-27T15:00:00-05:00
modified: 2026-07-28T00:48:46.751Z
reference: https://example.org/report.pdf
data:
  - Data/results.csv
---
`);

    expect(extractSidecarReferences(record)).toEqual([
      {
        path: "Data/results.csv",
        kind: "dataset",
        origin: "frontmatter",
        field: "data",
      },
    ]);
  });

  test("creates record links from frontmatter and body", () => {
    const record = parseMarkdownRecord(source, "Experiments/Dose response.md");
    const links = extractRecordLinks(record);
    expect(links.map((link) => link.targetPath)).toEqual(
      expect.arrayContaining([
        "Projects/Receptor screen",
        "Protocols/Transfection",
        "Entities/pReporter",
      ])
    );
    expect(links.every((link) => link.sourceId === id)).toBe(true);
  });

  test("creates a normalized search document", () => {
    const record = parseMarkdownRecord(source, "Experiments/Dose response.md");
    const document = createSearchDocument(record);

    expect(document).toMatchObject({
      id,
      path: "Experiments/Dose response.md",
      type: "experiment",
      title: "Dose response",
      status: "active",
      aliases: ["DR pilot"],
      tags: ["screen", "Experiment", "analysis"],
    });
    expect(document.links.length).toBeGreaterThanOrEqual(3);
    expect(document.tasks).toHaveLength(1);
  });
});
