import { notFound } from "next/navigation";
import { DnaViewer } from "@/components/entities/dna-viewer";
import { requireServerSession } from "@/lib/auth/session";
import { updateSequenceEntityDraftAction } from "@/lib/entities/actions";
import {
  getStoredSequenceEntityById,
  listStoredSequenceEntities,
} from "@/lib/entities/store";

type EntityDetailPageProps = {
  params: Promise<{
    entityId: string;
  }>;
  searchParams?: Promise<EntityDetailSearchParams>;
};

type EntityDetailSearchParams = {
  view?: string;
};

const allowedViews = new Set([
  "sequence",
  "map",
  "features",
  "primers",
  "enzymes",
  "history",
]);

export default async function EntityDetailPage({
  params,
  searchParams,
}: EntityDetailPageProps) {
  await requireServerSession();
  const [{ entityId }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams ?? Promise.resolve({} as EntityDetailSearchParams),
  ]);
  const [entity, entities] = await Promise.all([
    getStoredSequenceEntityById(entityId),
    listStoredSequenceEntities(),
  ]);

  if (!entity) {
    notFound();
  }

  return (
    <section className="space-y-4">
      <DnaViewer
        initialEntityId={entity.id}
        initialView={
          allowedViews.has(resolvedSearchParams.view ?? "")
            ? (resolvedSearchParams.view as
                | "sequence"
                | "map"
                | "features"
                | "primers"
                | "enzymes"
                | "history")
            : "sequence"
        }
        entities={entities}
        saveAction={updateSequenceEntityDraftAction}
      />
    </section>
  );
}
