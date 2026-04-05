import { DnaViewer } from "@/components/entities/dna-viewer";

export default function EntitiesPage() {
  return (
    <section className="space-y-6">
      <header className="border-b border-[color:var(--line)] pb-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[color:var(--accent-strong)]">
          Entities
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[color:var(--text-primary)]">
          DNA viewer foundation
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-[color:var(--text-muted)]">
          This workspace now centers on a SnapGene-style construct viewer with map and sequence panes,
          annotation overlays, topology controls, primer and search entry points, and direct seams for
          alignments, history, Sanger traces, cloning lineage, and PCR workflows.
        </p>
      </header>

      <DnaViewer />
    </section>
  );
}
