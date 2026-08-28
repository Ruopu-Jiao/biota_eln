import { syntaxTree } from "@codemirror/language";
import { parseBiotaSheetBlocks, type BiotaSheetSpec } from "@biota/vault";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  type ChangeSpec,
  type EditorState,
  type Range,
  StateField,
  Transaction,
} from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  WidgetType,
} from "@codemirror/view";

export interface SourceRange {
  from: number;
  to: number;
}

export interface TableCell extends SourceRange {
  text: string;
}

export interface TableRow {
  cells: TableCell[];
  header: boolean;
}

export interface ParsedMarkdownTable {
  rows: TableRow[];
}

const FRONTMATTER_SCAN_LIMIT = 256 * 1024;

export function findFrontmatterRange(source: string): SourceRange | undefined {
  const opening = /^---[ \t]*(?:\r?\n)/.exec(source);
  if (!opening) return undefined;

  const closing = /^(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/gm;
  closing.lastIndex = opening[0].length;
  const match = closing.exec(source);
  if (!match) return undefined;

  return { from: 0, to: match.index + match[0].length };
}

function unescapeTableCell(value: string) {
  return value.replace(/\\\|/g, "|").trim();
}

function splitTableRow(rawLine: string, absoluteStart: number): TableCell[] {
  const line = rawLine.replace(/\r?\n$/, "");
  const pipes: number[] = [];
  let codeFence = 0;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === "`") {
      let run = 1;
      while (line[index + run] === "`") run += 1;
      codeFence = codeFence === run ? 0 : codeFence === 0 ? run : codeFence;
      index += run - 1;
      continue;
    }
    if (
      character === "|" &&
      codeFence === 0 &&
      (index === 0 || line[index - 1] !== "\\")
    ) {
      pipes.push(index);
    }
  }

  const boundaries = [0, ...pipes, line.length];
  const cells: TableCell[] = [];

  for (let index = 0; index < boundaries.length - 1; index += 1) {
    let from = boundaries[index]!;
    let to = boundaries[index + 1]!;

    if (line[from] === "|") from += 1;
    if (line[to - 1] === "|") to -= 1;

    const segment = line.slice(from, to);
    if (
      segment.trim() === "" &&
      ((index === 0 && pipes[0] === 0) ||
        (index === boundaries.length - 2 &&
          pipes[pipes.length - 1] === line.length - 1))
    ) {
      continue;
    }

    const leading = segment.match(/^[ \t]*/)?.[0].length ?? 0;
    const trailing = segment.match(/[ \t]*$/)?.[0].length ?? 0;
    const contentFrom = from + leading;
    const contentTo = Math.max(contentFrom, to - trailing);

    cells.push({
      from: absoluteStart + contentFrom,
      to: absoluteStart + contentTo,
      text: unescapeTableCell(line.slice(contentFrom, contentTo)),
    });
  }

  return cells;
}

