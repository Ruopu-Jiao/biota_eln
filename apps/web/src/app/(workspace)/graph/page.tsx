export default function GraphPage() {
  return (
    <section className="space-y-8">
      <div className="border-b border-[color:var(--line)] pb-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[color:var(--accent-strong)]">
          Graph
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[color:var(--text-primary)]">
          Relation map
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-[color:var(--text-muted)]">
          This view will eventually visualize entries, entities, and protocol
          relationships as a scoped project graph.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(280px,0.7fr)]">
        <div className="min-h-[360px] border border-dashed border-[color:var(--line)] bg-[radial-gradient(circle_at_center,_var(--accent-muted),_transparent_55%)] px-6 py-6">
          <div className="flex h-full items-center justify-center border border-[color:var(--line)] bg-[color:var(--surface-muted)] text-sm text-[color:var(--text-muted)]">
            Graph canvas placeholder
          </div>
        </div>

        <div className="space-y-4">
          {["Entries", "Entities", "Protocols", "Filters"].map((item) => (
            <div
              key={item}
              className="border border-[color:var(--line)] bg-[color:var(--surface-muted)] px-4 py-4"
            >
              <p className="text-sm font-medium text-[color:var(--text-primary)]">
                {item}
              </p>
              <p className="mt-2 text-sm leading-7 text-[color:var(--text-muted)]">
                Placeholder graph controls and legend.
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
