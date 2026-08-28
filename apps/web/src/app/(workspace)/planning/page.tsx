import { redirect } from "next/navigation";
import { listPlanningWhiteboardsForUser } from "@biota/db";
import { createPlanningWhiteboardAction } from "@/lib/planning/actions";
import { isDemoAuthMode } from "@/lib/auth/demo.server";
import { requireServerSession } from "@/lib/auth/session";
import { listDemoPlanningWhiteboards } from "@/lib/notebook/demo-store";

export default async function PlanningIndexPage() {
  const session = await requireServerSession();
  const whiteboards = isDemoAuthMode()
    ? await listDemoPlanningWhiteboards()
    : await listPlanningWhiteboardsForUser(session.user.id);

  if (whiteboards[0]) {
    redirect(`/planning/${whiteboards[0].id}`);
  }

  return (
    <section className="min-h-[calc(100vh-3rem)] border border-[color:var(--line)] bg-[color:var(--document-surface)] px-8 py-7">
      <div className="max-w-xl">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[color:var(--text-soft)]">
          Planning
        </p>
        <h1 className="mt-3 text-2xl font-semibold text-[color:var(--text-primary)]">
          New planning whiteboard
        </h1>
        <p className="mt-2 text-sm leading-7 text-[color:var(--text-muted)]">
          Create a whiteboard to organize projects, experiments, task lanes, and
          timeline planning in one workspace.
        </p>
        <form action={createPlanningWhiteboardAction} className="mt-6 flex max-w-md gap-2">
          <label htmlFor="planning-whiteboard-title" className="sr-only">
            Whiteboard title
          </label>
          <input
            id="planning-whiteboard-title"
            name="title"
            required
            placeholder="Whiteboard title"
            className="min-h-9 min-w-0 flex-1 border border-[color:var(--line)] bg-transparent px-3 text-sm text-[color:var(--text-primary)] outline-none placeholder:text-[color:var(--text-soft)] focus:border-[color:var(--line-strong)]"
          />
          <button
            type="submit"
            className="inline-flex min-h-9 shrink-0 items-center border border-[color:var(--line)] px-3 text-sm text-[color:var(--text-muted)] transition hover:border-[color:var(--line-strong)] hover:text-[color:var(--text-primary)]"
          >
            New whiteboard
          </button>
        </form>
      </div>
    </section>
  );
}
