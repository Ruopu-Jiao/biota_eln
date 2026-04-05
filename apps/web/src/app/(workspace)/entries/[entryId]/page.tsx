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
  const detailsTabName = `entry-${entry.id}-panel`;
  const documentTabId = `${detailsTabName}-document`;
  const metadataTabId = `${detailsTabName}-metadata`;
  const protocolsTabId = `${detailsTabName}-protocols`;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--line)] pb-3 text-[11px] uppercase tracking-[0.18em] text-[color:var(--text-soft)]">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/entries"
            className="transition hover:text-[color:var(--text-primary)]"
          >
            Entries
          </Link>
          <span className="text-[color:var(--line-strong)]">/</span>
          <span className="text-[color:var(--text-primary)]">{entry.title}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="border border-[color:var(--line)] px-2 py-1">{entry.status}</span>
          <span className="border border-[color:var(--accent-soft)] bg-[color:var(--accent-muted)] px-2 py-1 text-[color:var(--text-primary)]">
            v{entry.latestVersionNumber}
          </span>
        </div>
      </div>

      <input
        id={documentTabId}
        name={detailsTabName}
        type="radio"
        defaultChecked
        className="peer/document sr-only"
      />
      <input
        id={metadataTabId}
        name={detailsTabName}
        type="radio"
        className="peer/metadata sr-only"
      />
      <input
        id={protocolsTabId}
        name={detailsTabName}
        type="radio"
        className="peer/protocols sr-only"
      />

      <div className="flex flex-wrap items-center gap-2 border-b border-[color:var(--line)] pb-3 text-[11px] uppercase tracking-[0.18em] text-[color:var(--text-soft)]">
        <label
          htmlFor={documentTabId}
          className="cursor-pointer border border-[color:var(--line)] px-3 py-2 transition hover:text-[color:var(--text-primary)] peer-checked/document:border-[color:var(--accent-soft)] peer-checked/document:bg-[color:var(--accent-muted)] peer-checked/document:text-[color:var(--text-primary)]"
        >
          Document
        </label>
        <label
          htmlFor={metadataTabId}
          className="cursor-pointer border border-[color:var(--line)] px-3 py-2 transition hover:text-[color:var(--text-primary)] peer-checked/metadata:border-[color:var(--accent-soft)] peer-checked/metadata:bg-[color:var(--accent-muted)] peer-checked/metadata:text-[color:var(--text-primary)]"
        >
          Metadata
        </label>
        <label
          htmlFor={protocolsTabId}
          className="cursor-pointer border border-[color:var(--line)] px-3 py-2 transition hover:text-[color:var(--text-primary)] peer-checked/protocols:border-[color:var(--accent-soft)] peer-checked/protocols:bg-[color:var(--accent-muted)] peer-checked/protocols:text-[color:var(--text-primary)]"
        >
          Protocols
        </label>
      </div>

      <section className="hidden peer-checked/document:block">
        <article className="min-h-[calc(100vh-13rem)] border-x border-[color:var(--line)] px-6 py-6 lg:px-10 lg:py-8">
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
      </section>

      <section className="hidden border-x border-[color:var(--line)] px-6 py-6 peer-checked/metadata:block lg:px-10 lg:py-8">
        <div className="max-w-2xl space-y-6">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[color:var(--text-soft)]">
              Entry metadata
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[color:var(--text-primary)]">
              {entry.title}
            </h2>
          </div>

          <dl className="grid gap-5 text-sm text-[color:var(--text-muted)] sm:grid-cols-2">
            <div>
              <dt className="font-mono text-[11px] uppercase tracking-[0.16em] text-[color:var(--text-soft)]">
                Repository
              </dt>
              <dd className="mt-2 text-[color:var(--text-primary)]">{entry.repositoryName}</dd>
            </div>
            <div>
              <dt className="font-mono text-[11px] uppercase tracking-[0.16em] text-[color:var(--text-soft)]">
                Folder
              </dt>
              <dd className="mt-2 text-[color:var(--text-primary)]">{entry.folderName ?? "Unfiled"}</dd>
            </div>
            <div>
              <dt className="font-mono text-[11px] uppercase tracking-[0.16em] text-[color:var(--text-soft)]">
                Author
              </dt>
              <dd className="mt-2 text-[color:var(--text-primary)]">{entry.createdByName ?? "Unknown author"}</dd>
            </div>
            <div>
              <dt className="font-mono text-[11px] uppercase tracking-[0.16em] text-[color:var(--text-soft)]">
                Updated
              </dt>
              <dd className="mt-2 text-[color:var(--text-primary)]">{entryDetailDateFormatter.format(entry.updatedAt)}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="hidden border-x border-[color:var(--line)] px-6 py-6 peer-checked/protocols:block lg:px-10 lg:py-8">
        <div className="max-w-3xl space-y-5">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[color:var(--text-soft)]">
              Linked protocols
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[color:var(--text-primary)]">
              Reusable methods attached to this entry
            </h2>
          </div>

          {entry.linkedProtocols.length ? (
            <div className="divide-y divide-[color:var(--line)] border-y border-[color:var(--line)]">
              {entry.linkedProtocols.map((protocol) => (
                <Link
                  key={protocol.id}
                  href={`/protocols/${protocol.id}`}
                  className="block py-4 text-sm transition hover:text-[color:var(--text-primary)]"
                >
                  <span className="block font-medium text-[color:var(--text-primary)]">{protocol.title}</span>
                  <span className="mt-1 block font-mono text-[11px] uppercase tracking-[0.16em] text-[color:var(--text-soft)]">
                    {protocol.status}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="space-y-3 text-sm leading-7 text-[color:var(--text-muted)]">
              <p>No protocol blocks are linked yet.</p>
              <p>
                Insert a protocol block from the document toolbar to connect this page to a reusable method.
              </p>
              <Link
                href="/protocols"
                className="inline-flex items-center border border-[color:var(--line)] px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-[color:var(--accent-strong)] transition hover:border-[color:var(--accent-soft)] hover:text-[color:var(--text-primary)]"
              >
                Open protocol library
              </Link>
            </div>
          )}
        </div>
      </section>
    </section>
  );
}
