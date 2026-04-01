import Link from "next/link";
import { SubmitButton } from "@/components/notebook/submit-button";
import { createEntryDraftAction } from "@/lib/notebook/actions";
import { getNotebookPageData } from "@/lib/notebook/data";
import { requireServerSession } from "@/lib/auth/session";

const entryDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export default async function EntriesPage() {
  const session = await requireServerSession();
  const { context, entries } = await getNotebookPageData(session.user.id);
  const linkedEntryCount = entries.filter(
    (entry) => entry.linkedProtocols.length > 0,
  ).length;

  return (
    <section className="space-y-10">
      <header className="border-b border-[color:var(--line)] pb-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[color:var(--accent-strong)]">
          Entries
        </p>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl font-semibold tracking-[-0.05em] text-[color:var(--text-primary)]">
              Experiment notebook
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[color:var(--text-muted)]">
              Treat each entry like a real notebook page: create a blank entry,
              open it instantly, and compose the experimental record inside the
              document itself.
            </p>
          </div>
          <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-[color:var(--text-soft)]">
            {context
              ? `${context.workspace.name} / ${context.repository.name}`
              : "No workspace"}
          </div>
        </div>
      </header>

      <div className="grid gap-4 border-y border-[color:var(--line)] py-4 text-sm md:grid-cols-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[color:var(--text-soft)]">
            Entries
          </p>
          <p className="mt-2 text-2xl font-semibold text-[color:var(--text-primary)]">
            {entries.length}
          </p>
        </div>
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[color:var(--text-soft)]">
            Protocol-linked
          </p>
          <p className="mt-2 text-2xl font-semibold text-[color:var(--text-primary)]">
            {linkedEntryCount}
          </p>
        </div>
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[color:var(--text-soft)]">
            Default folder
          </p>
          <p className="mt-2 text-lg font-medium text-[color:var(--text-primary)]">
            {context?.rootFolder?.name ?? "Unassigned"}
          </p>
        </div>
      </div>

      <div className="grid gap-10 xl:grid-cols-[minmax(280px,0.72fr)_minmax(0,1.28fr)]">
        <section className="space-y-5 border-t border-[color:var(--line)] pt-5">
          <div className="space-y-3">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[color:var(--text-soft)]">
              New entry
            </p>
            <h2 className="text-xl font-semibold tracking-[-0.03em] text-[color:var(--text-primary)]">
              Start from a blank page
            </h2>
            <p className="text-sm leading-7 text-[color:var(--text-muted)]">
              The new entry flow now creates a blank document first. Rename it,
              write in markdown, insert protocols, and drop tables into the same
              page once it opens.
            </p>
          </div>

          <form action={createEntryDraftAction} className="space-y-4">
            <SubmitButton
              idleLabel="Create new entry"
              pendingLabel="Opening blank entry..."
              className="inline-flex items-center border border-[color:var(--accent-soft)] bg-[color:var(--accent-muted)] px-4 py-3 text-sm font-medium text-[color:var(--text-primary)] transition hover:border-[color:var(--accent-strong)] hover:bg-[color:var(--accent-soft)] disabled:cursor-not-allowed disabled:opacity-60"
            />
          </form>

          <div className="border-t border-[color:var(--line)] pt-4 text-sm leading-7 text-[color:var(--text-muted)]">
            <p>The title defaults to `Untitled entry` until you rename it.</p>
            <p>
              Use the file navigator on the left to reopen entries by folder.
            </p>
          </div>
        </section>

        <section className="space-y-5 border-t border-[color:var(--line)] pt-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[color:var(--text-soft)]">
                Recent pages
              </p>
              <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-[color:var(--text-primary)]">
                Notebook activity
              </h2>
            </div>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[color:var(--text-soft)]">
              {entries.length} total
            </p>
          </div>

          {entries.length ? (
            <div className="divide-y divide-[color:var(--line)] border-y border-[color:var(--line)]">
              {entries.map((entry) => (
                <article key={entry.id} className="space-y-3 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={`/entries/${entry.id}`}
                        className="text-lg font-semibold tracking-[-0.02em] text-[color:var(--text-primary)] transition hover:text-[color:var(--accent-strong)]"
                      >
                        {entry.title}
                      </Link>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] uppercase tracking-[0.16em] text-[color:var(--text-soft)]">
                        <span>{entry.status}</span>
                        <span>v{entry.latestVersionNumber}</span>
                        <span>{entry.folderName ?? "Root"}</span>
                      </div>
                    </div>
                    <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[color:var(--text-soft)]">
                      {entryDateFormatter.format(entry.updatedAt)}
                    </p>
                  </div>

                  {entry.summary ? (
                    <p className="max-w-3xl text-sm leading-7 text-[color:var(--text-muted)]">
                      {entry.summary}
                    </p>
                  ) : (
                    <p className="text-sm italic text-[color:var(--text-soft)]">
                      Blank page so far.
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-2">
                    {entry.linkedProtocols.length ? (
                      entry.linkedProtocols.map((protocol) => (
                        <Link
                          key={protocol.id}
                          href={`/protocols/${protocol.id}`}
                          className="inline-flex items-center border border-[color:var(--line)] px-2.5 py-1 text-[11px] uppercase tracking-[0.16em] text-[color:var(--text-muted)] transition hover:border-[color:var(--accent-soft)] hover:text-[color:var(--text-primary)]"
                        >
                          {protocol.title}
                        </Link>
                      ))
                    ) : (
                      <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-[color:var(--text-soft)]">
                        No protocol blocks linked
                      </span>
                    )}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="border-y border-[color:var(--line)] py-6 text-sm leading-7 text-[color:var(--text-muted)]">
              Your notebook is empty. Create the first entry and it will open as
              a blank page immediately.
            </p>
          )}
        </section>
      </div>
    </section>
  );
}
