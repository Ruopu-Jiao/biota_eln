import { useMemo, useState, type DragEvent } from "react";
import { Icon, type IconName } from "@/components/Icon";
import type { BiotaTask, TaskState } from "@/types";

type PlanningView = "inbox" | "today" | "board" | "calendar" | "timeline";

const views: Array<{ id: PlanningView; label: string; icon: IconName }> = [
  { id: "inbox", label: "Inbox", icon: "inbox" },
  { id: "today", label: "Today", icon: "check" },
  { id: "board", label: "Board", icon: "layout" },
  { id: "calendar", label: "Calendar", icon: "calendar" },
  { id: "timeline", label: "Timeline", icon: "timeline" },
];

const boardColumns: Array<{
  state: TaskState;
  title: string;
  subtitle: string;
  tone: string;
}> = [
  { state: "inbox", title: "Inbox", subtitle: "Unscheduled", tone: "slate" },
  {
    state: "scheduled",
    title: "Scheduled",
    subtitle: "Ready to work",
    tone: "ochre",
  },
  {
    state: "waiting",
    title: "Waiting",
    subtitle: "Blocked or delegated",
    tone: "plum",
  },
  { state: "done", title: "Done", subtitle: "Completed", tone: "green" },
];

interface PlanningWorkspaceProps {
  tasks: BiotaTask[];
  onToggle: (task: BiotaTask, checked: boolean) => void;
  onMove: (task: BiotaTask, state: TaskState) => void;
  onOpenRecord: (path: string) => void;
  onCreateRecord: () => void;
}

function friendlyDate(date?: string) {
  if (!date) return "No date";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}

function localDateKey(value = new Date()) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateFromKey(value: string) {
  return new Date(`${value}T12:00:00`);
}

function addDays(value: Date, days: number) {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
}

function daysBetween(left: Date, right: Date) {
  return Math.round((right.getTime() - left.getTime()) / 86_400_000);
}

function TaskCard({
  task,
  compact = false,
  onToggle,
  onOpenRecord,
}: {
  task: BiotaTask;
  compact?: boolean;
  onToggle: (checked: boolean) => void;
  onOpenRecord: () => void;
}) {
  const today = localDateKey();
  return (
    <article
      className={`task-card ${compact ? "is-compact" : ""} ${task.checked ? "is-done" : ""}`}
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData("text/biota-task", task.id);
        event.dataTransfer.effectAllowed = "move";
      }}
    >
      <button
        className={`task-checkbox ${task.checked ? "is-checked" : ""}`}
        onClick={() => onToggle(!task.checked)}
        aria-label={task.checked ? "Mark incomplete" : "Mark complete"}
      >
        {task.checked ? <Icon name="check" size={12} /> : null}
      </button>
      <div className="task-card-copy">
        <strong>{task.title}</strong>
        <button className="task-record-link" onClick={onOpenRecord}>
          <Icon name="experiment" size={12} />
          {task.recordTitle}
        </button>
        {!compact ? (
          <div className="task-meta">
            {task.due ? (
              <span className={task.due === today ? "is-today" : ""}>
                <Icon name="calendar" size={11} />
                {task.due === today ? "Today" : friendlyDate(task.due)}
              </span>
            ) : null}
            {task.priority === "high" ? <em>High priority</em> : null}
          </div>
        ) : null}
      </div>
      <button className="task-more" aria-label="Task options">
        <Icon name="dots" size={16} />
      </button>
    </article>
  );
}

function InboxView({
  tasks,
  onToggle,
  onOpenRecord,
}: Pick<PlanningWorkspaceProps, "tasks" | "onToggle" | "onOpenRecord">) {
  const inboxTasks = tasks.filter(
    (task) => task.state === "inbox" && !task.checked
  );
  return (
    <div className="planning-list-view">
      <div className="planning-page-heading">
        <div>
          <p className="eyebrow">CAPTURE</p>
          <h1>Inbox</h1>
          <p>Loose ends gathered from every note in your vault.</p>
        </div>
        <span className="large-count">{inboxTasks.length}</span>
      </div>
      <div className="planning-list">
        {inboxTasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onToggle={(checked) => onToggle(task, checked)}
            onOpenRecord={() => onOpenRecord(task.recordPath)}
          />
        ))}
      </div>
    </div>
  );
}

