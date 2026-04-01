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
  const { context, entries, protocols } = await getNotebookPageData(
    session.user.id,
  );
  const linkedEntryCount = entries.filter(
    (entry) => entry.linkedProtocols.length > 0,
  ).length;

  return (
    <section className="space-y-8">
      <header className="border-b border-white/10 pb-5">
        <p className="text-xs uppercase tracking-[0.34em] text-emerald-200/75">
          Entries
        </p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-[-0.04em] text-white">
              Experiment notebook
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              Draft structured experiment notes, keep them scoped to a
              repository, and attach reusable protocols directly to the record.
            </p>
          </div>
          <div className="text-right text-xs uppercase tracking-[0.24em] text-slate-500">
            {context ? `${context.workspace.name} / ${context.repository.name}` : "No workspace"}
          </div>
        </div>
      </header>

      <div className="grid gap-4 border-y border-white/8 py-4 text-sm md:grid-cols-3">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
            Entries
          </p>
          <p className="mt-2 text-2xl font-semibold text-white">
            {entries.length}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
            Protocol-linked drafts
          </p>
          <p className="mt-2 text-2xl font-semibold text-white">
            {linkedEntryCount}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
            Default folder
          </p>
          <p className="mt-2 text-lg font-medium text-white">
            {context?.rootFolder?.name ?? "Unassigned"}
          </p>
        </div>
      </div>

      <div className="grid gap-10 xl:grid-cols-[minmax(320px,0.9fr)_minmax(0,1.1fr)]">
        <section className="space-y-4 border-t border-white/10 pt-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-slate-500">
                New draft
              </p>
              <h2 className="mt-2 text-lg font-semibold text-white">
                Capture an experiment entry
              </h2>
            </div>
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
              MVP
            </p>
          </div>

          <form action={createEntryDraftAction} className="space-y-5">
            <div className="space-y-2">
              <label
                htmlFor="entry-title"
                className="text-xs uppercase tracking-[0.24em] text-slate-500"
              >
                Title
              </label>
              <input
                id="entry-title"
                name="title"
                required
                placeholder="Example: Lentiviral transduction optimization"
                className="w-full border-b border-white/12 bg-transparent px-0 py-3 text-base text-white outline-none transition placeholder:text-slate-600 focus:border-emerald-300/40"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="entry-summary"
                className="text-xs uppercase tracking-[0.24em] text-slate-500"
              >
                Summary
              </label>
              <textarea
                id="entry-summary"
                name="summary"
                rows={3}
                placeholder="Short intent, readout, or decision summary"
                className="w-full border border-white/10 bg-slate-950/30 px-3 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-emerald-300/30"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="entry-body"
                className="text-xs uppercase tracking-[0.24em] text-slate-500"
              >
                Body
              </label>
              <textarea
                id="entry-body"
                name="bodyText"
                rows={10}
                placeholder="Objectives, setup, observations, and next steps"
                className="w-full border border-white/10 bg-slate-950/30 px-3 py-3 text-sm leading-6 text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-emerald-300/30"
              />
            </div>

            <div className="space-y-3 border-t border-white/8 pt-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
                    Protocol blocks
                  </p>
                  <p className="mt-1 text-sm text-slate-300">
                    Link reusable protocols into this entry draft.
                  </p>
                </div>
                <Link
                  href="/protocols"
                  className="text-xs uppercase tracking-[0.22em] text-emerald-200 transition hover:text-emerald-100"
                >
                  Manage library
                </Link>
              </div>

              {protocols.length ? (
                <div className="divide-y divide-white/8 border-y border-white/8">
                  {protocols.map((protocol) => (
                    <label
                      key={protocol.id}
                      className="flex items-start gap-3 py-3 text-sm text-slate-200"
                    >
                      <input
                        type="checkbox"
                        name="linkedProtocolIds"
                        value={protocol.id}
                        className="mt-1 h-4 w-4 border-white/20 bg-transparent text-emerald-400 focus:ring-emerald-400/25"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium text-white">
                          {protocol.title}
                        </span>
                        {protocol.summary ? (
                          <span className="mt-1 block text-sm leading-6 text-slate-400">
                            {protocol.summary}
                          </span>
                        ) : null}
                      </span>
                      <span className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
                        {protocol.status}
                      </span>
                    </label>
                  ))}
                </div>
              ) : (
                <p className="border-y border-white/8 py-3 text-sm leading-6 text-slate-400">
                  No reusable protocols yet. Add one from the protocol library
                  and it will appear here for insertion.
                </p>
              )}
            </div>

            <SubmitButton
              idleLabel="Create entry draft"
              pendingLabel="Creating entry..."
              className="border border-emerald-300/30 px-4 py-3 text-sm font-medium text-emerald-50 transition hover:bg-emerald-400/10 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </form>
        </section>

        <section className="space-y-4 border-t border-white/10 pt-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-slate-500">
                Recent drafts
              </p>
              <h2 className="mt-2 text-lg font-semibold text-white">
                Notebook activity
              </h2>
            </div>
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
              {entries.length} total
            </p>
          </div>

          {entries.length ? (
            <div className="divide-y divide-white/8 border-y border-white/8">
              {entries.map((entry) => (
                <article key={entry.id} className="space-y-3 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={`/entries/${entry.id}`}
                        className="text-base font-semibold text-white transition hover:text-emerald-100"
                      >
                        {entry.title}
                      </Link>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs uppercase tracking-[0.22em] text-slate-500">
                        <span>{entry.status}</span>
                        <span>v{entry.latestVersionNumber}</span>
                        <span>{entry.folderName ?? "Root"}</span>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500">
                      {entryDateFormatter.format(entry.updatedAt)}
                    </p>
                  </div>

                  {entry.summary ? (
                    <p className="max-w-3xl text-sm leading-6 text-slate-300">
                      {entry.summary}
                    </p>
                  ) : (
                    <p className="text-sm italic text-slate-500">
                      No summary yet.
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-2">
                    {entry.linkedProtocols.length ? (
                      entry.linkedProtocols.map((protocol) => (
                        <Link
                          key={protocol.id}
                          href={`/protocols/${protocol.id}`}
                          className="border border-white/10 px-2 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-300 transition hover:border-emerald-300/30 hover:text-white"
                        >
                          {protocol.title}
                        </Link>
                      ))
                    ) : (
                      <span className="text-xs uppercase tracking-[0.22em] text-slate-500">
                        No protocol blocks linked
                      </span>
                    )}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="border-y border-white/8 py-6 text-sm leading-6 text-slate-400">
              Your notebook is empty. Create the first entry draft on the left
              and it will appear here immediately.
            </p>
          )}
        </section>
      </div>
    </section>
  );
}
