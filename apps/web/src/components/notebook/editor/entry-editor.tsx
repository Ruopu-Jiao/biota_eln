"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type MouseEvent as ReactMouseEvent,
  type ReactElement,
  type ReactNode,
  type SVGProps,
} from "react";
import { SubmitButton } from "@/components/notebook/submit-button";
import { MarkdownPreview } from "./markdown-preview";
import { createTableFormulaResolver } from "./table-formulas";
import type {
  EntityOption,
  EntryEditorBlock,
  EntryEntityBlock,
  EntryProtocolBlock,
  EntryTableBlock,
  EntryTextBlock,
  ProtocolOption,
} from "./types";
import {
  buildSpreadsheetColumns,
  createDefaultEntryBlocks,
  createEntityBlock,
  createProtocolBlock,
  createTableBlock,
  createTextBlock,
  ensureInlineEntryEditorBlocks,
  getSerializableEntryEditorBlocks,
  serializeEntryEditorValue,
} from "./types";

type EntryEditorProps = {
  entryId?: string;
  initialTitle?: string;
  initialBlocks?: EntryEditorBlock[];
  protocolOptions: ProtocolOption[];
  entityOptions: EntityOption[];
  className?: string;
  formAction?: (formData: FormData) => void | Promise<void>;
  onChange?: (blocks: EntryEditorBlock[]) => void;
  submitLabel?: string;
  pendingLabel?: string;
};

type MarkdownCommand =
  | "h1"
  | "h2"
  | "bold"
  | "italic"
  | "code"
  | "code-block"
  | "bullet"
  | "numbered"
  | "quote"
  | "task";

type IconProps = SVGProps<SVGSVGElement>;

type TextSelection = {
  start: number;
  end: number;
};

type PendingFocusTarget = {
  blockId: string;
  position: number;
};

type TableContextMenu =
  | {
      kind: "column";
      index: number;
      x: number;
      y: number;
    }
  | {
      kind: "row";
      index: number;
      x: number;
      y: number;
    };

function ProtocolBlockIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...props}>
      <path d="M8 5.25h8" />
      <path d="M8 9.5h8" />
      <path d="M8 13.75h5" />
      <path d="M5.75 4.25h12.5v15.5H5.75z" />
    </svg>
  );
}

function EntityBlockIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...props}>
      <path d="M7 4.5c4.5 0 5.5 4 10 4" />
      <path d="M7 19.5c4.5 0 5.5-4 10-4" />
      <path d="M7 4.5c0 4.5 4 5.5 4 10" />
      <path d="M17 19.5c0-4.5-4-5.5-4-10" />
      <path d="M6.5 8.5h11" />
      <path d="M6.5 15.5h11" />
    </svg>
  );
}

function TableBlockIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...props}>
      <path d="M5.5 6.25h13v11.5h-13z" />
      <path d="M5.5 10h13" />
      <path d="M10 6.25v11.5" />
    </svg>
  );
}

function HeadingOneIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...props}>
      <path d="M6 5v14" />
      <path d="M6 12h8" />
      <path d="M14 5v14" />
      <path d="M17.5 8.5h2.5v10" />
      <path d="M17.5 18.5h5" />
    </svg>
  );
}

function HeadingTwoIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...props}>
      <path d="M6 5v14" />
      <path d="M6 12h8" />
      <path d="M14 5v14" />
      <path d="M17.25 9.5c0-1.1.9-2 2-2s2 .9 2 2c0 2.5-4 3.5-4 6h4.5" />
    </svg>
  );
}

function BoldIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...props}>
      <path d="M8 5.5h4.8a2.7 2.7 0 1 1 0 5.4H8z" />
      <path d="M8 11.5h5.5a2.8 2.8 0 1 1 0 5.6H8z" />
    </svg>
  );
}

function ItalicIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...props}>
      <path d="M10 5.5h7" />
      <path d="M7 18.5h7" />
      <path d="M12 5.5 10 18.5" />
    </svg>
  );
}

function CodeIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...props}>
      <path d="M9 8.5 5.5 12 9 15.5" />
      <path d="M15 8.5 18.5 12 15 15.5" />
      <path d="M13 6.5 11 17.5" />
    </svg>
  );
}

function BulletListIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...props}>
      <circle cx="6.5" cy="7.5" r="1.1" />
      <circle cx="6.5" cy="12" r="1.1" />
      <circle cx="6.5" cy="16.5" r="1.1" />
      <path d="M10.5 7.5h7" />
      <path d="M10.5 12h7" />
      <path d="M10.5 16.5h7" />
    </svg>
  );
}

function NumberedListIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...props}>
      <path d="M5.5 7.25h2" />
      <path d="M5.5 12h2" />
      <path d="M5.5 16.75h2" />
      <path d="M6.5 6.25v2" />
      <path d="M10.5 7.5h7" />
      <path d="M10.5 12h7" />
      <path d="M10.5 16.5h7" />
    </svg>
  );
}

function QuoteIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...props}>
      <path d="M7 8.5h4l-2 7H6l1-7Z" />
      <path d="M13 8.5h4l-2 7h-3l1-7Z" />
    </svg>
  );
}

function TaskIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...props}>
      <path d="M6 7.25h12" />
      <path d="M6 12h12" />
      <path d="M6 16.75h8" />
      <path d="M7 6.5h1.5l1 1.25 2.5-2.5" />
    </svg>
  );
}

function CodeBlockIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...props}>
      <path d="M8.5 6.5 5 12l3.5 5.5" />
      <path d="M15.5 6.5 19 12l-3.5 5.5" />
      <path d="M11.25 5.5 9.75 18.5" />
    </svg>
  );
}

function EyeIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...props}>
      <path d="M3.75 12c1.94-4.25 5.28-6.75 8.25-6.75s6.31 2.5 8.25 6.75c-1.94 4.25-5.28 6.75-8.25 6.75S5.69 16.25 3.75 12Z" />
      <circle cx="12" cy="12" r="2.75" />
    </svg>
  );
}

function TrashIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...props}>
      <path d="M8.5 7.25h7" />
      <path d="M6.75 7.25h10.5" />
      <path d="M9 7.25V5.75h6V7.25" />
      <path d="M8.25 7.25v10.5h7.5V7.25" />
      <path d="M10.5 10.25v4.5" />
      <path d="M13.5 10.25v4.5" />
    </svg>
  );
}

function insertAroundSelection(
  textarea: HTMLTextAreaElement,
  before: string,
  after: string,
  placeholder: string,
) {
  const selectionStart = textarea.selectionStart;
  const selectionEnd = textarea.selectionEnd;
  const selectedText = textarea.value.slice(selectionStart, selectionEnd);
  const content = selectedText || placeholder;
  const replacement = `${before}${content}${after}`;

  textarea.setRangeText(replacement, selectionStart, selectionEnd, "end");
  textarea.focus();
}

function prefixSelectionLines(
  textarea: HTMLTextAreaElement,
  prefix: string,
  placeholder: string,
) {
  const selectionStart = textarea.selectionStart;
  const selectionEnd = textarea.selectionEnd;
  const selectedText = textarea.value.slice(selectionStart, selectionEnd);
  const content = selectedText || placeholder;
  const replacement = content
    .split("\n")
    .map((line) => `${prefix}${line}`)
    .join("\n");

  textarea.setRangeText(replacement, selectionStart, selectionEnd, "end");
  textarea.focus();
}

function updateTableRows(block: EntryTableBlock, rows: string[][]): EntryTableBlock {
  return {
    ...block,
    rows: rows.map((row) =>
      Array.from({ length: block.columns.length }, (_, index) => row[index] ?? ""),
    ),
  };
}

function tableToCsv(block: EntryTableBlock) {
  const escapeCell = (value: string) => `"${value.replaceAll("\"", "\"\"")}"`;
  const lines = [
    block.columns.map(escapeCell).join(","),
    ...block.rows.map((row) => row.map((cell) => escapeCell(cell)).join(",")),
  ];

  return lines.join("\n");
}

