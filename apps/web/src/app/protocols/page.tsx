const protocols = [
  "Cell transformation",
  "PCR setup",
  "Plasmid miniprep",
  "Oligo annealing",
];

export default function ProtocolsPage() {
  return (
    <section className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-emerald-200/70">
          Protocols
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-white">
          Reusable protocol library
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
          Modular protocol blocks and versioned procedures will be managed from
          this space.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {protocols.map((protocol) => (
          <div
            key={protocol}
            className="rounded-2xl border border-white/8 bg-white/5 p-4"
          >
            <p className="text-sm font-medium text-white">{protocol}</p>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Placeholder protocol card.
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