function isTableDelimiter(line: string) {
  const trimmed = line.trim().replace(/^\||\|$/g, "");
  const cells = trimmed.split("|").map((cell) => cell.trim());
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

export function parseMarkdownTable(
  source: string,
  absoluteStart = 0
): ParsedMarkdownTable {
  const lines = source.match(/[^\r\n]*(?:\r\n|\n|$)/g)?.filter(Boolean) ?? [];
  const visibleLines = lines.filter((line) => line.trim() !== "");
  if (visibleLines.length < 2 || !isTableDelimiter(visibleLines[1]!)) {
    return { rows: [] };
  }

  let offset = absoluteStart;
  const rows: TableRow[] = [];
  let visibleIndex = 0;

  for (const line of lines) {
    const isBlank = line.trim() === "";
    if (!isBlank && visibleIndex !== 1) {
      rows.push({
        cells: splitTableRow(line, offset),
        header: visibleIndex === 0,
      });
    }
    if (!isBlank) visibleIndex += 1;
    offset += line.length;
  }

  return { rows };
}

export function escapeTableCell(value: string) {
  return value.replace(/\s*\r?\n\s*/g, " ").replace(/\|/g, "\\|");
}

export function tableCellChange(
  cell: TableCell,
  nextValue: string
): ChangeSpec | undefined {
  const insert = escapeTableCell(nextValue);
  return insert === escapeTableCell(cell.text)
    ? undefined
    : { from: cell.from, to: cell.to, insert };
}

export function taskToggleChanges(
  source: string,
  marker: SourceRange,
  listItem: SourceRange,
  checked: boolean
): ChangeSpec[] {
  const changes: ChangeSpec[] = [
    {
      from: marker.from + 1,
      to: marker.from + 2,
      insert: checked ? "x" : " ",
    },
  ];
  const itemText = source.slice(listItem.from, listItem.to);
  const state = /\bstate=(inbox|scheduled|waiting|done)\b/.exec(itemText);
  if (state?.index !== undefined) {
    const value = state[1]!;
    const from = listItem.from + state.index + "state=".length;
    changes.push({
      from,
      to: from + value.length,
      insert: checked ? "done" : "inbox",
    });
  }
  return changes;
}

function rangeIsActive(
  state: EditorState,
  from: number,
  to: number,
  byLine = false
) {
  if (byLine) {
    const start = state.doc.lineAt(from);
    const end = state.doc.lineAt(Math.max(from, to - 1));
    return state.selection.ranges.some((selection) => {
      const line = state.doc.lineAt(selection.head).number;
      return line >= start.number && line <= end.number;
    });
  }
  return state.selection.ranges.some(
    (selection) => selection.head >= from && selection.head < to
  );
}

function isTaskLineAt(state: EditorState, position: number) {
  const line = state.doc.lineAt(position);
  return /^\s*(?:[-+*]|\d+[.)])\s+\[[ xX]\](?:\s|$)/.test(
    state.doc.sliceString(line.from, line.to)
  );
}

function wikilinkFromNode(
  state: EditorState,
  from: number,
  to: number
):
  | {
      target: string;
      visibleFrom: number;
      visibleTo: number;
      outerFrom: number;
      outerTo: number;
    }
  | undefined {
  if (
    from < 1 ||
    to >= state.doc.length ||
    state.doc.sliceString(from - 1, from) !== "[" ||
    state.doc.sliceString(to, to + 1) !== "]"
  ) {
    return undefined;
  }

  const outerFrom = from - 1;
  const outerTo = to + 1;
  const inner = state.doc.sliceString(from + 1, to - 1);
  const separator = inner.indexOf("|");
  const target = (separator >= 0 ? inner.slice(0, separator) : inner).trim();
  if (!target) return undefined;

  const visibleFrom = separator >= 0 ? from + 1 + separator + 1 : outerFrom + 2;
  const visibleTo = outerTo - 2;
  return { target, visibleFrom, visibleTo, outerFrom, outerTo };
}

export function wikilinkTargetAt(
  state: EditorState,
  position: number
): string | undefined {
  let node = syntaxTree(state).resolveInner(position, -1);
  while (node) {
    if (node.name === "Link") {
      return wikilinkFromNode(state, node.from, node.to)?.target;
    }
    node = node.parent!;
  }
  return undefined;
}

class BulletWidget extends WidgetType {
  toDOM() {
    const bullet = document.createElement("span");
    bullet.className = "cm-live-bullet";
    bullet.textContent = "•";
    bullet.setAttribute("aria-hidden", "true");
    return bullet;
  }

  eq() {
    return true;
  }
}

class PropertiesWidget extends WidgetType {
  constructor(
    private readonly target: number,
    private readonly fields: number
  ) {
    super();
  }

  toDOM(view: EditorView) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "cm-live-properties";
    button.innerHTML = `<span>Properties</span><small>${this.fields} fields · click to edit</small>`;
    button.addEventListener("click", () => {
      view.dispatch({
        selection: { anchor: this.target },
        scrollIntoView: true,
      });
      view.focus();
    });
    return button;
  }

  eq(other: PropertiesWidget) {
    return other.target === this.target && other.fields === this.fields;
  }
}