function downloadTableCsv(block: EntryTableBlock, tableLabel: string) {
  const blob = new Blob([tableToCsv(block)], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const safeLabel = tableLabel
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  link.href = url;
  link.download = `${safeLabel || "entry-table"}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function buildOrdinalMap(
  blocks: EntryEditorBlock[],
  type: EntryEditorBlock["type"],
) {
  let count = 0;
  const ordinals = new Map<string, number>();

  for (const block of blocks) {
    if (block.type !== type) {
      continue;
    }

    count += 1;
    ordinals.set(block.id, count);
  }

  return ordinals;
}

function getBlockDescription(block: EntryEditorBlock) {
  if (block.type === "table") {
    return "Structured measurements, calculations, and reagent layouts.";
  }

  if (block.type === "entity") {
    return "Sequence-backed references to plasmids, primers, and guides.";
  }

  if (block.type === "protocol") {
    return "Reusable protocol references from the library.";
  }

  return "Freeform markdown writing.";
}

function lineCount(value: string) {
  return value.split("\n").length;
}

const iconButtonStyles =
  "inline-flex h-9 w-9 items-center justify-center border border-[color:var(--line)] text-[color:var(--text-muted)] transition hover:border-[color:var(--line-strong)] hover:text-[color:var(--text-primary)] disabled:opacity-40";
const quietButtonStyles =
  "inline-flex min-h-9 items-center justify-center border border-[color:var(--line)] px-3 text-[11px] uppercase tracking-[0.16em] text-[color:var(--text-muted)] transition hover:border-[color:var(--line-strong)] hover:text-[color:var(--text-primary)]";
const primaryButtonStyles =
  "inline-flex min-h-10 items-center justify-center border border-[color:var(--accent-soft)] bg-[color:var(--accent-muted)] px-4 text-sm font-medium text-[color:var(--text-primary)] transition hover:border-[color:var(--accent-strong)] hover:bg-[color:var(--accent-soft)] disabled:cursor-not-allowed disabled:opacity-60";

function IconActionButton({
  label,
  children,
  className = iconButtonStyles,
  outerClassName,
  ...props
}: {
  label: string;
  children: ReactNode;
  className?: string;
  outerClassName?: string;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children">) {
  return (
    <div className={`group relative inline-flex ${outerClassName ?? ""}`}>
      <button
        {...props}
        title={label}
        aria-label={label}
        className={className}
      >
        {children}
        <span className="sr-only">{label}</span>
      </button>
      <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 -translate-x-1/2 whitespace-nowrap border border-[color:var(--line)] bg-[color:var(--surface-strong)] px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-[color:var(--text-muted)] opacity-0 shadow-lg transition group-hover:opacity-100 group-focus-within:opacity-100">
        {label}
      </span>
    </div>
  );
}

function MarkdownToolbar({
  onApply,
  previewVisible,
  onTogglePreview,
  disabled = false,
}: {
  onApply: (command: MarkdownCommand) => void;
  previewVisible: boolean;
  onTogglePreview: () => void;
  disabled?: boolean;
}) {
  const commands: Array<{
    command: MarkdownCommand;
    label: string;
    Icon: (props: IconProps) => ReactElement;
  }> = [
    { command: "h1", label: "Heading 1", Icon: HeadingOneIcon },
    { command: "h2", label: "Heading 2", Icon: HeadingTwoIcon },
    { command: "bold", label: "Bold", Icon: BoldIcon },
    { command: "italic", label: "Italic", Icon: ItalicIcon },
    { command: "code", label: "Inline code", Icon: CodeIcon },
    { command: "bullet", label: "Bullet list", Icon: BulletListIcon },
    { command: "numbered", label: "Numbered list", Icon: NumberedListIcon },
    { command: "quote", label: "Quote", Icon: QuoteIcon },
    { command: "task", label: "Task list", Icon: TaskIcon },
    { command: "code-block", label: "Code block", Icon: CodeBlockIcon },
  ];

  return (
    <div className="flex flex-wrap items-center gap-1.5 border-b border-[color:var(--line)] pb-3">
      {commands.map(({ command, label, Icon }) => (
        <IconActionButton
          key={command}
          type="button"
          onClick={() => onApply(command)}
          label={label}
          disabled={disabled}
        >
          <Icon className="h-4 w-4" />
        </IconActionButton>
      ))}
      <IconActionButton
        type="button"
        onClick={onTogglePreview}
        label={previewVisible ? "Hide preview" : "Preview"}
        className={`${iconButtonStyles} text-[color:var(--accent-strong)] hover:border-[color:var(--accent-soft)]`}
        outerClassName="ml-auto"
      >
        <EyeIcon className="h-4 w-4" />
      </IconActionButton>
    </div>
  );
}

function TableBlockEditor({
  block,
  tableNumber,
  onRemove,
  onChange,
}: {
  block: EntryTableBlock;
  tableNumber: number;
  onRemove: () => void;
  onChange: (nextBlock: EntryTableBlock) => void;
}) {
  const [activeCellId, setActiveCellId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<TableContextMenu | null>(null);
  const resolveFormulaCell = useMemo(
    () => createTableFormulaResolver(block),
    [block],
  );
  const tableLabel = block.name?.trim() || `Table ${tableNumber}`;

  useEffect(() => {
    if (!contextMenu) {
      return;
    }

    function closeContextMenu() {
      setContextMenu(null);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeContextMenu();
      }
    }

    window.addEventListener("pointerdown", closeContextMenu);
    window.addEventListener("scroll", closeContextMenu, true);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", closeContextMenu);
      window.removeEventListener("scroll", closeContextMenu, true);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [contextMenu]);

  function setColumnCount(columnCount: number, rows: string[][]) {
    const columns = buildSpreadsheetColumns(columnCount);

    return {
      ...block,
      columns,
      rows: rows.map((row) =>
        Array.from({ length: columns.length }, (_, index) => row[index] ?? ""),
      ),
    } satisfies EntryTableBlock;
  }

  function updateName(value: string) {
    onChange({
      ...block,
      name: value,
    });
  }

  function updateCell(rowIndex: number, columnIndex: number, value: string) {
    const rows = block.rows.map((row, currentRowIndex) =>
      currentRowIndex === rowIndex
        ? row.map((cell, currentColumnIndex) =>
            currentColumnIndex === columnIndex ? value : cell,
          )
        : row,
    );

    onChange(updateTableRows(block, rows));
  }

  function addColumn() {
    onChange(setColumnCount(block.columns.length + 1, block.rows));
  }

  function removeColumn(columnIndex: number) {
    if (block.columns.length <= 1) {
      return;
    }

    setActiveCellId(null);
    setContextMenu(null);
    onChange(
      setColumnCount(
        block.columns.length - 1,
        block.rows.map((row) => row.filter((_, index) => index !== columnIndex)),
      ),
    );
  }

  function addRow() {
    onChange({
      ...block,
      rows: [...block.rows, Array.from({ length: block.columns.length }, () => "")],
    });
  }

  function removeRow(rowIndex: number) {
    if (block.rows.length <= 1) {
      return;
    }

    setActiveCellId(null);
    setContextMenu(null);
    onChange({
      ...block,
      rows: block.rows.filter((_, index) => index !== rowIndex),
    });
  }

  function openColumnContextMenu(
    event: ReactMouseEvent<HTMLTableCellElement>,
    columnIndex: number,
  ) {
    event.preventDefault();
    setContextMenu({
      kind: "column",
      index: columnIndex,
      x: event.clientX,
      y: event.clientY,
    });
  }

  function openRowContextMenu(
    event: ReactMouseEvent<HTMLTableCellElement>,
    rowIndex: number,
  ) {
    event.preventDefault();
    setContextMenu({
      kind: "row",
      index: rowIndex,
      x: event.clientX,
      y: event.clientY,
    });
  }

  return (
    <section className="space-y-0 border-y border-[color:var(--line)] py-4">
      <div className="border border-[color:var(--line)] bg-[color:var(--surface)]">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[color:var(--line)] px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[color:var(--text-soft)]">
              Table
            </p>
            <input
              value={block.name ?? ""}
              onChange={(event) => updateName(event.target.value)}
              aria-label={`Table ${tableNumber} name`}
              placeholder={tableLabel}
              className="mt-2 w-full max-w-xl border-0 bg-transparent px-0 py-0 text-base font-medium text-[color:var(--text-primary)] outline-none placeholder:text-[color:var(--text-soft)]"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={addRow}
              className={quietButtonStyles}
            >
              Add row
            </button>
            <button
              type="button"
              onClick={addColumn}
              className={quietButtonStyles}
            >
              Add column
            </button>
            <button
              type="button"
              onClick={() => downloadTableCsv(block, tableLabel)}
              className={quietButtonStyles}
            >
              Export CSV
            </button>
            <button
              type="button"
              onClick={onRemove}
              className={`${quietButtonStyles} hover:border-[color:var(--danger-soft)] hover:text-[color:var(--danger)]`}
            >
              Remove table
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse">
          <thead>
            <tr className="border-b border-[color:var(--line)] bg-[color:var(--surface-muted)]">
              <th className="w-16 border-r border-[color:var(--line)] px-3 py-2 text-left font-mono text-[11px] uppercase tracking-[0.16em] text-[color:var(--text-soft)]">
                #
              </th>
              {block.columns.map((column, columnIndex) => (
                <th
                  key={`${block.id}-column-${columnIndex}`}
                  onContextMenu={(event) => openColumnContextMenu(event, columnIndex)}
                  className="min-w-[180px] cursor-context-menu border-r border-[color:var(--line)] px-3 py-2 text-left align-top font-mono text-xs uppercase tracking-[0.18em] text-[color:var(--text-primary)] last:border-r-0"
                  scope="col"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, rowIndex) => (
              <tr
                key={`${block.id}-row-${rowIndex}`}
                className="border-b border-[color:var(--line)] last:border-b-0"
              >
                <th
                  onContextMenu={(event) => openRowContextMenu(event, rowIndex)}
                  className="w-16 cursor-context-menu border-r border-[color:var(--line)] bg-[color:var(--surface-muted)] px-3 py-2 text-left align-top font-mono text-xs text-[color:var(--text-soft)]"
                  scope="row"
                >
                  {rowIndex + 1}
                </th>
                {block.columns.map((_, columnIndex) => {
                  const currentCellId = `${rowIndex}:${columnIndex}`;
                  const active = activeCellId === currentCellId;
                  const cell = row[columnIndex] ?? "";
                  const cellDisplay = resolveFormulaCell(rowIndex, columnIndex);

                  return (
                    <td
                      key={`${block.id}-cell-${rowIndex}-${columnIndex}`}
                      className="border-r border-[color:var(--line)] px-3 py-2 align-top last:border-r-0"
                    >
                      <div className="space-y-1">
                        <input
                          value={active ? cell : cellDisplay.displayValue}
                          onChange={(event) =>
                            updateCell(rowIndex, columnIndex, event.target.value)
                          }
                          onFocus={() => setActiveCellId(currentCellId)}
                          onBlur={() =>
                            setActiveCellId((current) =>
                              current === currentCellId ? null : current,
                            )
                          }
                          aria-label={`Table ${tableNumber} row ${rowIndex + 1} column ${columnIndex + 1}`}
                          spellCheck={false}
                          autoComplete="off"
                          title={
                            cellDisplay.isFormula
                              ? cellDisplay.error ?? cellDisplay.formula ?? "Formula cell"
                              : "Cell value"
                          }
                          className="w-full bg-transparent text-sm text-[color:var(--text-primary)] outline-none placeholder:text-[color:var(--text-soft)]"
                        />
                        {cellDisplay.isFormula ? (
                          <div
                            className="flex items-center justify-between gap-2 font-mono text-[10px] uppercase tracking-[0.12em]"
                            title={cellDisplay.error ?? cellDisplay.formula ?? undefined}
                          >
                            <span className="truncate text-[color:var(--text-soft)]">
                              {cellDisplay.formula}
                            </span>
                            <span
                              className={
                                cellDisplay.error
                                  ? "text-[color:var(--danger)]"
                                  : "text-[color:var(--accent-strong)]"
                              }
                            >
                              {cellDisplay.error ? "Error" : "fx"}
                            </span>
                          </div>
                        ) : null}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          </table>
        </div>
      </div>

      {contextMenu ? (
        <div
          className="fixed z-30 min-w-[180px] border border-[color:var(--line)] bg-[color:var(--surface-strong)] p-1 shadow-2xl"
          style={{
            left: contextMenu.x + 8,
            top: contextMenu.y + 8,
          }}
        >
          <button
            type="button"
            onClick={() =>
              contextMenu.kind === "column"
                ? removeColumn(contextMenu.index)
                : removeRow(contextMenu.index)
            }
            disabled={
              contextMenu.kind === "column"
                ? block.columns.length <= 1
                : block.rows.length <= 1
            }
            className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm text-[color:var(--text-primary)] transition hover:bg-[color:var(--surface-muted)] disabled:cursor-not-allowed disabled:text-[color:var(--text-soft)]"
          >
            <span>
              {contextMenu.kind === "column"
                ? `Delete column ${block.columns[contextMenu.index]}`
                : `Delete row ${contextMenu.index + 1}`}
            </span>
            <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-[color:var(--text-soft)]">
              Delete
            </span>
          </button>
        </div>
      ) : null}
    </section>
  );
}

function EntityBlockEditor({
  block,
  entityNumber,
  entityOptions,
  onChange,
}: {
  block: EntryEntityBlock;
  entityNumber: number;
  entityOptions: EntityOption[];
  onChange: (nextBlock: EntryEntityBlock) => void;
}) {
  const entity = entityOptions.find((option) => option.id === block.entityId) ?? null;

  return (
    <div className="space-y-3">
      <label className="block space-y-2">
        <span className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--text-soft)]">
          Linked entity
        </span>
        <select
          value={block.entityId}
          onChange={(event) =>
            onChange({
              ...block,
              entityId: event.target.value,
            })
          }
          aria-label={`Entity block ${entityNumber}`}
          className="w-full border-b border-[color:var(--line)] bg-transparent px-0 py-2 text-sm text-[color:var(--text-primary)] outline-none focus:border-[color:var(--accent-strong)]"
        >
          <option value="">Select an entity</option>
          {entityOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.title}
            </option>
          ))}
        </select>
      </label>

      {entity ? (
        <div className="space-y-3 border-l border-[color:var(--line)] pl-4 text-sm text-[color:var(--text-muted)]">
          <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-[color:var(--text-soft)]">
            <span>{entity.typeLabel}</span>
            <span>{entity.sequenceLength.toLocaleString()} bp</span>
            <span>{entity.topology}</span>
          </div>
          <p className="leading-7">
            {entity.summary ?? "Sequence-backed record linked into this entry."}
          </p>
          <Link
            href={`/entities/${entity.id}`}
            className={quietButtonStyles}
          >
            Open in DNA viewer
          </Link>
        </div>
      ) : (
        <div className="text-sm leading-7 text-[color:var(--text-soft)]">
          Select an entity to link a real sequence-backed record into this document.
        </div>
      )}
    </div>
  );
}

function ProtocolBlockEditor({
  block,
  protocolNumber,
  protocolOptions,
  onChange,
}: {
  block: EntryProtocolBlock;
  protocolNumber: number;
  protocolOptions: ProtocolOption[];
  onChange: (nextBlock: EntryProtocolBlock) => void;
}) {
  const protocol =
    protocolOptions.find((option) => option.id === block.protocolId) ?? null;

  return (
    <div className="space-y-3">
      <label className="block space-y-2">
        <span className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--text-soft)]">
          Linked protocol
        </span>
        <select
          value={block.protocolId}
          onChange={(event) =>
            onChange({
              ...block,
              protocolId: event.target.value,
            })
          }
          aria-label={`Protocol block ${protocolNumber}`}
          className="w-full border-b border-[color:var(--line)] bg-transparent px-0 py-2 text-sm text-[color:var(--text-primary)] outline-none focus:border-[color:var(--accent-strong)]"
        >
          <option value="">Select a protocol</option>
          {protocolOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.title}
            </option>
          ))}
        </select>
      </label>

      {protocol ? (
        <div className="space-y-3 border-l border-[color:var(--line)] pl-4 text-sm text-[color:var(--text-muted)]">
          <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-[color:var(--text-soft)]">
            <span>{protocol.status ?? "Draft"}</span>
            <span>{protocol.slug}</span>
          </div>
          <p className="leading-7">
            {protocol.summary ?? "Reusable protocol inserted into this entry."}
          </p>
          <Link
            href={`/protocols/${protocol.id}`}
            className={quietButtonStyles}
          >
            Open protocol
          </Link>
        </div>
      ) : (
        <div className="text-sm leading-7 text-[color:var(--text-soft)]">
          Select a protocol to insert a reusable method block into the document flow.
        </div>
      )}
    </div>
  );
}

function EmbedBlockShell({
  block,
  onRemove,
  children,
}: {
  block: EntryProtocolBlock | EntryEntityBlock;
  onRemove: () => void;
  children: ReactNode;
}) {
  const label = block.type === "entity" ? "Entity" : "Protocol";

  return (
    <section className="space-y-4 border-y border-[color:var(--line)] py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[color:var(--text-soft)]">
            {label}
          </p>
          <p className="text-sm leading-7 text-[color:var(--text-muted)]">
            {getBlockDescription(block)}
          </p>
        </div>
        <IconActionButton
          type="button"
          onClick={onRemove}
          label={`Remove ${label.toLowerCase()} block`}
          className={`${iconButtonStyles} hover:border-[color:var(--danger-soft)] hover:text-[color:var(--danger)]`}
        >
          <TrashIcon className="h-4 w-4" />
        </IconActionButton>
      </div>
      {children}
    </section>
  );
}

export function EntryEditor({
  entryId = "",
  initialTitle = "",
  initialBlocks,
  protocolOptions,
  entityOptions,
  className,
  formAction,
  onChange,
  submitLabel = "Save new version",
  pendingLabel = "Saving...",
}: EntryEditorProps) {
  const initialEditorBlocks = useMemo(
    () =>
      ensureInlineEntryEditorBlocks(
        initialBlocks?.length ? initialBlocks : createDefaultEntryBlocks(),
      ),
    [initialBlocks],
  );
  const [title, setTitle] = useState(initialTitle);
  const [blocks, setBlocks] = useState<EntryEditorBlock[]>(initialEditorBlocks);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [interactiveReady, setInteractiveReady] = useState(false);
  const [activeTextBlockId, setActiveTextBlockId] = useState<string | null>(
    initialEditorBlocks.find(
      (block): block is EntryTextBlock => block.type === "text",
    )?.id ?? null,
  );
  const textBlockRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const textSelectionsRef = useRef<Record<string, TextSelection>>({});
  const pendingFocusRef = useRef<PendingFocusTarget | null>(null);
  const serializedValue = serializeEntryEditorValue(blocks);
  const activeTextBlock = useMemo(
    () =>
      blocks.find(
        (block): block is EntryTextBlock =>
          block.type === "text" && block.id === activeTextBlockId,
      ) ??
      blocks.find((block): block is EntryTextBlock => block.type === "text") ??
      null,
    [activeTextBlockId, blocks],
  );
  const tableNumberById = useMemo(() => buildOrdinalMap(blocks, "table"), [blocks]);
  const entityNumberById = useMemo(() => buildOrdinalMap(blocks, "entity"), [blocks]);
  const protocolNumberById = useMemo(
    () => buildOrdinalMap(blocks, "protocol"),
    [blocks],
  );
  const insertableBlockCount = useMemo(
    () => getSerializableEntryEditorBlocks(blocks).filter((block) => block.type !== "text").length,
    [blocks],
  );

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setInteractiveReady(true);
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    const pendingFocus = pendingFocusRef.current;

    if (!pendingFocus) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      const textarea = textBlockRefs.current[pendingFocus.blockId];

      if (!textarea) {
        return;
      }

      textarea.focus();
      textarea.setSelectionRange(pendingFocus.position, pendingFocus.position);
      textSelectionsRef.current[pendingFocus.blockId] = {
        start: pendingFocus.position,
        end: pendingFocus.position,
      };
      pendingFocusRef.current = null;
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [blocks]);

  function emitChange(nextBlocks: EntryEditorBlock[]) {
    onChange?.(getSerializableEntryEditorBlocks(nextBlocks));
  }

  function commitBlocks(
    nextBlocks: EntryEditorBlock[],
    focusTarget?: PendingFocusTarget,
  ) {
    const inlineBlocks = ensureInlineEntryEditorBlocks(nextBlocks);
    pendingFocusRef.current = focusTarget ?? null;
    setBlocks(inlineBlocks);
    emitChange(inlineBlocks);
  }

  function updateTextBlock(blockId: string, content: string) {
    const nextBlocks = blocks.map((block) =>
      block.id === blockId && block.type === "text"
        ? {
            ...block,
            content,
          }
        : block,
    );

    setBlocks(nextBlocks);
    emitChange(nextBlocks);
  }

  function updateEmbedBlock(
    blockId: string,
    nextBlock: EntryProtocolBlock | EntryEntityBlock | EntryTableBlock,
  ) {
    commitBlocks(
      blocks.map((block) => (block.id === blockId ? nextBlock : block)),
    );
  }

  function removeEmbedBlock(blockId: string) {
    commitBlocks(blocks.filter((block) => block.id !== blockId));
  }

  function rememberSelection(blockId: string) {
    const textarea = textBlockRefs.current[blockId];

    if (!textarea) {
      return;
    }

    textSelectionsRef.current[blockId] = {
      start: textarea.selectionStart,
      end: textarea.selectionEnd,
    };
  }

  function getSelectionForBlock(block: EntryTextBlock): TextSelection {
    const textarea = textBlockRefs.current[block.id];

    if (textarea) {
      return {
        start: textarea.selectionStart,
        end: textarea.selectionEnd,
      };
    }

    return (
      textSelectionsRef.current[block.id] ?? {
        start: block.content.length,
        end: block.content.length,
      }
    );
  }

  function insertInlineBlock(
    blockFactory: () => EntryProtocolBlock | EntryEntityBlock | EntryTableBlock,
  ) {
    if (!interactiveReady || previewVisible) {
      return;
    }

    const newBlock = blockFactory();

    if (activeTextBlock) {
      const activeIndex = blocks.findIndex((block) => block.id === activeTextBlock.id);
      const selection = getSelectionForBlock(activeTextBlock);
      const insertionPoint = selection.start;
      const before = activeTextBlock.content.slice(0, insertionPoint);
      const after = activeTextBlock.content.slice(insertionPoint);
      const trailingTextBlock = createTextBlock(after);
      const replacement: EntryEditorBlock[] = [];

      if (before.length) {
        replacement.push({
          ...activeTextBlock,
          content: before,
        });
      }

      replacement.push(newBlock, trailingTextBlock);

      commitBlocks(
        [
          ...blocks.slice(0, activeIndex),
          ...replacement,
          ...blocks.slice(activeIndex + 1),
        ],
        {
          blockId: trailingTextBlock.id,
          position: 0,
        },
      );

      return;
    }

    const trailingTextBlock = createTextBlock();
    commitBlocks([...blocks, newBlock, trailingTextBlock], {
      blockId: trailingTextBlock.id,
      position: 0,
    });
  }

  function togglePreview() {
    setPreviewVisible((current) => !current);
  }

  function applyMarkdownCommand(command: MarkdownCommand) {
    if (!activeTextBlock) {
      return;
    }

    const textarea = textBlockRefs.current[activeTextBlock.id];

    if (!textarea) {
      return;
    }

    if (command === "bold") {
      insertAroundSelection(textarea, "**", "**", "bold text");
    } else if (command === "italic") {
      insertAroundSelection(textarea, "*", "*", "italic text");
    } else if (command === "code") {
      insertAroundSelection(textarea, "`", "`", "code");
    } else if (command === "code-block") {
      insertAroundSelection(textarea, "```\n", "\n```", "code block");
    } else if (command === "h1") {
      prefixSelectionLines(textarea, "# ", "Heading");
    } else if (command === "h2") {
      prefixSelectionLines(textarea, "## ", "Subheading");
    } else if (command === "bullet") {
      prefixSelectionLines(textarea, "- ", "List item");
    } else if (command === "numbered") {
      prefixSelectionLines(textarea, "1. ", "List item");
    } else if (command === "quote") {
      prefixSelectionLines(textarea, "> ", "Quoted note");
    } else if (command === "task") {
      prefixSelectionLines(textarea, "- [ ] ", "Action item");
    }

    rememberSelection(activeTextBlock.id);
    updateTextBlock(activeTextBlock.id, textarea.value);
  }

  return (
    <form action={formAction} className={className}>
      <input type="hidden" name="entryId" value={entryId} />
      <input type="hidden" name="blocksJson" value={serializedValue} />

      <div className="space-y-8">
        <section className="border-b border-[color:var(--line)] pb-5">
          <input
            name="title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            aria-label="Entry title"
            className="w-full bg-transparent px-0 py-0 text-5xl font-semibold tracking-[-0.06em] text-[color:var(--text-primary)] outline-none placeholder:text-[color:var(--text-soft)]"
            placeholder="Untitled entry"
          />

          <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-[color:var(--text-soft)]">
            <span>Document canvas</span>
            <span className="text-[color:var(--line-strong)]">/</span>
            <span>{insertableBlockCount} inline embeds</span>
            <span className="ml-auto">
              {previewVisible
                ? "Preview mode"
                : activeTextBlock
                  ? "Insert at cursor"
                  : "Focus a writing region"}
            </span>
          </div>

          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[color:var(--text-soft)]">
                Insert
              </span>
              <IconActionButton
                type="button"
                onClick={() =>
                  insertInlineBlock(() =>
                    createProtocolBlock(protocolOptions[0]?.id ?? ""),
                  )
                }
                label="Insert protocol"
                disabled={!interactiveReady || previewVisible}
              >
                <ProtocolBlockIcon className="h-4 w-4" />
              </IconActionButton>
              <IconActionButton
                type="button"
                onClick={() =>
                  insertInlineBlock(() =>
                    createEntityBlock(entityOptions[0]?.id ?? ""),
                  )
                }
                label="Insert entity"
                disabled={!interactiveReady || previewVisible}
              >
                <EntityBlockIcon className="h-4 w-4" />
              </IconActionButton>
              <IconActionButton
                type="button"
                onClick={() => insertInlineBlock(() => createTableBlock())}
                label="Insert table"
                disabled={!interactiveReady || previewVisible}
              >
                <TableBlockIcon className="h-4 w-4" />
              </IconActionButton>
              <p className="ml-auto max-w-xl text-right text-sm leading-6 text-[color:var(--text-muted)]">
                Tables, linked entities, and reusable protocols now sit inside
                the document flow instead of living in a separate lane below it.
              </p>
            </div>

            <MarkdownToolbar
              onApply={applyMarkdownCommand}
              previewVisible={previewVisible}
              onTogglePreview={togglePreview}
              disabled={previewVisible || !activeTextBlock}
            />
          </div>
        </section>

        <section className="space-y-6">
          {blocks.map((block, index) => {
            if (block.type === "text") {
              const primaryTextBlock = index === 0;
              const ariaLabel = primaryTextBlock
                ? "Entry document body"
                : `Entry document body section ${index + 1}`;

              return previewVisible ? (
                <div
                  key={block.id}
                  className="py-1 text-sm leading-8 text-[color:var(--text-primary)]"
                >
                  {block.content.trim() ? (
                    <MarkdownPreview value={block.content} />
                  ) : (
                    <p className="italic text-[color:var(--text-soft)]">
                      {primaryTextBlock
                        ? "Start writing your experimental rationale, setup, observations, or next steps."
                        : "Continue the entry around this embedded block."}
                    </p>
                  )}
                </div>
              ) : (
                <textarea
                  key={block.id}
                  ref={(node) => {
                    textBlockRefs.current[block.id] = node;
                  }}
                  value={block.content}
                  onChange={(event) => updateTextBlock(block.id, event.target.value)}
                  onFocus={() => {
                    setActiveTextBlockId(block.id);
                    rememberSelection(block.id);
                  }}
                  onClick={() => rememberSelection(block.id)}
                  onKeyUp={() => rememberSelection(block.id)}
                  onSelect={() => rememberSelection(block.id)}
                  rows={Math.max(primaryTextBlock ? 10 : 4, lineCount(block.content) + 1)}
                  aria-label={ariaLabel}
                  spellCheck={false}
                  className="block w-full resize-none border-0 bg-transparent px-0 py-1 text-sm leading-8 text-[color:var(--text-primary)] outline-none placeholder:text-[color:var(--text-soft)]"
                  placeholder={
                    primaryTextBlock
                      ? "Start writing your experimental rationale, setup, observations, or next steps."
                      : "Continue the entry here."
                  }
                />
              );
            }

            if (block.type === "table") {
              return (
                <TableBlockEditor
                  key={block.id}
                  block={block}
                  tableNumber={tableNumberById.get(block.id) ?? 1}
                  onRemove={() => removeEmbedBlock(block.id)}
                  onChange={(nextBlock) => updateEmbedBlock(block.id, nextBlock)}
                />
              );
            }

            if (block.type === "entity") {
              return (
                <EmbedBlockShell
                  key={block.id}
                  block={block}
                  onRemove={() => removeEmbedBlock(block.id)}
                >
                  <EntityBlockEditor
                    block={block}
                    entityNumber={entityNumberById.get(block.id) ?? 1}
                    entityOptions={entityOptions}
                    onChange={(nextBlock) => updateEmbedBlock(block.id, nextBlock)}
                  />
                </EmbedBlockShell>
              );
            }

            return (
              <EmbedBlockShell
                key={block.id}
                block={block}
                onRemove={() => removeEmbedBlock(block.id)}
              >
                <ProtocolBlockEditor
                  block={block}
                  protocolNumber={protocolNumberById.get(block.id) ?? 1}
                  protocolOptions={protocolOptions}
                  onChange={(nextBlock) => updateEmbedBlock(block.id, nextBlock)}
                />
              </EmbedBlockShell>
            );
          })}
        </section>

        <div className="border-t border-[color:var(--line)] pt-5">
          <SubmitButton
            idleLabel={submitLabel}
            pendingLabel={pendingLabel}
            className={primaryButtonStyles}
          />
        </div>
      </div>
    </form>
  );
}
