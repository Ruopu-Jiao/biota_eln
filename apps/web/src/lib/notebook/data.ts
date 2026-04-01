import {
  getEntryDetailForUser,
  getNotebookContextForUser,
  getProtocolDetailForUser,
  listEntriesForUser,
  listProtocolsForUser,
} from "@biota/db";
import { isDemoAuthMode } from "@/lib/auth/demo.server";
import {
  getDemoEntryDetail,
  getDemoNotebookContext,
  getDemoProtocolDetail,
  listDemoEntries,
  listDemoProtocols,
} from "@/lib/notebook/demo-store";

export async function getNotebookPageData(userId: string) {
  if (isDemoAuthMode()) {
    const [entries, protocols] = await Promise.all([
      listDemoEntries(),
      listDemoProtocols(),
    ]);

    return {
      context: getDemoNotebookContext(),
      entries,
      protocols,
    };
  }

  const [context, entries, protocols] = await Promise.all([
    getNotebookContextForUser(userId),
    listEntriesForUser(userId),
    listProtocolsForUser(userId),
  ]);

  return {
    context,
    entries,
    protocols,
  };
}

export async function getEntryDetailPageData(userId: string, entryId: string) {
  if (isDemoAuthMode()) {
    const entry = await getDemoEntryDetail(entryId);

    return {
      context: getDemoNotebookContext(),
      entry,
    };
  }

  const [context, entry] = await Promise.all([
    getNotebookContextForUser(userId),
    getEntryDetailForUser(userId, entryId),
  ]);

  return {
    context,
    entry,
  };
}

export async function getProtocolDetailPageData(
  userId: string,
  protocolId: string,
) {
  if (isDemoAuthMode()) {
    const protocol = await getDemoProtocolDetail(protocolId);

    return {
      context: getDemoNotebookContext(),
      protocol,
    };
  }

  const [context, protocol] = await Promise.all([
    getNotebookContextForUser(userId),
    getProtocolDetailForUser(userId, protocolId),
  ]);

  return {
    context,
    protocol,
  };
}