class TaskCheckboxWidget extends WidgetType {
  constructor(
    private readonly checked: boolean,
    private readonly marker: SourceRange,
    private readonly listItem: SourceRange
  ) {
    super();
  }

  toDOM(view: EditorView) {
    const input = document.createElement("input");
    input.type = "checkbox";
    input.className = "cm-live-task-checkbox";
    input.checked = this.checked;
    input.setAttribute(
      "aria-label",
      this.checked ? "Mark task incomplete" : "Mark task complete"
    );
    input.addEventListener("change", () => {
      view.dispatch({
        changes: taskToggleChanges(
          view.state.doc.toString(),
          this.marker,
          this.listItem,
          input.checked
        ),
        annotations: Transaction.userEvent.of("input"),
      });
    });
    return input;
  }

  eq(other: TaskCheckboxWidget) {
    return (
      other.checked === this.checked &&
      other.marker.from === this.marker.from &&
      other.marker.to === this.marker.to &&
      other.listItem.from === this.listItem.from &&
      other.listItem.to === this.listItem.to
    );
  }
}

class MarkdownTableWidget extends WidgetType {
  constructor(
    private readonly source: string,
    private readonly from: number,
    private readonly parsed: ParsedMarkdownTable,
    private readonly readOnly: boolean
  ) {
    super();
  }

  toDOM(view: EditorView) {
    const wrapper = document.createElement("div");
    wrapper.className = "cm-live-table-wrap";

    const toolbar = document.createElement("div");
    toolbar.className = "cm-live-table-toolbar";
    const label = document.createElement("span");
    label.textContent = this.readOnly
      ? "Markdown table"
      : "Edit cells directly, or open source";
    const sourceButton = document.createElement("button");
    sourceButton.type = "button";
    sourceButton.textContent = "Edit source";
    sourceButton.addEventListener("click", () => {
      view.dispatch({
        selection: { anchor: this.from },
        scrollIntoView: true,
      });
      view.focus();
    });
    toolbar.append(label, sourceButton);

    const table = document.createElement("table");
    for (const row of this.parsed.rows) {
      const tableRow = document.createElement("tr");
      for (const cell of row.cells) {
        const element = document.createElement(row.header ? "th" : "td");
        element.textContent = cell.text;
        if (!this.readOnly) {
          element.contentEditable = "plaintext-only";
          element.spellcheck = true;
          element.setAttribute("aria-label", "Editable Markdown table cell");
          element.addEventListener("keydown", (event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              element.blur();
            }
          });
          element.addEventListener("blur", () => {
            const change = tableCellChange(cell, element.textContent ?? "");
            if (change) {
              view.dispatch({
                changes: change,
                annotations: Transaction.userEvent.of("input"),
              });
            }
          });
        }
        tableRow.append(element);
      }
      table.append(tableRow);
    }

    wrapper.append(toolbar, table);
    return wrapper;
  }

  eq(other: MarkdownTableWidget) {
    return (
      other.source === this.source &&
      other.from === this.from &&
      other.readOnly === this.readOnly
    );
  }
}

const sheetRoots = new WeakMap<HTMLElement, Root>();

class EmbeddedSheetWidget extends WidgetType {
  constructor(
    private readonly spec: BiotaSheetSpec,
    private readonly ownerPath: string,
    private readonly sourceFrom: number,
    private readonly readOnly: boolean,
    private readonly onOpenAsset?: (target: string) => void
  ) {
    super();
  }

  get estimatedHeight() {
    return 500;
  }

