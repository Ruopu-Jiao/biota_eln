import {
  Prisma,
  PrismaClient,
  type Organization,
  type Repository,
} from "@prisma/client";

type DbClient = PrismaClient | Prisma.TransactionClient;

type GlobalPrisma = typeof globalThis & {
  prisma?: PrismaClient;
};

const globalForPrisma = globalThis as GlobalPrisma;

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export interface PersonalWorkspaceBootstrapInput {
  userId: string;
  userName?: string | null;
  workspaceName?: string;
  repositoryName?: string;
}

export interface OrganizationWorkspaceInput {
  ownerUserId: string;
  name: string;
  slug?: string;
  repositoryName?: string;
  repositorySlug?: string;
}

export interface WorkspaceBootstrapResult {
  organization: Organization;
  repository: Repository;
}

export interface NotebookContext {
  workspace: {
    id: string;
    name: string;
    slug: string;
  };
  repository: {
    id: string;
    name: string;
    slug: string;
  };
  rootFolder: {
    id: string;
    name: string;
    slug: string;
  } | null;
}

export interface EntryListItem {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  status: string;
  repositoryName: string;
  folderName: string | null;
  latestVersionNumber: number;
  updatedAt: Date;
  createdByName: string | null;
  linkedProtocols: Array<{
    id: string;
    title: string;
    slug: string;
    status: string;
  }>;
}

export interface EntryTextBlock {
  id: string;
  type: "text";
  text: string;
}

export interface EntryProtocolBlock {
  id: string;
  type: "protocol";
  protocolId: string;
  label?: string;
}

export type EntryBlock = EntryTextBlock | EntryProtocolBlock;

export interface EntryDetail extends EntryListItem {
  bodyText: string | null;
  blocks: EntryBlock[];
}

export interface ProtocolListItem {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  status: string;
  repositoryName: string;
  folderName: string | null;
  latestVersionNumber: number;
  updatedAt: Date;
  createdByName: string | null;
}

export interface ProtocolDetail extends ProtocolListItem {
  bodyText: string | null;
}

export interface CreateEntryDraftInput {
  userId: string;
  title: string;
  summary?: string;
  bodyText?: string;
  linkedProtocolIds?: string[];
}

export interface UpdateEntryDraftInput {
  userId: string;
  entryId: string;
  title: string;
  summary?: string;
  blocks: EntryBlock[];
}

export interface CreateProtocolDraftInput {
  userId: string;
  title: string;
  summary?: string;
  bodyText?: string;
}

export interface RegistrationBootstrapInput {
  firstName: string;
  lastName: string;
  email: string;
  passwordHash: string;
  workspaceName: string;
}

function compactSlug(value: string) {
  const base = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return base || "workspace";
}

function preferredSlug(value: string, fallback: string) {
  return compactSlug(value || fallback);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeEntryTextBlock(block: unknown): EntryTextBlock | null {
  if (!isRecord(block) || block.type !== "text" || typeof block.id !== "string") {
    return null;
  }

  return {
    id: block.id,
    type: "text",
    text: typeof block.text === "string" ? block.text : "",
  };
}

function normalizeEntryProtocolBlock(
  block: unknown,
  allowedProtocolIds?: Set<string>,
): EntryProtocolBlock | null {
  if (
    !isRecord(block) ||
    block.type !== "protocol" ||
    typeof block.id !== "string" ||
    typeof block.protocolId !== "string"
  ) {
    return null;
  }

  if (allowedProtocolIds && !allowedProtocolIds.has(block.protocolId)) {
    return null;
  }

  return {
    id: block.id,
    type: "protocol",
    protocolId: block.protocolId,
    label: typeof block.label === "string" ? block.label : undefined,
  };
}

function normalizeEntryBlocks(
  blocks: unknown,
  allowedProtocolIds?: Set<string>,
): EntryBlock[] {
  if (!Array.isArray(blocks)) {
    return [];
  }

  const normalized = blocks
    .map((block) => {
      if (isRecord(block) && block.type === "text") {
        return normalizeEntryTextBlock(block);
      }

      if (isRecord(block) && block.type === "protocol") {
        return normalizeEntryProtocolBlock(block, allowedProtocolIds);
      }

      return null;
    })
    .filter((block): block is EntryBlock => Boolean(block))
    .map((block) =>
      block.type === "text"
        ? {
            ...block,
            text: block.text.trim(),
          }
        : block,
    )
    .filter((block) => block.type !== "text" || block.text.length > 0);

  if (!normalized.length) {
    return [
      {
        id: "text-initial",
        type: "text",
        text: "",
      },
    ];
  }

  return normalized;
}

async function uniqueOrganizationSlug(client: DbClient, preferred: string) {
  let suffix = 0;
  let candidate = preferred;

  while (true) {
    const existing = await client.organization.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });

    if (!existing) {
      return candidate;
    }

    suffix += 1;
    candidate = `${preferred}-${suffix}`;
  }
}

