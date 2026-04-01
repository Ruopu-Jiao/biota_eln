import Link from "next/link";
import { getEntryDetailForUser } from "@biota/db";
import { notFound } from "next/navigation";
import { isDemoAuthMode } from "@/lib/auth/demo.server";
import { requireServerSession } from "@/lib/auth/session";
import { getDemoEntryDetail } from "@/lib/notebook/demo-store";

const entryDetailDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

type EntryDetailPageProps = {
  params: Promise<{
    entryId: string;
  }>;
};

export default async function EntryDetailPage({
  params,
}: EntryDetailPageProps) {
  const session = await requireServerSession();
  const { entryId } = await params;
  const entry = isDemoAuthMode()
    ? await getDemoEntryDetail(entryId)
    : await getEntryDetailForUser(session.user.id, entryId);

  if (!entry) {
    notFound();
  }

  return (
    <section className="space-y-8">
      <div className="border-b border-white/10 pb-6">
        <Link
          href="/entries"
          className="text-[11px] uppercase tracking-[0.28em] text-slate-500 transition hover:text-slate-300"
        >
          Entries
        </Link>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-white">
              {entry.title}
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
              {entry.summary ?? "No summary recorded yet for this notebook entry."}
            </p>
          </div>
          <div className="text-right text-xs uppercase tracking-[0.22em] text-slate-500">
            <p>{entry.status}</p>
            <p className="mt-2">v{entry.latestVersionNumber}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1.7fr)_minmax(280px,0.7fr)]">
        <article className="border border-white/10 bg-black/10">
            <div className="border-b border-white/10 px-5 py-4">
            <p className="text-sm font-medium text-white">Draft body</p>
            <p className="mt-1 text-sm text-slate-400">
              Entry editor blocks will replace this plain text body in the next
              wave, but the versioned record is already in place.
            </p>
            {entry.linkedProtocols.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {entry.linkedProtocols.map((protocol) => (
                  <Link
                    key={protocol.id}
                    href={`/protocols/${protocol.id}`}
                    className="border border-white/10 px-2 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-300 transition hover:border-emerald-300/30 hover:text-white"
                  >
                    {protocol.title}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
          <div className="px-5 py-5">
            <pre className="whitespace-pre-wrap font-sans text-sm leading-7 text-slate-200">
              {entry.bodyText ?? "No body content yet."}
            </pre>
          </div>
        </article>

        <aside className="border-l border-white/10 pl-6">
          <div className="space-y-5">
            <div className="border-b border-white/10 pb-4">
              <p className="text-sm font-medium text-white">Record metadata</p>
            </div>
            <dl className="space-y-4 text-sm text-slate-300">
              <div>
                <dt className="text-[11px] uppercase tracking-[0.24em] text-slate-500">
                  Repository
                </dt>
                <dd className="mt-1 text-white">{entry.repositoryName}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-[0.24em] text-slate-500">
                  Folder
                </dt>
                <dd className="mt-1 text-white">{entry.folderName ?? "Unfiled"}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-[0.24em] text-slate-500">
                  Author
                </dt>
                <dd className="mt-1 text-white">
                  {entry.createdByName ?? "Unknown author"}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-[0.24em] text-slate-500">
                  Updated
                </dt>
                <dd className="mt-1 text-white">
                  {entryDetailDateFormatter.format(entry.updatedAt)}
                </dd>
              </div>
            </dl>
          </div>
        </aside>
      </div>
    </section>
  );
}
