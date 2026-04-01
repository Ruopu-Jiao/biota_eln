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

export interface EntryDetail extends EntryListItem {
  bodyText: string | null;
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
    versions: Array<{ bodyText: string | null }>;
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
        select: { bodyText: true },
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
        select: { bodyText: true },
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
          select: { id: true },
        })
      : [];
    const linkedProtocolIds = new Set(linkedProtocols.map((protocol) => protocol.id));

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
          create: requestedProtocolIds
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
        bodyText,
      },
    });

    return entry;
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
