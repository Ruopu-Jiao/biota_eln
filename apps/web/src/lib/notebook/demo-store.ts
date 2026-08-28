import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  derivePlanningDateRange,
  normalizePlanningDateRange,
  planningTaskStatuses,
} from "@biota/db";
import type {
  CreateEntryDraftInput,
  CreatePlanningWhiteboardInput,
  CreateProtocolDraftInput,
  DeletePlanningItemInput,
  DeletePlanningWhiteboardInput,
  EntryBlock,
  EntryDetail,
  EntryListItem,
  NotebookNavigatorData,
  NotebookContext,
  PlanningExperimentItem,
  PlanningExperimentMutationInput,
  PlanningProjectItem,
  PlanningProjectMutationInput,
  PlanningTaskItem,
  PlanningTaskMutationInput,
  PlanningTaskOrderGroup,
  PlanningTaskStatusValue,
  PlanningWhiteboardDetail,
  PlanningWhiteboardListItem,
  ProtocolDetail,
  ProtocolListItem,
  ReorderPlanningTasksInput,
  UpdatePlanningWhiteboardInput,
  UpdateEntryDraftInput,
} from "@biota/db";
import {
  demoRepositoryId,
  demoRootFolderId,
  demoWorkspaceId,
  getDemoEntries,
  getDemoProtocols,
} from "@/lib/auth/demo.server";

type DemoStoreEntry = {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  status: string;
  repositoryName: string;
  folderName: string | null;
  latestVersionNumber: number;
  updatedAt: string;
  createdByName: string | null;
  bodyText: string | null;
  blocks: EntryBlock[];
  linkedProtocolIds: string[];
  linkedEntityIds: string[];
};

type DemoStoreProtocol = {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  status: string;
  repositoryName: string;
  folderName: string | null;
  latestVersionNumber: number;
  updatedAt: string;
  createdByName: string | null;
  bodyText: string | null;
};

type DemoStorePlanningTask = {
  id: string;
  experimentId: string;
  title: string;
  notes: string | null;
  status: PlanningTaskStatusValue;
  startDate: string | null;
  endDate: string | null;
  sortOrder: number;
  linkedEntryIds: string[];
};

type DemoStorePlanningExperiment = {
  id: string;
  projectId: string;
  title: string;
  startDate: string | null;
  endDate: string | null;
  sortOrder: number;
  tasks: DemoStorePlanningTask[];
};

type DemoStorePlanningProject = {
  id: string;
  whiteboardId: string;
  title: string;
  startDate: string | null;
  endDate: string | null;
  sortOrder: number;
  experiments: DemoStorePlanningExperiment[];
};

type DemoStorePlanningWhiteboard = {
  id: string;
  title: string;
  slug: string;
  updatedAt: string;
  projects: DemoStorePlanningProject[];
};

type DemoNotebookStore = {
  entries: DemoStoreEntry[];
  protocols: DemoStoreProtocol[];
  planningWhiteboards: DemoStorePlanningWhiteboard[];
};

const localDataDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../.local",
);
const demoStorePath = path.join(localDataDirectory, "demo-notebook.json");

function compactSlug(value: string) {
  const base = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return base || "draft";
}

function uniqueSlug(existingSlugs: string[], preferred: string) {
  let suffix = 0;
  let candidate = preferred;

  while (existingSlugs.includes(candidate)) {
    suffix += 1;
    candidate = `${preferred}-${suffix}`;
  }

  return candidate;
}

function normalizeEntryBlocks(blocks: EntryBlock[] | undefined | null) {
  const normalized = (blocks ?? [])
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
        type: "text" as const,
        text: "",
      },
    ];
  }

  return normalized;
}

function buildEntryBlocksForEntry(entry: DemoStoreEntry) {
  if (entry.blocks?.length) {
    return normalizeEntryBlocks(entry.blocks);
  }

  return normalizeEntryBlocks([
    {
      id: `${entry.id}-text`,
      type: "text",
      text: entry.bodyText ?? "",
    },
    ...entry.linkedProtocolIds.map((protocolId, index) => ({
      id: `${entry.id}-protocol-${index + 1}`,
      type: "protocol" as const,
      protocolId,
    })),
  ]);
}

function deriveLinkedProtocolIds(blocks: EntryBlock[]) {
  return Array.from(
    new Set(
      blocks.flatMap((block) =>
        block.type === "protocol" ? [block.protocolId] : [],
      ),
    ),
  );
}

function deriveLinkedEntityIds(blocks: EntryBlock[]) {
  return Array.from(
    new Set(
      blocks.flatMap((block) =>
        block.type === "entity" ? [block.entityId] : [],
      ),
    ),
  );
}

