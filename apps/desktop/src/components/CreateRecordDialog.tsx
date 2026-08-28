import { useEffect, useRef, useState } from "react";
import { Icon, type IconName } from "@/components/Icon";
import type { RecordType } from "@/types";

const choices: Array<{
  id: RecordType;
  title: string;
  description: string;
  icon: IconName;
}> = [
  {
    id: "experiment",
    title: "Experiment",
    description: "Plan, execute, and record results in one living document.",
    icon: "experiment",
  },
  {
    id: "note",
    title: "Note",
    description: "A flexible Zettelkasten note connected with wikilinks.",
    icon: "document",
  },
  {
    id: "protocol",
    title: "Protocol",
    description: "A reusable, versioned laboratory procedure.",
    icon: "protocol",
  },
  {
    id: "project",
    title: "Project",
    description: "A hub for related experiments, tasks, and decisions.",
    icon: "folder",
  },
  {
    id: "entity",
    title: "Entity",
    description: "A biological sample, construct, reagent, or cell line.",
    icon: "dna",
  },
  {
    id: "analysis",
    title: "Analysis",
    description: "A reproducible dataset, statistical model, and figures.",
    icon: "analysis",
  },
];

interface CreateRecordDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (type: RecordType, title: string) => Promise<void>;
}

export function CreateRecordDialog({
  open,
  onClose,
  onCreate,
}: CreateRecordDialogProps) {
  const [type, setType] = useState<RecordType>("experiment");
  const [title, setTitle] = useState("");
  const [working, setWorking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) window.setTimeout(() => inputRef.current?.focus(), 30);
    else {
      setTitle("");
      setWorking(false);
    }
  }, [open]);

  if (!open) return null;

  async function submit() {
    if (!title.trim()) return;
    setWorking(true);
    try {
      await onCreate(type, title.trim());
      onClose();
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section
        className="create-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <p className="eyebrow">NEW IN YOUR VAULT</p>
            <h2 id="create-title">Create a record</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </header>
        <div className="record-choice-grid">
          {choices.map((choice) => (
            <button
              key={choice.id}
              className={type === choice.id ? "is-selected" : ""}
              onClick={() => setType(choice.id)}
            >
              <span>
                <Icon name={choice.icon} />
              </span>
              <strong>{choice.title}</strong>
              <small>{choice.description}</small>
              {type === choice.id ? (
                <span className="choice-check">
                  <Icon name="check" size={12} />
                </span>
              ) : null}
            </button>
          ))}
        </div>
        <label className="create-title-field">
          <span>Title</span>
          <input
            ref={inputRef}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void submit();
              if (event.key === "Escape") onClose();
            }}
            placeholder={`Untitled ${type}`}
          />
          <small>
            Saved as <strong>{title.trim() || `Untitled ${type}`}.md</strong>
          </small>
        </label>
        <footer>
          <button className="button button-quiet" onClick={onClose}>
            Cancel
          </button>
          <button
            className="button button-primary"
            disabled={!title.trim() || working}
            onClick={() => void submit()}
          >
            <Icon name="add" size={16} />
            {working ? "Creating…" : `Create ${type}`}
          </button>
        </footer>
      </section>
    </div>
  );
}
