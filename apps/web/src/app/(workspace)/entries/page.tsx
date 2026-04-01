const sections = [
  "Entry list",
  "Pinned experiments",
  "Linked protocols",
  "Recent edits",
];

export default function EntriesPage() {
  return (
    <section className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-emerald-200/70">
          Entries
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-white">
          Experiment notebook workspace
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
          This area will evolve into the main structured entry editor, with
          blocks, links, history, and embedded scientific objects.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {sections.map((section) => (
          <div
            key={section}
            className="rounded-2xl border border-white/8 bg-white/5 p-4"
          >
            <p className="text-sm font-medium text-white">{section}</p>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Placeholder workspace panel.
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