function deriveBodyText(
  blocks: EntryBlock[],
  protocolsById: Map<string, DemoStoreProtocol>,
) {
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
        return block.label ? `Entity: ${block.label}` : `Entity: ${block.entityId}`;
      }

      const protocol = protocolsById.get(block.protocolId);
      return protocol ? `Protocol: ${protocol.title}` : null;
    })
    .filter((value): value is string => Boolean(value))
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

function deriveSummary(
  blocks: EntryBlock[],
  protocolsById: Map<string, DemoStoreProtocol>,
) {
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

    const protocol = protocolsById.get(block.protocolId);
    return truncateSummary(`Protocol: ${protocol?.title ?? "Linked protocol"}`);
  }

  return null;
}

function getSeedPlanningWhiteboards(): DemoStorePlanningWhiteboard[] {
  return [
    {
      id: "demo-planning-board-crispr",
      title: "CRISPR pilot planning",
      slug: "crispr-pilot-planning",
      updatedAt: new Date("2026-04-01T14:20:00.000Z").toISOString(),
      projects: [
        {
          id: "demo-project-crispr-pilot",
          whiteboardId: "demo-planning-board-crispr",
          title: "CRISPR pilot screen",
          startDate: null,
          endDate: null,
          sortOrder: 0,
          experiments: [
            {
              id: "demo-experiment-baseline",
              projectId: "demo-project-crispr-pilot",
              title: "Day 0 baseline",
              startDate: "2026-04-06",
              endDate: "2026-04-07",
              sortOrder: 0,
              tasks: [
                {
                  id: "demo-task-seed-plates",
                  experimentId: "demo-experiment-baseline",
                  title: "Seed HEK293T Cas9 plates",
                  notes: "Prepare baseline plates for 12-guide pilot.",
                  status: "SCHEDULED",
                  startDate: "2026-04-06",
                  endDate: "2026-04-06",
                  sortOrder: 0,
                  linkedEntryIds: ["demo-entry-crispr-screen"],
                },
                {
                  id: "demo-task-viral-addition",
                  experimentId: "demo-experiment-baseline",
                  title: "Stagger viral addition",
                  notes: "Keep collection timing aligned across wells.",
                  status: "QUEUED",
                  startDate: null,
                  endDate: null,
                  sortOrder: 0,
                  linkedEntryIds: [],
                },
              ],
            },
            {
              id: "demo-experiment-qc",
              projectId: "demo-project-crispr-pilot",
              title: "Construct QC",
              startDate: null,
              endDate: null,
              sortOrder: 1,
              tasks: [
                {
                  id: "demo-task-review-digest",
                  experimentId: "demo-experiment-qc",
                  title: "Review digest and concentration data",
                  notes: "Confirm which constructs need re-miniprep.",
                  status: "DONE",
                  startDate: "2026-04-03",
                  endDate: "2026-04-03",
                  sortOrder: 0,
                  linkedEntryIds: ["demo-entry-miniprep-qc"],
                },
              ],
            },
          ],
        },
      ],
    },
  ];
}

function getSeedStore(): DemoNotebookStore {
  const protocols = getDemoProtocols().map((protocol) => ({
    ...protocol,
    updatedAt: protocol.updatedAt.toISOString(),
  }));
  const entries = getDemoEntries().map((entry, index) => ({
    ...entry,
    updatedAt: entry.updatedAt.toISOString(),
    blocks: normalizeEntryBlocks([
      {
        id: `${entry.id}-text`,
        type: "text",
        text: entry.bodyText ?? "",
      },
      {
        id: `${entry.id}-protocol`,
        type: "protocol",
        protocolId:
          index === 0
            ? "demo-protocol-sgrna-oligo"
            : "demo-protocol-colony-pcr",
      },
    ]),
    linkedProtocolIds:
      index === 0
        ? ["demo-protocol-sgrna-oligo"]
        : ["demo-protocol-colony-pcr"],
    linkedEntityIds: [],
  }));

  return {
    entries,
    protocols,
    planningWhiteboards: getSeedPlanningWhiteboards(),
  };
}

function getEntryLinkedEntityIds(entry: DemoStoreEntry) {
  if (Array.isArray(entry.linkedEntityIds)) {
    return entry.linkedEntityIds;
  }

  return deriveLinkedEntityIds(buildEntryBlocksForEntry(entry));
}

function ensurePlanningWhiteboards(store: DemoNotebookStore) {
  if (!Array.isArray(store.planningWhiteboards)) {
    store.planningWhiteboards = getSeedPlanningWhiteboards();
  }

  return store;
}

