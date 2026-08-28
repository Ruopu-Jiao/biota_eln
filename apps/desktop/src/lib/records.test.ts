import { describe, expect, it } from "vitest";
import {
  buildFileTree,
  createRecordMarkdown,
  extractTasks,
  extractWikilinks,
  parseFrontmatter,
  toggleTaskInMarkdown,
  updateTaskStateInMarkdown,
} from "./records";

describe("desktop record helpers", () => {
  it("keeps unknown frontmatter available while splitting the Markdown body", () => {
    const parsed = parseFrontmatter(`---
biota_id: 01J00000000000000000000000
biota_type: experiment
custom_vendor_field: keep-me
tags:
  - assay
  - pilot
---

# Pilot
`);

    expect(parsed.data.custom_vendor_field).toBe("keep-me");
    expect(parsed.data.tags).toEqual(["assay", "pilot"]);
    expect(parsed.body).toContain("# Pilot");
  });

  it("creates canonical ULID-backed records and task metadata", () => {
    const markdown = createRecordMarkdown("experiment", "Pilot");
    const recordId = /biota_id:\s*(\w+)/.exec(markdown)?.[1];
    const taskId = /biota-task id=(\w+)/.exec(markdown)?.[1];

    expect(recordId).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(taskId).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(markdown).toContain("status: planned");
  });

  it("extracts and updates task-anywhere metadata without hiding the checkbox", () => {
    const markdown = `- [ ] Run assay [[Experiments/Pilot]]
  <!-- biota-task id=01J00000000000000000000001 state=scheduled start=2026-08-01 due=2026-08-02 priority=high -->`;
    const [task] = extractTasks(markdown, "Projects/Screen.md", "Screen");

    expect(task).toMatchObject({
      id: "01J00000000000000000000001",
      checked: false,
      state: "scheduled",
      priority: "high",
      links: ["Experiments/Pilot"],
    });

    const done = toggleTaskInMarkdown(markdown, task!.id, true);
    expect(done).toContain("- [x] Run assay");
    expect(done).toContain("state=done");

    const waiting = updateTaskStateInMarkdown(done, task!.id, "waiting");
    expect(waiting).toContain("- [ ] Run assay");
    expect(waiting).toContain("state=waiting");
  });

  it("adds stable metadata when a plain Markdown task first enters planning", () => {
    const waiting = updateTaskStateInMarkdown(
      "- [ ] Call collaborator",
      "Notes/Inbox.md:1",
      "waiting"
    );

    expect(waiting).toContain("- [ ] Call collaborator");
    expect(waiting).toMatch(
      /<!-- biota-task id=[0-9A-HJKMNP-TV-Z]{26} state=waiting priority=normal -->/
    );
  });

  it("extracts aliases from relative wikilinks", () => {
    expect(
      extractWikilinks("Use [[Protocols/Transfection|the standard method]].")
    ).toEqual([
      {
        target: "Protocols/Transfection",
        alias: "the standard method",
      },
    ]);
  });

  it("derives a physical folder tree from flat vault paths", () => {
    const tree = buildFileTree([
      {
        name: "Pilot.md",
        path: "Experiments/2026/Pilot.md",
        kind: "file",
        recordType: "experiment",
      },
      {
        name: "Protocol.md",
        path: "Protocols/Protocol.md",
        kind: "file",
        recordType: "protocol",
      },
    ]);

    expect(tree.map((node) => node.name)).toEqual(["Experiments", "Protocols"]);
    expect(tree[0]?.children[0]?.children[0]?.path).toBe(
      "Experiments/2026/Pilot.md"
    );
  });
});
