import { Fragment, type ReactNode } from "react";

type MarkdownPreviewProps = {
  value: string;
};

const inlinePattern =
  /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|~~[^~]+~~|\[[^\]]+\]\([^)]+\))/g;

function renderInlineContent(text: string, keyPrefix: string) {
  return text.split(inlinePattern).map((part, index) => {
    const key = `${keyPrefix}-${index}`;

    if (!part) {
      return null;
    }

    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={key}
          className="mx-0.5 bg-[color:var(--surface-muted)] px-1.5 py-0.5 font-mono text-[0.92em] text-[color:var(--text-primary)]"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={key}>{part.slice(2, -2)}</strong>;
    }

    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={key}>{part.slice(1, -1)}</em>;
    }

    if (part.startsWith("~~") && part.endsWith("~~")) {
      return (
        <span key={key} className="line-through opacity-80">
          {part.slice(2, -2)}
        </span>
      );
    }

    if (part.startsWith("[") && part.includes("](") && part.endsWith(")")) {
      const [, label = part, href = "#"] =
        part.match(/^\[([^\]]+)\]\(([^)]+)\)$/) ?? [];

      return (
        <a
          key={key}
          href={href}
          className="text-[color:var(--accent-strong)] underline decoration-[color:var(--line-strong)] underline-offset-4 transition hover:decoration-[color:var(--accent-strong)]"
          target="_blank"
          rel="noreferrer"
        >
          {label}
        </a>
      );
    }

    return <Fragment key={key}>{part}</Fragment>;
  });
}

export function MarkdownPreview({ value }: MarkdownPreviewProps) {
  if (!value.trim()) {
    return (
      <div className="border border-dashed border-[color:var(--line)] px-4 py-5 text-sm text-[color:var(--text-soft)]">
        Preview will appear here as you write.
      </div>
    );
  }

  const lines = value.replace(/\r\n/g, "\n").split("\n");
  const nodes: ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? "";

    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (line.startsWith("```")) {
      const language = line.slice(3).trim();
      const blockLines: string[] = [];
      index += 1;

      while (index < lines.length && !(lines[index] ?? "").startsWith("```")) {
        blockLines.push(lines[index] ?? "");
        index += 1;
      }

      index += 1;
      nodes.push(
        <pre
          key={`code-${nodes.length}`}
          className="overflow-x-auto border border-[color:var(--line)] bg-[color:var(--surface-muted)] px-4 py-4 font-mono text-sm leading-7 text-[color:var(--text-primary)]"
        >
          {language ? (
            <div className="mb-2 text-[11px] uppercase tracking-[0.22em] text-[color:var(--text-soft)]">
              {language}
            </div>
          ) : null}
          <code>{blockLines.join("\n")}</code>
        </pre>,
      );
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);

    if (headingMatch) {
      const level = headingMatch[1]?.length ?? 1;
      const text = headingMatch[2] ?? "";
      const headingClass =
        level === 1
          ? "text-3xl font-semibold tracking-[-0.05em]"
          : level === 2
            ? "text-2xl font-semibold tracking-[-0.04em]"
            : level === 3
              ? "text-xl font-semibold tracking-[-0.03em]"
              : "text-base font-semibold uppercase tracking-[0.14em] text-[color:var(--text-muted)]";

      nodes.push(
        <div key={`heading-${nodes.length}`} className={headingClass}>
          {renderInlineContent(text, `heading-${nodes.length}`)}
        </div>,
      );
      index += 1;
      continue;
    }

    if (line.startsWith(">")) {
      const quoteLines: string[] = [];

      while (index < lines.length && (lines[index] ?? "").startsWith(">")) {
        quoteLines.push((lines[index] ?? "").replace(/^>\s?/, ""));
        index += 1;
      }

      nodes.push(
        <blockquote
          key={`quote-${nodes.length}`}
          className="border-l border-[color:var(--line-strong)] pl-4 text-sm italic leading-7 text-[color:var(--text-muted)]"
        >
          {quoteLines.map((quoteLine, quoteIndex) => (
            <p key={`quote-line-${quoteIndex}`}>
              {renderInlineContent(quoteLine, `quote-${nodes.length}-${quoteIndex}`)}
            </p>
          ))}
        </blockquote>,
      );
      continue;
    }

    if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];

      while (index < lines.length && /^\d+\.\s/.test(lines[index] ?? "")) {
        items.push((lines[index] ?? "").replace(/^\d+\.\s/, ""));
        index += 1;
      }

      nodes.push(
        <ol
          key={`ordered-${nodes.length}`}
          className="ml-5 list-decimal space-y-1 text-sm leading-7 text-[color:var(--text-primary)]"
        >
          {items.map((item, itemIndex) => (
            <li key={`ordered-item-${itemIndex}`}>
              {renderInlineContent(item, `ordered-${nodes.length}-${itemIndex}`)}
            </li>
          ))}
        </ol>,
      );
      continue;
    }

    if (/^[-*]\s/.test(line)) {
      const items: string[] = [];

      while (index < lines.length && /^[-*]\s/.test(lines[index] ?? "")) {
        items.push((lines[index] ?? "").replace(/^[-*]\s/, ""));
        index += 1;
      }

      nodes.push(
        <ul
          key={`unordered-${nodes.length}`}
          className="ml-5 list-disc space-y-1 text-sm leading-7 text-[color:var(--text-primary)]"
        >
          {items.map((item, itemIndex) => {
            const taskMatch = item.match(/^\[( |x)\]\s+(.*)$/i);

            if (taskMatch) {
              const checked = taskMatch[1]?.toLowerCase() === "x";

              return (
                <li
                  key={`task-item-${itemIndex}`}
                  className="list-none -ml-5 flex items-start gap-2"
                >
                  <span className="mt-1.5 inline-flex h-3.5 w-3.5 items-center justify-center border border-[color:var(--line-strong)] text-[10px] text-[color:var(--accent-strong)]">
                    {checked ? "x" : ""}
                  </span>
                  <span>{renderInlineContent(taskMatch[2] ?? "", `task-${nodes.length}-${itemIndex}`)}</span>
                </li>
              );
            }

            return (
              <li key={`unordered-item-${itemIndex}`}>
                {renderInlineContent(item, `unordered-${nodes.length}-${itemIndex}`)}
              </li>
            );
          })}
        </ul>,
      );
      continue;
    }

    const paragraphLines: string[] = [];

    while (index < lines.length) {
      const nextLine = lines[index] ?? "";

      if (
        !nextLine.trim() ||
        nextLine.startsWith("```") ||
        nextLine.startsWith(">") ||
        /^\d+\.\s/.test(nextLine) ||
        /^[-*]\s/.test(nextLine) ||
        /^(#{1,6})\s+/.test(nextLine)
      ) {
        break;
      }

      paragraphLines.push(nextLine);
      index += 1;
    }

    nodes.push(
      <p
        key={`paragraph-${nodes.length}`}
        className="text-sm leading-8 text-[color:var(--text-primary)]"
      >
        {renderInlineContent(
          paragraphLines.join(" "),
          `paragraph-${nodes.length}`,
        )}
      </p>,
    );
  }

  return <div className="space-y-4">{nodes}</div>;
}