async function ensureDemoStore() {
  try {
    const raw = await readFile(demoStorePath, "utf8");
    return ensurePlanningWhiteboards(JSON.parse(raw) as DemoNotebookStore);
  } catch {
    const seed = getSeedStore();
    await mkdir(localDataDirectory, { recursive: true });
    await writeFile(demoStorePath, JSON.stringify(seed, null, 2), "utf8");
    return seed;
  }
}

async function saveDemoStore(store: DemoNotebookStore) {
  await mkdir(localDataDirectory, { recursive: true });
  await writeFile(demoStorePath, JSON.stringify(store, null, 2), "utf8");
}

export function getDemoNotebookContext(): NotebookContext {
  return {
    workspace: {
      id: demoWorkspaceId,
      name: "Demo workspace",
      slug: "demo-workspace",
    },
    repository: {
      id: demoRepositoryId,
      name: "Main notebook",
      slug: "main",
    },
    rootFolder: {
      id: demoRootFolderId,
      name: "Root",
      slug: "root",
    },
  };
}

export async function getDemoNotebookNavigator(): Promise<NotebookNavigatorData> {
  const store = await ensureDemoStore();

  return {
    repository: {
      id: demoRepositoryId,
      name: "Main notebook",
      slug: "main",
    },
    folders: [
      {
        id: demoRootFolderId,
        name: "Root",
        slug: "root",
        parentFolderId: null,
        records: store.entries
          .slice()
          .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
          .map((entry) => ({
            kind: "entry" as const,
            id: entry.id,
            title: entry.title,
            slug: entry.slug,
            href: `/entries/${entry.id}`,
            latestVersionNumber: entry.latestVersionNumber,
          })),
        childFolders: [],
      },
    ],
    unfiledRecords: [],
  };
}

export async function listDemoProtocols(): Promise<ProtocolListItem[]> {
  const store = await ensureDemoStore();

  return store.protocols
    .slice()
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .map((protocol) => ({
      id: protocol.id,
      title: protocol.title,
      slug: protocol.slug,
      summary: protocol.summary,
      status: protocol.status,
      repositoryName: protocol.repositoryName,
      folderName: protocol.folderName,
      latestVersionNumber: protocol.latestVersionNumber,
      updatedAt: new Date(protocol.updatedAt),
      createdByName: protocol.createdByName,
    }));
}

export async function listDemoEntries(): Promise<EntryListItem[]> {
  const store = await ensureDemoStore();
  const protocolsById = new Map(
    store.protocols.map((protocol) => [protocol.id, protocol]),
  );

  return store.entries
    .slice()
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .map((entry) => ({
      id: entry.id,
      title: entry.title,
      slug: entry.slug,
      summary: entry.summary,
      status: entry.status,
      repositoryName: entry.repositoryName,
      folderName: entry.folderName,
      latestVersionNumber: entry.latestVersionNumber,
      updatedAt: new Date(entry.updatedAt),
      createdByName: entry.createdByName,
      linkedProtocols: entry.linkedProtocolIds
        .map((protocolId) => protocolsById.get(protocolId))
        .filter((protocol): protocol is DemoStoreProtocol => Boolean(protocol))
        .map((protocol) => ({
          id: protocol.id,
          title: protocol.title,
          slug: protocol.slug,
          status: protocol.status,
        })),
      linkedEntityIds: getEntryLinkedEntityIds(entry),
    }));
}

function normalizePlanningTitle(title: string | undefined, fallback: string) {
  const trimmed = title?.trim();

  return trimmed || fallback;
}

function normalizePlanningStatus(
  status: PlanningTaskStatusValue | null | undefined,
) {
  return planningTaskStatuses.includes(status as PlanningTaskStatusValue)
    ? (status as PlanningTaskStatusValue)
    : "QUEUED";
}

function getValidDemoEntryIds(store: DemoNotebookStore, entryIds: string[]) {
  const validEntryIds = new Set(store.entries.map((entry) => entry.id));

  return Array.from(
    new Set(entryIds.map((entryId) => entryId.trim()).filter(Boolean)),
  ).filter((entryId) => validEntryIds.has(entryId));
}

function getDemoEntryLinks(store: DemoNotebookStore, entryIds: string[]) {
  const entriesById = new Map(store.entries.map((entry) => [entry.id, entry]));

  return entryIds
    .map((entryId) => entriesById.get(entryId))
    .filter((entry): entry is DemoStoreEntry => Boolean(entry))
    .map((entry) => ({
      id: entry.id,
      title: entry.title,
      slug: entry.slug,
      latestVersionNumber: entry.latestVersionNumber,
    }));
}