async function uniqueRepositorySlug(
  client: DbClient,
  organizationId: string,
  preferred: string
) {
  let suffix = 0;
  let candidate = preferred;

  while (true) {
    const existing = await client.repository.findUnique({
      where: {
        organizationId_slug: {
          organizationId,
          slug: candidate,
        },
      },
      select: { id: true },
    });

    if (!existing) {
      return candidate;
    }

    suffix += 1;
    candidate = `${preferred}-${suffix}`;
  }
}

async function uniqueEntrySlug(
  client: DbClient,
  repositoryId: string,
  preferred: string
) {
  let suffix = 0;
  let candidate = preferred;

  while (true) {
    const existing = await client.entry.findUnique({
      where: {
        repositoryId_slug: {
          repositoryId,
          slug: candidate,
        },
      },
      select: { id: true },
    });

    if (!existing) {
      return candidate;
    }

    suffix += 1;
    candidate = `${preferred}-${suffix}`;
  }
}

async function uniqueProtocolSlug(
  client: DbClient,
  repositoryId: string,
  preferred: string
) {
  let suffix = 0;
  let candidate = preferred;

  while (true) {
    const existing = await client.protocol.findUnique({
      where: {
        repositoryId_slug: {
          repositoryId,
          slug: candidate,
        },
      },
      select: { id: true },
    });

    if (!existing) {
      return candidate;
    }

    suffix += 1;
    candidate = `${preferred}-${suffix}`;
  }
}

function getDefaultPersonalWorkspaceName(userName: string | null | undefined) {
  const trimmed = userName?.trim();
  return trimmed ? `${trimmed}'s workspace` : "Personal workspace";
}

async function createDefaultRepository(
  client: DbClient,
  organizationId: string,
  repositoryName: string,
  repositorySlugHint?: string
) {
  const slug = await uniqueRepositorySlug(
    client,
    organizationId,
    repositorySlugHint ?? preferredSlug(repositoryName, "main")
  );

  const repository = await client.repository.create({
    data: {
      organizationId,
      name: repositoryName,
      slug,
      visibility: "PRIVATE",
      isDefault: true,
    },
  });

  await client.folder.create({
    data: {
      repositoryId: repository.id,
      name: "Root",
      slug: "root",
    },
  });

  return repository;
}

export async function findUserForCredentials(email: string) {
  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    include: {
      passwordCredential: true,
      personalWorkspace: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
      organizationMembers: {
        where: { status: "ACTIVE" },
        include: {
          organization: {
            select: {
              id: true,
              name: true,
              slug: true,
              kind: true,
            },
          },
        },
        orderBy: {
          createdAt: "asc",
        },
      },
    },
  });

  if (!user) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    personalWorkspace: user.personalWorkspace,
    organizationMembers: user.organizationMembers,
    passwordCredential: user.passwordCredential
      ? {
          id: user.passwordCredential.id,
          hash: user.passwordCredential.passwordHash,
        }
      : null,
  };
}

