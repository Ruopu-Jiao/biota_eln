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
      <header className="border-b border-[color:var(--line)] pb-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[color:var(--accent-strong)]">
          Protocols
        </p>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-[-0.04em] text-[color:var(--text-primary)]">
              Reusable protocol library
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[color:var(--text-muted)]">
              Build modular SOP blocks once, keep them versioned, and reuse them
              across notebook pages from the same repository.
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
            Protocols
          </p>
          <p className="mt-2 text-2xl font-semibold text-[color:var(--text-primary)]">
            {protocols.length}
          </p>
        </div>
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[color:var(--text-soft)]">
            Active procedures
          </p>
          <p className="mt-2 text-2xl font-semibold text-[color:var(--text-primary)]">
            {activeProtocols}
          </p>
        </div>
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[color:var(--text-soft)]">
            Linked entry pages
          </p>
          <p className="mt-2 text-2xl font-semibold text-[color:var(--text-primary)]">
            {entries.length}
          </p>
        </div>
      </div>

      <div className="grid gap-10 xl:grid-cols-[minmax(320px,0.9fr)_minmax(0,1.1fr)]">
        <section className="space-y-5 border-t border-[color:var(--line)] pt-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[color:var(--text-soft)]">
                New protocol
              </p>
              <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-[color:var(--text-primary)]">
                Create a reusable block
              </h2>
            </div>
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[color:var(--text-soft)]">
              Version 1
            </p>
          </div>

          <form action={createProtocolDraftAction} className="space-y-5">
            <div className="space-y-2">
              <label
                htmlFor="protocol-title"
                className="font-mono text-[11px] uppercase tracking-[0.18em] text-[color:var(--text-soft)]"
              >
                Title
              </label>
              <input
                id="protocol-title"
                name="title"
                required
                placeholder="Example: Golden Gate ligation setup"
                className="w-full border-b border-[color:var(--line)] bg-transparent px-0 py-3 text-base text-[color:var(--text-primary)] outline-none transition focus:border-[color:var(--accent-strong)]"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="protocol-summary"
                className="font-mono text-[11px] uppercase tracking-[0.18em] text-[color:var(--text-soft)]"
              >
                Summary
              </label>
              <textarea
                id="protocol-summary"
                name="summary"
                rows={3}
                placeholder="What this protocol is for and when to use it"
                className="w-full border border-[color:var(--line)] bg-[color:var(--surface-muted)] px-3 py-3 text-sm text-[color:var(--text-primary)] outline-none transition focus:border-[color:var(--accent-strong)]"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="protocol-body"
                className="font-mono text-[11px] uppercase tracking-[0.18em] text-[color:var(--text-soft)]"
              >
                Steps
              </label>
              <textarea
                id="protocol-body"
                name="bodyText"
                rows={12}
                placeholder="Add reagents, setup notes, cycling conditions, timing, and checkpoints"
                className="w-full border border-[color:var(--line)] bg-[color:var(--surface-muted)] px-3 py-3 text-sm leading-7 text-[color:var(--text-primary)] outline-none transition focus:border-[color:var(--accent-strong)]"
              />
            </div>

            <div className="border-l border-[color:var(--accent-soft)] pl-4 text-sm leading-7 text-[color:var(--text-muted)]">
              Protocols created here become available as insertable blocks when
              drafting a notebook entry.
            </div>

            <SubmitButton
              idleLabel="Create protocol draft"
              pendingLabel="Creating protocol..."
              className="inline-flex items-center border border-[color:var(--accent-soft)] bg-[color:var(--accent-muted)] px-4 py-3 text-sm font-medium text-[color:var(--text-primary)] transition hover:border-[color:var(--accent-strong)] hover:bg-[color:var(--accent-soft)] disabled:cursor-not-allowed disabled:opacity-60"
            />
          </form>
        </section>

        <section className="space-y-5 border-t border-[color:var(--line)] pt-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[color:var(--text-soft)]">
                Library
              </p>
              <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-[color:var(--text-primary)]">
                Protocol drafts and active procedures
              </h2>
            </div>
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[color:var(--text-soft)]">
              Reusable
            </p>
          </div>

          {protocols.length ? (
            <div className="divide-y divide-[color:var(--line)] border-y border-[color:var(--line)]">
              {protocols.map((protocol) => (
                <article key={protocol.id} className="space-y-3 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={`/protocols/${protocol.id}`}
                        className="text-lg font-semibold tracking-[-0.02em] text-[color:var(--text-primary)] transition hover:text-[color:var(--accent-strong)]"
                      >
                        {protocol.title}
                      </Link>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] uppercase tracking-[0.16em] text-[color:var(--text-soft)]">
                        <span>{protocol.status}</span>
                        <span>v{protocol.latestVersionNumber}</span>
                        <span>{protocol.folderName ?? "Root"}</span>
                      </div>
                    </div>
                    <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[color:var(--text-soft)]">
                      {protocolDateFormatter.format(protocol.updatedAt)}
                    </p>
                  </div>

                  {protocol.summary ? (
                    <p className="max-w-3xl text-sm leading-7 text-[color:var(--text-muted)]">
                      {protocol.summary}
                    </p>
                  ) : (
                    <p className="text-sm italic text-[color:var(--text-soft)]">
                      No summary yet.
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[11px] uppercase tracking-[0.16em] text-[color:var(--text-soft)]">
                    <span>{protocol.repositoryName}</span>
                    <span>{protocol.createdByName ?? "Unknown author"}</span>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="border-y border-[color:var(--line)] py-6 text-sm leading-7 text-[color:var(--text-muted)]">
              No protocols yet. Add the first draft on the left and it will
              become available for entry insertion immediately.
            </p>
          )}
        </section>
      </div>
    </section>
  );
}