function mapDemoPlanningTask(
  store: DemoNotebookStore,
  task: DemoStorePlanningTask,
): PlanningTaskItem {
  const range = derivePlanningDateRange(task.startDate, task.endDate, []);

  return {
    id: task.id,
    experimentId: task.experimentId,
    title: task.title,
    notes: task.notes,
    status: normalizePlanningStatus(task.status),
    sortOrder: task.sortOrder,
    explicitStartDate: task.startDate,
    explicitEndDate: task.endDate,
    startDate: range.startDate,
    endDate: range.endDate,
    source: range.source,
    entryLinks: getDemoEntryLinks(store, task.linkedEntryIds ?? []),
  };
}

function mapDemoPlanningExperiment(
  store: DemoNotebookStore,
  experiment: DemoStorePlanningExperiment,
): PlanningExperimentItem {
  const tasks = experiment.tasks
    .slice()
    .sort((left, right) => {
      const statusDelta =
        planningTaskStatuses.indexOf(normalizePlanningStatus(left.status)) -
        planningTaskStatuses.indexOf(normalizePlanningStatus(right.status));

      return statusDelta || left.sortOrder - right.sortOrder;
    })
    .map((task) => mapDemoPlanningTask(store, task));
  const range = derivePlanningDateRange(
    experiment.startDate,
    experiment.endDate,
    tasks,
  );

  return {
    id: experiment.id,
    projectId: experiment.projectId,
    title: experiment.title,
    sortOrder: experiment.sortOrder,
    explicitStartDate: experiment.startDate,
    explicitEndDate: experiment.endDate,
    startDate: range.startDate,
    endDate: range.endDate,
    source: range.source,
    tasks,
  };
}

function mapDemoPlanningProject(
  store: DemoNotebookStore,
  project: DemoStorePlanningProject,
): PlanningProjectItem {
  const experiments = project.experiments
    .slice()
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((experiment) => mapDemoPlanningExperiment(store, experiment));
  const range = derivePlanningDateRange(project.startDate, project.endDate, experiments);

  return {
    id: project.id,
    whiteboardId: project.whiteboardId,
    title: project.title,
    sortOrder: project.sortOrder,
    explicitStartDate: project.startDate,
    explicitEndDate: project.endDate,
    startDate: range.startDate,
    endDate: range.endDate,
    source: range.source,
    experiments,
  };
}

function mapDemoPlanningWhiteboard(
  store: DemoNotebookStore,
  whiteboard: DemoStorePlanningWhiteboard,
): PlanningWhiteboardDetail {
  return {
    id: whiteboard.id,
    title: whiteboard.title,
    slug: whiteboard.slug,
    updatedAt: new Date(whiteboard.updatedAt),
    projects: whiteboard.projects
      .slice()
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((project) => mapDemoPlanningProject(store, project)),
  };
}

function touchDemoWhiteboard(whiteboard: DemoStorePlanningWhiteboard) {
  whiteboard.updatedAt = new Date().toISOString();
}

function findDemoWhiteboard(store: DemoNotebookStore, whiteboardId: string) {
  return store.planningWhiteboards.find((whiteboard) => whiteboard.id === whiteboardId);
}

function findDemoProject(store: DemoNotebookStore, projectId: string) {
  for (const whiteboard of store.planningWhiteboards) {
    const project = whiteboard.projects.find((record) => record.id === projectId);

    if (project) {
      return { whiteboard, project };
    }
  }

  return null;
}

function findDemoExperiment(store: DemoNotebookStore, experimentId: string) {
  for (const whiteboard of store.planningWhiteboards) {
    for (const project of whiteboard.projects) {
      const experiment = project.experiments.find(
        (record) => record.id === experimentId,
      );

      if (experiment) {
        return { whiteboard, project, experiment };
      }
    }
  }

  return null;
}

function findDemoTask(store: DemoNotebookStore, taskId: string) {
  for (const whiteboard of store.planningWhiteboards) {
    for (const project of whiteboard.projects) {
      for (const experiment of project.experiments) {
        const taskIndex = experiment.tasks.findIndex((record) => record.id === taskId);

        if (taskIndex !== -1) {
          return {
            whiteboard,
            project,
            experiment,
            task: experiment.tasks[taskIndex],
            taskIndex,
          };
        }
      }
    }
  }

  return null;
}

export async function listDemoPlanningWhiteboards(): Promise<
  PlanningWhiteboardListItem[]
> {
  const store = await ensureDemoStore();

  return store.planningWhiteboards
    .slice()
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .map((whiteboard) => ({
      id: whiteboard.id,
      title: whiteboard.title,
      slug: whiteboard.slug,
      updatedAt: new Date(whiteboard.updatedAt),
      projectCount: whiteboard.projects.length,
    }));
}

