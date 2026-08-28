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
  linkedEntityIds: string[];
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

export interface EntryEntityBlock {
  id: string;
  type: "entity";
  entityId: string;
  label?: string;
}

export interface EntryTableBlock {
  id: string;
  type: "table";
  name?: string;
  columns: string[];
  rows: string[][];
}

export type EntryBlock =
  | EntryTextBlock
  | EntryProtocolBlock
  | EntryEntityBlock
  | EntryTableBlock;

export interface EntryDetail extends EntryListItem {
  bodyText: string | null;
  blocks: EntryBlock[];
}

interface NotebookNavigatorRecordBase {
  id: string;
  title: string;
  slug: string;
  href: string;
}

export interface NotebookNavigatorEntryRecord
  extends NotebookNavigatorRecordBase {
  kind: "entry";
  latestVersionNumber: number;
}

export interface NotebookNavigatorEntityRecord
  extends NotebookNavigatorRecordBase {
  kind: "entity";
  entityTypeLabel: string;
  sequenceLength: number;
}

export type NotebookNavigatorRecord =
  | NotebookNavigatorEntryRecord
  | NotebookNavigatorEntityRecord;

export interface NotebookNavigatorFolder {
  id: string;
  name: string;
  slug: string;
  parentFolderId: string | null;
  records: NotebookNavigatorRecord[];
  childFolders: NotebookNavigatorFolder[];
}

export interface NotebookNavigatorData {
  repository: {
    id: string;
    name: string;
    slug: string;
  };
  folders: NotebookNavigatorFolder[];
  unfiledRecords: NotebookNavigatorRecord[];
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
  folderId?: string | null;
}

export interface UpdateEntryDraftInput {
  userId: string;
  entryId: string;
  title: string;
  summary?: string;
  blocks: EntryBlock[];
}

export interface DeleteEntryInput {
  userId: string;
  entryId: string;
}

export interface CreateProtocolDraftInput {
  userId: string;
  title: string;
  summary?: string;
  bodyText?: string;
}

export const planningTaskStatuses = ["QUEUED", "SCHEDULED", "DONE"] as const;

export type PlanningTaskStatusValue = (typeof planningTaskStatuses)[number];

export type PlanningDateRangeSource = "explicit" | "derived" | null;

export interface PlanningDateRange {
  startDate: string | null;
  endDate: string | null;
  source: PlanningDateRangeSource;
}

export interface PlanningWhiteboardListItem {
  id: string;
  title: string;
  slug: string;
  updatedAt: Date;
  projectCount: number;
}

export interface PlanningTaskEntryLinkItem {
  id: string;
  title: string;
  slug: string;
  latestVersionNumber: number;
}

export interface PlanningTaskItem extends PlanningDateRange {
  id: string;
  experimentId: string;
  title: string;
  notes: string | null;
  status: PlanningTaskStatusValue;
  sortOrder: number;
  explicitStartDate: string | null;
  explicitEndDate: string | null;
  entryLinks: PlanningTaskEntryLinkItem[];
}

export interface PlanningExperimentItem extends PlanningDateRange {
  id: string;
  projectId: string;
  title: string;
  sortOrder: number;
  explicitStartDate: string | null;
  explicitEndDate: string | null;
  tasks: PlanningTaskItem[];
}

export interface PlanningProjectItem extends PlanningDateRange {
  id: string;
  whiteboardId: string;
  title: string;
  sortOrder: number;
  explicitStartDate: string | null;
  explicitEndDate: string | null;
  experiments: PlanningExperimentItem[];
}

export interface PlanningWhiteboardDetail {
  id: string;
  title: string;
  slug: string;
  updatedAt: Date;
  projects: PlanningProjectItem[];
}

export interface CreatePlanningWhiteboardInput {
  userId: string;
  title: string;
}

export interface UpdatePlanningWhiteboardInput extends CreatePlanningWhiteboardInput {
  whiteboardId: string;
}

export interface DeletePlanningWhiteboardInput {
  userId: string;
  whiteboardId: string;
}

export interface PlanningProjectMutationInput {
  userId: string;
  whiteboardId: string;
  projectId?: string;
  title: string;
  startDate?: string | null;
  endDate?: string | null;
}

export interface PlanningExperimentMutationInput {
  userId: string;
  projectId: string;
  experimentId?: string;
  title: string;
  startDate?: string | null;
  endDate?: string | null;
}

export interface PlanningTaskMutationInput {
  userId: string;
  experimentId: string;
  taskId?: string;
  title: string;
  notes?: string | null;
  status?: PlanningTaskStatusValue;
  startDate?: string | null;
  endDate?: string | null;
  linkedEntryIds?: string[];
}

export interface DeletePlanningItemInput {
  userId: string;
  id: string;
}