export async function ensurePersonalWorkspace(
  client: DbClient,
  input: PersonalWorkspaceBootstrapInput
): Promise<WorkspaceBootstrapResult> {
  const user = await client.user.findUnique({
    where: { id: input.userId },
    include: {
      personalWorkspace: {
        include: {
          repositories: true,
        },
      },
    },
  });

  if (!user) {
    throw new Error(
      `Cannot bootstrap workspace for missing user ${input.userId}`
    );
  }

  if (user.personalWorkspace) {
    const defaultRepository = user.personalWorkspace.repositories.find(
      (repository) => repository.isDefault
    );

    if (!defaultRepository) {
      const repository = await createDefaultRepository(
        client,
        user.personalWorkspace.id,
        input.repositoryName ?? "Main"
      );

      return {
        organization: user.personalWorkspace,
        repository,
      };
    }

    return {
      organization: user.personalWorkspace,
      repository: defaultRepository,
    };
  }

  const organizationName =
    input.workspaceName ?? getDefaultPersonalWorkspaceName(user.name);
  const organizationSlug = await uniqueOrganizationSlug(
    client,
    preferredSlug(organizationName, user.email.split("@")[0] ?? "workspace")
  );

  const organization = await client.organization.create({
    data: {
      name: organizationName,
      slug: organizationSlug,
      kind: "PERSONAL",
      ownerId: user.id,
      personalForUserId: user.id,
      members: {
        create: {
          userId: user.id,
          role: "OWNER",
          status: "ACTIVE",
        },
      },
    },
  });

  const repository = await createDefaultRepository(
    client,
    organization.id,
    input.repositoryName ?? "Main"
  );

  await client.user.update({
    where: { id: user.id },
    data: { personalWorkspaceId: organization.id },
  });

  return {
    organization,
    repository,
  };
}

export async function createOrganizationWorkspace(
  client: DbClient,
  input: OrganizationWorkspaceInput
): Promise<WorkspaceBootstrapResult> {
  const organizationSlug = await uniqueOrganizationSlug(
    client,
    preferredSlug(input.slug ?? input.name, input.name)
  );

  const organization = await client.organization.create({
    data: {
      name: input.name,
      slug: organizationSlug,
      kind: "ORGANIZATION",
      ownerId: input.ownerUserId,
      members: {
        create: {
          userId: input.ownerUserId,
          role: "OWNER",
          status: "ACTIVE",
        },
      },
    },
  });

  const repository = await createDefaultRepository(
    client,
    organization.id,
    input.repositoryName ?? "Main",
    input.repositorySlug
  );

  return {
    organization,
    repository,
  };
}

export async function registerUserWithPersonalWorkspace(
  input: RegistrationBootstrapInput
) {
  const normalizedEmail = input.email.trim().toLowerCase();
  const displayName =
    `${input.firstName.trim()} ${input.lastName.trim()}`.trim();

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: normalizedEmail,
        name: displayName,
      },
    });

    await tx.passwordCredential.create({
      data: {
        userId: user.id,
        passwordHash: input.passwordHash,
      },
    });

    const workspace = await ensurePersonalWorkspace(tx, {
      userId: user.id,
      userName: displayName,
      workspaceName: input.workspaceName,
      repositoryName: "Main",
    });

    return {
      user,
      ...workspace,
    };
  });
}

export async function getUserWorkspaceSummary(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      personalWorkspace: {
        select: {
          id: true,
          name: true,
          slug: true,
          kind: true,
        },
      },
    },
  });
}