export async function getDemoPlanningWhiteboard(
  whiteboardId: string,
): Promise<PlanningWhiteboardDetail | null> {
  const store = await ensureDemoStore();
  const whiteboard = findDemoWhiteboard(store, whiteboardId);

  return whiteboard ? mapDemoPlanningWhiteboard(store, whiteboard) : null;
}

export async function createDemoPlanningWhiteboard(
  input: Omit<CreatePlanningWhiteboardInput, "userId">,
) {
  const store = await ensureDemoStore();
  const title = normalizePlanningTitle(input.title, "Untitled whiteboard");
  const whiteboard = {
    id: `demo-planning-${crypto.randomUUID()}`,
    title,
    slug: uniqueSlug(
      store.planningWhiteboards.map((record) => record.slug),
      compactSlug(title),
    ),
    updatedAt: new Date().toISOString(),
    projects: [],
  } satisfies DemoStorePlanningWhiteboard;

  store.planningWhiteboards.unshift(whiteboard);
  await saveDemoStore(store);

  return whiteboard;
}

export async function updateDemoPlanningWhiteboard(
  input: Omit<UpdatePlanningWhiteboardInput, "userId">,
) {
  const store = await ensureDemoStore();
  const whiteboard = findDemoWhiteboard(store, input.whiteboardId);

  if (!whiteboard) {
    throw new Error(`Demo planning whiteboard ${input.whiteboardId} was not found.`);
  }

  const title = normalizePlanningTitle(input.title, "Untitled whiteboard");
  whiteboard.title = title;
  whiteboard.slug = uniqueSlug(
    store.planningWhiteboards
      .filter((record) => record.id !== input.whiteboardId)
      .map((record) => record.slug),
    compactSlug(title),
  );
  touchDemoWhiteboard(whiteboard);
  await saveDemoStore(store);

  return whiteboard;
}

export async function deleteDemoPlanningWhiteboard(
  input: Omit<DeletePlanningWhiteboardInput, "userId">,
) {
  const store = await ensureDemoStore();
  const whiteboardIndex = store.planningWhiteboards.findIndex(
    (whiteboard) => whiteboard.id === input.whiteboardId,
  );

  if (whiteboardIndex === -1) {
    throw new Error(`Demo planning whiteboard ${input.whiteboardId} was not found.`);
  }

  const [whiteboard] = store.planningWhiteboards.splice(whiteboardIndex, 1);
  await saveDemoStore(store);

  return { id: whiteboard.id };
}

export async function createDemoPlanningProject(
  input: Omit<PlanningProjectMutationInput, "userId">,
) {
  const store = await ensureDemoStore();
  const whiteboard = findDemoWhiteboard(store, input.whiteboardId);

  if (!whiteboard) {
    throw new Error(`Demo planning whiteboard ${input.whiteboardId} was not found.`);
  }

  const { startDate, endDate } = normalizePlanningDateRange(
    input.startDate,
    input.endDate,
  );
  const project = {
    id: `demo-project-${crypto.randomUUID()}`,
    whiteboardId: whiteboard.id,
    title: normalizePlanningTitle(input.title, "Untitled project"),
    startDate,
    endDate,
    sortOrder: whiteboard.projects.length,
    experiments: [],
  } satisfies DemoStorePlanningProject;

  whiteboard.projects.push(project);
  touchDemoWhiteboard(whiteboard);
  await saveDemoStore(store);

  return project;
}

export async function updateDemoPlanningProject(
  input: Omit<PlanningProjectMutationInput, "userId"> & { projectId: string },
) {
  const store = await ensureDemoStore();
  const target = findDemoProject(store, input.projectId);

  if (!target) {
    throw new Error(`Demo planning project ${input.projectId} was not found.`);
  }

  const { startDate, endDate } = normalizePlanningDateRange(
    input.startDate,
    input.endDate,
  );
  target.project.title = normalizePlanningTitle(input.title, "Untitled project");
  target.project.startDate = startDate;
  target.project.endDate = endDate;
  touchDemoWhiteboard(target.whiteboard);
  await saveDemoStore(store);

  return target.project;
}

export async function deleteDemoPlanningProject(
  input: Omit<DeletePlanningItemInput, "userId">,
) {
  const store = await ensureDemoStore();
  const target = findDemoProject(store, input.id);

  if (!target) {
    throw new Error(`Demo planning project ${input.id} was not found.`);
  }

  target.whiteboard.projects = target.whiteboard.projects.filter(
    (project) => project.id !== input.id,
  );
  touchDemoWhiteboard(target.whiteboard);
  await saveDemoStore(store);

  return { id: input.id };
}

