import { createEntryDraftForUser } from "@biota/db";
import { redirect } from "next/navigation";
import { isDemoAuthMode } from "@/lib/auth/demo.server";
import { requireServerSession } from "@/lib/auth/session";
import { createDemoEntryDraft } from "@/lib/notebook/demo-store";

type NewEntryPageProps = {
  searchParams: Promise<{
    folderId?: string;
  }>;
};

export default async function NewEntryPage({
  searchParams,
}: NewEntryPageProps) {
  const session = await requireServerSession();
  const params = await searchParams;
  const entry = isDemoAuthMode()
    ? await createDemoEntryDraft({
        title: "Untitled entry",
        folderId: params.folderId ?? null,
      })
    : await createEntryDraftForUser({
        userId: session.user.id,
        title: "Untitled entry",
        folderId: params.folderId ?? null,
      });

  redirect(`/entries/${entry.id}`);
}