function TodayView({
  tasks,
  onToggle,
  onOpenRecord,
}: Pick<PlanningWorkspaceProps, "tasks" | "onToggle" | "onOpenRecord">) {
  const today = localDateKey();
  const todayLabel = new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
  })
    .format(dateFromKey(today))
    .toUpperCase();
  const todayTasks = tasks.filter(
    (task) => !task.checked && (task.start === today || task.due === today)
  );
  return (
    <div className="planning-list-view">
      <div className="planning-page-heading today-heading">
        <div>
          <p className="eyebrow">{todayLabel}</p>
          <h1>Today</h1>
          <p>Keep the day small enough to finish.</p>
        </div>
        <div className="today-progress">
          <strong>{todayTasks.length}</strong>
          <span>remaining</span>
        </div>
      </div>
      <div className="today-banner">
        <span className="sun-mark">☼</span>
        <div>
          <strong>Good afternoon</strong>
          <span>Your schedule is projected directly from Markdown tasks.</span>
        </div>
        <span>{todayTasks.length} tasks planned</span>
      </div>
      <div className="planning-list">
        {todayTasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onToggle={(checked) => onToggle(task, checked)}
            onOpenRecord={() => onOpenRecord(task.recordPath)}
          />
        ))}
      </div>
    </div>
  );
}