export async function createDemoPlanningExperiment(
  input: Omit<PlanningExperimentMutationInput, "userId">,
) {
  const store = await ensureDemoStore();
  const target = findDemoProject(store, input.projectId);

  if (!target) {
    throw new Error(`Demo planning project ${input.projectId} was not found.`);
  }

  const { startDate, endDate } = normalizePlanningDateRange(
    input.startDate,
    input.endDate,
  );
  const experiment = {
    id: `demo-experiment-${crypto.randomUUID()}`,
    projectId: target.project.id,
    title: normalizePlanningTitle(input.title, "Untitled experiment"),
    startDate,
    endDate,
    sortOrder: target.project.experiments.length,
    tasks: [],
  } satisfies DemoStorePlanningExperiment;

  target.project.experiments.push(experiment);
  touchDemoWhiteboard(target.whiteboard);
  await saveDemoStore(store);

  return experiment;
}

export async function updateDemoPlanningExperiment(
  input: Omit<PlanningExperimentMutationInput, "userId"> & {
    experimentId: string;
  },
) {
  const store = await ensureDemoStore();
  const target = findDemoExperiment(store, input.experimentId);

  if (!target) {
    throw new Error(`Demo planning experiment ${input.experimentId} was not found.`);
  }

  const { startDate, endDate } = normalizePlanningDateRange(
    input.startDate,
    input.endDate,
  );
  target.experiment.title = normalizePlanningTitle(
    input.title,
    "Untitled experiment",
  );
  target.experiment.startDate = startDate;
  target.experiment.endDate = endDate;
  touchDemoWhiteboard(target.whiteboard);
  await saveDemoStore(store);

  return target.experiment;
}

export async function deleteDemoPlanningExperiment(
  input: Omit<DeletePlanningItemInput, "userId">,
) {
  const store = await ensureDemoStore();
  const target = findDemoExperiment(store, input.id);

  if (!target) {
    throw new Error(`Demo planning experiment ${input.id} was not found.`);
  }

  target.project.experiments = target.project.experiments.filter(
    (experiment) => experiment.id !== input.id,
  );
  touchDemoWhiteboard(target.whiteboard);
  await saveDemoStore(store);

  return { id: input.id };
}

export async function createDemoPlanningTask(
  input: Omit<PlanningTaskMutationInput, "userId">,
) {
  const store = await ensureDemoStore();
  const target = findDemoExperiment(store, input.experimentId);

  if (!target) {
    throw new Error(`Demo planning experiment ${input.experimentId} was not found.`);
  }

  const status = normalizePlanningStatus(input.status);
  const { startDate, endDate } = normalizePlanningDateRange(
    input.startDate,
    input.endDate,
  );
  const sortOrder = target.experiment.tasks.filter(
    (task) => task.status === status,
  ).length;
  const task = {
    id: `demo-task-${crypto.randomUUID()}`,
    experimentId: target.experiment.id,
    title: normalizePlanningTitle(input.title, "Untitled task"),
    notes: input.notes?.trim() || null,
    status,
    startDate,
    endDate,
    sortOrder,
    linkedEntryIds: getValidDemoEntryIds(store, input.linkedEntryIds ?? []),
  } satisfies DemoStorePlanningTask;

  target.experiment.tasks.push(task);
  touchDemoWhiteboard(target.whiteboard);
  await saveDemoStore(store);

  return task;
}

export async function updateDemoPlanningTask(
  input: Omit<PlanningTaskMutationInput, "userId"> & { taskId: string },
) {
  const store = await ensureDemoStore();
  const target = findDemoTask(store, input.taskId);

  if (!target) {
    throw new Error(`Demo planning task ${input.taskId} was not found.`);
  }

  const { startDate, endDate } = normalizePlanningDateRange(
    input.startDate,
    input.endDate,
  );
  target.task.title = normalizePlanningTitle(input.title, "Untitled task");
  target.task.notes = input.notes?.trim() || null;
  target.task.status = normalizePlanningStatus(input.status);
  target.task.startDate = startDate;
  target.task.endDate = endDate;
  target.task.linkedEntryIds = getValidDemoEntryIds(store, input.linkedEntryIds ?? []);
  touchDemoWhiteboard(target.whiteboard);
  await saveDemoStore(store);

  return target.task;
}

export async function deleteDemoPlanningTask(
  input: Omit<DeletePlanningItemInput, "userId">,
) {
  const store = await ensureDemoStore();
  const target = findDemoTask(store, input.id);

  if (!target) {
    throw new Error(`Demo planning task ${input.id} was not found.`);
  }

  target.experiment.tasks.splice(target.taskIndex, 1);
  touchDemoWhiteboard(target.whiteboard);
  await saveDemoStore(store);

  return { id: input.id };
}

