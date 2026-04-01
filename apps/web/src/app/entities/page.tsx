const entities = ["Plasmids", "gDNA", "sgRNAs", "Primers"];

export default function EntitiesPage() {
  return (
    <section className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-emerald-200/70">
          Entities
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-white">
          Biological entity registry
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
          Typed scientific objects will live here, including sequence-backed
          records and reusable materials.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {entities.map((entity) => (
          <div
            key={entity}
            className="rounded-2xl border border-white/8 bg-white/5 p-4"
          >
            <p className="text-sm font-medium text-white">{entity}</p>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Placeholder entity table and detail view.
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
