import Link from "next/link";
import { redirect } from "next/navigation";
import type { NotebookNavigatorFolder, NotebookNavigatorRecord } from "@biota/db";
import { requireServerSession } from "@/lib/auth/session";
import { getWorkspaceNavigatorData } from "@/lib/notebook/data";

const secondaryButtonStyles =
  "inline-flex min-h-10 items-center justify-center border border-[color:var(--line)] px-3 text-sm text-[color:var(--text-muted)] transition hover:border-[color:var(--line-strong)] hover:text-[color:var(--text-primary)]";

function findFirstRecordHref(
  folders: NotebookNavigatorFolder[],
  unfiledRecords: NotebookNavigatorRecord[],
): string | null {
  for (const folder of folders) {
    const directRecord = folder.records[0];

    if (directRecord) {
      return directRecord.href;
    }

    const nestedRecord = findFirstRecordHref(folder.childFolders, []);

    if (nestedRecord) {
      return nestedRecord;
    }
  }

  return unfiledRecords[0]?.href ?? null;
}

export default async function EntriesPage() {
  const session = await requireServerSession();
  const navigator = await getWorkspaceNavigatorData(session.user.id);
  const firstRecordHref = navigator
    ? findFirstRecordHref(navigator.folders, navigator.unfiledRecords)
    : null;

  if (firstRecordHref) {
    redirect(firstRecordHref);
  }

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[color:var(--line)] pb-5">
        <div className="space-y-2">
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[color:var(--accent-strong)]">
            Projects
          </p>
          <h1 className="text-3xl font-semibold tracking-[-0.05em] text-[color:var(--text-primary)]">
            No project records yet
          </h1>
          <p className="max-w-2xl text-sm leading-7 text-[color:var(--text-muted)]">
            The Projects rail now opens directly into the first available
            record. If the workspace is empty, use the navigator plus menu to
            add a new entry or sequence entity.
          </p>
        </div>
      </header>

      <div className="grid gap-3 border-y border-[color:var(--line)] py-5 md:max-w-xl">
        <Link href="/entities" className={secondaryButtonStyles}>
          Browse sequence entities
        </Link>
        <Link href="/stats" className={secondaryButtonStyles}>
          Open workspace stats
        </Link>
      </div>
    </section>
  );
}
