"use client";

import { useRef, useState } from "react";
import { SubmitButton } from "@/components/notebook/submit-button";
import { MarkdownPreview } from "./markdown-preview";
import type {
  EntryEditorBlock,
  EntryTableBlock,
  ProtocolOption,
} from "./types";
import {
  createDefaultEntryBlocks,
  createProtocolBlock,
  createTableBlock,
  createTextBlock,
  normalizeEntryEditorBlocks,
  serializeEntryEditorValue,
} from "./types";

type EntryEditorProps = {
  entryId?: string;
  initialTitle?: string;
  initialBlocks?: EntryEditorBlock[];
  protocolOptions: ProtocolOption[];
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

function moveBlock<T>(blocks: T[], fromIndex: number, toIndex: number) {
  const nextBlocks = blocks.slice();
  const [block] = nextBlocks.splice(fromIndex, 1);

  if (!block) {
    return blocks;
  }

  nextBlocks.splice(toIndex, 0, block);
  return nextBlocks;
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

function downloadTableCsv(block: EntryTableBlock) {
  const blob = new Blob([tableToCsv(block)], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "entry-table.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function MarkdownToolbar({
  blockId,
  onApply,
  previewVisible,
  onTogglePreview,
}: {
  blockId: string;
  onApply: (blockId: string, command: MarkdownCommand) => void;
  previewVisible: boolean;
  onTogglePreview: (blockId: string) => void;
}) {
  const commands: Array<{ command: MarkdownCommand; label: string }> = [
    { command: "h1", label: "H1" },
    { command: "h2", label: "H2" },
    { command: "bold", label: "Bold" },
    { command: "italic", label: "Italic" },
    { command: "code", label: "Code" },
    { command: "bullet", label: "Bullet" },
    { command: "numbered", label: "Numbered" },
    { command: "quote", label: "Quote" },
    { command: "task", label: "Task" },
    { command: "code-block", label: "Code block" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-[color:var(--line)] pb-3">
      {commands.map(({ command, label }) => (
        <button
          key={command}
          type="button"
          onClick={() => onApply(blockId, command)}
          className="inline-flex items-center border border-[color:var(--line)] px-2.5 py-1.5 text-[11px] uppercase tracking-[0.16em] text-[color:var(--text-muted)] transition hover:border-[color:var(--line-strong)] hover:text-[color:var(--text-primary)]"
        >
          {label}
        </button>
      ))}
      <button
        type="button"
        onClick={() => onTogglePreview(blockId)}
        className="ml-auto inline-flex items-center border border-[color:var(--line)] px-2.5 py-1.5 text-[11px] uppercase tracking-[0.16em] text-[color:var(--accent-strong)] transition hover:border-[color:var(--accent-soft)]"
      >
        {previewVisible ? "Hide preview" : "Show preview"}
      </button>
    </div>
  );
}

function TableBlockEditor({
  block,
  blockIndex,
  onChange,
}: {
  block: EntryTableBlock;
  blockIndex: number;
  onChange: (nextBlock: EntryTableBlock) => void;
}) {
  function updateColumn(columnIndex: number, value: string) {
    const columns = block.columns.slice();
    columns[columnIndex] = value;
    onChange({
      ...block,
      columns,
      rows: block.rows.map((row) =>
        Array.from({ length: columns.length }, (_, index) => row[index] ?? ""),
      ),
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
    const nextColumnNumber = block.columns.length + 1;
    onChange({
      ...block,
      columns: [...block.columns, `Column ${nextColumnNumber}`],
      rows: block.rows.map((row) => [...row, ""]),
    });
  }

  function removeColumn(columnIndex: number) {
    if (block.columns.length <= 1) {
      return;
    }

    onChange({
      ...block,
      columns: block.columns.filter((_, index) => index !== columnIndex),
      rows: block.rows.map((row) =>
        row.filter((_, index) => index !== columnIndex),
      ),
    });
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

    onChange({
      ...block,
      rows: block.rows.filter((_, index) => index !== rowIndex),
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 border-b border-[color:var(--line)] pb-3">
        <button
          type="button"
          onClick={addColumn}
          className="inline-flex items-center border border-[color:var(--line)] px-2.5 py-1.5 text-[11px] uppercase tracking-[0.16em] text-[color:var(--text-muted)] transition hover:border-[color:var(--line-strong)] hover:text-[color:var(--text-primary)]"
        >
          Add column
        </button>
        <button
          type="button"
          onClick={addRow}
          className="inline-flex items-center border border-[color:var(--line)] px-2.5 py-1.5 text-[11px] uppercase tracking-[0.16em] text-[color:var(--text-muted)] transition hover:border-[color:var(--line-strong)] hover:text-[color:var(--text-primary)]"
        >
          Add row
        </button>
        <button
          type="button"
          onClick={() => downloadTableCsv(block)}
          className="ml-auto inline-flex items-center border border-[color:var(--line)] px-2.5 py-1.5 text-[11px] uppercase tracking-[0.16em] text-[color:var(--accent-strong)] transition hover:border-[color:var(--accent-soft)]"
        >
          Export CSV
        </button>
      </div>

      <div className="overflow-x-auto border border-[color:var(--line)]">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="border-b border-[color:var(--line)] bg-[color:var(--surface-muted)]">
              {block.columns.map((column, columnIndex) => (
                <th
                  key={`${block.id}-column-${columnIndex}`}
                  className="min-w-[180px] border-r border-[color:var(--line)] px-3 py-2 text-left align-top last:border-r-0"
                >
                  <div className="space-y-2">
                    <input
                      value={column}
                      onChange={(event) =>
                        updateColumn(columnIndex, event.target.value)
                      }
                      aria-label={`Table ${blockIndex + 1} column ${columnIndex + 1}`}
                      className="w-full border-b border-[color:var(--line)] bg-transparent px-0 py-1 text-sm font-medium text-[color:var(--text-primary)] outline-none focus:border-[color:var(--accent-strong)]"
                    />
                    <button
                      type="button"
                      onClick={() => removeColumn(columnIndex)}
                      disabled={block.columns.length <= 1}
                      className="text-[11px] uppercase tracking-[0.16em] text-[color:var(--text-soft)] transition hover:text-[color:var(--danger)] disabled:opacity-40"
                    >
                      Remove
                    </button>
                  </div>
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
                {row.map((cell, columnIndex) => (
                  <td
                    key={`${block.id}-cell-${rowIndex}-${columnIndex}`}
                    className="border-r border-[color:var(--line)] px-3 py-2 align-top last:border-r-0"
                  >
                    <input
                      value={cell}
                      onChange={(event) =>
                        updateCell(rowIndex, columnIndex, event.target.value)
                      }
                      aria-label={`Table ${blockIndex + 1} row ${rowIndex + 1} column ${columnIndex + 1}`}
                      className="w-full bg-transparent text-sm text-[color:var(--text-primary)] outline-none placeholder:text-[color:var(--text-soft)]"
                      placeholder="Cell value"
                    />
                  </td>
                ))}
                <td className="w-14 px-2 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => removeRow(rowIndex)}
                    disabled={block.rows.length <= 1}
                    className="text-[11px] uppercase tracking-[0.16em] text-[color:var(--text-soft)] transition hover:text-[color:var(--danger)] disabled:opacity-40"
                  >
                    Del
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function EntryEditor({
  entryId = "",
  initialTitle = "",
  initialBlocks,
  protocolOptions,
  className,
  formAction,
  onChange,
  submitLabel = "Save new version",
  pendingLabel = "Saving...",
}: EntryEditorProps) {
  const [title, setTitle] = useState(initialTitle);
  const [blocks, setBlocks] = useState<EntryEditorBlock[]>(
    normalizeEntryEditorBlocks(initialBlocks ?? createDefaultEntryBlocks()),
  );
  const [previewByBlockId, setPreviewByBlockId] = useState<
    Record<string, boolean>
  >({});
  const textareaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const serializedValue = serializeEntryEditorValue(blocks);

  function commit(nextBlocks: EntryEditorBlock[]) {
    const normalized = normalizeEntryEditorBlocks(nextBlocks);
    setBlocks(normalized);
    onChange?.(normalized);
  }

  function addMarkdownBlock() {
    commit([...blocks, createTextBlock()]);
  }

  function addProtocolInsertion() {
    commit([...blocks, createProtocolBlock(protocolOptions[0]?.id ?? "")]);
  }

  function addTableInsertion() {
    commit([...blocks, createTableBlock()]);
  }

  function updateBlock(index: number, nextBlock: EntryEditorBlock) {
    const nextBlocks = blocks.slice();
    nextBlocks[index] = nextBlock;
    commit(nextBlocks);
  }

  function removeBlock(index: number) {
    commit(blocks.filter((_, currentIndex) => currentIndex !== index));
  }

  function moveUp(index: number) {
    if (index <= 0) {
      return;
    }

    commit(moveBlock(blocks, index, index - 1));
  }

  function moveDown(index: number) {
    if (index >= blocks.length - 1) {
      return;
    }

    commit(moveBlock(blocks, index, index + 1));
  }

  function togglePreview(blockId: string) {
    setPreviewByBlockId((current) => ({
      ...current,
      [blockId]: !current[blockId],
    }));
  }

  function applyMarkdownCommand(blockId: string, command: MarkdownCommand) {
    const textarea = textareaRefs.current[blockId];

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

    const nextValue = textarea.value;
    const blockIndex = blocks.findIndex(
      (block) => block.id === blockId && block.type === "text",
    );

    if (blockIndex === -1) {
      return;
    }

    updateBlock(blockIndex, {
      id: blockId,
      type: "text",
      content: nextValue,
    });
  }

  return (
    <form action={formAction} className={className}>
      <input type="hidden" name="entryId" value={entryId} />
      <input type="hidden" name="blocksJson" value={serializedValue} />

      <div className="space-y-8">
        <section className="border-b border-[color:var(--line)] pb-6">
          <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-[color:var(--text-soft)]">
            <span>Document canvas</span>
            <span className="text-[color:var(--line-strong)]">/</span>
            <span>{blocks.length} blocks</span>
          </div>
          <input
            name="title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            aria-label="Entry title"
            className="mt-4 w-full bg-transparent px-0 py-0 text-4xl font-semibold tracking-[-0.05em] text-[color:var(--text-primary)] outline-none placeholder:text-[color:var(--text-soft)]"
            placeholder="Untitled entry"
          />
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[color:var(--text-muted)]">
            Write in markdown, insert reusable protocol blocks, and add tables
            inline so the entry reads like a single notebook page.
          </p>
        </section>

        <section className="flex flex-wrap items-center gap-2 border-b border-[color:var(--line)] pb-4">
          <button
            type="button"
            onClick={addMarkdownBlock}
            className="inline-flex items-center border border-[color:var(--line)] px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-[color:var(--text-muted)] transition hover:border-[color:var(--line-strong)] hover:text-[color:var(--text-primary)]"
          >
            Add markdown
          </button>
          <button
            type="button"
            onClick={addProtocolInsertion}
            className="inline-flex items-center border border-[color:var(--line)] px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-[color:var(--text-muted)] transition hover:border-[color:var(--line-strong)] hover:text-[color:var(--text-primary)]"
          >
            Insert protocol
          </button>
          <button
            type="button"
            onClick={addTableInsertion}
            className="inline-flex items-center border border-[color:var(--line)] px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-[color:var(--text-muted)] transition hover:border-[color:var(--line-strong)] hover:text-[color:var(--text-primary)]"
          >
            Insert table
          </button>
        </section>

        <div className="divide-y divide-[color:var(--line)]">
          {blocks.map((block, index) => {
            const canMoveUp = index > 0;
            const canMoveDown = index < blocks.length - 1;
            const previewVisible =
              block.type === "text" ? Boolean(previewByBlockId[block.id]) : false;

            return (
              <section
                key={block.id}
                className="grid gap-5 py-6 lg:grid-cols-[156px_minmax(0,1fr)_auto]"
              >
                <div className="space-y-2">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--text-soft)]">
                    {block.type === "text"
                      ? "Markdown"
                      : block.type === "table"
                        ? "Table"
                        : "Protocol"}
                  </p>
                  <div className="border-l border-[color:var(--line)] pl-3 text-xs leading-6 text-[color:var(--text-muted)]">
                    {block.type === "text"
                      ? "Narrative notes, observations, and headings."
                      : block.type === "table"
                        ? "Structured measurements and reagent layouts."
                        : "Reusable protocol references from the library."}
                  </div>
                </div>

                <div className="space-y-4">
                  {block.type === "text" ? (
                    <>
                      <MarkdownToolbar
                        blockId={block.id}
                        onApply={applyMarkdownCommand}
                        previewVisible={previewVisible}
                        onTogglePreview={togglePreview}
                      />
                      <textarea
                        ref={(node) => {
                          textareaRefs.current[block.id] = node;
                        }}
                        value={block.content}
                        onChange={(event) =>
                          updateBlock(index, {
                            ...block,
                            content: event.target.value,
                          })
                        }
                      rows={previewVisible ? 10 : 14}
                      aria-label={`Markdown block ${index + 1}`}
                      className="block min-h-[320px] w-full border-t border-[color:var(--line)] bg-transparent px-0 py-4 text-sm leading-8 text-[color:var(--text-primary)] outline-none placeholder:text-[color:var(--text-soft)]"
                      placeholder="Start writing your experimental rationale, setup, observations, or next steps."
                    />
                      {previewVisible ? (
                        <div className="border-t border-[color:var(--line)] pt-4">
                          <p className="mb-3 text-[11px] uppercase tracking-[0.22em] text-[color:var(--text-soft)]">
                            Preview
                          </p>
                          <MarkdownPreview value={block.content} />
                        </div>
                      ) : null}
                    </>
                  ) : null}

                  {block.type === "protocol" ? (
                    <div className="space-y-3">
                      <label className="block space-y-2">
                        <span className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--text-soft)]">
                          Linked protocol
                        </span>
                        <select
                          value={block.protocolId}
                          onChange={(event) =>
                            updateBlock(index, {
                              ...block,
                              protocolId: event.target.value,
                            })
                          }
                          aria-label={`Protocol block ${index + 1}`}
                          className="w-full border-b border-[color:var(--line)] bg-transparent px-0 py-2 text-sm text-[color:var(--text-primary)] outline-none focus:border-[color:var(--accent-strong)]"
                        >
                          <option value="">Select a protocol</option>
                          {protocolOptions.map((protocol) => (
                            <option key={protocol.id} value={protocol.id}>
                              {protocol.title}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="text-sm leading-7 text-[color:var(--text-muted)]">
                        {block.protocolId ? (
                          protocolOptions.find(
                            (protocol) => protocol.id === block.protocolId,
                          )?.summary ?? "Reusable protocol inserted into this entry."
                        ) : (
                          <span className="text-[color:var(--text-soft)]">
                            Select a protocol to insert a reusable method block.
                          </span>
                        )}
                      </div>
                    </div>
                  ) : null}

                  {block.type === "table" ? (
                    <TableBlockEditor
                      block={block}
                      blockIndex={index}
                      onChange={(nextBlock) => updateBlock(index, nextBlock)}
                    />
                  ) : null}
                </div>

                <div className="flex items-start gap-2 lg:justify-end">
                  <button
                    type="button"
                    onClick={() => moveUp(index)}
                    disabled={!canMoveUp}
                    className="inline-flex items-center border border-[color:var(--line)] px-2.5 py-2 text-[11px] uppercase tracking-[0.16em] text-[color:var(--text-muted)] transition hover:border-[color:var(--line-strong)] hover:text-[color:var(--text-primary)] disabled:opacity-40"
                  >
                    Up
                  </button>
                  <button
                    type="button"
                    onClick={() => moveDown(index)}
                    disabled={!canMoveDown}
                    className="inline-flex items-center border border-[color:var(--line)] px-2.5 py-2 text-[11px] uppercase tracking-[0.16em] text-[color:var(--text-muted)] transition hover:border-[color:var(--line-strong)] hover:text-[color:var(--text-primary)] disabled:opacity-40"
                  >
                    Down
                  </button>
                  <button
                    type="button"
                    onClick={() => removeBlock(index)}
                    disabled={blocks.length <= 1}
                    className="inline-flex items-center border border-[color:var(--line)] px-2.5 py-2 text-[11px] uppercase tracking-[0.16em] text-[color:var(--text-muted)] transition hover:border-[color:var(--danger-soft)] hover:text-[color:var(--danger)] disabled:opacity-40"
                  >
                    Remove
                  </button>
                </div>
              </section>
            );
          })}
        </div>

        <div className="border-t border-[color:var(--line)] pt-5">
          <SubmitButton
            idleLabel={submitLabel}
            pendingLabel={pendingLabel}
            className="inline-flex items-center border border-[color:var(--accent-soft)] bg-[color:var(--accent-muted)] px-4 py-3 text-sm font-medium text-[color:var(--text-primary)] transition hover:border-[color:var(--accent-strong)] hover:bg-[color:var(--accent-soft)] disabled:cursor-not-allowed disabled:opacity-60"
          />
        </div>
      </div>
    </form>
  );
}
