import Link from "next/link";

const workspaceCards = [
  {
    title: "Recent entries",
    body: "Draft experiment records, revisions, and linked scientific context now live in the notebook surface.",
    action: "Open entries",
    href: "/entries",
  },
  {
    title: "Typed entities",
    body: "Track plasmids, sgRNAs, primers, and sequence-backed records in one place.",
    action: "Browse entities",
    href: "/entities",
  },
  {
    title: "Protocols",
    body: "Reusable procedure records now have a real library surface and versioned draft model.",
    action: "View protocols",
    href: "/protocols",
  },
];

export default function Home() {
  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1.55fr)_minmax(280px,0.75fr)]">
      <section className="space-y-8">
        <div className="border-b border-white/10 pb-6">
          <p className="text-[11px] uppercase tracking-[0.32em] text-emerald-200/70">
            Workspace overview
          </p>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-white">
                Biota ELN
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                The notebook shell is now moving beyond scaffolding: entries and
                protocols have persisted draft models, detail pages, and a
                flatter workspace structure.
              </p>
            </div>
            <div className="text-xs uppercase tracking-[0.24em] text-emerald-200/80">
              Private workspace
            </div>
          </div>
        </div>

        <div className="border-y border-white/10">
          {workspaceCards.map((card) => (
            <article
              key={card.title}
              className="grid gap-4 border-b border-white/8 px-0 py-5 last:border-b-0 md:grid-cols-[minmax(0,1fr)_auto]"
            >
              <div>
                <h2 className="text-base font-medium text-white">{card.title}</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                  {card.body}
                </p>
              </div>
              <div className="flex items-start md:items-center">
                <Link
                  href={card.href}
                  className="border border-white/10 px-3 py-2 text-sm font-medium text-white transition hover:border-emerald-300/30 hover:bg-emerald-400/10"
                >
                  {card.action}
                </Link>
              </div>
            </article>
          ))}
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          <section className="border-t border-white/10 pt-4">
            <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">
              Active context
            </p>
            <dl className="mt-4 space-y-4 text-sm text-slate-300">
              <div className="flex items-center justify-between gap-3 border-b border-white/8 pb-3">
                <dt>Project</dt>
                <dd className="font-medium text-white">Default workspace</dd>
              </div>
              <div className="flex items-center justify-between gap-3 border-b border-white/8 pb-3">
                <dt>Navigator</dt>
                <dd className="font-medium text-white">Entries</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt>Search</dt>
                <dd className="font-mono text-xs text-emerald-200">
                  plasmid OR sgRNA
                </dd>
              </div>
            </dl>
          </section>

          <section className="border-t border-white/10 pt-4">
            <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">
              Quick actions
            </p>
            <div className="mt-4 divide-y divide-white/8 border-y border-white/8">
              {[
                "New entry",
                "New protocol",
                "Insert protocol block",
                "Open graph",
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-center justify-between px-0 py-3 text-sm text-slate-200"
                >
                  <span>{item}</span>
                  <span className="text-xs uppercase tracking-[0.22em] text-slate-500">
                    Soon
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </section>

      <aside className="space-y-8 border-l border-white/10 pl-6">
        <section className="border-b border-white/10 pb-5">
          <p className="text-[11px] uppercase tracking-[0.32em] text-slate-500">
            Inspector
          </p>
          <h2 className="mt-3 text-lg font-semibold text-white">
            Context panel
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            This space will hold metadata, backlinks, relations, and history.
            It now sits beside real notebook and protocol records instead of
            placeholder cards.
          </p>
        </section>

        <section className="space-y-4">
          <div className="border-l border-white/10 pl-4 text-sm text-slate-300">
            <span className="block text-[11px] uppercase tracking-[0.22em] text-slate-500">
              Backlinks
            </span>
            <span className="mt-1 block text-white">0 linked resources</span>
          </div>
          <div className="border-l border-white/10 pl-4 text-sm text-slate-300">
            <span className="block text-[11px] uppercase tracking-[0.22em] text-slate-500">
              Activity
            </span>
            <span className="mt-1 block text-white">
              Entry and protocol draft foundations are live
            </span>
          </div>
        </section>

        <section className="border-t border-emerald-400/20 pt-5">
          <p className="text-[11px] uppercase tracking-[0.32em] text-emerald-200/70">
            System note
          </p>
          <p className="mt-3 text-sm leading-6 text-emerald-50/90">
            The UI direction is shifting away from nested rounded boxes toward
            pane dividers, list rows, and restrained surface highlights.
          </p>
        </section>
      </aside>
    </div>
  );
}
