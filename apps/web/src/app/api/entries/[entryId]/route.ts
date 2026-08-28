import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { deleteEntryForUser } from "@biota/db";
import { isDemoAuthMode } from "@/lib/auth/demo.server";
import { requireServerSession } from "@/lib/auth/session";
import { deleteDemoEntry } from "@/lib/notebook/demo-store";

type EntryRouteContext = {
  params: Promise<{
    entryId: string;
  }>;
};

function revalidateEntrySurfaces(entryId: string) {
  revalidatePath("/");
  revalidatePath("/entries");
  revalidatePath(`/entries/${entryId}`);
}

export async function DELETE(_request: Request, { params }: EntryRouteContext) {
  const session = await requireServerSession();
  const { entryId } = await params;
  const normalizedEntryId = entryId.trim();

  if (!normalizedEntryId) {
    return NextResponse.json({ error: "Missing entry id." }, { status: 400 });
  }

  const demoMode = isDemoAuthMode();
  const deletedEntry = await (async () => {
    try {
      return demoMode
        ? await deleteDemoEntry(normalizedEntryId)
        : await deleteEntryForUser({
            userId: session.user.id,
            entryId: normalizedEntryId,
          });
    } catch {
      return null;
    }
  })();

  if (!deletedEntry) {
    return NextResponse.json(
      { error: "Entry could not be deleted." },
      { status: 404 },
    );
  }

  revalidateEntrySurfaces(normalizedEntryId);

  return NextResponse.json({ ok: true, entry: deletedEntry });
}
