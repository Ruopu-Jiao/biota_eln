import Link from "next/link";
import { redirect } from "next/navigation";
import { listStoredSequenceEntities } from "@/lib/entities/store";

type EntitiesPageProps = {
  searchParams: Promise<{
    entity?: string;
  }>;
};

export default async function EntitiesPage({ searchParams }: EntitiesPageProps) {
  const { entity } = await searchParams;
  const entities = await listStoredSequenceEntities();

  if (entity) {
    redirect(`/entities/${encodeURIComponent(entity)}`);
  }

  if (entities.length > 0) {
    redirect(`/entities/${entities[0].id}`);
  }

  return (
    <section className="space-y-6">
      <header className="border-b border-[color:var(--line)] pb-5">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[color:var(--accent-strong)]">
          Entities
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[color:var(--text-primary)]">
          No sequence entities yet
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-[color:var(--text-muted)]">
          Create an entity from the navigator plus menu to open a sequence-first
          DNA workspace.
        </p>
      </header>

      <Link
        href="/entities/new"
        className="inline-flex min-h-10 items-center justify-center border border-[color:var(--line)] px-4 text-sm text-[color:var(--text-muted)] transition hover:border-[color:var(--line-strong)] hover:text-[color:var(--text-primary)]"
      >
        Create new entity
      </Link>
    </section>
  );
}
