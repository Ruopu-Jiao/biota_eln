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
  return blocks.map((block) =>
    block.type === "text"
      ? {
          id: block.id,
          type: "text",
          content: block.text,
        }
      : {
          id: block.id,
          type: "protocol",
          protocolId: block.protocolId,
        },
  );
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
  const textBlocks = entry.blocks.filter((block) => block.type === "text");

  return (
    <section className="space-y-8">
      <header className="border-b border-white/10 pb-6">
        <Link
          href="/entries"
          className="text-[11px] uppercase tracking-[0.28em] text-slate-500 transition hover:text-slate-300"
        >
          Entries
        </Link>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-emerald-200/75">
              Entry editor
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">
              {entry.title}
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
              Save structured notebook versions with ordered text and protocol
              blocks. Each submit writes a new entry version on top of the
              existing draft.
            </p>
          </div>
          <div className="text-right text-xs uppercase tracking-[0.22em] text-slate-500">
            <p>{entry.status}</p>
            <p className="mt-2">v{entry.latestVersionNumber}</p>
          </div>
        </div>
      </header>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1.7fr)_minmax(280px,0.7fr)]">
        <article className="border-t border-white/10 pt-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-slate-500">
                Structured canvas
              </p>
              <h2 className="mt-2 text-lg font-semibold text-white">
                Blocks and protocol insertions
              </h2>
            </div>
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
              {entry.blocks.length} blocks
            </p>
          </div>

          <EntryEditor
            entryId={entry.id}
            initialTitle={entry.title}
            initialSummary={entry.summary ?? ""}
            initialBlocks={toEditorBlocks(entry.blocks)}
            protocolOptions={protocolOptions}
            formAction={updateEntryDraftAction}
            submitLabel="Save entry version"
            pendingLabel="Saving version..."
            className="space-y-0"
          />
        </article>

        <aside className="space-y-8 border-l border-white/10 pl-6">
          <section className="border-b border-white/10 pb-5">
            <p className="text-xs uppercase tracking-[0.28em] text-slate-500">
              Record metadata
            </p>
            <dl className="mt-4 space-y-4 text-sm text-slate-300">
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
          </section>

          <section className="border-b border-white/10 pb-5">
            <p className="text-xs uppercase tracking-[0.28em] text-slate-500">
              Block summary
            </p>
            <div className="mt-4 divide-y divide-white/8 border-y border-white/8">
              <div className="flex items-center justify-between gap-3 py-3 text-sm">
                <span className="text-slate-400">Text blocks</span>
                <span className="text-white">{textBlocks.length}</span>
              </div>
              <div className="flex items-center justify-between gap-3 py-3 text-sm">
                <span className="text-slate-400">Protocol blocks</span>
                <span className="text-white">{protocolBlocks.length}</span>
              </div>
              <div className="flex items-center justify-between gap-3 py-3 text-sm">
                <span className="text-slate-400">Latest version</span>
                <span className="text-white">v{entry.latestVersionNumber}</span>
              </div>
            </div>
          </section>

          <section className="border-b border-white/10 pb-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs uppercase tracking-[0.28em] text-slate-500">
                Linked protocols
              </p>
              <Link
                href="/protocols"
                className="text-[11px] uppercase tracking-[0.22em] text-emerald-200 transition hover:text-emerald-100"
              >
                Open library
              </Link>
            </div>
            {entry.linkedProtocols.length ? (
              <div className="mt-4 divide-y divide-white/8 border-y border-white/8">
                {entry.linkedProtocols.map((protocol) => (
                  <Link
                    key={protocol.id}
                    href={`/protocols/${protocol.id}`}
                    className="block py-3 text-sm transition hover:text-white"
                  >
                    <span className="block font-medium text-white">
                      {protocol.title}
                    </span>
                    <span className="mt-1 block text-[11px] uppercase tracking-[0.22em] text-slate-500">
                      {protocol.status}
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm leading-6 text-slate-400">
                No protocol blocks are linked yet. Insert one from the editor
                canvas to make this entry modular.
              </p>
            )}
          </section>
        </aside>
      </div>
    </section>
  );
}
