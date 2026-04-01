import Link from "next/link";
import {
  getEntryDetailForUser,
  listProtocolsForUser,
  type EntryBlock,
} from "@biota/db";
import { notFound } from "next/navigation";
import { EntryEditor, type EntryEditorBlock } from "@/components/notebook/editor";
import type { ProtocolOption } from "@/components/notebook/editor";
import { isDemoAuthMode } from "@/lib/auth/demo.server";
import { requireServerSession } from "@/lib/auth/session";
import {
  getDemoEntryDetail,
  listDemoProtocols,
} from "@/lib/notebook/demo-store";
import { updateEntryDraftAction } from "@/lib/notebook/actions";

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

function toEditorBlocks(blocks: EntryBlock[]): EntryEditorBlock[] {
  return blocks.map((block) => {
    if (block.type === "text") {
      return {
        id: block.id,
        type: "text",
        content: block.text,
      };
    }

    if (block.type === "table") {
      return {
        id: block.id,
        type: "table",
        columns: block.columns,
        rows: block.rows,
      };
    }

    return {
      id: block.id,
      type: "protocol",
      protocolId: block.protocolId,
    };
  });
}

function toProtocolOptions(
  protocols: Awaited<ReturnType<typeof listProtocolsForUser>>,
): ProtocolOption[] {
  return protocols.map((protocol) => ({
    id: protocol.id,
    title: protocol.title,
    slug: protocol.slug,
    summary: protocol.summary,
    status: protocol.status,
  }));
}

export default async function EntryDetailPage({
  params,
}: EntryDetailPageProps) {
  const session = await requireServerSession();
  const { entryId } = await params;
  const [entry, protocols] = isDemoAuthMode()
    ? await Promise.all([getDemoEntryDetail(entryId), listDemoProtocols()])
    : await Promise.all([
        getEntryDetailForUser(session.user.id, entryId),
        listProtocolsForUser(session.user.id),
      ]);

  if (!entry) {
    notFound();
  }

  const protocolOptions = toProtocolOptions(protocols);
  const protocolBlocks = entry.blocks.filter((block) => block.type === "protocol");
  const markdownBlocks = entry.blocks.filter((block) => block.type === "text");
  const tableBlocks = entry.blocks.filter((block) => block.type === "table");

  return (
    <section className="space-y-8">
      <header className="border-b border-[color:var(--line)] pb-6">
        <Link
          href="/entries"
          className="font-mono text-[11px] uppercase tracking-[0.22em] text-[color:var(--text-soft)] transition hover:text-[color:var(--text-primary)]"
        >
          Entries
        </Link>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[color:var(--accent-strong)]">
              Entry editor
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-[color:var(--text-primary)]">
              Page workspace
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[color:var(--text-muted)]">
              This editor now treats the entry like a notebook page instead of a
              draft form. Use markdown blocks for narrative, insert protocols as
              reusable method references, and build simple data tables inline.
            </p>
          </div>
          <div className="text-right">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[color:var(--text-soft)]">
              {entry.status}
            </p>
            <p className="mt-2 text-lg font-semibold text-[color:var(--text-primary)]">
              v{entry.latestVersionNumber}
            </p>
          </div>
        </div>
      </header>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1.75fr)_minmax(280px,0.72fr)]">
        <article className="border-t border-[color:var(--line)] pt-4">
          <EntryEditor
            entryId={entry.id}
            initialTitle={entry.title}
            initialBlocks={toEditorBlocks(entry.blocks)}
            protocolOptions={protocolOptions}
            formAction={updateEntryDraftAction}
            submitLabel="Save entry version"
            pendingLabel="Saving version..."
            className="space-y-0"
          />
        </article>

        <aside className="space-y-8 border-l border-[color:var(--line)] pl-6">
          <section className="border-b border-[color:var(--line)] pb-5">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[color:var(--text-soft)]">
              Record metadata
            </p>
            <dl className="mt-4 space-y-4 text-sm text-[color:var(--text-muted)]">
              <div>
                <dt className="font-mono text-[11px] uppercase tracking-[0.16em] text-[color:var(--text-soft)]">
                  Repository
                </dt>
                <dd className="mt-1 text-[color:var(--text-primary)]">
                  {entry.repositoryName}
                </dd>
              </div>
              <div>
                <dt className="font-mono text-[11px] uppercase tracking-[0.16em] text-[color:var(--text-soft)]">
                  Folder
                </dt>
                <dd className="mt-1 text-[color:var(--text-primary)]">
                  {entry.folderName ?? "Unfiled"}
                </dd>
              </div>
              <div>
                <dt className="font-mono text-[11px] uppercase tracking-[0.16em] text-[color:var(--text-soft)]">
                  Author
                </dt>
                <dd className="mt-1 text-[color:var(--text-primary)]">
                  {entry.createdByName ?? "Unknown author"}
                </dd>
              </div>
              <div>
                <dt className="font-mono text-[11px] uppercase tracking-[0.16em] text-[color:var(--text-soft)]">
                  Updated
                </dt>
                <dd className="mt-1 text-[color:var(--text-primary)]">
                  {entryDetailDateFormatter.format(entry.updatedAt)}
                </dd>
              </div>
            </dl>
          </section>

          <section className="border-b border-[color:var(--line)] pb-5">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[color:var(--text-soft)]">
              Block summary
            </p>
            <div className="mt-4 divide-y divide-[color:var(--line)] border-y border-[color:var(--line)]">
              <div className="flex items-center justify-between gap-3 py-3 text-sm">
                <span className="text-[color:var(--text-muted)]">Markdown blocks</span>
                <span className="text-[color:var(--text-primary)]">
                  {markdownBlocks.length}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 py-3 text-sm">
                <span className="text-[color:var(--text-muted)]">Table blocks</span>
                <span className="text-[color:var(--text-primary)]">
                  {tableBlocks.length}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 py-3 text-sm">
                <span className="text-[color:var(--text-muted)]">Protocol blocks</span>
                <span className="text-[color:var(--text-primary)]">
                  {protocolBlocks.length}
                </span>
              </div>
            </div>
          </section>

          <section className="border-b border-[color:var(--line)] pb-5">
            <div className="flex items-center justify-between gap-3">
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[color:var(--text-soft)]">
                Linked protocols
              </p>
              <Link
                href="/protocols"
                className="font-mono text-[11px] uppercase tracking-[0.16em] text-[color:var(--accent-strong)] transition hover:text-[color:var(--text-primary)]"
              >
                Open library
              </Link>
            </div>
            {entry.linkedProtocols.length ? (
              <div className="mt-4 divide-y divide-[color:var(--line)] border-y border-[color:var(--line)]">
                {entry.linkedProtocols.map((protocol) => (
                  <Link
                    key={protocol.id}
                    href={`/protocols/${protocol.id}`}
                    className="block py-3 text-sm transition hover:text-[color:var(--text-primary)]"
                  >
                    <span className="block font-medium text-[color:var(--text-primary)]">
                      {protocol.title}
                    </span>
                    <span className="mt-1 block font-mono text-[11px] uppercase tracking-[0.16em] text-[color:var(--text-soft)]">
                      {protocol.status}
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm leading-7 text-[color:var(--text-muted)]">
                No protocol blocks are linked yet. Insert one from the editor to
                turn this notebook page into a reusable experimental record.
              </p>
            )}
          </section>
        </aside>
      </div>
    </section>
  );
}
