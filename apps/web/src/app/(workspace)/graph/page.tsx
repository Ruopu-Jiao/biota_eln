export default function GraphPage() {
  return (
    <section className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-emerald-200/70">
          Graph
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-white">Relation map</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
          This view will eventually visualize entries, entities, and protocol
          relationships as a scoped project graph.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(280px,0.7fr)]">
        <div className="min-h-[360px] rounded-[28px] border border-dashed border-white/10 bg-[radial-gradient(circle_at_center,_rgba(16,185,129,0.12),_transparent_55%),linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.015))] p-6">
          <div className="flex h-full items-center justify-center rounded-[24px] border border-white/8 bg-slate-950/60 text-sm text-slate-400">
            Graph canvas placeholder
          </div>
        </div>

        <div className="space-y-4">
          {["Entries", "Entities", "Protocols", "Filters"].map((item) => (
            <div
              key={item}
              className="rounded-2xl border border-white/8 bg-white/5 p-4"
            >
              <p className="text-sm font-medium text-white">{item}</p>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Placeholder graph controls and legend.
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