function applyDemoTaskOrder(
  store: DemoNotebookStore,
  group: PlanningTaskOrderGroup,
) {
  const target = findDemoExperiment(store, group.experimentId);

  if (!target) {
    return;
  }

  const status = normalizePlanningStatus(group.status);
  const orderedIds = Array.from(
    new Set(group.taskIds.map((taskId) => taskId.trim()).filter(Boolean)),
  );

  for (const [sortOrder, taskId] of orderedIds.entries()) {
    const task = target.experiment.tasks.find((record) => record.id === taskId);

    if (task) {
      task.status = status;
      task.sortOrder = sortOrder;
    }
  }
}

export async function reorderDemoPlanningTasks(
  input: Omit<ReorderPlanningTasksInput, "userId">,
) {
  const store = await ensureDemoStore();
  const targetExperiment = findDemoExperiment(store, input.targetExperimentId);
  const taskLocation = findDemoTask(store, input.taskId);

  if (!targetExperiment || !taskLocation) {
    throw new Error(`Demo planning task ${input.taskId} could not be reordered.`);
  }

  if (taskLocation.experiment.id !== targetExperiment.experiment.id) {
    const [task] = taskLocation.experiment.tasks.splice(taskLocation.taskIndex, 1);
    task.experimentId = targetExperiment.experiment.id;
    targetExperiment.experiment.tasks.push(task);
    taskLocation.task = task;
  }

  taskLocation.task.status = normalizePlanningStatus(input.status);
  taskLocation.task.experimentId = targetExperiment.experiment.id;

  for (const group of input.taskOrders) {
    applyDemoTaskOrder(store, group);
  }

  touchDemoWhiteboard(targetExperiment.whiteboard);
  await saveDemoStore(store);

  return {
    id: input.taskId,
    experimentId: targetExperiment.experiment.id,
    status: normalizePlanningStatus(input.status),
  };
}

export async function createDemoProtocolDraft(
  input: Omit<CreateProtocolDraftInput, "userId">,
) {
  const store = await ensureDemoStore();
  const title = input.title.trim();
  const now = new Date().toISOString();
  const slug = uniqueSlug(
    store.protocols.map((protocol) => protocol.slug),
    compactSlug(title),
  );

  store.protocols.unshift({
    id: `demo-protocol-${crypto.randomUUID()}`,
    title,
    slug,
    summary: input.summary?.trim() || null,
    status: "DRAFT",
    repositoryName: "Main notebook",
    folderName: "Root",
    latestVersionNumber: 1,
    updatedAt: now,
    createdByName: "Demo Researcher",
    bodyText: input.bodyText?.trim() || null,
  });

  await saveDemoStore(store);
}

export async function createDemoEntryDraft(
  input: Omit<CreateEntryDraftInput, "userId">,
) {
  const store = await ensureDemoStore();
  const title = input.title.trim();
  const now = new Date().toISOString();
  const slug = uniqueSlug(
    store.entries.map((entry) => entry.slug),
    compactSlug(title),
  );
  const validProtocolIds = new Set(store.protocols.map((protocol) => protocol.id));
  const requestedProtocolIds = Array.from(
    new Set((input.linkedProtocolIds ?? []).filter((id) => validProtocolIds.has(id))),
  );
  const blocks = normalizeEntryBlocks([
    {
      id: "text-initial",
      type: "text",
      text: input.bodyText?.trim() || "",
    },
    ...requestedProtocolIds.map((protocolId, index) => ({
      id: `protocol-${index + 1}`,
      type: "protocol" as const,
      protocolId,
    })),
  ]);
  const protocolsById = new Map(
    store.protocols.map((protocol) => [protocol.id, protocol]),
  );

  const entry = {
    id: `demo-entry-${crypto.randomUUID()}`,
    title,
    slug,
    status: "DRAFT",
    repositoryName: "Main notebook",
    folderName: "Root",
    latestVersionNumber: 1,
    updatedAt: now,
    createdByName: "Demo Researcher",
    bodyText: deriveBodyText(blocks, protocolsById),
    blocks,
    linkedProtocolIds: deriveLinkedProtocolIds(blocks),
    linkedEntityIds: deriveLinkedEntityIds(blocks),
    summary: input.summary?.trim() || deriveSummary(blocks, protocolsById),
  } satisfies DemoStoreEntry;

  store.entries.unshift(entry);

  await saveDemoStore(store);

  return entry;
}

