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

export async function disconnectPrisma() {
  await prisma.$disconnect();
}
