"use client";

import Link from "next/link";
import {
  DndContext,
  MouseSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type {
  EntryListItem,
  PlanningExperimentItem,
  PlanningProjectItem,
  PlanningTaskItem,
  PlanningTaskStatusValue,
  PlanningWhiteboardDetail,
  PlanningWhiteboardListItem,
} from "@biota/db";
import { planningTaskStatuses } from "@biota/db";
import {
  createPlanningExperimentAction,
  createPlanningProjectAction,
  createPlanningTaskAction,
  createPlanningWhiteboardAction,
  deletePlanningExperimentAction,
  deletePlanningProjectAction,
  deletePlanningTaskAction,
  deletePlanningWhiteboardAction,
  updatePlanningExperimentAction,
  updatePlanningProjectAction,
  updatePlanningTaskAction,
  updatePlanningWhiteboardAction,
} from "@/lib/planning/actions";

const statusLabels: Record<PlanningTaskStatusValue, string> = {
  QUEUED: "Queued",
  SCHEDULED: "Scheduled",
  DONE: "Done",
};

type PlanningWorkspaceProps = {
  initialWhiteboard: PlanningWhiteboardDetail;
  whiteboards: PlanningWhiteboardListItem[];
  entries: EntryListItem[];
};

type TaskLocation = {
  projectId: string;
  experimentId: string;
  status: PlanningTaskStatusValue;
  task: PlanningTaskItem;
};

function hiddenInput(name: string, value: string | number | null | undefined) {
  return <input type="hidden" name={name} value={value ?? ""} />;
}

function laneId(experimentId: string, status: PlanningTaskStatusValue) {
  return `${experimentId}::${status}`;
}

function parseLaneId(value: string) {
  const [experimentId, status] = value.split("::");

  if (!experimentId || !planningTaskStatuses.includes(status as PlanningTaskStatusValue)) {
    return null;
  }

  return {
    experimentId,
    status: status as PlanningTaskStatusValue,
  };
}

function getTasksForStatus(
  experiment: PlanningExperimentItem,
  status: PlanningTaskStatusValue,
) {
  return experiment.tasks
    .filter((task) => task.status === status)
    .sort((left, right) => left.sortOrder - right.sortOrder);
}

function findTaskLocation(
  whiteboard: PlanningWhiteboardDetail,
  taskId: string,
): TaskLocation | null {
  for (const project of whiteboard.projects) {
    for (const experiment of project.experiments) {
      const task = experiment.tasks.find((record) => record.id === taskId);

      if (task) {
        return {
          projectId: project.id,
          experimentId: experiment.id,
          status: task.status,
          task,
        };
      }
    }
  }

  return null;
}

function getOverTarget(
  whiteboard: PlanningWhiteboardDetail,
  overId: string,
) {
  const lane = parseLaneId(overId);

  if (lane) {
    return { ...lane, overTaskId: null as string | null };
  }

  const taskLocation = findTaskLocation(whiteboard, overId);

  if (!taskLocation) {
    return null;
  }

  return {
    experimentId: taskLocation.experimentId,
    status: taskLocation.status,
    overTaskId: overId,
  };
}

function moveTask(
  whiteboard: PlanningWhiteboardDetail,
  taskId: string,
  targetExperimentId: string,
  targetStatus: PlanningTaskStatusValue,
  overTaskId: string | null,
) {
  const movingLocation = findTaskLocation(whiteboard, taskId);

  if (!movingLocation) {
    return whiteboard;
  }

  const movingTask = {
    ...movingLocation.task,
    experimentId: targetExperimentId,
    status: targetStatus,
  };

  return {
    ...whiteboard,
    projects: whiteboard.projects.map((project) => ({
      ...project,
      experiments: project.experiments.map((experiment) => {
        let tasks = experiment.tasks.filter((task) => task.id !== taskId);

        if (experiment.id === targetExperimentId) {
          const targetLaneTasks = tasks
            .filter((task) => task.status === targetStatus)
            .sort((left, right) => left.sortOrder - right.sortOrder);
          const insertIndex = overTaskId
            ? Math.max(
                0,
                targetLaneTasks.findIndex((task) => task.id === overTaskId),
              )
            : targetLaneTasks.length;
          const reorderedLane = targetLaneTasks.slice();

          reorderedLane.splice(
            insertIndex === -1 ? targetLaneTasks.length : insertIndex,
            0,
            movingTask,
          );
          tasks = tasks
            .filter((task) => task.status !== targetStatus)
            .concat(
              reorderedLane.map((task, sortOrder) => ({
                ...task,
                status: targetStatus,
                sortOrder,
              })),
            );
        }

        return {
          ...experiment,
          tasks,
        };
      }),
    })),
  };
}

function collectTaskOrders(
  whiteboard: PlanningWhiteboardDetail,
  experimentIds: string[],
) {
  const affectedExperimentIds = new Set(experimentIds);
  const orders: Array<{
    experimentId: string;
    status: PlanningTaskStatusValue;
    taskIds: string[];
  }> = [];

  for (const project of whiteboard.projects) {
    for (const experiment of project.experiments) {
      if (!affectedExperimentIds.has(experiment.id)) {
        continue;
      }

      for (const status of planningTaskStatuses) {
        orders.push({
          experimentId: experiment.id,
          status,
          taskIds: getTasksForStatus(experiment, status).map((task) => task.id),
        });
      }
    }
  }

  return orders;
}

function DateField({
  name,
  defaultValue,
  label,
}: {
  name: string;
  defaultValue?: string | null;
  label: string;
}) {
  return (
    <label className="grid gap-1 text-[11px] uppercase tracking-[0.14em] text-[color:var(--text-soft)]">
      <span>{label}</span>
      <input
        type="date"
        name={name}
        defaultValue={defaultValue ?? ""}
        className="min-h-8 border border-[color:var(--line)] bg-transparent px-2 text-sm normal-case tracking-normal text-[color:var(--text-primary)] outline-none focus:border-[color:var(--line-strong)]"
      />
    </label>
  );
}

function InlineTextInput({
  name,
  defaultValue,
  placeholder,
}: {
  name: string;
  defaultValue?: string;
  placeholder: string;
}) {
  return (
    <input
      name={name}
      defaultValue={defaultValue}
      required
      placeholder={placeholder}
      className="min-h-8 min-w-0 flex-1 border border-[color:var(--line)] bg-transparent px-2 text-sm text-[color:var(--text-primary)] outline-none placeholder:text-[color:var(--text-soft)] focus:border-[color:var(--line-strong)]"
    />
  );
}

function CompactButton({
  children,
  type = "submit",
}: {
  children: ReactNode;
  type?: "submit" | "button";
}) {
  return (
    <button
      type={type}
      className="inline-flex min-h-8 shrink-0 items-center justify-center border border-[color:var(--line)] px-2.5 text-xs text-[color:var(--text-muted)] transition hover:border-[color:var(--line-strong)] hover:text-[color:var(--text-primary)]"
    >
      {children}
    </button>
  );
}

function TaskCard({
  task,
  whiteboardId,
  experimentId,
  entries,
}: {
  task: PlanningTaskItem;
  whiteboardId: string;
  experimentId: string;
  entries: EntryListItem[];
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: {
      type: "task",
      experimentId,
      status: task.status,
    },
  });
  const linkedEntryIds = new Set(task.entryLinks.map((entry) => entry.id));

  return (
    <article
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={`border border-[color:var(--line)] bg-[color:var(--document-surface)] p-3 text-sm ${
        isDragging ? "opacity-60 shadow-lg" : ""
      }`}
    >
      <div
        style={{ touchAction: "none" }}
        className="flex w-full cursor-grab items-start justify-between gap-3 text-left active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <span className="font-medium text-[color:var(--text-primary)]">{task.title}</span>
        <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-[color:var(--text-soft)]">
          {task.entryLinks.length ? `${task.entryLinks.length} links` : "Task"}
        </span>
      </div>
      {task.startDate || task.endDate ? (
        <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.12em] text-[color:var(--text-soft)]">
          {task.startDate ?? "Open"} - {task.endDate ?? task.startDate ?? "Open"}
        </p>
      ) : null}
      {task.entryLinks.length ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {task.entryLinks.map((entry) => (
            <Link
              key={entry.id}
              href={`/entries/${entry.id}`}
              className="border border-[color:var(--line)] px-1.5 py-0.5 text-xs text-[color:var(--text-muted)] transition hover:border-[color:var(--line-strong)] hover:text-[color:var(--text-primary)]"
            >
              {entry.title}
            </Link>
          ))}
        </div>
      ) : null}
      <details className="mt-3">
        <summary className="cursor-pointer font-mono text-[11px] uppercase tracking-[0.14em] text-[color:var(--text-soft)]">
          Edit
        </summary>
        <form action={updatePlanningTaskAction} className="mt-3 space-y-2">
          {hiddenInput("whiteboardId", whiteboardId)}
          {hiddenInput("experimentId", experimentId)}
          {hiddenInput("taskId", task.id)}
          <InlineTextInput
            name="title"
            defaultValue={task.title}
            placeholder="Task title"
          />
          <textarea
            name="notes"
            defaultValue={task.notes ?? ""}
            placeholder="Notes"
            className="min-h-20 w-full border border-[color:var(--line)] bg-transparent px-2 py-2 text-sm text-[color:var(--text-primary)] outline-none placeholder:text-[color:var(--text-soft)] focus:border-[color:var(--line-strong)]"
          />
          <div className="grid grid-cols-3 gap-2">
            <label className="grid gap-1 text-[11px] uppercase tracking-[0.14em] text-[color:var(--text-soft)]">
              <span>Status</span>
              <select
                name="status"
                defaultValue={task.status}
                className="min-h-8 border border-[color:var(--line)] bg-transparent px-2 text-sm normal-case tracking-normal text-[color:var(--text-primary)] outline-none"
              >
                {planningTaskStatuses.map((status) => (
                  <option key={status} value={status}>
                    {statusLabels[status]}
                  </option>
                ))}
              </select>
            </label>
            <DateField
              name="startDate"
              label="Start"
              defaultValue={task.explicitStartDate}
            />
            <DateField name="endDate" label="End" defaultValue={task.explicitEndDate} />
          </div>
          <fieldset className="max-h-32 overflow-auto border border-[color:var(--line)] p-2">
            <legend className="px-1 font-mono text-[10px] uppercase tracking-[0.14em] text-[color:var(--text-soft)]">
              Linked entries
            </legend>
            <div className="space-y-1">
              {entries.map((entry) => (
                <label
                  key={entry.id}
                  className="flex items-center gap-2 text-xs text-[color:var(--text-muted)]"
                >
                  <input
                    type="checkbox"
                    name="linkedEntryIds"
                    value={entry.id}
                    defaultChecked={linkedEntryIds.has(entry.id)}
                  />
                  <span className="truncate">{entry.title}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="flex gap-2">
            <CompactButton>Save task</CompactButton>
          </div>
        </form>
        <form action={deletePlanningTaskAction} className="mt-2">
          {hiddenInput("whiteboardId", whiteboardId)}
          {hiddenInput("taskId", task.id)}
          <button
            type="submit"
            className="text-xs text-[color:var(--danger)] transition hover:underline"
          >
            Delete task
          </button>
        </form>
      </details>
    </article>
  );
}

function TaskLane({
  status,
  experiment,
  whiteboardId,
  entries,
}: {
  status: PlanningTaskStatusValue;
  experiment: PlanningExperimentItem;
  whiteboardId: string;
  entries: EntryListItem[];
}) {
  const tasks = getTasksForStatus(experiment, status);
  const { setNodeRef, isOver } = useDroppable({
    id: laneId(experiment.id, status),
    data: {
      type: "lane",
      experimentId: experiment.id,
      status,
    },
  });

  return (
    <section
      ref={setNodeRef}
      className={`min-h-48 border border-[color:var(--line)] bg-[color:var(--surface-muted)] p-2 ${
        isOver ? "outline outline-1 outline-[color:var(--accent-soft)]" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-2 px-1 py-1">
        <h4 className="text-sm font-medium text-[color:var(--text-primary)]">
          {statusLabels[status]}
        </h4>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[color:var(--text-soft)]">
          {tasks.length}
        </span>
      </div>
      <SortableContext items={tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
        <div className="mt-2 space-y-2">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              whiteboardId={whiteboardId}
              experimentId={experiment.id}
              entries={entries}
            />
          ))}
        </div>
      </SortableContext>
      <form action={createPlanningTaskAction} className="mt-3 space-y-2">
        {hiddenInput("whiteboardId", whiteboardId)}
        {hiddenInput("experimentId", experiment.id)}
        {hiddenInput("status", status)}
        <InlineTextInput name="title" placeholder="New task" />
        <div className="grid grid-cols-2 gap-2">
          <DateField name="startDate" label="Start" />
          <DateField name="endDate" label="End" />
        </div>
        <CompactButton>Add task</CompactButton>
      </form>
    </section>
  );
}

function ExperimentBoard({
  experiment,
  whiteboardId,
  projectId,
  entries,
}: {
  experiment: PlanningExperimentItem;
  whiteboardId: string;
  projectId: string;
  entries: EntryListItem[];
}) {
  return (
    <section className="border border-[color:var(--line)] bg-[color:var(--document-surface)] p-4">
      <form action={updatePlanningExperimentAction} className="flex flex-wrap gap-2">
        {hiddenInput("whiteboardId", whiteboardId)}
        {hiddenInput("projectId", projectId)}
        {hiddenInput("experimentId", experiment.id)}
        <InlineTextInput
          name="title"
          defaultValue={experiment.title}
          placeholder="Experiment title"
        />
        <DateField
          name="startDate"
          label="Start"
          defaultValue={experiment.explicitStartDate}
        />
        <DateField name="endDate" label="End" defaultValue={experiment.explicitEndDate} />
        <CompactButton>Save</CompactButton>
      </form>
      <div className="mt-4 grid gap-3 xl:grid-cols-3">
        {planningTaskStatuses.map((status) => (
          <TaskLane
            key={status}
            status={status}
            experiment={experiment}
            whiteboardId={whiteboardId}
            entries={entries}
          />
        ))}
      </div>
      <form action={deletePlanningExperimentAction} className="mt-3">
        {hiddenInput("whiteboardId", whiteboardId)}
        {hiddenInput("experimentId", experiment.id)}
        <button
          type="submit"
          className="text-xs text-[color:var(--danger)] transition hover:underline"
        >
          Delete experiment
        </button>
      </form>
    </section>
  );
}

function ProjectSection({
  project,
  whiteboardId,
  entries,
}: {
  project: PlanningProjectItem;
  whiteboardId: string;
  entries: EntryListItem[];
}) {
  return (
    <section className="border border-[color:var(--line)] bg-[color:var(--document-surface)] p-4">
      <form action={updatePlanningProjectAction} className="flex flex-wrap gap-2">
        {hiddenInput("whiteboardId", whiteboardId)}
        {hiddenInput("projectId", project.id)}
        <InlineTextInput
          name="title"
          defaultValue={project.title}
          placeholder="Project title"
        />
        <DateField
          name="startDate"
          label="Start"
          defaultValue={project.explicitStartDate}
        />
        <DateField name="endDate" label="End" defaultValue={project.explicitEndDate} />
        <CompactButton>Save</CompactButton>
      </form>
      <div className="mt-4 space-y-4">
        {project.experiments.map((experiment) => (
          <ExperimentBoard
            key={experiment.id}
            experiment={experiment}
            projectId={project.id}
            whiteboardId={whiteboardId}
            entries={entries}
          />
        ))}
      </div>
      <form action={createPlanningExperimentAction} className="mt-4 flex flex-wrap gap-2">
        {hiddenInput("whiteboardId", whiteboardId)}
        {hiddenInput("projectId", project.id)}
        <InlineTextInput name="title" placeholder="New experiment" />
        <DateField name="startDate" label="Start" />
        <DateField name="endDate" label="End" />
        <CompactButton>Add experiment</CompactButton>
      </form>
      <form action={deletePlanningProjectAction} className="mt-3">
        {hiddenInput("whiteboardId", whiteboardId)}
        {hiddenInput("projectId", project.id)}
        <button
          type="submit"
          className="text-xs text-[color:var(--danger)] transition hover:underline"
        >
          Delete project
        </button>
      </form>
    </section>
  );
}

function WhiteboardView({
  whiteboard,
  entries,
}: {
  whiteboard: PlanningWhiteboardDetail;
  entries: EntryListItem[];
}) {
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  );

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (!over || typeof active.id !== "string" || typeof over.id !== "string") {
      return;
    }

    const source = findTaskLocation(whiteboard, active.id);
    const target = getOverTarget(whiteboard, over.id);

    if (!source || !target) {
      return;
    }

    const nextWhiteboard = moveTask(
      whiteboard,
      active.id,
      target.experimentId,
      target.status,
      target.overTaskId,
    );
    const taskOrders = collectTaskOrders(nextWhiteboard, [
      source.experimentId,
      target.experimentId,
    ]);

    window.dispatchEvent(
      new CustomEvent("biota-planning-local-update", {
        detail: nextWhiteboard,
      }),
    );

    await fetch("/api/planning/tasks/reorder", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        whiteboardId: whiteboard.id,
        taskId: active.id,
        targetExperimentId: target.experimentId,
        status: target.status,
        taskOrders,
      }),
    });
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
      <div className="space-y-4">
        {whiteboard.projects.map((project) => (
          <ProjectSection
            key={project.id}
            project={project}
            whiteboardId={whiteboard.id}
            entries={entries}
          />
        ))}
        <form action={createPlanningProjectAction} className="flex flex-wrap gap-2 border border-[color:var(--line)] bg-[color:var(--document-surface)] p-4">
          {hiddenInput("whiteboardId", whiteboard.id)}
          <InlineTextInput name="title" placeholder="New project" />
          <DateField name="startDate" label="Start" />
          <DateField name="endDate" label="End" />
          <CompactButton>Add project</CompactButton>
        </form>
      </div>
    </DndContext>
  );
}

type TimelineRow = {
  id: string;
  title: string;
  level: "project" | "experiment" | "task";
  startDate: string | null;
  endDate: string | null;
  source: string | null;
};

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function daysBetween(start: string, end: string) {
  const startMs = new Date(`${start}T00:00:00.000Z`).getTime();
  const endMs = new Date(`${end}T00:00:00.000Z`).getTime();

  return Math.max(0, Math.round((endMs - startMs) / 86_400_000));
}

function TimelineView({ whiteboard }: { whiteboard: PlanningWhiteboardDetail }) {
  const rows: TimelineRow[] = [];

  for (const project of whiteboard.projects) {
    rows.push({
      id: project.id,
      title: project.title,
      level: "project",
      startDate: project.startDate,
      endDate: project.endDate,
      source: project.source,
    });

    for (const experiment of project.experiments) {
      rows.push({
        id: experiment.id,
        title: experiment.title,
        level: "experiment",
        startDate: experiment.startDate,
        endDate: experiment.endDate,
        source: experiment.source,
      });

      for (const task of experiment.tasks) {
        rows.push({
          id: task.id,
          title: task.title,
          level: "task",
          startDate: task.startDate,
          endDate: task.endDate,
          source: task.source,
        });
      }
    }
  }

  const scheduledRows = rows.filter((row) => row.startDate && row.endDate);
  const unscheduledRows = rows.filter((row) => !row.startDate || !row.endDate);
  const dates = scheduledRows.flatMap((row) => [row.startDate, row.endDate]) as string[];
  dates.sort();
  const minDate = dates[0] ?? new Date().toISOString().slice(0, 10);
  const maxDate = dates[dates.length - 1] ?? minDate;
  const totalDays = Math.min(120, daysBetween(minDate, maxDate) + 1);
  const timelineDays = Array.from({ length: Math.max(1, totalDays) }, (_, index) =>
    addDays(new Date(`${minDate}T00:00:00.000Z`), index).toISOString().slice(0, 10),
  );

  return (
    <div className="border border-[color:var(--line)] bg-[color:var(--document-surface)] p-4">
      <div className="overflow-x-auto">
        <div className="min-w-[760px]">
          <div className="grid grid-cols-[220px_minmax(520px,1fr)] border-b border-[color:var(--line)] pb-2 font-mono text-[10px] uppercase tracking-[0.12em] text-[color:var(--text-soft)]">
            <span>Item</span>
            <div
              className="grid"
              style={{ gridTemplateColumns: `repeat(${timelineDays.length}, minmax(28px, 1fr))` }}
            >
              {timelineDays.map((day) => (
                <span key={day} className="border-l border-[color:var(--line)] pl-1">
                  {day.slice(5)}
                </span>
              ))}
            </div>
          </div>
          <div className="divide-y divide-[color:var(--line)]">
            {scheduledRows.map((row) => {
              const start = row.startDate ?? minDate;
              const end = row.endDate ?? start;
              const startColumn = daysBetween(minDate, start) + 1;
              const span = Math.max(1, daysBetween(start, end) + 1);

              return (
                <div
                  key={row.id}
                  className="grid min-h-10 grid-cols-[220px_minmax(520px,1fr)] items-center py-2"
                >
                  <div className={`truncate pr-3 text-sm ${
                    row.level === "project"
                      ? "font-semibold"
                      : row.level === "experiment"
                        ? "pl-4"
                        : "pl-8 text-[color:var(--text-muted)]"
                  }`}
                  >
                    {row.title}
                    {row.source === "derived" ? (
                      <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.12em] text-[color:var(--text-soft)]">
                        derived
                      </span>
                    ) : null}
                  </div>
                  <div
                    className="grid h-5"
                    style={{ gridTemplateColumns: `repeat(${timelineDays.length}, minmax(28px, 1fr))` }}
                  >
                    <span
                      className={`h-5 border ${
                        row.level === "project"
                          ? "border-[color:var(--accent-soft)] bg-[color:var(--accent-muted)]"
                          : row.level === "experiment"
                            ? "border-[color:var(--line-strong)] bg-[color:var(--surface-muted)]"
                            : "border-[color:var(--line)] bg-[color:var(--document-surface)]"
                      }`}
                      style={{
                        gridColumn: `${startColumn} / span ${span}`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {unscheduledRows.length ? (
        <div className="mt-5 border-t border-[color:var(--line)] pt-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[color:var(--text-soft)]">
            Unscheduled
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {unscheduledRows.map((row) => (
              <span
                key={row.id}
                className="border border-[color:var(--line)] px-2 py-1 text-xs text-[color:var(--text-muted)]"
              >
                {row.title}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function PlanningWorkspace({
  initialWhiteboard,
  whiteboards,
  entries,
}: PlanningWorkspaceProps) {
  const [whiteboard, setWhiteboard] = useState(initialWhiteboard);
  const [activeTab, setActiveTab] = useState<"whiteboard" | "timeline">("whiteboard");

  useEffect(() => {
    setWhiteboard(initialWhiteboard);
  }, [initialWhiteboard]);

  useEffect(() => {
    function handleLocalUpdate(event: Event) {
      const detail = (event as CustomEvent<PlanningWhiteboardDetail>).detail;

      if (detail?.id === initialWhiteboard.id) {
        setWhiteboard(detail);
      }
    }

    window.addEventListener("biota-planning-local-update", handleLocalUpdate);
    return () => {
      window.removeEventListener("biota-planning-local-update", handleLocalUpdate);
    };
  }, [initialWhiteboard.id]);

  const projectCount = useMemo(() => whiteboard.projects.length, [whiteboard.projects]);

  return (
    <section className="min-h-[calc(100vh-3rem)] border border-[color:var(--line)] bg-[color:var(--surface)]">
      <div className="border-b border-[color:var(--line)] bg-[color:var(--document-surface)] px-5 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <form action={updatePlanningWhiteboardAction} className="flex min-w-0 flex-1 gap-2">
            {hiddenInput("whiteboardId", whiteboard.id)}
            <input
              name="title"
              defaultValue={whiteboard.title}
              className="min-w-0 flex-1 bg-transparent text-xl font-semibold text-[color:var(--text-primary)] outline-none"
            />
            <CompactButton>Rename</CompactButton>
          </form>
          <form action={deletePlanningWhiteboardAction}>
            {hiddenInput("whiteboardId", whiteboard.id)}
            <CompactButton>Delete board</CompactButton>
          </form>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {whiteboards.map((board) => (
            <Link
              key={board.id}
              href={`/planning/${board.id}`}
              className={`border px-2 py-1 text-xs transition ${
                board.id === whiteboard.id
                  ? "border-[color:var(--accent-soft)] bg-[color:var(--accent-muted)] text-[color:var(--text-primary)]"
                  : "border-[color:var(--line)] text-[color:var(--text-muted)] hover:border-[color:var(--line-strong)] hover:text-[color:var(--text-primary)]"
              }`}
            >
              {board.title}
            </Link>
          ))}
          <form action={createPlanningWhiteboardAction} className="ml-auto flex gap-2">
            <InlineTextInput name="title" placeholder="New whiteboard" />
            <CompactButton>Create</CompactButton>
          </form>
        </div>
      </div>
      <div className="flex h-9 items-end gap-6 border-b border-[color:var(--line)] bg-[color:var(--document-surface)] px-5 text-sm text-[color:var(--text-muted)]">
        <button
          type="button"
          onClick={() => setActiveTab("whiteboard")}
          className={`h-9 border-b-2 ${
            activeTab === "whiteboard"
              ? "border-[color:var(--text-primary)] font-semibold text-[color:var(--text-primary)]"
              : "border-transparent"
          }`}
        >
          Whiteboard
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("timeline")}
          className={`h-9 border-b-2 ${
            activeTab === "timeline"
              ? "border-[color:var(--text-primary)] font-semibold text-[color:var(--text-primary)]"
              : "border-transparent"
          }`}
        >
          Timeline
        </button>
        <span className="ml-auto pb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-[color:var(--text-soft)]">
          {projectCount} projects
        </span>
      </div>
      <div className="p-5">
        {activeTab === "whiteboard" ? (
          <WhiteboardView whiteboard={whiteboard} entries={entries} />
        ) : (
          <TimelineView whiteboard={whiteboard} />
        )}
      </div>
    </section>
  );
}