export async function getDemoEntryDetail(
  entryId: string,
): Promise<EntryDetail | null> {
  const store = await ensureDemoStore();
  const protocolsById = new Map(
    store.protocols.map((protocol) => [protocol.id, protocol]),
  );
  const entry = store.entries.find((record) => record.id === entryId);

  if (!entry) {
    return null;
  }

  return {
    id: entry.id,
    title: entry.title,
    slug: entry.slug,
    summary: entry.summary,
    status: entry.status,
    repositoryName: entry.repositoryName,
    folderName: entry.folderName,
    latestVersionNumber: entry.latestVersionNumber,
    updatedAt: new Date(entry.updatedAt),
    createdByName: entry.createdByName,
    bodyText: entry.bodyText,
    blocks: buildEntryBlocksForEntry(entry),
    linkedEntityIds: getEntryLinkedEntityIds(entry),
    linkedProtocols: entry.linkedProtocolIds
      .map((protocolId) => protocolsById.get(protocolId))
      .filter((protocol): protocol is DemoStoreProtocol => Boolean(protocol))
      .map((protocol) => ({
        id: protocol.id,
        title: protocol.title,
        slug: protocol.slug,
        status: protocol.status,
      })),
  };
}

export async function getDemoProtocolDetail(
  protocolId: string,
): Promise<ProtocolDetail | null> {
  const store = await ensureDemoStore();
  const protocol = store.protocols.find((record) => record.id === protocolId);

  if (!protocol) {
    return null;
  }

  return {
    id: protocol.id,
    title: protocol.title,
    slug: protocol.slug,
    summary: protocol.summary,
    status: protocol.status,
    repositoryName: protocol.repositoryName,
    folderName: protocol.folderName,
    latestVersionNumber: protocol.latestVersionNumber,
    updatedAt: new Date(protocol.updatedAt),
    createdByName: protocol.createdByName,
    bodyText: protocol.bodyText,
  };
}

export async function updateDemoEntryDraft(
  input: Omit<UpdateEntryDraftInput, "userId">,
) {
  const store = await ensureDemoStore();
  const entry = store.entries.find((record) => record.id === input.entryId);

  if (!entry) {
    throw new Error(`Demo entry ${input.entryId} was not found.`);
  }

  const protocolsById = new Map(
    store.protocols.map((protocol) => [protocol.id, protocol]),
  );
  const validProtocolIds = new Set(store.protocols.map((protocol) => protocol.id));
  const blocks = normalizeEntryBlocks(
    input.blocks.filter(
      (block) =>
        block.type !== "protocol" || validProtocolIds.has(block.protocolId),
    ),
  );

  entry.title = input.title.trim();
  entry.summary = input.summary?.trim() || deriveSummary(blocks, protocolsById);
  entry.blocks = blocks;
  entry.bodyText = deriveBodyText(blocks, protocolsById);
  entry.linkedProtocolIds = deriveLinkedProtocolIds(blocks);
  entry.linkedEntityIds = deriveLinkedEntityIds(blocks);
  entry.latestVersionNumber += 1;
  entry.updatedAt = new Date().toISOString();

  await saveDemoStore(store);

  return {
    id: entry.id,
    versionNumber: entry.latestVersionNumber,
  };
}

export async function autosaveDemoEntryDraft(
  input: Omit<UpdateEntryDraftInput, "userId">,
) {
  const store = await ensureDemoStore();
  const entry = store.entries.find((record) => record.id === input.entryId);

  if (!entry) {
    throw new Error(`Demo entry ${input.entryId} was not found.`);
  }

  const protocolsById = new Map(
    store.protocols.map((protocol) => [protocol.id, protocol]),
  );
  const validProtocolIds = new Set(store.protocols.map((protocol) => protocol.id));
  const blocks = normalizeEntryBlocks(
    input.blocks.filter(
      (block) =>
        block.type !== "protocol" || validProtocolIds.has(block.protocolId),
    ),
  );

  entry.title = input.title.trim();
  entry.summary = input.summary?.trim() || deriveSummary(blocks, protocolsById);
  entry.blocks = blocks;
  entry.bodyText = deriveBodyText(blocks, protocolsById);
  entry.linkedProtocolIds = deriveLinkedProtocolIds(blocks);
  entry.linkedEntityIds = deriveLinkedEntityIds(blocks);
  entry.updatedAt = new Date().toISOString();

  await saveDemoStore(store);

  return {
    id: entry.id,
    versionNumber: entry.latestVersionNumber,
  };
}

export async function deleteDemoEntry(entryId: string) {
  const store = await ensureDemoStore();
  const entryIndex = store.entries.findIndex((record) => record.id === entryId);

  if (entryIndex === -1) {
    throw new Error(`Demo entry ${entryId} was not found.`);
  }

  const [entry] = store.entries.splice(entryIndex, 1);

  await saveDemoStore(store);

  return {
    id: entry.id,
  };
}
