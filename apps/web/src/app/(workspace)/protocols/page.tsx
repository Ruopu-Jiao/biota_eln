import Link from "next/link";
import { SubmitButton } from "@/components/notebook/submit-button";
import { requireServerSession } from "@/lib/auth/session";
import { createProtocolDraftAction } from "@/lib/notebook/actions";
import { getNotebookPageData } from "@/lib/notebook/data";

const protocolDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export default async function ProtocolsPage() {
  const session = await requireServerSession();
  const { context, protocols, entries } = await getNotebookPageData(
    session.user.id,
  );
  const activeProtocols = protocols.filter(
    (protocol) => protocol.status === "ACTIVE",
  ).length;

  return (
    <section className="space-y-8">
      <header className="border-b border-white/10 pb-5">
        <p className="text-xs uppercase tracking-[0.34em] text-emerald-200/75">
          Protocols
        </p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-[-0.04em] text-white">
              Reusable protocol library
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              Build modular SOP blocks once, keep them versioned, and reuse them
              across notebook drafts from the same repository.
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
            Protocols
          </p>
          <p className="mt-2 text-2xl font-semibold text-white">
            {protocols.length}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
            Active procedures
          </p>
          <p className="mt-2 text-2xl font-semibold text-white">
            {activeProtocols}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
            Entry drafts in notebook
          </p>
          <p className="mt-2 text-2xl font-semibold text-white">
            {entries.length}
          </p>
        </div>
      </div>

      <div className="grid gap-10 xl:grid-cols-[minmax(320px,0.9fr)_minmax(0,1.1fr)]">
        <section className="space-y-4 border-t border-white/10 pt-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-slate-500">
                New protocol
              </p>
              <h2 className="mt-2 text-lg font-semibold text-white">
                Create a reusable block
              </h2>
            </div>
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
              Version 1
            </p>
          </div>

          <form action={createProtocolDraftAction} className="space-y-5">
            <div className="space-y-2">
              <label
                htmlFor="protocol-title"
                className="text-xs uppercase tracking-[0.24em] text-slate-500"
              >
                Title
              </label>
              <input
                id="protocol-title"
                name="title"
                required
                placeholder="Example: Golden Gate ligation setup"
                className="w-full border-b border-white/12 bg-transparent px-0 py-3 text-base text-white outline-none transition placeholder:text-slate-600 focus:border-emerald-300/40"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="protocol-summary"
                className="text-xs uppercase tracking-[0.24em] text-slate-500"
              >
                Summary
              </label>
              <textarea
                id="protocol-summary"
                name="summary"
                rows={3}
                placeholder="What this protocol is for and when to use it"
                className="w-full border border-white/10 bg-slate-950/30 px-3 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-emerald-300/30"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="protocol-body"
                className="text-xs uppercase tracking-[0.24em] text-slate-500"
              >
                Steps
              </label>
              <textarea
                id="protocol-body"
                name="bodyText"
                rows={12}
                placeholder="Add reagents, setup notes, cycling conditions, timing, and checkpoints"
                className="w-full border border-white/10 bg-slate-950/30 px-3 py-3 text-sm leading-6 text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-emerald-300/30"
              />
            </div>

            <div className="border-l-2 border-emerald-400/25 pl-4 text-sm leading-6 text-slate-300">
              Protocols created here become available as insertable blocks when
              drafting a notebook entry.
            </div>

            <SubmitButton
              idleLabel="Create protocol draft"
              pendingLabel="Creating protocol..."
              className="border border-emerald-300/30 px-4 py-3 text-sm font-medium text-emerald-50 transition hover:bg-emerald-400/10 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </form>
        </section>

        <section className="space-y-4 border-t border-white/10 pt-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-slate-500">
                Library
              </p>
              <h2 className="mt-2 text-lg font-semibold text-white">
                Protocol drafts and active procedures
              </h2>
            </div>
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
              Reusable
            </p>
          </div>

          {protocols.length ? (
            <div className="divide-y divide-white/8 border-y border-white/8">
              {protocols.map((protocol) => (
                <article key={protocol.id} className="space-y-3 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={`/protocols/${protocol.id}`}
                        className="text-base font-semibold text-white transition hover:text-emerald-100"
                      >
                        {protocol.title}
                      </Link>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs uppercase tracking-[0.22em] text-slate-500">
                        <span>{protocol.status}</span>
                        <span>v{protocol.latestVersionNumber}</span>
                        <span>{protocol.folderName ?? "Root"}</span>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500">
                      {protocolDateFormatter.format(protocol.updatedAt)}
                    </p>
                  </div>

                  {protocol.summary ? (
                    <p className="max-w-3xl text-sm leading-6 text-slate-300">
                      {protocol.summary}
                    </p>
                  ) : (
                    <p className="text-sm italic text-slate-500">
                      No summary yet.
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs uppercase tracking-[0.22em] text-slate-500">
                    <span>{protocol.repositoryName}</span>
                    <span>{protocol.createdByName ?? "Unknown author"}</span>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="border-y border-white/8 py-6 text-sm leading-6 text-slate-400">
              No protocols yet. Add the first draft on the left and it will
              become available for entry insertion immediately.
            </p>
          )}
        </section>
      </div>
    </section>
  );
}
