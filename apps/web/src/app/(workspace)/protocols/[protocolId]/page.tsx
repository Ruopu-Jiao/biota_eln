import Link from "next/link";
import { getProtocolDetailForUser } from "@biota/db";
import { notFound } from "next/navigation";
import { isDemoAuthMode } from "@/lib/auth/demo.server";
import { requireServerSession } from "@/lib/auth/session";
import { getDemoProtocolDetail } from "@/lib/notebook/demo-store";

const protocolDetailDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

type ProtocolDetailPageProps = {
  params: Promise<{
    protocolId: string;
  }>;
};

export default async function ProtocolDetailPage({
  params,
}: ProtocolDetailPageProps) {
  const session = await requireServerSession();
  const { protocolId } = await params;
  const protocol = isDemoAuthMode()
    ? await getDemoProtocolDetail(protocolId)
    : await getProtocolDetailForUser(session.user.id, protocolId);

  if (!protocol) {
    notFound();
  }

  return (
    <section className="space-y-8">
      <div className="border-b border-white/10 pb-6">
        <Link
          href="/protocols"
          className="text-[11px] uppercase tracking-[0.28em] text-slate-500 transition hover:text-slate-300"
        >
          Protocols
        </Link>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-white">
              {protocol.title}
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
              {protocol.summary ??
                "No summary recorded yet for this protocol draft."}
            </p>
          </div>
          <div className="text-right text-xs uppercase tracking-[0.22em] text-slate-500">
            <p>{protocol.status}</p>
            <p className="mt-2">v{protocol.latestVersionNumber}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1.7fr)_minmax(280px,0.7fr)]">
        <article className="border border-white/10 bg-black/10">
          <div className="border-b border-white/10 px-5 py-4">
            <p className="text-sm font-medium text-white">Procedure body</p>
            <p className="mt-1 text-sm text-slate-400">
              Step blocks and reusable protocol insertion will build on this
              versioned foundation in the next wave.
            </p>
          </div>
          <div className="px-5 py-5">
            <pre className="whitespace-pre-wrap font-sans text-sm leading-7 text-slate-200">
              {protocol.bodyText ?? "No body content yet."}
            </pre>
          </div>
        </article>

        <aside className="border-l border-white/10 pl-6">
          <div className="space-y-5">
            <div className="border-b border-white/10 pb-4">
              <p className="text-sm font-medium text-white">Procedure metadata</p>
            </div>
            <dl className="space-y-4 text-sm text-slate-300">
              <div>
                <dt className="text-[11px] uppercase tracking-[0.24em] text-slate-500">
                  Repository
                </dt>
                <dd className="mt-1 text-white">{protocol.repositoryName}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-[0.24em] text-slate-500">
                  Folder
                </dt>
                <dd className="mt-1 text-white">
                  {protocol.folderName ?? "Unfiled"}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-[0.24em] text-slate-500">
                  Author
                </dt>
                <dd className="mt-1 text-white">
                  {protocol.createdByName ?? "Unknown author"}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-[0.24em] text-slate-500">
                  Updated
                </dt>
                <dd className="mt-1 text-white">
                  {protocolDetailDateFormatter.format(protocol.updatedAt)}
                </dd>
              </div>
            </dl>
          </div>
        </aside>
      </div>
    </section>
  );
}
