import Link from "next/link";
import {
  formatEntryIdentifier,
  getEntryDetailForUser,
  getWorkspaceSnapshotForUser,
  listProtocolsForUser,
  type EntryBlock,
} from "@biota/db";
import { notFound } from "next/navigation";
import { EntryEditor, type EntryEditorBlock } from "@/components/notebook/editor";
import type { ProtocolOption } from "@/components/notebook/editor";
import { listStoredSequenceEntityOptions } from "@/lib/entities/store";
import {
  getDemoWorkspaceSnapshot,
  isDemoAuthMode,
} from "@/lib/auth/demo.server";
import { requireServerSession } from "@/lib/auth/session";
import { WorkspaceActions } from "@/components/workspace-actions";
import {
  getDemoEntryDetail,
  listDemoProtocols,
} from "@/lib/notebook/demo-store";

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
        name: block.name,
        columns: block.columns,
        rows: block.rows,
      };
    }

    if (block.type === "entity") {
      return {
        id: block.id,
        type: "entity",
        entityId: block.entityId,
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
  const demoMode = isDemoAuthMode();
  const [entry, protocols, workspaceSnapshot] = demoMode
    ? await Promise.all([
        getDemoEntryDetail(entryId),
        listDemoProtocols(),
        Promise.resolve(getDemoWorkspaceSnapshot()),
      ])
    : await Promise.all([
        getEntryDetailForUser(session.user.id, entryId),
        listProtocolsForUser(session.user.id),
        getWorkspaceSnapshotForUser(session.user.id),
      ]);

  if (!entry) {
    notFound();
  }

  const protocolOptions = toProtocolOptions(protocols);
  const entityOptions = await listStoredSequenceEntityOptions();
  const linkedEntities = entry.linkedEntityIds
    .map((entityId) =>
      entityOptions.find((entity) => entity.id === entityId),
    )
    .filter((entity): entity is (typeof entityOptions)[number] => Boolean(entity));
  const detailsTabName = `entry-${entry.id}-panel`;
  const documentTabId = `${detailsTabName}-document`;
  const metadataTabId = `${detailsTabName}-metadata`;
  const protocolsTabId = `${detailsTabName}-protocols`;
  const entryIdentifier = formatEntryIdentifier(entry.id);
  const workspaceLabel =
    workspaceSnapshot?.personalWorkspace?.name ?? "Personal workspace";

  return (
    <section className="space-y-1">
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
      <style>
        {`
          input[id="${documentTabId}"]:checked ~ .entry-detail-tab-strip label[for="${documentTabId}"],
          input[id="${metadataTabId}"]:checked ~ .entry-detail-tab-strip label[for="${metadataTabId}"],
          input[id="${protocolsTabId}"]:checked ~ .entry-detail-tab-strip label[for="${protocolsTabId}"] {
            border-bottom-color: var(--text-primary);
            color: var(--text-primary);
            font-weight: 600;
          }
        `}
      </style>

      <div className="entry-detail-tab-strip flex h-7 min-w-0 flex-nowrap items-end gap-6 overflow-hidden border-x border-y border-[color:var(--line)] bg-[color:var(--document-surface)] px-6 text-sm text-[color:var(--text-muted)] lg:px-10">
        <label
          htmlFor={documentTabId}
          className="-mb-px inline-flex h-7 shrink-0 cursor-pointer items-center border-b-2 border-transparent px-0 transition hover:text-[color:var(--text-primary)]"
        >
          Document
        </label>
        <label
          htmlFor={metadataTabId}
          className="-mb-px inline-flex h-7 shrink-0 cursor-pointer items-center border-b-2 border-transparent px-0 transition hover:text-[color:var(--text-primary)]"
        >
          Metadata
        </label>
        <label
          htmlFor={protocolsTabId}
          className="-mb-px inline-flex h-7 shrink-0 cursor-pointer items-center border-b-2 border-transparent px-0 transition hover:text-[color:var(--text-primary)]"
        >
          Protocols
        </label>
        <WorkspaceActions workspaceLabel={workspaceLabel} />
      </div>

      <section className="hidden peer-checked/document:block">
        <article className="min-h-[calc(100vh-8rem)] border-x border-[color:var(--line)] bg-[color:var(--document-surface)] px-6 py-4 lg:px-10 lg:py-5">
          <EntryEditor
            entryId={entry.id}
            initialTitle={entry.title}
            initialBlocks={toEditorBlocks(entry.blocks)}
            protocolOptions={protocolOptions}
            entityOptions={entityOptions}
            autosaveUrl={`/api/entries/${entry.id}/autosave`}
            className="space-y-0"
          />
        </article>
      </section>

      <section className="hidden min-h-[calc(100vh-8rem)] border-x border-[color:var(--line)] bg-[color:var(--document-surface)] px-6 py-4 peer-checked/metadata:block lg:px-10 lg:py-5">
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
                Entry ID
              </dt>
              <dd className="mt-2 font-mono text-xs text-[color:var(--accent-strong)]">
                {entryIdentifier}
              </dd>
            </div>
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

          {linkedEntities.length ? (
            <div className="border-t border-[color:var(--line)] pt-5">
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[color:var(--text-soft)]">
                Linked entities
              </p>
              <div className="mt-3 divide-y divide-[color:var(--line)] border-y border-[color:var(--line)]">
                {linkedEntities.map((entity) => (
                  <Link
                    key={entity.id}
                    href={`/entities/${entity.id}`}
                    className="flex flex-wrap items-center justify-between gap-3 px-0 py-3 text-sm transition hover:text-[color:var(--text-primary)]"
                  >
                    <span className="font-medium text-[color:var(--text-primary)]">
                      {entity.title}
                    </span>
                    <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-[color:var(--text-soft)]">
                      {entity.typeLabel} / {entity.sequenceLength.toLocaleString()} bp
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <section className="hidden min-h-[calc(100vh-8rem)] border-x border-[color:var(--line)] bg-[color:var(--document-surface)] px-6 py-4 peer-checked/protocols:block lg:px-10 lg:py-5">
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
