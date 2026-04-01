import Link from "next/link";

const workspaceCards = [
  {
    title: "Recent entries",
    body: "Protocol drafts, assay logs, and linked experiment notes live here.",
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
    body: "Reusable blocks and pinned procedures will become the library backbone.",
    action: "View protocols",
    href: "/protocols",
  },
];

export default function Home() {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
      <section className="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-[0_24px_90px_rgba(0,0,0,0.35)] backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-emerald-300/80">
              Workspace overview
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">
              Biota ELN
            </h1>
          </div>
          <div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-200">
            Private workspace
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {workspaceCards.map((card) => (
            <article
              key={card.title}
              className="rounded-2xl border border-white/8 bg-slate-950/60 p-4"
            >
              <h2 className="text-sm font-semibold text-white">{card.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                {card.body}
              </p>
              <Link
                href={card.href}
                className="mt-4 inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-medium text-white transition hover:border-emerald-300/30 hover:bg-emerald-400/10"
              >
                {card.action}
              </Link>
            </article>
          ))}
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-[1fr_1fr]">
          <div className="rounded-2xl border border-white/8 bg-slate-950/55 p-4">
            <p className="text-xs uppercase tracking-[0.25em] text-slate-400">
              Active context
            </p>
            <div className="mt-3 space-y-3 text-sm text-slate-300">
              <div className="flex items-center justify-between gap-3">
                <span>Project</span>
                <span className="font-medium text-white">
                  Default workspace
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Navigator</span>
                <span className="font-medium text-white">Entries</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Search</span>
                <span className="font-mono text-xs text-emerald-200">
                  plasmid OR sgRNA
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/8 bg-slate-950/55 p-4">
            <p className="text-xs uppercase tracking-[0.25em] text-slate-400">
              Quick actions
            </p>
            <div className="mt-3 grid gap-2">
              {[
                "New entry",
                "New entity",
                "Insert protocol block",
                "Open graph",
              ].map((item) => (
                <button
                  key={item}
                  type="button"
                  className="flex items-center justify-between rounded-xl border border-white/8 bg-white/5 px-3 py-2 text-left text-sm text-slate-200 transition hover:border-white/15 hover:bg-white/8"
                >
                  <span>{item}</span>
                  <span className="text-xs text-slate-500">Soon</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <aside className="space-y-4">
        <div className="rounded-[28px] border border-white/10 bg-slate-950/70 p-5">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
            Inspector
          </p>
          <h2 className="mt-3 text-lg font-semibold text-white">
            Context panel
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            This area will hold metadata, backlinks, relations, history, and
            resource actions once the core workflows land.
          </p>
          <div className="mt-4 space-y-3 text-sm text-slate-300">
            <div className="rounded-2xl border border-white/8 bg-white/5 p-3">
              <span className="block text-xs uppercase tracking-[0.2em] text-slate-500">
                Backlinks
              </span>
              <span className="mt-1 block text-white">0 linked resources</span>
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/5 p-3">
              <span className="block text-xs uppercase tracking-[0.2em] text-slate-500">
                Activity
              </span>
              <span className="mt-1 block text-white">
                Scaffolded workspace ready for entry design
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-[28px] border border-emerald-400/15 bg-emerald-400/8 p-5">
          <p className="text-xs uppercase tracking-[0.3em] text-emerald-200/70">
            System note
          </p>
          <p className="mt-3 text-sm leading-6 text-emerald-50/90">
            The initial shell is intentionally minimal so we can layer in auth,
            entries, entities, protocols, and sequence tooling without a second
            visual rewrite.
          </p>
        </div>
      </aside>
    </div>
  );
}