export async function getWorkspaceSnapshotForUser(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      personalWorkspace: {
        select: {
          id: true,
          name: true,
          slug: true,
          repositories: {
            orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
            select: {
              id: true,
              name: true,
              slug: true,
              visibility: true,
              isDefault: true,
              folders: {
                orderBy: { createdAt: "asc" },
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
              },
            },
          },
        },
      },
      organizationMembers: {
        where: { status: "ACTIVE" },
        orderBy: { createdAt: "asc" },
        select: {
          role: true,
          organization: {
            select: {
              id: true,
              name: true,
              slug: true,
              kind: true,
            },
          },
        },
      },
    },
  });
}

async function getNotebookContextForUserWithClient(
  client: DbClient,
  userId: string
): Promise<NotebookContext | null> {
  const user = await client.user.findUnique({
    where: { id: userId },
    select: {
      personalWorkspace: {
        select: {
          id: true,
          name: true,
          slug: true,
          repositories: {
            where: { status: "ACTIVE" },
            orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
            select: {
              id: true,
              name: true,
              slug: true,
              folders: {
                where: { parentFolderId: null, status: "ACTIVE" },
                orderBy: { createdAt: "asc" },
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
              },
            },
          },
        },
      },
    },
  });

  const workspace = user?.personalWorkspace;
  const repository = workspace?.repositories[0];

  if (!workspace || !repository) {
    return null;
  }

  return {
    workspace: {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
    },
    repository: {
      id: repository.id,
      name: repository.name,
      slug: repository.slug,
    },
    rootFolder: repository.folders[0] ?? null,
  };
}

export async function getNotebookContextForUser(
  userId: string
): Promise<NotebookContext | null> {
  return getNotebookContextForUserWithClient(prisma, userId);
}

function buildLegacyEntryBlocks(
  bodyText: string | null | undefined,
  linkedProtocols: Array<{
    protocol: {
      id: string;
      title: string;
    };
  }>,
): EntryBlock[] {
  const blocks: EntryBlock[] = [];

  if (bodyText?.trim()) {
    blocks.push({
      id: "legacy-text",
      type: "text",
      text: bodyText.trim(),
    });
  }

  for (const [index, reference] of linkedProtocols.entries()) {
    blocks.push({
      id: `legacy-protocol-${index + 1}`,
      type: "protocol",
      protocolId: reference.protocol.id,
      label: reference.protocol.title,
    });
  }

  if (!blocks.length) {
    blocks.push({
      id: "text-initial",
      type: "text",
      text: "",
    });
  }

  return blocks;
}

function parseEntryBlocksFromVersion(
  bodyJson: Prisma.JsonValue | null,
  bodyText: string | null | undefined,
  linkedProtocols: Array<{
    protocol: {
      id: string;
      title: string;
    };
  }>,
): EntryBlock[] {
  const normalized = normalizeEntryBlocks(bodyJson);

  if (normalized.length) {
    return normalized;
  }

  return buildLegacyEntryBlocks(bodyText, linkedProtocols);
}

function getLinkedProtocolIdsFromBlocks(blocks: EntryBlock[]) {
  return Array.from(
    new Set(
      blocks.flatMap((block) =>
        block.type === "protocol" ? [block.protocolId] : [],
      ),
    ),
  );
}

function deriveEntryBodyText(
  blocks: EntryBlock[],
  protocolTitlesById: Map<string, string>,
): string | null {
  const text = blocks
    .map((block) => {
      if (block.type === "text") {
        return block.text.trim();
      }

      return block.label
        ? `Protocol: ${block.label}`
        : protocolTitlesById.has(block.protocolId)
          ? `Protocol: ${protocolTitlesById.get(block.protocolId)}`
          : `Protocol: ${block.protocolId}`;
    })
    .filter(Boolean)
    .join("\n\n")
    .trim();

  return text || null;
}

function toEntryBlocksJson(blocks: EntryBlock[]): Prisma.InputJsonValue {
  return blocks.map((block) =>
    block.type === "text"
      ? {
          id: block.id,
          type: "text",
          text: block.text,
        }
      : {
          id: block.id,
          type: "protocol",
          protocolId: block.protocolId,
          ...(block.label ? { label: block.label } : {}),
        },
  ) as unknown as Prisma.InputJsonValue;
}

