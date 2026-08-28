import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import type { SearchHit } from "@/types";

interface CommandPaletteProps {
  open: boolean;
  results: SearchHit[];
  onQuery: (query: string) => void;
  onClose: () => void;
  onOpenRecord: (path: string) => void;
  onCreate: () => void;
}

export function CommandPalette({
  open,
  results,
  onQuery,
  onClose,
  onOpenRecord,
  onCreate,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const commands = useMemo(
    () =>
      query
        ? []
        : [
            {
              id: "new",
              title: "Create a new record",
              subtitle: "Experiment, note, protocol, project, or analysis",
              icon: "add" as const,
              action: onCreate,
            },
          ],
    [onCreate, query]
  );

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    window.setTimeout(() => inputRef.current?.focus(), 20);
  }, [open]);

  useEffect(() => {
    onQuery(query);
  }, [onQuery, query]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section
        className="command-palette"
        role="dialog"
        aria-modal="true"
        aria-label="Quick switcher"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="command-input">
          <Icon name="search" size={19} />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") onClose();
              if (event.key === "Enter" && results[0]) {
                onOpenRecord(results[0].path);
                onClose();
              }
            }}
            placeholder="Search notes, commands, sequences…"
          />
          <kbd>esc</kbd>
        </div>
        <div className="command-results">
          <p className="command-group-label">{query ? "Vault" : "Suggested"}</p>
          {commands.map((command) => (
            <button
              key={command.id}
              onClick={() => {
                command.action();
                onClose();
              }}
            >
              <span className="command-result-icon">
                <Icon name={command.icon} />
              </span>
              <span>
                <strong>{command.title}</strong>
                <small>{command.subtitle}</small>
              </span>
            </button>
          ))}
          {results.map((hit) => (
            <button
              key={hit.id}
              onClick={() => {
                onOpenRecord(hit.path);
                onClose();
              }}
            >
              <span className="command-result-icon">
                <Icon
                  name={
                    hit.recordType === "experiment"
                      ? "experiment"
                      : hit.recordType === "protocol"
                        ? "protocol"
                        : "document"
                  }
                />
              </span>
              <span>
                <strong>{hit.title}</strong>
                <small>{hit.path}</small>
              </span>
              <span className="command-record-type">{hit.recordType}</span>
            </button>
          ))}
          {query && !results.length ? (
            <div className="command-empty">
              <Icon name="search" size={24} />
              <strong>No results</strong>
              <span>Try a title, tag, or phrase from the note.</span>
            </div>
          ) : null}
        </div>
        <footer className="command-footer">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> Navigate
          </span>
          <span>
            <kbd>↵</kbd> Open
          </span>
          <span>Indexed locally</span>
        </footer>
      </section>
    </div>
  );
}