  toDOM(view: EditorView) {
    const wrapper = document.createElement("section");
    wrapper.className = "cm-live-sheet-wrap";
    wrapper.dataset.sheetId = this.spec.id;

    const toolbar = document.createElement("header");
    toolbar.className = "cm-live-sheet-toolbar";
    const identity = document.createElement("span");
    identity.className = "cm-live-sheet-identity";
    const badge = document.createElement("small");
    badge.textContent = "Spreadsheet";
    const title = document.createElement("strong");
    title.textContent = this.spec.title;
    identity.append(badge, title);

    const actions = document.createElement("span");
    actions.className = "cm-live-sheet-actions";
    const openData = document.createElement("button");
    openData.type = "button";
    openData.textContent = "Open CSV";
    openData.addEventListener("click", () =>
      this.onOpenAsset?.(this.spec.data)
    );
    const editSource = document.createElement("button");
    editSource.type = "button";
    editSource.textContent = "Edit embed";
    editSource.addEventListener("click", () => {
      view.dispatch({
        selection: { anchor: this.sourceFrom },
        scrollIntoView: true,
      });
      view.focus();
    });
    actions.append(openData, editSource);
    toolbar.append(identity, actions);

    const mount = document.createElement("div");
    mount.className = "cm-live-sheet-mount";
    mount.innerHTML =
      '<div class="cm-live-sheet-loading"><span></span>Opening local spreadsheet…</div>';
    wrapper.append(toolbar, mount);

    const root = createRoot(mount);
    sheetRoots.set(wrapper, root);
    void import("@/components/EmbeddedSpreadsheet")
      .then(({ EmbeddedSpreadsheet }) => {
        if (!wrapper.isConnected) return;
        root.render(
          createElement(EmbeddedSpreadsheet, {
            spec: this.spec,
            ownerPath: this.ownerPath,
            readOnly: this.readOnly,
          })
        );
        view.requestMeasure();
      })
      .catch((caught: unknown) => {
        if (!wrapper.isConnected) return;
        const message =
          caught instanceof Error
            ? caught.message
            : "The spreadsheet module could not be loaded.";
        mount.replaceChildren();
        const error = document.createElement("div");
        error.className = "cm-live-sheet-error";
        error.textContent = message;
        mount.append(error);
        view.requestMeasure();
      });

    return wrapper;
  }

  destroy(dom: HTMLElement) {
    const root = sheetRoots.get(dom);
    sheetRoots.delete(dom);
    if (root) {
      // A CodeMirror decoration can be removed during a surrounding React
      // commit. Deferring this nested-root unmount avoids React 19's
      // synchronous-unmount race while keeping the detached DOM recoverable.
      queueMicrotask(() => root.unmount());
    }
  }

  eq(other: EmbeddedSheetWidget) {
    return (
      other.ownerPath === this.ownerPath &&
      other.sourceFrom === this.sourceFrom &&
      other.readOnly === this.readOnly &&
      other.spec.id === this.spec.id &&
      other.spec.title === this.spec.title &&
      other.spec.data === this.spec.data &&
      other.spec.schema === this.spec.schema
    );
  }

  ignoreEvent() {
    return true;
  }
}

interface BuildDecorationOptions {
  recordPath?: string;
  onOpenWikilink?: (target: string) => void;
}

