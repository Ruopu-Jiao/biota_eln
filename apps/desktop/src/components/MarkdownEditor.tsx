import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import {
  defaultHighlightStyle,
  syntaxHighlighting,
} from "@codemirror/language";
import {
  Annotation,
  Compartment,
  EditorState,
  Transaction,
} from "@codemirror/state";
import { EditorView, keymap, placeholder } from "@codemirror/view";
import {
  findFrontmatterRange,
  liveMarkdownPreview,
} from "@/lib/markdown-live-preview";

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  ariaLabel?: string;
  presentation?: "source" | "live";
  onOpenWikilink?: (target: string) => void;
  recordPath?: string;
}

export interface MarkdownEditorHandle {
  focus: () => void;
  insertText: (text: string) => void;
}

const externalValueUpdate = Annotation.define<boolean>();

export const MarkdownEditor = forwardRef<
  MarkdownEditorHandle,
  MarkdownEditorProps
>(function MarkdownEditor(
  {
    value,
    onChange,
    readOnly = false,
    ariaLabel = "Markdown editor",
    presentation = "source",
    onOpenWikilink,
    recordPath,
  },
  ref
) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const onOpenWikilinkRef = useRef(onOpenWikilink);
  const readOnlyCompartmentRef = useRef(new Compartment());
  const presentationCompartmentRef = useRef(new Compartment());
  onChangeRef.current = onChange;
  onOpenWikilinkRef.current = onOpenWikilink;

  useImperativeHandle(
    ref,
    () => ({
      focus() {
        viewRef.current?.focus();
      },
      insertText(text: string) {
        const view = viewRef.current;
        if (!view || view.state.readOnly) return;
        const selection = view.state.selection.main;
        const before = view.state.sliceDoc(0, selection.from);
        const after = view.state.sliceDoc(selection.to);
        const leadingBreak = before && !before.endsWith("\n") ? "\n\n" : "";
        const trailingBreak = after && !after.startsWith("\n") ? "\n\n" : "";
        const insert = `${leadingBreak}${text}${trailingBreak}`;
        const anchor = selection.from + leadingBreak.length + text.length;
        view.dispatch({
          changes: {
            from: selection.from,
            to: selection.to,
            insert,
          },
          selection: { anchor },
          scrollIntoView: true,
          annotations: Transaction.userEvent.of("input"),
        });
        view.focus();
      },
    }),
    []
  );

  useEffect(() => {
    if (!hostRef.current) return;

    const lineSeparator = value.includes("\r\n") ? "\r\n" : "\n";
    const normalizedValue =
      lineSeparator === "\r\n" ? value.replace(/\r\n/g, "\n") : value;
    const frontmatter = findFrontmatterRange(normalizedValue);
    const state = EditorState.create({
      doc: value,
      selection:
        presentation === "live" && frontmatter
          ? { anchor: frontmatter.to }
          : undefined,
      extensions: [
        history(),
        EditorState.lineSeparator.of(lineSeparator),
        markdown({ base: markdownLanguage }),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap]),
        readOnlyCompartmentRef.current.of(EditorState.readOnly.of(readOnly)),
        presentationCompartmentRef.current.of(
          presentation === "live"
            ? liveMarkdownPreview({
                onOpenWikilink: (target) => onOpenWikilinkRef.current?.(target),
                recordPath,
              })
            : []
        ),
        EditorView.lineWrapping,
        EditorView.contentAttributes.of({
          "aria-label": ariaLabel,
          spellcheck: "true",
        }),
        placeholder("Start writing…"),
        EditorView.updateListener.of((update) => {
          if (
            update.docChanged &&
            !update.transactions.some((transaction) =>
              transaction.annotation(externalValueUpdate)
            )
          ) {
            onChangeRef.current(update.state.sliceDoc());
          }
        }),
        EditorView.theme({
          "&": {
            height: "100%",
            background: "transparent",
            color: "var(--ink)",
            fontSize: "15px",
          },
          ".cm-scroller": {
            overflow: "auto",
            fontFamily: "var(--font-mono)",
            lineHeight: "1.68",
            padding: "38px max(38px, calc((100% - 760px) / 2)) 100px",
          },
          ".cm-content": {
            caretColor: "var(--accent)",
            maxWidth: "900px",
            minHeight: "100%",
          },
          ".cm-line": { padding: "0" },
          ".cm-gutters": {
            display: "none",
          },
          ".cm-cursor": {
            borderLeftColor: "var(--accent)",
            borderLeftWidth: "1.5px",
          },
          ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
            background: "color-mix(in srgb, var(--accent) 18%, transparent)",
          },
          "&.cm-focused": { outline: "none" },
          ".cm-activeLine": { background: "transparent" },
          ".ͼb": { color: "var(--accent-deep)" },
          ".ͼc": { color: "var(--plum)" },
          ".ͼd": { color: "var(--moss)" },
          ".ͼe": { color: "var(--rust)" },
        }),
      ],
    });

    const view = new EditorView({ state, parent: hostRef.current });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // The editor is intentionally constructed once. External value updates are
    // synchronized by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.sliceDoc();
    if (current === value) return;
    view.dispatch({
      changes: { from: 0, to: current.length, insert: value },
      annotations: [
        externalValueUpdate.of(true),
        Transaction.addToHistory.of(false),
      ],
    });
  }, [value]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: readOnlyCompartmentRef.current.reconfigure(
        EditorState.readOnly.of(readOnly)
      ),
    });
  }, [readOnly]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const frontmatter =
      presentation === "live"
        ? findFrontmatterRange(view.state.sliceDoc())
        : undefined;
    const head = view.state.selection.main.head;
    view.dispatch({
      effects: presentationCompartmentRef.current.reconfigure(
        presentation === "live"
          ? liveMarkdownPreview({
              onOpenWikilink: (target) => onOpenWikilinkRef.current?.(target),
              recordPath,
            })
          : []
      ),
      selection:
        frontmatter && head >= frontmatter.from && head < frontmatter.to
          ? { anchor: frontmatter.to }
          : undefined,
    });
  }, [presentation, recordPath]);

  return (
    <div
      className={`markdown-editor presentation-${presentation}`}
      ref={hostRef}
    />
  );
});