function mapEntryRecord(
  entry: {
    id: string;
    title: string;
    slug: string;
    summary: string | null;
    status: string;
    latestVersionNumber: number;
    updatedAt: Date;
    repository: { name: string };
    folder: { name: string } | null;
    createdBy: { name: string | null };
    versions: Array<{
      bodyText: string | null;
      bodyJson: Prisma.JsonValue | null;
    }>;
    linkedProtocols: Array<{
      protocol: {
        id: string;
        title: string;
        slug: string;
        status: string;
      };
    }>;
  }
): EntryDetail {
  return {
    id: entry.id,
    title: entry.title,
    slug: entry.slug,
    summary: entry.summary,
    status: entry.status,
    repositoryName: entry.repository.name,
    folderName: entry.folder?.name ?? null,
    latestVersionNumber: entry.latestVersionNumber,
    updatedAt: entry.updatedAt,
    createdByName: entry.createdBy.name,
    bodyText: entry.versions[0]?.bodyText ?? null,
    blocks: parseEntryBlocksFromVersion(
      entry.versions[0]?.bodyJson ?? null,
      entry.versions[0]?.bodyText ?? null,
      entry.linkedProtocols,
    ),
    linkedProtocols: entry.linkedProtocols.map((reference) => ({
      id: reference.protocol.id,
      title: reference.protocol.title,
      slug: reference.protocol.slug,
      status: reference.protocol.status,
    })),
  };
}

function mapProtocolRecord(
  protocol: {
    id: string;
    title: string;
    slug: string;
    summary: string | null;
    status: string;
    latestVersionNumber: number;
    updatedAt: Date;
    repository: { name: string };
    folder: { name: string } | null;
    createdBy: { name: string | null };
    versions: Array<{ bodyText: string | null }>;
  }
): ProtocolDetail {
  return {
    id: protocol.id,
    title: protocol.title,
    slug: protocol.slug,
    summary: protocol.summary,
    status: protocol.status,
    repositoryName: protocol.repository.name,
    folderName: protocol.folder?.name ?? null,
    latestVersionNumber: protocol.latestVersionNumber,
    updatedAt: protocol.updatedAt,
    createdByName: protocol.createdBy.name,
    bodyText: protocol.versions[0]?.bodyText ?? null,
  };
}