function buildDecorations(
  state: EditorState,
  options: BuildDecorationOptions = {}
): DecorationSet {
  const source = state.doc.toString();
  const ranges: Range<Decoration>[] = [];
  const lineClasses = new Map<number, Set<string>>();
  const handledTables = new Set<string>();
  const sheetBlocks = new Map(
    parseBiotaSheetBlocks(source).map((block) => [block.from, block])
  );
  const frontmatter = findFrontmatterRange(
    source.slice(0, FRONTMATTER_SCAN_LIMIT)
  );

  const addLineClass = (position: number, className: string) => {
    const lineFrom = state.doc.lineAt(position).from;
    const classes = lineClasses.get(lineFrom) ?? new Set<string>();
    classes.add(className);
    lineClasses.set(lineFrom, classes);
  };

  const hide = (from: number, to: number) => {
    if (from < to) ranges.push(Decoration.replace({}).range(from, to));
  };

  if (frontmatter && !rangeIsActive(state, frontmatter.from, frontmatter.to)) {
    const raw = source.slice(frontmatter.from, frontmatter.to);
    const fields = raw
      .split(/\r?\n/)
      .filter((line) => /^[\w.-]+\s*:/.test(line)).length;
    const target = Math.min(frontmatter.to, 4);
    ranges.push(
      Decoration.replace({
        block: true,
        widget: new PropertiesWidget(target, fields),
      }).range(frontmatter.from, frontmatter.to)
    );
  }

  const tree = syntaxTree(state);
  tree.iterate({
    enter(node) {
      if (
        frontmatter &&
        node.from < frontmatter.to &&
        node.to <= frontmatter.to
      ) {
        return false;
      }

      const name = node.name;
      const activeLine = rangeIsActive(state, node.from, node.to, true);
      const taskLine = isTaskLineAt(state, node.from);
      const revealInlineMarkup = activeLine && !taskLine;

      const heading = /^ATXHeading([1-6])$/.exec(name);
      if (heading) {
        addLineClass(node.from, `cm-live-heading cm-live-h${heading[1]}`);
      } else if (name === "SetextHeading1" || name === "SetextHeading2") {
        addLineClass(
          node.from,
          `cm-live-heading ${
            name === "SetextHeading1" ? "cm-live-h1" : "cm-live-h2"
          }`
        );
      } else if (name === "HeaderMark" && !activeLine) {
        let to = node.to;
        if (state.doc.sliceString(to, to + 1) === " ") to += 1;
        hide(node.from, to);
      } else if (name === "StrongEmphasis") {
        ranges.push(
          Decoration.mark({ class: "cm-live-strong" }).range(node.from, node.to)
        );
      } else if (name === "Emphasis") {
        ranges.push(
          Decoration.mark({ class: "cm-live-emphasis" }).range(
            node.from,
            node.to
          )
        );
      } else if (name === "Strikethrough") {
        ranges.push(
          Decoration.mark({ class: "cm-live-strike" }).range(node.from, node.to)
        );
      } else if (
        (name === "EmphasisMark" || name === "StrikethroughMark") &&
        !revealInlineMarkup
      ) {
        hide(node.from, node.to);
      } else if (name === "InlineCode") {
        ranges.push(
          Decoration.mark({ class: "cm-live-inline-code" }).range(
            node.from,
            node.to
          )
        );
      } else if (name === "CodeMark" && !revealInlineMarkup) {
        hide(node.from, node.to);
      } else if (name === "QuoteMark") {
        addLineClass(node.from, "cm-live-quote");
        if (!activeLine) {
          let to = node.to;
          if (state.doc.sliceString(to, to + 1) === " ") to += 1;
          hide(node.from, to);
        }
      } else if (name === "ListMark" && (!activeLine || taskLine)) {
        ranges.push(
          Decoration.replace({ widget: new BulletWidget() }).range(
            node.from,
            node.to
          )
        );
      } else if (name === "TaskMarker") {
        addLineClass(node.from, "cm-live-task-line");
        let parent = node.node.parent;
        while (parent && parent.name !== "ListItem") parent = parent.parent;
        if (parent) {
          const checked =
            state.doc.sliceString(node.from, node.to).toLowerCase() === "[x]";
          ranges.push(
            Decoration.replace({
              widget: new TaskCheckboxWidget(
                checked,
                { from: node.from, to: node.to },
                { from: parent.from, to: parent.to }
              ),
            }).range(node.from, node.to)
          );
        }
      } else if (name === "CommentBlock") {
        const comment = state.doc.sliceString(node.from, node.to);
        if (comment.includes("biota-task") && !activeLine) {
          const line = state.doc.lineAt(node.from);
          if (
            state.doc.sliceString(line.from, line.to).trim().startsWith("<!--")
          ) {
            const to =
              line.to < state.doc.length ? line.to + 1 : state.doc.length;
            ranges.push(
              Decoration.replace({ block: true }).range(line.from, to)
            );
          } else {
            hide(node.from, node.to);
          }
        }
      } else if (name === "Link") {
        const wikilink = wikilinkFromNode(state, node.from, node.to);
        if (wikilink) {
          if (!revealInlineMarkup) {
            hide(wikilink.outerFrom, wikilink.visibleFrom);
            hide(wikilink.visibleTo, wikilink.outerTo);
          }
          ranges.push(
            Decoration.mark({
              class: "cm-live-link cm-live-wikilink",
              attributes: {
                title: `⌘-click to open ${wikilink.target}`,
              },
            }).range(wikilink.visibleFrom, wikilink.visibleTo)
          );
          return false;
        }
        ranges.push(
          Decoration.mark({ class: "cm-live-link" }).range(node.from, node.to)
        );
      } else if (
        (name === "LinkMark" || name === "URL") &&
        !revealInlineMarkup
      ) {
        hide(node.from, node.to);
      } else if (name === "Table") {
        const key = `${node.from}:${node.to}`;
        if (handledTables.has(key)) return false;
        handledTables.add(key);
        if (!rangeIsActive(state, node.from, node.to)) {
          const endLine = state.doc.lineAt(Math.max(node.from, node.to - 1));
          const to =
            endLine.to < state.doc.length ? endLine.to + 1 : endLine.to;
          const tableSource = state.doc.sliceString(node.from, node.to);
          ranges.push(
            Decoration.replace({
              block: true,
              widget: new MarkdownTableWidget(
                tableSource,
                node.from,
                parseMarkdownTable(tableSource, node.from),
                state.readOnly
              ),
            }).range(node.from, to)
          );
        }
        return false;
      } else if (name === "FencedCode") {
        const sheetBlock = sheetBlocks.get(node.from);
        if (
          sheetBlock?.valid &&
          sheetBlock.spec &&
          options.recordPath &&
          !rangeIsActive(state, sheetBlock.from, sheetBlock.to)
        ) {
          ranges.push(
            Decoration.replace({
              block: true,
              widget: new EmbeddedSheetWidget(
                sheetBlock.spec,
                options.recordPath,
                sheetBlock.from,
                state.readOnly,
                options.onOpenWikilink
              ),
            }).range(sheetBlock.from, sheetBlock.to)
          );
          return false;
        }
        let line = state.doc.lineAt(node.from);
        const end = state.doc.lineAt(Math.max(node.from, node.to - 1)).number;
        while (line.number <= end) {
          addLineClass(line.from, "cm-live-code-line");
          if (line.number === end || line.to >= state.doc.length) break;
          line = state.doc.line(line.number + 1);
        }
        return false;
      }
      return undefined;
    },
  });

  for (const [from, classes] of lineClasses) {
    ranges.push(Decoration.line({ class: [...classes].join(" ") }).range(from));
  }

  return Decoration.set(ranges, true);
}

export interface LiveMarkdownPreviewOptions {
  onOpenWikilink?: (target: string) => void;
  recordPath?: string;
}

export function liveMarkdownPreview(
  options: LiveMarkdownPreviewOptions | ((target: string) => void) = {}
) {
  const normalized =
    typeof options === "function" ? { onOpenWikilink: options } : options;
  const { onOpenWikilink } = normalized;
  const decorations = StateField.define<DecorationSet>({
    create(state) {
      return buildDecorations(state, normalized);
    },
    update(_value, transaction) {
      return buildDecorations(transaction.state, normalized);
    },
    provide: (field) => EditorView.decorations.from(field),
  });

  return [
    decorations,
    EditorView.domEventHandlers({
      mousedown(event, view) {
        if (!(event.metaKey || event.ctrlKey)) return false;
        const position = view.posAtCoords({
          x: event.clientX,
          y: event.clientY,
        });
        if (position === null) return false;
        const target = wikilinkTargetAt(view.state, position);
        if (!target) return false;
        event.preventDefault();
        onOpenWikilink?.(target);
        return true;
      },
    }),
  ];
}
