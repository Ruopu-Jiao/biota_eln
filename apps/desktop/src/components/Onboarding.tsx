import { useState } from "react";
import { Icon } from "@/components/Icon";
import type { VaultInfo } from "@/types";

interface OnboardingProps {
  onOpen: () => Promise<VaultInfo | null>;
  onCreate: () => Promise<VaultInfo | null>;
  onReady: (vault: VaultInfo) => void;
}

export function Onboarding({ onOpen, onCreate, onReady }: OnboardingProps) {
  const [working, setWorking] = useState<"open" | "create" | null>(null);
  const [error, setError] = useState("");

  async function run(kind: "open" | "create") {
    setWorking(kind);
    setError("");
    try {
      const vault = await (kind === "open" ? onOpen() : onCreate());
      if (vault) onReady(vault);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The vault could not be opened."
      );
    } finally {
      setWorking(null);
    }
  }

  return (
    <main className="onboarding">
      <div className="traffic-lights" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <section className="onboarding-card">
        <div className="onboarding-brandmark">
          <span className="brandmark-orbit orbit-one" />
          <span className="brandmark-orbit orbit-two" />
          <span className="brandmark-core" />
        </div>
        <p className="eyebrow">LOCAL SCIENTIFIC WORKSPACE</p>
        <h1>Welcome to Biota</h1>
        <p className="onboarding-lede">
          Your experiments, notes, sequences, and analyses—connected in one
          private, local workspace.
        </p>
        <div className="onboarding-actions">
          <button
            className="button button-primary"
            onClick={() => void run("create")}
          >
            <Icon name="folder" size={17} />
            {working === "create" ? "Creating…" : "Create a new vault"}
          </button>
          <button
            className="button button-secondary"
            onClick={() => void run("open")}
          >
            <Icon name="archive" size={17} />
            {working === "open" ? "Opening…" : "Open an existing vault"}
          </button>
        </div>
        {error ? (
          <p className="inline-error">
            <Icon name="warning" size={15} /> {error}
          </p>
        ) : null}
        <p className="onboarding-footnote">
          Biota stores ordinary Markdown, GenBank, and CSV files. Nothing leaves
          your Mac.
        </p>
      </section>
      <div className="onboarding-decoration decoration-a" />
      <div className="onboarding-decoration decoration-b" />
    </main>
  );
}