export async function listEntriesForUser(userId: string): Promise<EntryListItem[]> {
  const context = await getNotebookContextForUser(userId);

  if (!context) {
    return [];
  }

  const entries = await prisma.entry.findMany({
    where: {
      repositoryId: context.repository.id,
      archivedAt: null,
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    include: {
      repository: {
        select: { name: true },
      },
      folder: {
        select: { name: true },
      },
      createdBy: {
        select: { name: true },
      },
      versions: {
        orderBy: { versionNumber: "desc" },
        take: 1,
        select: { bodyText: true, bodyJson: true },
      },
      linkedProtocols: {
        orderBy: { sortOrder: "asc" },
        select: {
          protocol: {
            select: {
              id: true,
              title: true,
              slug: true,
              status: true,
            },
          },
        },
      },
    },
  });

  return entries.map(mapEntryRecord);
}

export async function getEntryDetailForUser(
  userId: string,
  entryId: string
): Promise<EntryDetail | null> {
  const context = await getNotebookContextForUser(userId);

  if (!context) {
    return null;
  }

  const entry = await prisma.entry.findFirst({
    where: {
      id: entryId,
      repositoryId: context.repository.id,
      archivedAt: null,
    },
    include: {
      repository: {
        select: { name: true },
      },
      folder: {
        select: { name: true },
      },
      createdBy: {
        select: { name: true },
      },
      versions: {
        orderBy: { versionNumber: "desc" },
        take: 1,
        select: { bodyText: true, bodyJson: true },
      },
      linkedProtocols: {
        orderBy: { sortOrder: "asc" },
        select: {
          protocol: {
            select: {
              id: true,
              title: true,
              slug: true,
              status: true,
            },
          },
        },
      },
    },
  });

  return entry ? mapEntryRecord(entry) : null;
}

export async function createEntryDraftForUser(input: CreateEntryDraftInput) {
  return prisma.$transaction(async (tx) => {
    const context = await getNotebookContextForUserWithClient(tx, input.userId);

    if (!context) {
      throw new Error(`Cannot create an entry for user ${input.userId} without a workspace.`);
    }

    const title = input.title.trim();
    const summary = input.summary?.trim() || null;
    const bodyText = input.bodyText?.trim() || null;
    const requestedProtocolIds = Array.from(
      new Set((input.linkedProtocolIds ?? []).map((id) => id.trim()).filter(Boolean))
    );
    const slug = await uniqueEntrySlug(
      tx,
      context.repository.id,
      preferredSlug(title, "entry")
    );
    const linkedProtocols = requestedProtocolIds.length
      ? await tx.protocol.findMany({
          where: {
            id: { in: requestedProtocolIds },
            repositoryId: context.repository.id,
            archivedAt: null,
          },
          select: { id: true, title: true },
        })
      : [];
    const linkedProtocolIds = new Set(linkedProtocols.map((protocol) => protocol.id));
    const blocks = normalizeEntryBlocks(
      [
        bodyText
          ? {
              id: "text-initial",
              type: "text",
              text: bodyText,
            }
          : null,
        ...requestedProtocolIds.map((protocolId, index) => ({
          id: `protocol-${index + 1}`,
          type: "protocol",
          protocolId,
        })),
      ].filter(Boolean),
      linkedProtocolIds,
    );
    const protocolTitlesById = new Map(
      linkedProtocols.map((protocol) => [protocol.id, protocol.title]),
    );
    const derivedBodyText = deriveEntryBodyText(blocks, protocolTitlesById);

    const entry = await tx.entry.create({
      data: {
        repositoryId: context.repository.id,
        folderId: context.rootFolder?.id,
        createdById: input.userId,
        title,
        slug,
        summary,
        status: "DRAFT",
        latestVersionNumber: 1,
        linkedProtocols: {
          create: getLinkedProtocolIdsFromBlocks(blocks)
            .filter((protocolId) => linkedProtocolIds.has(protocolId))
            .map((protocolId, sortOrder) => ({
              protocolId,
              sortOrder,
            })),
        },
      },
    });

    await tx.entryVersion.create({
      data: {
        entryId: entry.id,
        createdById: input.userId,
        versionNumber: 1,
        title,
        summary,
        bodyText: derivedBodyText,
        bodyJson: toEntryBlocksJson(blocks),
      },
    });

    return entry;
  });
}

export async function updateEntryDraftForUser(input: UpdateEntryDraftInput) {
  return prisma.$transaction(async (tx) => {
    const context = await getNotebookContextForUserWithClient(tx, input.userId);

    if (!context) {
      throw new Error(`Cannot update an entry for user ${input.userId} without a workspace.`);
    }

    const entry = await tx.entry.findFirst({
      where: {
        id: input.entryId,
        repositoryId: context.repository.id,
        archivedAt: null,
      },
      select: {
        id: true,
        latestVersionNumber: true,
      },
    });

    if (!entry) {
      throw new Error(`Entry ${input.entryId} was not found in the current workspace.`);
    }

    const title = input.title.trim();
    const summary = input.summary?.trim() || null;
    const requestedProtocolIds = getLinkedProtocolIdsFromBlocks(input.blocks);
    const protocols = requestedProtocolIds.length
      ? await tx.protocol.findMany({
          where: {
            id: { in: requestedProtocolIds },
            repositoryId: context.repository.id,
            archivedAt: null,
          },
          select: {
            id: true,
            title: true,
          },
        })
      : [];
    const validProtocolIds = new Set(protocols.map((protocol) => protocol.id));
    const protocolTitlesById = new Map(
      protocols.map((protocol) => [protocol.id, protocol.title]),
    );
    const blocks = normalizeEntryBlocks(input.blocks, validProtocolIds);
    const nextVersionNumber = entry.latestVersionNumber + 1;

    await tx.entry.update({
      where: { id: entry.id },
      data: {
        title,
        summary,
        status: "DRAFT",
        latestVersionNumber: nextVersionNumber,
        linkedProtocols: {
          deleteMany: {},
          create: getLinkedProtocolIdsFromBlocks(blocks).map(
            (protocolId, sortOrder) => ({
              protocolId,
              sortOrder,
            }),
          ),
        },
      },
    });

    await tx.entryVersion.create({
      data: {
        entryId: entry.id,
        createdById: input.userId,
        versionNumber: nextVersionNumber,
        title,
        summary,
        bodyText: deriveEntryBodyText(blocks, protocolTitlesById),
        bodyJson: toEntryBlocksJson(blocks),
      },
    });

    return {
      id: entry.id,
      versionNumber: nextVersionNumber,
    };
  });
}

export async function listProtocolsForUser(
  userId: string
): Promise<ProtocolListItem[]> {
  const context = await getNotebookContextForUser(userId);

  if (!context) {
    return [];
  }

  const protocols = await prisma.protocol.findMany({
    where: {
      repositoryId: context.repository.id,
      archivedAt: null,
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    include: {
      repository: {
        select: { name: true },
      },
      folder: {
        select: { name: true },
      },
      createdBy: {
        select: { name: true },
      },
      versions: {
        orderBy: { versionNumber: "desc" },
        take: 1,
        select: { bodyText: true },
      },
    },
  });

  return protocols.map(mapProtocolRecord);
}

export async function getProtocolDetailForUser(
  userId: string,
  protocolId: string
): Promise<ProtocolDetail | null> {
  const context = await getNotebookContextForUser(userId);

  if (!context) {
    return null;
  }

  const protocol = await prisma.protocol.findFirst({
    where: {
      id: protocolId,
      repositoryId: context.repository.id,
      archivedAt: null,
    },
    include: {
      repository: {
        select: { name: true },
      },
      folder: {
        select: { name: true },
      },
      createdBy: {
        select: { name: true },
      },
      versions: {
        orderBy: { versionNumber: "desc" },
        take: 1,
        select: { bodyText: true },
      },
    },
  });

  return protocol ? mapProtocolRecord(protocol) : null;
}

export async function createProtocolDraftForUser(input: CreateProtocolDraftInput) {
  return prisma.$transaction(async (tx) => {
    const context = await getNotebookContextForUserWithClient(tx, input.userId);

    if (!context) {
      throw new Error(
        `Cannot create a protocol for user ${input.userId} without a workspace.`
      );
    }

    const title = input.title.trim();
    const summary = input.summary?.trim() || null;
    const bodyText = input.bodyText?.trim() || null;
    const slug = await uniqueProtocolSlug(
      tx,
      context.repository.id,
      preferredSlug(title, "protocol")
    );

    const protocol = await tx.protocol.create({
      data: {
        repositoryId: context.repository.id,
        folderId: context.rootFolder?.id,
        createdById: input.userId,
        title,
        slug,
        summary,
        status: "DRAFT",
        latestVersionNumber: 1,
      },
    });

    await tx.protocolVersion.create({
      data: {
        protocolId: protocol.id,
        createdById: input.userId,
        versionNumber: 1,
        title,
        summary,
        bodyText,
      },
    });

    return protocol;
  });
}

export async function disconnectPrisma() {
  await prisma.$disconnect();
}
