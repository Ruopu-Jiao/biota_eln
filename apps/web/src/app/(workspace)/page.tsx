import Link from "next/link";

const workspaceCards = [
  {
    title: "Recent entries",
    body: "Draft experiment records now open as document-style pages with markdown blocks, protocol insertions, and tables.",
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
    body: "Reusable procedure records live in a versioned library and can be inserted directly into entries.",
    action: "View protocols",
    href: "/protocols",
  },
];

export default function Home() {
  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1.55fr)_minmax(280px,0.75fr)]">
      <section className="space-y-8">
        <div className="border-b border-[color:var(--line)] pb-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[color:var(--accent-strong)]">
            Workspace overview
          </p>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold tracking-[-0.04em] text-[color:var(--text-primary)]">
                Biota ELN
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-[color:var(--text-muted)]">
                The workspace is shifting toward an Obsidian-like notebook feel:
                flatter panes, a real file browser, and entries that behave like
                pages instead of forms.
              </p>
            </div>
            <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-[color:var(--accent-strong)]">
              Private workspace
            </div>
          </div>
        </div>

        <div className="border-y border-[color:var(--line)]">
          {workspaceCards.map((card) => (
            <article
              key={card.title}
              className="grid gap-4 border-b border-[color:var(--line)] px-0 py-5 last:border-b-0 md:grid-cols-[minmax(0,1fr)_auto]"
            >
              <div>
                <h2 className="text-base font-medium text-[color:var(--text-primary)]">
                  {card.title}
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-7 text-[color:var(--text-muted)]">
                  {card.body}
                </p>
              </div>
              <div className="flex items-start md:items-center">
                <Link
                  href={card.href}
                  className="inline-flex items-center border border-[color:var(--line)] px-3 py-2 text-sm font-medium text-[color:var(--text-primary)] transition hover:border-[color:var(--accent-soft)] hover:bg-[color:var(--accent-muted)]"
                >
                  {card.action}
                </Link>
              </div>
            </article>
          ))}
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          <section className="border-t border-[color:var(--line)] pt-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[color:var(--text-soft)]">
              Active context
            </p>
            <dl className="mt-4 space-y-4 text-sm text-[color:var(--text-muted)]">
              <div className="flex items-center justify-between gap-3 border-b border-[color:var(--line)] pb-3">
                <dt>Project</dt>
                <dd className="font-medium text-[color:var(--text-primary)]">
                  Default workspace
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 border-b border-[color:var(--line)] pb-3">
                <dt>Navigator</dt>
                <dd className="font-medium text-[color:var(--text-primary)]">
                  File browser
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt>Search</dt>
                <dd className="font-mono text-xs text-[color:var(--accent-strong)]">
                  plasmid OR sgRNA
                </dd>
              </div>
            </dl>
          </section>

          <section className="border-t border-[color:var(--line)] pt-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[color:var(--text-soft)]">
              Quick actions
            </p>
            <div className="mt-4 divide-y divide-[color:var(--line)] border-y border-[color:var(--line)]">
              {[
                "New entry",
                "New protocol",
                "Insert protocol block",
                "Open graph",
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-center justify-between px-0 py-3 text-sm text-[color:var(--text-primary)]"
                >
                  <span>{item}</span>
                  <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-[color:var(--text-soft)]">
                    Live / next
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </section>

      <aside className="space-y-8 border-l border-[color:var(--line)] pl-6">
        <section className="border-b border-[color:var(--line)] pb-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[color:var(--text-soft)]">
            Inspector
          </p>
          <h2 className="mt-3 text-lg font-semibold text-[color:var(--text-primary)]">
            Context panel
          </h2>
          <p className="mt-2 text-sm leading-7 text-[color:var(--text-muted)]">
            This space will hold metadata, backlinks, relations, and history.
            It now sits beside real notebook and protocol records instead of
            placeholder cards.
          </p>
        </section>

        <section className="space-y-4">
          <div className="border-l border-[color:var(--line)] pl-4 text-sm text-[color:var(--text-muted)]">
            <span className="block font-mono text-[11px] uppercase tracking-[0.16em] text-[color:var(--text-soft)]">
              Backlinks
            </span>
            <span className="mt-1 block text-[color:var(--text-primary)]">
              0 linked resources
            </span>
          </div>
          <div className="border-l border-[color:var(--line)] pl-4 text-sm text-[color:var(--text-muted)]">
            <span className="block font-mono text-[11px] uppercase tracking-[0.16em] text-[color:var(--text-soft)]">
              Activity
            </span>
            <span className="mt-1 block text-[color:var(--text-primary)]">
              Entry page workflows and theme controls are live
            </span>
          </div>
        </section>

        <section className="border-t border-[color:var(--accent-soft)] pt-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[color:var(--accent-strong)]">
            System note
          </p>
          <p className="mt-3 text-sm leading-7 text-[color:var(--text-muted)]">
            The interface now leans on pane dividers, list rows, and restrained
            surface highlights instead of rounded dashboard cards.
          </p>
        </section>
      </aside>
    </div>
  );
}
