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
      <div className="border-b border-[color:var(--line)] pb-6">
        <Link
          href="/protocols"
          className="font-mono text-[11px] uppercase tracking-[0.22em] text-[color:var(--text-soft)] transition hover:text-[color:var(--text-primary)]"
        >
          Protocols
        </Link>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-[-0.04em] text-[color:var(--text-primary)]">
              {protocol.title}
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[color:var(--text-muted)]">
              {protocol.summary ??
                "No summary recorded yet for this protocol draft."}
            </p>
          </div>
          <div className="text-right">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[color:var(--text-soft)]">
              {protocol.status}
            </p>
            <p className="mt-2 text-lg font-semibold text-[color:var(--text-primary)]">
              v{protocol.latestVersionNumber}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1.7fr)_minmax(280px,0.7fr)]">
        <article className="border border-[color:var(--line)] bg-[color:var(--surface-muted)]">
          <div className="border-b border-[color:var(--line)] px-5 py-4">
            <p className="text-sm font-medium text-[color:var(--text-primary)]">
              Procedure body
            </p>
            <p className="mt-1 text-sm leading-7 text-[color:var(--text-muted)]">
              Step blocks and reusable protocol insertion will build on this
              versioned foundation in the next wave.
            </p>
          </div>
          <div className="px-5 py-5">
            <pre className="whitespace-pre-wrap font-sans text-sm leading-8 text-[color:var(--text-primary)]">
              {protocol.bodyText ?? "No body content yet."}
            </pre>
          </div>
        </article>

        <aside className="border-l border-[color:var(--line)] pl-6">
          <div className="space-y-5">
            <div className="border-b border-[color:var(--line)] pb-4">
              <p className="text-sm font-medium text-[color:var(--text-primary)]">
                Procedure metadata
              </p>
            </div>
            <dl className="space-y-4 text-sm text-[color:var(--text-muted)]">
              <div>
                <dt className="font-mono text-[11px] uppercase tracking-[0.16em] text-[color:var(--text-soft)]">
                  Repository
                </dt>
                <dd className="mt-1 text-[color:var(--text-primary)]">
                  {protocol.repositoryName}
                </dd>
              </div>
              <div>
                <dt className="font-mono text-[11px] uppercase tracking-[0.16em] text-[color:var(--text-soft)]">
                  Folder
                </dt>
                <dd className="mt-1 text-[color:var(--text-primary)]">
                  {protocol.folderName ?? "Unfiled"}
                </dd>
              </div>
              <div>
                <dt className="font-mono text-[11px] uppercase tracking-[0.16em] text-[color:var(--text-soft)]">
                  Author
                </dt>
                <dd className="mt-1 text-[color:var(--text-primary)]">
                  {protocol.createdByName ?? "Unknown author"}
                </dd>
              </div>
              <div>
                <dt className="font-mono text-[11px] uppercase tracking-[0.16em] text-[color:var(--text-soft)]">
                  Updated
                </dt>
                <dd className="mt-1 text-[color:var(--text-primary)]">
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
