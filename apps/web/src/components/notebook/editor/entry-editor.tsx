"use client";

import { useState } from "react";
import { SubmitButton } from "@/components/notebook/submit-button";
import type {
  EntryEditorBlock,
  ProtocolOption,
} from "./types";
import {
  createDefaultEntryBlocks,
  createProtocolBlock,
  createTextBlock,
  normalizeEntryEditorBlocks,
  serializeEntryEditorValue,
} from "./types";

type EntryEditorProps = {
  entryId?: string;
  initialTitle?: string;
  initialSummary?: string;
  initialBlocks?: EntryEditorBlock[];
  protocolOptions: ProtocolOption[];
  className?: string;
  formAction?: (formData: FormData) => void | Promise<void>;
  onChange?: (blocks: EntryEditorBlock[]) => void;
  submitLabel?: string;
  pendingLabel?: string;
};

function moveBlock<T>(blocks: T[], fromIndex: number, toIndex: number) {
  const nextBlocks = blocks.slice();
  const [block] = nextBlocks.splice(fromIndex, 1);

  if (!block) {
    return blocks;
  }

  nextBlocks.splice(toIndex, 0, block);
  return nextBlocks;
}

export function EntryEditor({
  entryId = "",
  initialTitle = "",
  initialSummary = "",
  initialBlocks,
  protocolOptions,
  className,
  formAction,
  onChange,
  submitLabel = "Save new version",
  pendingLabel = "Saving...",
}: EntryEditorProps) {
  const [title, setTitle] = useState(initialTitle);
  const [summary, setSummary] = useState(initialSummary);
  const [blocks, setBlocks] = useState<EntryEditorBlock[]>(
    normalizeEntryEditorBlocks(initialBlocks ?? createDefaultEntryBlocks()),
  );

  const serializedValue = serializeEntryEditorValue(blocks);

  function commit(nextBlocks: EntryEditorBlock[]) {
    const normalized = normalizeEntryEditorBlocks(nextBlocks);
    setBlocks(normalized);
    onChange?.(normalized);
  }

  function addTextBlock() {
    commit([...blocks, createTextBlock()]);
  }

  function addProtocolBlock() {
    commit([...blocks, createProtocolBlock(protocolOptions[0]?.id ?? "")]);
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

  return (
    <form action={formAction} className={className}>
      <input type="hidden" name="entryId" value={entryId} />
      <input type="hidden" name="blocksJson" value={serializedValue} />

      <div className="flex flex-wrap items-center gap-3 border-b border-white/10 pb-4">
        <button
          type="button"
          onClick={addTextBlock}
          className="border border-white/12 px-3 py-2 text-xs uppercase tracking-[0.22em] text-slate-200 transition hover:border-emerald-300/30 hover:text-white"
        >
          Add text block
        </button>
        <button
          type="button"
          onClick={addProtocolBlock}
          className="border border-white/12 px-3 py-2 text-xs uppercase tracking-[0.22em] text-slate-200 transition hover:border-emerald-300/30 hover:text-white"
        >
          Add protocol block
        </button>
        <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
          Blocks are saved as JSON on submit.
        </p>
      </div>

      <div className="space-y-6">
        <section className="grid gap-4 border-b border-white/10 py-5 lg:grid-cols-[160px_minmax(0,1fr)]">
          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-[0.26em] text-slate-500">
              Entry title
            </p>
            <div className="border-l border-white/10 pl-3 text-xs text-slate-400">
              A single line title that identifies the experiment note.
            </div>
          </div>
          <input
            name="title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            aria-label="Entry title"
            className="w-full border-b border-white/12 bg-transparent px-0 py-2 text-sm font-medium text-white outline-none placeholder:text-slate-600 focus:border-emerald-300/40"
            placeholder="Entry title"
          />
        </section>

        <section className="grid gap-4 border-b border-white/10 py-5 lg:grid-cols-[160px_minmax(0,1fr)]">
          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-[0.26em] text-slate-500">
              Summary
            </p>
            <div className="border-l border-white/10 pl-3 text-xs text-slate-400">
              One or two lines for the gist of the entry.
            </div>
          </div>
          <textarea
            name="summary"
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            rows={3}
            aria-label="Entry summary"
            className="w-full border border-white/10 bg-slate-950/25 px-3 py-3 text-sm leading-6 text-slate-100 outline-none placeholder:text-slate-600 focus:border-emerald-300/30"
            placeholder="Summary"
          />
        </section>

        <div className="divide-y divide-white/10">
          {blocks.map((block, index) => {
            const canMoveUp = index > 0;
            const canMoveDown = index < blocks.length - 1;

            return (
              <section
                key={block.id}
                className="grid gap-4 py-5 md:grid-cols-[140px_minmax(0,1fr)_auto]"
              >
                <div className="space-y-2">
                  <p className="text-[11px] uppercase tracking-[0.26em] text-slate-500">
                    {block.type}
                  </p>
                  <div className="border-l border-white/10 pl-3 text-xs text-slate-400">
                    <p>
                      {block.type === "text"
                        ? "Structured notebook prose"
                        : "Reusable protocol insertion"}
                    </p>
                  </div>
                </div>

                {block.type === "text" ? (
                  <div className="space-y-3">
                    <textarea
                      value={block.content}
                      onChange={(event) =>
                        updateBlock(index, {
                          ...block,
                          content: event.target.value,
                        })
                      }
                      rows={7}
                      aria-label={`Text block ${index + 1}`}
                      className="w-full border border-white/10 bg-slate-950/25 px-3 py-3 text-sm leading-6 text-slate-100 outline-none placeholder:text-slate-600 focus:border-emerald-300/30"
                      placeholder="Write the experiment note, observations, or method step here."
                    />
                  </div>
                ) : (
                  <div className="space-y-3">
                    <label className="block space-y-2">
                      <span className="text-xs uppercase tracking-[0.22em] text-slate-500">
                        Protocol
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
                        className="w-full border border-white/10 bg-slate-950/25 px-3 py-3 text-sm text-slate-100 outline-none focus:border-emerald-300/30"
                      >
                        <option value="">Select a protocol</option>
                        {protocolOptions.map((protocol) => (
                          <option key={protocol.id} value={protocol.id}>
                            {protocol.title}
                          </option>
                        ))}
                      </select>
                    </label>
                    {block.protocolId ? (
                      <p className="text-xs uppercase tracking-[0.22em] text-emerald-200/80">
                        {protocolOptions.find(
                          (protocol) => protocol.id === block.protocolId,
                        )?.summary ?? "Inserted protocol"}
                      </p>
                    ) : (
                      <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
                        No protocol selected
                      </p>
                    )}
                  </div>
                )}

                <div className="flex items-start gap-2 md:justify-end">
                  <button
                    type="button"
                    onClick={() => moveUp(index)}
                    disabled={!canMoveUp}
                    className="border border-white/10 px-2 py-2 text-[11px] uppercase tracking-[0.2em] text-slate-300 transition hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Up
                  </button>
                  <button
                    type="button"
                    onClick={() => moveDown(index)}
                    disabled={!canMoveDown}
                    className="border border-white/10 px-2 py-2 text-[11px] uppercase tracking-[0.2em] text-slate-300 transition hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Down
                  </button>
                  <button
                    type="button"
                    onClick={() => removeBlock(index)}
                    disabled={blocks.length <= 1}
                    className="border border-white/10 px-2 py-2 text-[11px] uppercase tracking-[0.2em] text-slate-300 transition hover:border-rose-300/30 hover:text-rose-100 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Remove
                  </button>
                </div>
              </section>
            );
          })}
        </div>

        <div className="border-t border-white/10 pt-5">
          <SubmitButton
            idleLabel={submitLabel}
            pendingLabel={pendingLabel}
            className="border border-emerald-300/30 px-4 py-3 text-sm font-medium text-emerald-50 transition hover:bg-emerald-400/10 disabled:cursor-not-allowed disabled:opacity-60"
          />
        </div>
      </div>
    </form>
  );
}