export interface PlanningTaskOrderGroup {
  experimentId: string;
  status: PlanningTaskStatusValue;
  taskIds: string[];
}

export interface ReorderPlanningTasksInput {
  userId: string;
  taskId: string;
  targetExperimentId: string;
  status: PlanningTaskStatusValue;
  taskOrders: PlanningTaskOrderGroup[];
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

export function normalizePlanningDateInput(value: string | null | undefined) {
  const trimmed = value?.trim();

  if (!trimmed || !/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return null;
  }

  const date = new Date(`${trimmed}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== trimmed) {
    return null;
  }

  return trimmed;
}

export function normalizePlanningDateRange(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
) {
  const normalizedStartDate = normalizePlanningDateInput(startDate);
  const normalizedEndDate = normalizePlanningDateInput(endDate);

  if (
    normalizedStartDate &&
    normalizedEndDate &&
    normalizedEndDate < normalizedStartDate
  ) {
    return {
      startDate: normalizedStartDate,
      endDate: normalizedStartDate,
    };
  }

  return {
    startDate: normalizedStartDate,
    endDate: normalizedEndDate,
  };
}

export function derivePlanningDateRange(
  explicitStartDate: string | null | undefined,
  explicitEndDate: string | null | undefined,
  childRanges: Array<Pick<PlanningDateRange, "startDate" | "endDate">>,
): PlanningDateRange {
  const explicitRange = normalizePlanningDateRange(
    explicitStartDate,
    explicitEndDate,
  );

  if (explicitRange.startDate || explicitRange.endDate) {
    const startDate = explicitRange.startDate ?? explicitRange.endDate;
    const endDate = explicitRange.endDate ?? explicitRange.startDate;

    return {
      startDate: startDate ?? null,
      endDate: endDate ?? null,
      source: "explicit",
    };
  }

  const childDates = childRanges.flatMap((range) =>
    [range.startDate, range.endDate].filter((date): date is string => Boolean(date)),
  );

  if (!childDates.length) {
    return {
      startDate: null,
      endDate: null,
      source: null,
    };
  }

  childDates.sort();

  return {
    startDate: childDates[0] ?? null,
    endDate: childDates[childDates.length - 1] ?? null,
    source: "derived",
  };
}

function planningDateToPrisma(value: string | null | undefined) {
  const normalized = normalizePlanningDateInput(value);

  return normalized ? new Date(`${normalized}T00:00:00.000Z`) : null;
}

function prismaDateToPlanningDay(value: Date | null | undefined) {
  return value ? value.toISOString().slice(0, 10) : null;
}

function spreadsheetColumnLabel(index: number) {
  let label = "";
  let current = index;

  do {
    label = String.fromCharCode(65 + (current % 26)) + label;
    current = Math.floor(current / 26) - 1;
  } while (current >= 0);

  return label;
}

function buildSpreadsheetColumns(count: number) {
  return Array.from({ length: Math.max(1, count) }, (_, index) =>
    spreadsheetColumnLabel(index),
  );
}

export function formatEntryIdentifier(entryId: string) {
  const uuidMatch = entryId.match(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
  );

  if (uuidMatch) {
    return `ENT-${uuidMatch[0].toUpperCase()}`;
  }

  return `ENT-${entryId.replace(/[^a-z0-9]/gi, "").toUpperCase()}`;
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

function normalizeEntryEntityBlock(block: unknown): EntryEntityBlock | null {
  if (
    !isRecord(block) ||
    block.type !== "entity" ||
    typeof block.id !== "string" ||
    typeof block.entityId !== "string"
  ) {
    return null;
  }

  return {
    id: block.id,
    type: "entity",
    entityId: block.entityId,
    label: typeof block.label === "string" ? block.label : undefined,
  };
}

function normalizeEntryTableBlock(block: unknown): EntryTableBlock | null {
  if (!isRecord(block) || block.type !== "table" || typeof block.id !== "string") {
    return null;
  }

  const rawColumns = Array.isArray(block.columns) ? block.columns : [];
  const safeColumns = buildSpreadsheetColumns(rawColumns.length || 2);
  const width = safeColumns.length;
  const rawRows = Array.isArray(block.rows) ? block.rows : [];
  const rows = rawRows.map((row) => {
    const cells = Array.isArray(row) ? row : [];
    const normalizedRow = Array.from({ length: width }, (_, index) => {
      const cell = cells[index];
      return typeof cell === "string" ? cell : "";
    });

    return normalizedRow;
  });

  return {
    id: block.id,
    type: "table",
    name:
      typeof block.name === "string" && block.name.trim()
        ? block.name.trim()
        : undefined,
    columns: safeColumns,
    rows,
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

      if (isRecord(block) && block.type === "entity") {
        return normalizeEntryEntityBlock(block);
      }

      if (isRecord(block) && block.type === "table") {
        return normalizeEntryTableBlock(block);
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

async function uniquePlanningWhiteboardSlug(
  client: DbClient,
  repositoryId: string,
  preferred: string,
  ignoredWhiteboardId?: string,
) {
  let suffix = 0;
  let candidate = preferred;

  while (true) {
    const existing = await client.planningWhiteboard.findUnique({
      where: {
        repositoryId_slug: {
          repositoryId,
          slug: candidate,
        },
      },
      select: { id: true },
    });

    if (!existing || existing.id === ignoredWhiteboardId) {
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

function getLinkedEntityIdsFromBlocks(blocks: EntryBlock[]) {
  return Array.from(
    new Set(
      blocks.flatMap((block) =>
        block.type === "entity" ? [block.entityId] : [],
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

      if (block.type === "table") {
        const header = block.columns.join("\t");
        const rows = block.rows.map((row) => row.join("\t")).join("\n");

        return [block.name ? `Table: ${block.name}` : "Table", header, rows]
          .filter(Boolean)
          .join("\n");
      }

      if (block.type === "entity") {
        return block.label
          ? `Entity: ${block.label}`
          : `Entity: ${block.entityId}`;
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

function normalizeSummaryText(value: string) {
  return value
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_`>#~-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function truncateSummary(value: string, maxLength = 180) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1).trimEnd()}…`;
}

function deriveEntrySummary(
  blocks: EntryBlock[],
  protocolTitlesById: Map<string, string>,
): string | null {
  for (const block of blocks) {
    if (block.type === "text") {
      const normalized = normalizeSummaryText(block.text);

      if (normalized) {
        return truncateSummary(normalized);
      }

      continue;
    }

    if (block.type === "table") {
      const summary = block.name?.trim()
        ? `Table: ${block.name.trim()}`
        : `Table: ${block.columns.length} columns`;

      return truncateSummary(`${summary} (${block.rows.length} rows)`);
    }

    if (block.type === "entity") {
      return truncateSummary(`Entity: ${block.label ?? block.entityId}`);
    }

    const protocolLabel =
      block.label ??
      protocolTitlesById.get(block.protocolId) ??
      "Linked protocol";

    return truncateSummary(`Protocol: ${protocolLabel}`);
  }

  return null;
}

function toEntryBlocksJson(blocks: EntryBlock[]): Prisma.InputJsonValue {
  return blocks.map((block) => {
    if (block.type === "text") {
      return {
        id: block.id,
        type: "text",
        text: block.text,
      };
    }

    if (block.type === "table") {
      return {
        id: block.id,
        type: "table",
        ...(block.name?.trim() ? { name: block.name.trim() } : {}),
        columns: block.columns,
        rows: block.rows,
      };
    }

    if (block.type === "entity") {
      return {
        id: block.id,
        type: "entity",
        entityId: block.entityId,
        ...(block.label ? { label: block.label } : {}),
      };
    }

    return {
      id: block.id,
      type: "protocol",
      protocolId: block.protocolId,
      ...(block.label ? { label: block.label } : {}),
    };
  }) as unknown as Prisma.InputJsonValue;
}

function mapNavigatorRecord(entry: {
  id: string;
  title: string;
  slug: string;
  latestVersionNumber: number;
}) {
  return {
    kind: "entry",
    id: entry.id,
    title: entry.title,
    slug: entry.slug,
    href: `/entries/${entry.id}`,
    latestVersionNumber: entry.latestVersionNumber,
  } satisfies NotebookNavigatorEntryRecord;
}

function buildNavigatorFolders(
  folders: Array<{
    id: string;
    name: string;
    slug: string;
    parentFolderId: string | null;
  }>,
  entries: Array<{
    id: string;
    title: string;
    slug: string;
    folderId: string | null;
    latestVersionNumber: number;
  }>,
) {
  const foldersById = new Map(
    folders.map((folder) => [
      folder.id,
      {
        id: folder.id,
        name: folder.name,
        slug: folder.slug,
        parentFolderId: folder.parentFolderId,
        records: [] as NotebookNavigatorRecord[],
        childFolders: [] as NotebookNavigatorFolder[],
      },
    ]),
  );
  const unfiledRecords: NotebookNavigatorRecord[] = [];

  for (const entry of entries) {
    const mappedEntry = mapNavigatorRecord(entry);

    if (entry.folderId && foldersById.has(entry.folderId)) {
      foldersById.get(entry.folderId)?.records.push(mappedEntry);
    } else {
      unfiledRecords.push(mappedEntry);
    }
  }

  const rootFolders: NotebookNavigatorFolder[] = [];

  for (const folder of folders) {
    const currentFolder = foldersById.get(folder.id);

    if (!currentFolder) {
      continue;
    }

    if (
      folder.parentFolderId &&
      foldersById.has(folder.parentFolderId)
    ) {
      foldersById.get(folder.parentFolderId)?.childFolders.push(currentFolder);
    } else {
      rootFolders.push(currentFolder);
    }
  }

  return {
    rootFolders,
    unfiledRecords,
  };
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
  const blocks = parseEntryBlocksFromVersion(
    entry.versions[0]?.bodyJson ?? null,
    entry.versions[0]?.bodyText ?? null,
    entry.linkedProtocols,
  );

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
    blocks,
    linkedProtocols: entry.linkedProtocols.map((reference) => ({
      id: reference.protocol.id,
      title: reference.protocol.title,
      slug: reference.protocol.slug,
      status: reference.protocol.status,
    })),
    linkedEntityIds: getLinkedEntityIdsFromBlocks(blocks),
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

export async function getNotebookNavigatorForUser(
  userId: string,
): Promise<NotebookNavigatorData | null> {
  const context = await getNotebookContextForUser(userId);

  if (!context) {
    return null;
  }

  const repository = await prisma.repository.findUnique({
    where: { id: context.repository.id },
    select: {
      id: true,
      name: true,
      slug: true,
      folders: {
        where: {
          status: "ACTIVE",
          archivedAt: null,
        },
        orderBy: [{ parentFolderId: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          name: true,
          slug: true,
          parentFolderId: true,
        },
      },
      entries: {
        where: {
          archivedAt: null,
        },
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
        select: {
          id: true,
          title: true,
          slug: true,
          folderId: true,
          latestVersionNumber: true,
        },
      },
    },
  });

  if (!repository) {
    return null;
  }

  const { rootFolders, unfiledRecords } = buildNavigatorFolders(
    repository.folders,
    repository.entries,
  );

  return {
    repository: {
      id: repository.id,
      name: repository.name,
      slug: repository.slug,
    },
    folders: rootFolders,
    unfiledRecords,
  };
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
    const explicitSummary = input.summary?.trim() || null;
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
    const summary = explicitSummary ?? deriveEntrySummary(blocks, protocolTitlesById);
    const requestedFolderId = input.folderId?.trim() || null;
    const targetFolder = requestedFolderId
      ? await tx.folder.findFirst({
          where: {
            id: requestedFolderId,
            repositoryId: context.repository.id,
          },
          select: { id: true },
        })
      : null;

    const entry = await tx.entry.create({
      data: {
        repositoryId: context.repository.id,
        folderId: targetFolder?.id ?? context.rootFolder?.id,
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
    const explicitSummary = input.summary?.trim() || null;
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
    const summary = explicitSummary ?? deriveEntrySummary(blocks, protocolTitlesById);
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

export async function autosaveEntryDraftForUser(input: UpdateEntryDraftInput) {
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
    const explicitSummary = input.summary?.trim() || null;
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
    const summary = explicitSummary ?? deriveEntrySummary(blocks, protocolTitlesById);
    const bodyText = deriveEntryBodyText(blocks, protocolTitlesById);
    const bodyJson = toEntryBlocksJson(blocks);

    await tx.entry.update({
      where: { id: entry.id },
      data: {
        title,
        summary,
        status: "DRAFT",
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

    const updatedVersion = await tx.entryVersion.updateMany({
      where: {
        entryId: entry.id,
        versionNumber: entry.latestVersionNumber,
      },
      data: {
        title,
        summary,
        bodyText,
        bodyJson,
      },
    });

    if (!updatedVersion.count) {
      await tx.entryVersion.create({
        data: {
          entryId: entry.id,
          createdById: input.userId,
          versionNumber: entry.latestVersionNumber,
          title,
          summary,
          bodyText,
          bodyJson,
        },
      });
    }

    return {
      id: entry.id,
      versionNumber: entry.latestVersionNumber,
    };
  });
}

export async function deleteEntryForUser(input: DeleteEntryInput) {
  const context = await getNotebookContextForUser(input.userId);

  if (!context) {
    throw new Error(`Cannot delete an entry for user ${input.userId} without a workspace.`);
  }

  const entry = await prisma.entry.findFirst({
    where: {
      id: input.entryId,
      repositoryId: context.repository.id,
      archivedAt: null,
    },
    select: {
      id: true,
    },
  });

  if (!entry) {
    throw new Error(`Entry ${input.entryId} was not found in the current workspace.`);
  }

  await prisma.entry.update({
    where: { id: entry.id },
    data: {
      archivedAt: new Date(),
    },
  });

  return {
    id: entry.id,
  };
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

const planningWhiteboardDetailInclude = {
  projects: {
    where: { archivedAt: null },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: {
      experiments: {
        where: { archivedAt: null },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        include: {
          tasks: {
            where: { archivedAt: null },
            orderBy: [{ status: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
            include: {
              entryLinks: {
                orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
                include: {
                  entry: {
                    select: {
                      id: true,
                      title: true,
                      slug: true,
                      latestVersionNumber: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.PlanningWhiteboardInclude;

type PlanningWhiteboardRecord = Prisma.PlanningWhiteboardGetPayload<{
  include: typeof planningWhiteboardDetailInclude;
}>;

type PlanningTaskRecord =
  PlanningWhiteboardRecord["projects"][number]["experiments"][number]["tasks"][number];

type PlanningExperimentRecord =
  PlanningWhiteboardRecord["projects"][number]["experiments"][number];

type PlanningProjectRecord = PlanningWhiteboardRecord["projects"][number];

function normalizePlanningTitle(title: string, fallback: string) {
  const trimmed = title.trim();

  return trimmed || fallback;
}

function normalizePlanningStatus(
  status: PlanningTaskStatusValue | null | undefined,
) {
  return planningTaskStatuses.includes(status as PlanningTaskStatusValue)
    ? (status as PlanningTaskStatusValue)
    : "QUEUED";
}

function mapPlanningTask(task: PlanningTaskRecord): PlanningTaskItem {
  const explicitStartDate = prismaDateToPlanningDay(task.startDate);
  const explicitEndDate = prismaDateToPlanningDay(task.endDate);
  const range = derivePlanningDateRange(explicitStartDate, explicitEndDate, []);

  return {
    id: task.id,
    experimentId: task.experimentId,
    title: task.title,
    notes: task.notes,
    status: task.status,
    sortOrder: task.sortOrder,
    explicitStartDate,
    explicitEndDate,
    startDate: range.startDate,
    endDate: range.endDate,
    source: range.source,
    entryLinks: task.entryLinks.map((link) => ({
      id: link.entry.id,
      title: link.entry.title,
      slug: link.entry.slug,
      latestVersionNumber: link.entry.latestVersionNumber,
    })),
  };
}

function mapPlanningExperiment(
  experiment: PlanningExperimentRecord,
): PlanningExperimentItem {
  const tasks = experiment.tasks.map(mapPlanningTask);
  const explicitStartDate = prismaDateToPlanningDay(experiment.startDate);
  const explicitEndDate = prismaDateToPlanningDay(experiment.endDate);
  const range = derivePlanningDateRange(explicitStartDate, explicitEndDate, tasks);

  return {
    id: experiment.id,
    projectId: experiment.projectId,
    title: experiment.title,
    sortOrder: experiment.sortOrder,
    explicitStartDate,
    explicitEndDate,
    startDate: range.startDate,
    endDate: range.endDate,
    source: range.source,
    tasks,
  };
}

function mapPlanningProject(project: PlanningProjectRecord): PlanningProjectItem {
  const experiments = project.experiments.map(mapPlanningExperiment);
  const explicitStartDate = prismaDateToPlanningDay(project.startDate);
  const explicitEndDate = prismaDateToPlanningDay(project.endDate);
  const range = derivePlanningDateRange(
    explicitStartDate,
    explicitEndDate,
    experiments,
  );

  return {
    id: project.id,
    whiteboardId: project.whiteboardId,
    title: project.title,
    sortOrder: project.sortOrder,
    explicitStartDate,
    explicitEndDate,
    startDate: range.startDate,
    endDate: range.endDate,
    source: range.source,
    experiments,
  };
}

function mapPlanningWhiteboard(
  whiteboard: PlanningWhiteboardRecord,
): PlanningWhiteboardDetail {
  return {
    id: whiteboard.id,
    title: whiteboard.title,
    slug: whiteboard.slug,
    updatedAt: whiteboard.updatedAt,
    projects: whiteboard.projects.map(mapPlanningProject),
  };
}

async function getValidPlanningEntryIds(
  client: DbClient,
  repositoryId: string,
  entryIds: string[],
) {
  const requestedEntryIds = Array.from(
    new Set(entryIds.map((id) => id.trim()).filter(Boolean)),
  );

  if (!requestedEntryIds.length) {
    return [];
  }

  const entries = await client.entry.findMany({
    where: {
      id: { in: requestedEntryIds },
      repositoryId,
      archivedAt: null,
    },
    select: { id: true },
  });
  const validEntryIds = new Set(entries.map((entry) => entry.id));

  return requestedEntryIds.filter((entryId) => validEntryIds.has(entryId));
}

async function findPlanningWhiteboardForUser(
  client: DbClient,
  userId: string,
  whiteboardId: string,
) {
  const context = await getNotebookContextForUserWithClient(client, userId);

  if (!context) {
    return null;
  }

  const whiteboard = await client.planningWhiteboard.findFirst({
    where: {
      id: whiteboardId,
      repositoryId: context.repository.id,
      archivedAt: null,
    },
    select: {
      id: true,
      repositoryId: true,
    },
  });

  return whiteboard ? { context, whiteboard } : null;
}

async function findPlanningProjectForUser(
  client: DbClient,
  userId: string,
  projectId: string,
) {
  const context = await getNotebookContextForUserWithClient(client, userId);

  if (!context) {
    return null;
  }

  const project = await client.planningProject.findFirst({
    where: {
      id: projectId,
      archivedAt: null,
      whiteboard: {
        is: {
          repositoryId: context.repository.id,
          archivedAt: null,
        },
      },
    },
    select: {
      id: true,
      whiteboardId: true,
    },
  });

  return project ? { context, project } : null;
}

async function findPlanningExperimentForUser(
  client: DbClient,
  userId: string,
  experimentId: string,
) {
  const context = await getNotebookContextForUserWithClient(client, userId);

  if (!context) {
    return null;
  }

  const experiment = await client.planningExperiment.findFirst({
    where: {
      id: experimentId,
      archivedAt: null,
      project: {
        is: {
          archivedAt: null,
          whiteboard: {
            is: {
              repositoryId: context.repository.id,
              archivedAt: null,
            },
          },
        },
      },
    },
    select: {
      id: true,
      projectId: true,
    },
  });

  return experiment ? { context, experiment } : null;
}

async function findPlanningTaskForUser(
  client: DbClient,
  userId: string,
  taskId: string,
) {
  const context = await getNotebookContextForUserWithClient(client, userId);

  if (!context) {
    return null;
  }

  const task = await client.planningTask.findFirst({
    where: {
      id: taskId,
      archivedAt: null,
      experiment: {
        is: {
          archivedAt: null,
          project: {
            is: {
              archivedAt: null,
              whiteboard: {
                is: {
                  repositoryId: context.repository.id,
                  archivedAt: null,
                },
              },
            },
          },
        },
      },
    },
    select: {
      id: true,
      experimentId: true,
    },
  });

  return task ? { context, task } : null;
}

export async function listPlanningWhiteboardsForUser(
  userId: string,
): Promise<PlanningWhiteboardListItem[]> {
  const context = await getNotebookContextForUser(userId);

  if (!context) {
    return [];
  }

  const whiteboards = await prisma.planningWhiteboard.findMany({
    where: {
      repositoryId: context.repository.id,
      archivedAt: null,
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "asc" }],
    include: {
      projects: {
        where: { archivedAt: null },
        select: { id: true },
      },
    },
  });

  return whiteboards.map((whiteboard) => ({
    id: whiteboard.id,
    title: whiteboard.title,
    slug: whiteboard.slug,
    updatedAt: whiteboard.updatedAt,
    projectCount: whiteboard.projects.length,
  }));
}

export async function getPlanningWhiteboardForUser(
  userId: string,
  whiteboardId: string,
): Promise<PlanningWhiteboardDetail | null> {
  const context = await getNotebookContextForUser(userId);

  if (!context) {
    return null;
  }

  const whiteboard = await prisma.planningWhiteboard.findFirst({
    where: {
      id: whiteboardId,
      repositoryId: context.repository.id,
      archivedAt: null,
    },
    include: planningWhiteboardDetailInclude,
  });

  return whiteboard ? mapPlanningWhiteboard(whiteboard) : null;
}

export async function createPlanningWhiteboardForUser(
  input: CreatePlanningWhiteboardInput,
) {
  return prisma.$transaction(async (tx) => {
    const context = await getNotebookContextForUserWithClient(tx, input.userId);

    if (!context) {
      throw new Error(
        `Cannot create a planning whiteboard for user ${input.userId} without a workspace.`,
      );
    }

    const title = normalizePlanningTitle(input.title, "Untitled whiteboard");
    const slug = await uniquePlanningWhiteboardSlug(
      tx,
      context.repository.id,
      preferredSlug(title, "planning"),
    );

    return tx.planningWhiteboard.create({
      data: {
        repositoryId: context.repository.id,
        title,
        slug,
      },
    });
  });
}

export async function updatePlanningWhiteboardForUser(
  input: UpdatePlanningWhiteboardInput,
) {
  return prisma.$transaction(async (tx) => {
    const target = await findPlanningWhiteboardForUser(
      tx,
      input.userId,
      input.whiteboardId,
    );

    if (!target) {
      throw new Error(`Planning whiteboard ${input.whiteboardId} was not found.`);
    }

    const title = normalizePlanningTitle(input.title, "Untitled whiteboard");
    const slug = await uniquePlanningWhiteboardSlug(
      tx,
      target.context.repository.id,
      preferredSlug(title, "planning"),
      input.whiteboardId,
    );

    return tx.planningWhiteboard.update({
      where: { id: target.whiteboard.id },
      data: { title, slug },
    });
  });
}

export async function deletePlanningWhiteboardForUser(
  input: DeletePlanningWhiteboardInput,
) {
  const target = await findPlanningWhiteboardForUser(
    prisma,
    input.userId,
    input.whiteboardId,
  );

  if (!target) {
    throw new Error(`Planning whiteboard ${input.whiteboardId} was not found.`);
  }

  return prisma.planningWhiteboard.update({
    where: { id: target.whiteboard.id },
    data: { archivedAt: new Date() },
  });
}

export async function createPlanningProjectForUser(
  input: PlanningProjectMutationInput,
) {
  return prisma.$transaction(async (tx) => {
    const target = await findPlanningWhiteboardForUser(
      tx,
      input.userId,
      input.whiteboardId,
    );

    if (!target) {
      throw new Error(`Planning whiteboard ${input.whiteboardId} was not found.`);
    }

    const { startDate, endDate } = normalizePlanningDateRange(
      input.startDate,
      input.endDate,
    );
    const sortOrder = await tx.planningProject.count({
      where: {
        whiteboardId: target.whiteboard.id,
        archivedAt: null,
      },
    });

    return tx.planningProject.create({
      data: {
        whiteboardId: target.whiteboard.id,
        title: normalizePlanningTitle(input.title, "Untitled project"),
        startDate: planningDateToPrisma(startDate),
        endDate: planningDateToPrisma(endDate),
        sortOrder,
      },
    });
  });
}

export async function updatePlanningProjectForUser(
  input: PlanningProjectMutationInput & { projectId: string },
) {
  return prisma.$transaction(async (tx) => {
    const target = await findPlanningProjectForUser(
      tx,
      input.userId,
      input.projectId,
    );

    if (!target) {
      throw new Error(`Planning project ${input.projectId} was not found.`);
    }

    const { startDate, endDate } = normalizePlanningDateRange(
      input.startDate,
      input.endDate,
    );

    return tx.planningProject.update({
      where: { id: target.project.id },
      data: {
        title: normalizePlanningTitle(input.title, "Untitled project"),
        startDate: planningDateToPrisma(startDate),
        endDate: planningDateToPrisma(endDate),
      },
    });
  });
}

export async function deletePlanningProjectForUser(input: DeletePlanningItemInput) {
  const target = await findPlanningProjectForUser(prisma, input.userId, input.id);

  if (!target) {
    throw new Error(`Planning project ${input.id} was not found.`);
  }

  return prisma.planningProject.update({
    where: { id: target.project.id },
    data: { archivedAt: new Date() },
  });
}

export async function createPlanningExperimentForUser(
  input: PlanningExperimentMutationInput,
) {
  return prisma.$transaction(async (tx) => {
    const target = await findPlanningProjectForUser(tx, input.userId, input.projectId);

    if (!target) {
      throw new Error(`Planning project ${input.projectId} was not found.`);
    }

    const { startDate, endDate } = normalizePlanningDateRange(
      input.startDate,
      input.endDate,
    );
    const sortOrder = await tx.planningExperiment.count({
      where: {
        projectId: target.project.id,
        archivedAt: null,
      },
    });

    return tx.planningExperiment.create({
      data: {
        projectId: target.project.id,
        title: normalizePlanningTitle(input.title, "Untitled experiment"),
        startDate: planningDateToPrisma(startDate),
        endDate: planningDateToPrisma(endDate),
        sortOrder,
      },
    });
  });
}

export async function updatePlanningExperimentForUser(
  input: PlanningExperimentMutationInput & { experimentId: string },
) {
  return prisma.$transaction(async (tx) => {
    const target = await findPlanningExperimentForUser(
      tx,
      input.userId,
      input.experimentId,
    );

    if (!target) {
      throw new Error(`Planning experiment ${input.experimentId} was not found.`);
    }

    const { startDate, endDate } = normalizePlanningDateRange(
      input.startDate,
      input.endDate,
    );

    return tx.planningExperiment.update({
      where: { id: target.experiment.id },
      data: {
        title: normalizePlanningTitle(input.title, "Untitled experiment"),
        startDate: planningDateToPrisma(startDate),
        endDate: planningDateToPrisma(endDate),
      },
    });
  });
}

export async function deletePlanningExperimentForUser(
  input: DeletePlanningItemInput,
) {
  const target = await findPlanningExperimentForUser(prisma, input.userId, input.id);

  if (!target) {
    throw new Error(`Planning experiment ${input.id} was not found.`);
  }

  return prisma.planningExperiment.update({
    where: { id: target.experiment.id },
    data: { archivedAt: new Date() },
  });
}

export async function createPlanningTaskForUser(input: PlanningTaskMutationInput) {
  return prisma.$transaction(async (tx) => {
    const target = await findPlanningExperimentForUser(
      tx,
      input.userId,
      input.experimentId,
    );

    if (!target) {
      throw new Error(`Planning experiment ${input.experimentId} was not found.`);
    }

    const status = normalizePlanningStatus(input.status);
    const { startDate, endDate } = normalizePlanningDateRange(
      input.startDate,
      input.endDate,
    );
    const sortOrder = await tx.planningTask.count({
      where: {
        experimentId: target.experiment.id,
        status,
        archivedAt: null,
      },
    });
    const validEntryIds = await getValidPlanningEntryIds(
      tx,
      target.context.repository.id,
      input.linkedEntryIds ?? [],
    );

    return tx.planningTask.create({
      data: {
        experimentId: target.experiment.id,
        title: normalizePlanningTitle(input.title, "Untitled task"),
        notes: input.notes?.trim() || null,
        status,
        startDate: planningDateToPrisma(startDate),
        endDate: planningDateToPrisma(endDate),
        sortOrder,
        entryLinks: {
          create: validEntryIds.map((entryId, index) => ({
            entryId,
            sortOrder: index,
          })),
        },
      },
    });
  });
}

export async function updatePlanningTaskForUser(
  input: PlanningTaskMutationInput & { taskId: string },
) {
  return prisma.$transaction(async (tx) => {
    const target = await findPlanningTaskForUser(tx, input.userId, input.taskId);

    if (!target) {
      throw new Error(`Planning task ${input.taskId} was not found.`);
    }

    const { startDate, endDate } = normalizePlanningDateRange(
      input.startDate,
      input.endDate,
    );
    const validEntryIds = await getValidPlanningEntryIds(
      tx,
      target.context.repository.id,
      input.linkedEntryIds ?? [],
    );

    return tx.planningTask.update({
      where: { id: target.task.id },
      data: {
        title: normalizePlanningTitle(input.title, "Untitled task"),
        notes: input.notes?.trim() || null,
        status: normalizePlanningStatus(input.status),
        startDate: planningDateToPrisma(startDate),
        endDate: planningDateToPrisma(endDate),
        entryLinks: {
          deleteMany: {},
          create: validEntryIds.map((entryId, index) => ({
            entryId,
            sortOrder: index,
          })),
        },
      },
    });
  });
}

export async function deletePlanningTaskForUser(input: DeletePlanningItemInput) {
  const target = await findPlanningTaskForUser(prisma, input.userId, input.id);

  if (!target) {
    throw new Error(`Planning task ${input.id} was not found.`);
  }

  return prisma.planningTask.update({
    where: { id: target.task.id },
    data: { archivedAt: new Date() },
  });
}

export async function reorderPlanningTasksForUser(
  input: ReorderPlanningTasksInput,
) {
  return prisma.$transaction(async (tx) => {
    const target = await findPlanningExperimentForUser(
      tx,
      input.userId,
      input.targetExperimentId,
    );

    if (!target) {
      throw new Error(
        `Planning experiment ${input.targetExperimentId} was not found.`,
      );
    }

    const task = await findPlanningTaskForUser(tx, input.userId, input.taskId);

    if (!task) {
      throw new Error(`Planning task ${input.taskId} was not found.`);
    }

    await tx.planningTask.update({
      where: { id: task.task.id },
      data: {
        experimentId: target.experiment.id,
        status: normalizePlanningStatus(input.status),
      },
    });

    const experimentIds = Array.from(
      new Set(input.taskOrders.map((group) => group.experimentId)),
    );
    const validExperiments = await tx.planningExperiment.findMany({
      where: {
        id: { in: experimentIds },
        archivedAt: null,
        project: {
          is: {
            archivedAt: null,
            whiteboard: {
              is: {
                repositoryId: target.context.repository.id,
                archivedAt: null,
              },
            },
          },
        },
      },
      select: { id: true },
    });
    const validExperimentIds = new Set(
      validExperiments.map((experiment) => experiment.id),
    );

    for (const group of input.taskOrders) {
      if (!validExperimentIds.has(group.experimentId)) {
        continue;
      }

      const status = normalizePlanningStatus(group.status);
      const taskIds = Array.from(
        new Set(group.taskIds.map((taskId) => taskId.trim()).filter(Boolean)),
      );

      await Promise.all(
        taskIds.map((taskId, sortOrder) =>
          tx.planningTask.updateMany({
            where: {
              id: taskId,
              archivedAt: null,
              experimentId: group.experimentId,
            },
            data: {
              status,
              sortOrder,
            },
          }),
        ),
      );
    }

    return {
      id: input.taskId,
      experimentId: target.experiment.id,
      status: normalizePlanningStatus(input.status),
    };
  });
}

export async function disconnectPrisma() {
  await prisma.$disconnect();
}
