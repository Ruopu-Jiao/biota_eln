import { getNotebookContextForUser } from "@biota/db";
import { redirect } from "next/navigation";
import { isDemoAuthMode } from "@/lib/auth/demo.server";
import { requireServerSession } from "@/lib/auth/session";
import { getDemoNotebookContext } from "@/lib/notebook/demo-store";
import { createSequenceEntityDraft } from "@/lib/entities/store";

type NewEntityPageProps = {
  searchParams: Promise<{
    folderId?: string;
    folderName?: string;
  }>;
};

export default async function NewEntityPage({
  searchParams,
}: NewEntityPageProps) {
  const session = await requireServerSession();
  const params = await searchParams;
  const context = isDemoAuthMode()
    ? getDemoNotebookContext()
    : await getNotebookContextForUser(session.user.id);

  const entity = await createSequenceEntityDraft({
    repositoryId: context?.repository.id ?? null,
    repositoryName: context?.repository.name ?? "Main notebook",
    folderId: params.folderId ?? context?.rootFolder?.id ?? null,
    folderName: params.folderName ?? context?.rootFolder?.name ?? "Root",
  });

  redirect(`/entities/${encodeURIComponent(entity.id)}`);
}