function BoardView({
  tasks,
  onToggle,
  onMove,
  onOpenRecord,
}: PlanningWorkspaceProps) {
  function allowDrop(event: DragEvent) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }

  return (
    <div className="board-view">
      <div className="planning-page-heading board-heading">
        <div>
          <p className="eyebrow">ALL PROJECTS</p>
          <h1>Research board</h1>
        </div>
        <div className="board-heading-actions">
          <button className="button button-quiet">
            <Icon name="tag" size={14} /> Filter
          </button>
          <button className="button button-secondary">
            <Icon name="add" size={14} /> Add task
          </button>
        </div>
      </div>
      <div className="kanban-board">
        {boardColumns.map((column) => {
          const columnTasks = tasks.filter(
            (task) => task.state === column.state
          );
          return (
            <section
              className="kanban-column"
              key={column.state}
              onDragOver={allowDrop}
              onDrop={(event) => {
                event.preventDefault();
                const id = event.dataTransfer.getData("text/biota-task");
                const task = tasks.find((candidate) => candidate.id === id);
                if (task && task.state !== column.state)
                  onMove(task, column.state);
              }}
            >
              <header>
                <span className={`column-dot tone-${column.tone}`} />
                <div>
                  <strong>{column.title}</strong>
                  <small>{column.subtitle}</small>
                </div>
                <span className="column-count">{columnTasks.length}</span>
              </header>
              <div className="kanban-cards">
                {columnTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onToggle={(checked) => onToggle(task, checked)}
                    onOpenRecord={() => onOpenRecord(task.recordPath)}
                  />
                ))}
                <button className="add-task-card">
                  <Icon name="add" size={14} /> Add task
                </button>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function CalendarView({
  tasks,
  onToggle,
  onOpenRecord,
}: Pick<PlanningWorkspaceProps, "tasks" | "onToggle" | "onOpenRecord">) {
  const [weekOffset, setWeekOffset] = useState(0);
  const today = dateFromKey(localDateKey());
  const monday = addDays(today, -((today.getDay() + 6) % 7) + weekOffset * 7);
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(monday, index);
    return [
      new Intl.DateTimeFormat("en", { weekday: "short" }).format(date),
      String(date.getDate()),
      localDateKey(date),
    ] as const;
  });
  const lastDay = addDays(monday, 6);
  const rangeStart = new Intl.DateTimeFormat("en", {
    month: "long",
    day: "numeric",
  }).format(monday);
  const rangeEnd = new Intl.DateTimeFormat("en", {
    month: monday.getMonth() === lastDay.getMonth() ? undefined : "long",
    day: "numeric",
    year:
      monday.getFullYear() === lastDay.getFullYear() ? undefined : "numeric",
  }).format(lastDay);
  return (
    <div className="calendar-view">
      <div className="planning-page-heading board-heading">
        <div>
          <p className="eyebrow">MARKDOWN SCHEDULE</p>
          <h1>
            {rangeStart} – {rangeEnd}
          </h1>
        </div>
        <div className="board-heading-actions">
          <button
            className="icon-button"
            onClick={() => setWeekOffset((value) => value - 1)}
            aria-label="Previous week"
          >
            <Icon name="back" size={15} />
          </button>
          <button
            className="button button-quiet"
            onClick={() => setWeekOffset(0)}
          >
            Today
          </button>
          <button
            className="icon-button"
            onClick={() => setWeekOffset((value) => value + 1)}
            aria-label="Next week"
          >
            <Icon name="back" size={15} className="flip-horizontal" />
          </button>
        </div>
      </div>
      <div className="week-grid">
        {days.map(([label, day, date]) => (
          <section
            key={date}
            className={date === localDateKey() ? "is-today" : ""}
          >
            <header>
              <span>{label}</span>
              <strong>{day}</strong>
            </header>
            <div>
              {tasks
                .filter((task) => task.start === date || task.due === date)
                .map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    compact
                    onToggle={(checked) => onToggle(task, checked)}
                    onOpenRecord={() => onOpenRecord(task.recordPath)}
                  />
                ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function TimelineView({
  tasks,
  onOpenRecord,
}: Pick<PlanningWorkspaceProps, "tasks" | "onOpenRecord">) {
  const windowStart = dateFromKey(localDateKey());
  const windowEnd = addDays(windowStart, 13);
  const datedTasks = tasks.filter((task) => {
    const start = dateFromKey(task.start ?? task.due ?? localDateKey());
    const end = dateFromKey(task.due ?? task.start ?? localDateKey());
    return end >= windowStart && start <= windowEnd;
  });
  return (
    <div className="timeline-view">
      <div className="planning-page-heading board-heading">
        <div>
          <p className="eyebrow">NEXT 14 DAYS</p>
          <h1>Experiment timeline</h1>
        </div>
      </div>
      <div className="timeline-chart">
        <div className="timeline-days">
          {Array.from({ length: 14 }, (_, index) => (
            <span key={index}>{addDays(windowStart, index).getDate()}</span>
          ))}
        </div>
        {datedTasks.map((task, index) => {
          const start = dateFromKey(task.start ?? task.due ?? localDateKey());
          const due = dateFromKey(task.due ?? task.start ?? localDateKey());
          const normalizedStart = Math.max(0, daysBetween(windowStart, start));
          const normalizedEnd = Math.min(13, daysBetween(windowStart, due));
          return (
            <div className="timeline-row" key={task.id}>
              <button onClick={() => onOpenRecord(task.recordPath)}>
                {task.title}
              </button>
              <div>
                <span
                  className={`timeline-bar priority-${task.priority}`}
                  style={{
                    left: `${(normalizedStart / 14) * 100}%`,
                    width: `${Math.max(
                      100 / 14,
                      ((normalizedEnd - normalizedStart + 1) / 14) * 100
                    )}%`,
                  }}
                >
                  {index < 4 ? task.recordTitle : ""}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function PlanningWorkspace(props: PlanningWorkspaceProps) {
  const [view, setView] = useState<PlanningView>("board");
  const today = localDateKey();
  const counts = useMemo(
    () => ({
      inbox: props.tasks.filter(
        (task) => task.state === "inbox" && !task.checked
      ).length,
      today: props.tasks.filter(
        (task) => !task.checked && (task.start === today || task.due === today)
      ).length,
    }),
    [props.tasks, today]
  );

  return (
    <div className="planning-workspace">
      <aside className="planning-sidebar">
        <div className="planning-sidebar-heading">
          <span>Plan</span>
          <button aria-label="Planning options">
            <Icon name="dots" size={16} />
          </button>
        </div>
        <nav>
          {views.map((item) => (
            <button
              key={item.id}
              className={view === item.id ? "is-active" : ""}
              onClick={() => setView(item.id)}
            >
              <Icon name={item.icon} size={16} />
              <span>{item.label}</span>
              {item.id === "inbox" || item.id === "today" ? (
                <em>{counts[item.id]}</em>
              ) : null}
            </button>
          ))}
        </nav>
        <div className="planning-sidebar-section">
          <div>
            <span>Projects</span>
            <Icon name="add" size={14} />
          </div>
          <button>
            <span className="project-color project-amber" />
            Receptor screen
            <em>4</em>
          </button>
          <button>
            <span className="project-color project-green" />
            Vector library
            <em>2</em>
          </button>
        </div>
        <div className="planning-sidebar-tip">
          <Icon name="sparkle" size={16} />
          <p>
            <strong>Tasks live in your notes.</strong>
            Update one here and its Markdown checkbox changes too.
          </p>
        </div>
      </aside>
      <main className="planning-main">
        {view === "inbox" ? <InboxView {...props} /> : null}
        {view === "today" ? <TodayView {...props} /> : null}
        {view === "board" ? <BoardView {...props} /> : null}
        {view === "calendar" ? <CalendarView {...props} /> : null}
        {view === "timeline" ? <TimelineView {...props} /> : null}
      </main>
      <footer className="planning-statusbar">
        <span>
          <span className="status-dot status-dot-green" /> Synced with Markdown
        </span>
        <span>
          {props.tasks.filter((task) => !task.checked).length} open tasks
        </span>
      </footer>
    </div>
  );
}
