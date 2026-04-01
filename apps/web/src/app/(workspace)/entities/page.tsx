const entities = ["Plasmids", "gDNA", "sgRNAs", "Primers"];

export default function EntitiesPage() {
  return (
    <section className="space-y-8">
      <div className="border-b border-[color:var(--line)] pb-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[color:var(--accent-strong)]">
          Entities
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[color:var(--text-primary)]">
          Biological entity registry
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-[color:var(--text-muted)]">
          Typed scientific objects will live here, including sequence-backed
          records and reusable materials linked into notebook pages.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {entities.map((entity) => (
          <div
            key={entity}
            className="border border-[color:var(--line)] bg-[color:var(--surface-muted)] px-4 py-4"
          >
            <p className="text-sm font-medium text-[color:var(--text-primary)]">
              {entity}
            </p>
            <p className="mt-2 text-sm leading-7 text-[color:var(--text-muted)]">
              Placeholder entity table and detail view.
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
