import Link from "next/link";
import { requireServerSession } from "@/lib/auth/session";
import { getSequenceEntityStats } from "@/lib/entities/catalog";
import { listStoredSequenceEntities } from "@/lib/entities/store";
import { getNotebookPageData } from "@/lib/notebook/data";

const entryDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

type ProjectRecord =
  | {
      id: string;
      kind: "Entry";
      href: string;
      title: string;
      summary: string | null;
      meta: string[];
      timestamp: string;
      linkedLabels: string[];
    }
  | {
      id: string;
      kind: "Entity";
      href: string;
      title: string;
      summary: string;
      meta: string[];
      timestamp: string;
      linkedLabels: string[];
    }
  | {
      id: string;
      kind: "Protocol";
      href: string;
      title: string;
      summary: string;
      meta: string[];
      timestamp: string;
      linkedLabels: string[];
    };

export default async function StatsPage() {
  const session = await requireServerSession();
  const { context, entries, protocols } = await getNotebookPageData(session.user.id);
  const sequenceEntities = await listStoredSequenceEntities();
  const entitiesById = new Map(sequenceEntities.map((entity) => [entity.id, entity]));
  const linkedEntryCount = entries.filter(
    (entry) => entry.linkedProtocols.length > 0 || entry.linkedEntityIds.length > 0,
  ).length;

  const projectRecords: ProjectRecord[] = [
    ...entries.map((entry) => ({
      id: entry.id,
      kind: "Entry" as const,
      href: `/entries/${entry.id}`,
      title: entry.title,
      summary: entry.summary,
      meta: [entry.status, `v${entry.latestVersionNumber}`, entry.folderName ?? "Root"],
      timestamp: entryDateFormatter.format(entry.updatedAt),
      linkedLabels: [
        ...entry.linkedEntityIds
          .map((entityId) => entitiesById.get(entityId)?.name)
          .filter((value): value is string => Boolean(value)),
        ...entry.linkedProtocols.map((protocol) => protocol.title),
      ],
    })),
    ...sequenceEntities.map((entity) => {
      const stats = getSequenceEntityStats(entity);

      return {
        id: entity.id,
        kind: "Entity" as const,
        href: `/entities/${entity.id}`,
        title: entity.name,
        summary: entity.description,
        meta: [
          entity.entityType === "sgrna" ? "sgRNA" : entity.entityType,
          entity.topology,
          `${stats.length.toLocaleString()} bp`,
          `GC ${stats.gc}`,
        ],
        timestamp: entity.purpose,
        linkedLabels: entity.aliases,
      };
    }),
    ...protocols.map((protocol) => ({
      id: protocol.id,
      kind: "Protocol" as const,
      href: `/protocols/${protocol.id}`,
      title: protocol.title,
      summary: protocol.summary ?? "No summary yet.",
      meta: [protocol.status, `v${protocol.latestVersionNumber}`, protocol.folderName ?? "Root"],
      timestamp: entryDateFormatter.format(protocol.updatedAt),
      linkedLabels: [protocol.repositoryName, protocol.createdByName ?? "Unknown author"],
    })),
  ];

  return (
    <section className="space-y-8">
      <header className="border-b border-[color:var(--line)] pb-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[color:var(--accent-strong)]">
          Stats
        </p>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl font-semibold tracking-[-0.05em] text-[color:var(--text-primary)]">
              Workspace pulse
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[color:var(--text-muted)]">
              Cross-record activity lives here now: entries, sequence-backed
              entities, and protocols in one overview without turning the main
              notebook tab into a dashboard.
            </p>
          </div>
          <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-[color:var(--text-soft)]">
            {context
              ? `${context.workspace.name} / ${context.repository.name}`
              : "No workspace"}
          </div>
        </div>
      </header>

      <div className="grid gap-4 border-y border-[color:var(--line)] py-4 text-sm md:grid-cols-4">
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
            Entities
          </p>
          <p className="mt-2 text-2xl font-semibold text-[color:var(--text-primary)]">
            {sequenceEntities.length}
          </p>
        </div>
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
            Linked entries
          </p>
          <p className="mt-2 text-2xl font-semibold text-[color:var(--text-primary)]">
            {linkedEntryCount}
          </p>
        </div>
      </div>

      <section className="space-y-5 border-t border-[color:var(--line)] pt-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[color:var(--text-soft)]">
              Record stream
            </p>
            <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-[color:var(--text-primary)]">
              Entries, entities, and methods at a glance
            </h2>
          </div>
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[color:var(--text-soft)]">
            {projectRecords.length} total
          </p>
        </div>

        <div className="divide-y divide-[color:var(--line)] border-y border-[color:var(--line)]">
          {projectRecords.map((record) => (
            <article key={`${record.kind}-${record.id}`} className="space-y-3 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="border border-[color:var(--line)] px-2 py-1 font-mono text-[11px] uppercase tracking-[0.14em] text-[color:var(--text-soft)]">
                      {record.kind}
                    </span>
                    <Link
                      href={record.href}
                      className="text-lg font-semibold tracking-[-0.02em] text-[color:var(--text-primary)] transition hover:text-[color:var(--accent-strong)]"
                    >
                      {record.title}
                    </Link>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] uppercase tracking-[0.16em] text-[color:var(--text-soft)]">
                    {record.meta.map((item) => (
                      <span key={`${record.id}-${item}`}>{item}</span>
                    ))}
                  </div>
                </div>
                <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[color:var(--text-soft)]">
                  {record.timestamp}
                </p>
              </div>

              <p className="max-w-3xl text-sm leading-7 text-[color:var(--text-muted)]">
                {record.summary || "Blank page so far."}
              </p>

              <div className="flex flex-wrap items-center gap-2">
                {record.linkedLabels.length ? (
                  record.linkedLabels.map((label) => (
                    <span
                      key={`${record.id}-${label}`}
                      className="inline-flex items-center border border-[color:var(--line)] px-2.5 py-1 text-[11px] uppercase tracking-[0.16em] text-[color:var(--text-muted)]"
                    >
                      {label}
                    </span>
                  ))
                ) : (
                  <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-[color:var(--text-soft)]">
                    No linked records yet
                  </span>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}
