// @vitest-environment jsdom

import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { describe, expect, test } from "vitest";
import {
  findFrontmatterRange,
  liveMarkdownPreview,
  parseMarkdownTable,
  tableCellChange,
  taskToggleChanges,
  wikilinkTargetAt,
} from "./markdown-live-preview";

const fixture = [
  "---",
  "biota_id: 01K0000000000000000000000",
  "biota_type: experiment",
  "biota_schema: 1",
  'title: "Dose-response — β"',
  "unknown_user_field:",
  "  nested: untouched",
  "---",
  "# Dose-response pilot",
  "",
  "> **Objective** — Establish a working concentration.",
  "",
  "- [ ] Run assay [[Experiments/Pilot|pilot experiment]]",
  "  <!-- biota-task id=01K0000000000000000000001 state=scheduled priority=high -->",
  "",
  "| Variable | Value |",
  "| :--- | ---: |",
  "| Plate | 96-well \\| black |",
  "",
  "```md",
  "[[This/is/code|not a link]]",
  "```",
  "",
].join("\r\n");

function markdownState(source: string) {
  const lineSeparator = source.includes("\r\n") ? "\r\n" : "\n";
  return EditorState.create({
    doc: source,
    extensions: [
      EditorState.lineSeparator.of(lineSeparator),
      markdown({ base: markdownLanguage }),
      liveMarkdownPreview(),
    ],
  });
}

describe("Markdown live preview", () => {
  test("recognizes frontmatter without changing unknown YAML or CRLF", () => {
    const range = findFrontmatterRange(fixture);

    expect(range).toBeDefined();
    expect(fixture.slice(range!.from, range!.to)).toContain(
      "unknown_user_field:\r\n  nested: untouched"
    );
    expect(fixture.slice(range!.to)).toMatch(/^# Dose-response pilot/);
  });

  test("keeps the exact Markdown source when visual decorations are enabled", () => {
    const state = markdownState(fixture);

    expect(state.sliceDoc()).toBe(fixture);
  });

  test("installs frontmatter and table block widgets through a real editor view", () => {
    const initial = markdownState(fixture);
    const bodyPosition = initial.doc.toString().indexOf("# Dose-response");
    const state = initial.update({
      selection: { anchor: bodyPosition },
    }).state;
    const parent = document.createElement("div");
    document.body.append(parent);
    const view = new EditorView({ state, parent });

    expect(parent.querySelector(".cm-live-properties")).not.toBeNull();
    expect(parent.querySelector(".cm-live-table-wrap")).not.toBeNull();
    expect(parent.querySelector(".cm-live-hidden-line")).toBeNull();
    expect(parent.textContent).not.toContain("biota-task");
    expect(view.state.sliceDoc()).toBe(fixture);

    view.destroy();
    parent.remove();
  });

  test("keeps task controls and inline delimiters stable on the active task line", () => {
    const initial = markdownState(fixture);
    const taskPosition = initial.doc.toString().indexOf("Run assay") + 4;
    const state = initial.update({
      selection: { anchor: taskPosition },
    }).state;
    const parent = document.createElement("div");
    document.body.append(parent);
    const view = new EditorView({ state, parent });
    const taskLine = parent.querySelector(".cm-live-task-line");

    expect(taskLine?.querySelector(".cm-live-bullet")).not.toBeNull();
    expect(taskLine?.querySelector(".cm-live-task-checkbox")).not.toBeNull();
    expect(taskLine?.textContent).not.toContain("[ ]");
    expect(taskLine?.textContent).not.toContain("[[");
    expect(taskLine?.textContent).toContain("pilot experiment");
    expect(view.state.sliceDoc()).toBe(fixture);

    view.destroy();
    parent.remove();
  });

  test("resolves visible wikilinks but not lookalikes inside fenced code", () => {
    const state = markdownState(fixture);
    const visiblePosition = fixture.indexOf("pilot experiment") + 3;
    const codePosition = fixture.indexOf("not a link") + 3;

    expect(wikilinkTargetAt(state, visiblePosition)).toBe("Experiments/Pilot");
    expect(wikilinkTargetAt(state, codePosition)).toBeUndefined();
  });

  test("toggles a visual task and its metadata without touching other bytes", () => {
    const state = markdownState(fixture);
    const normalized = state.doc.toString();
    const markerFrom = normalized.indexOf("[ ]");
    const itemFrom = normalized.lastIndexOf("- ", markerFrom);
    const itemTo = normalized.indexOf("\n\n", markerFrom);
    const transaction = state.update({
      changes: taskToggleChanges(
        normalized,
        { from: markerFrom, to: markerFrom + 3 },
        { from: itemFrom, to: itemTo },
        true
      ),
    });
    const updated = transaction.state.sliceDoc();

    expect(updated).toContain("- [x] Run assay");
    expect(updated).toContain("state=done priority=high");
    expect(updated).toContain("unknown_user_field:\r\n  nested: untouched");
    expect(updated).toContain("[[This/is/code|not a link]]");
    expect(updated.replace(/[^\r]/g, "").length).toBe(
      fixture.replace(/[^\r]/g, "").length
    );
  });

  test("edits a rendered table cell while preserving its pipe-table source", () => {
    const state = markdownState(fixture);
    const normalized = state.doc.toString();
    const tableFrom = normalized.indexOf("| Variable");
    const tableTo = normalized.indexOf("\n\n", tableFrom);
    const tableSource = normalized.slice(tableFrom, tableTo);
    const table = parseMarkdownTable(tableSource, tableFrom);
    const plateValue = table.rows[1]!.cells[1]!;
    const change = tableCellChange(plateValue, "96-well | clear");
    const updated = state.update({ changes: change! }).state.sliceDoc();

    expect(updated).toContain("| Plate | 96-well \\| clear |");
    expect(updated).toContain("| :--- | ---: |");
    expect(updated).toContain(
      "<!-- biota-task id=01K0000000000000000000001 state=scheduled priority=high -->"
    );
  });

  test("a prose edit changes only the selected source range", () => {
    const state = markdownState(fixture);
    const normalized = state.doc.toString();
    const from = normalized.indexOf("working concentration");
    const to = from + "working concentration".length;
    const updated = state
      .update({
        changes: { from, to, insert: "validated concentration range" },
      })
      .state.sliceDoc();
    const sourceFrom = fixture.indexOf("working concentration");
    const sourceTo = sourceFrom + "working concentration".length;

    expect(updated).toBe(
      fixture.slice(0, sourceFrom) +
        "validated concentration range" +
        fixture.slice(sourceTo)
    );
  });
});
