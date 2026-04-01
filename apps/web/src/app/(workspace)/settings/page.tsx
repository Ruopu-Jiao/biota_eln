import { getWorkspaceSnapshotForUser } from "@biota/db";
import {
  getDemoWorkspaceSnapshot,
  isDemoAuthMode,
} from "@/lib/auth/demo.server";
import { requireServerSession } from "@/lib/auth/session";

export default async function SettingsPage() {
  const session = await requireServerSession();
  const snapshot = isDemoAuthMode()
    ? getDemoWorkspaceSnapshot()
    : await getWorkspaceSnapshotForUser(session.user.id);
  const workspace = snapshot?.personalWorkspace;
  const repositories = workspace?.repositories ?? [];
  const memberships = snapshot?.organizationMembers ?? [];

  return (
    <section className="space-y-8">
      <div className="border-b border-[color:var(--line)] pb-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[color:var(--accent-strong)]">
          Settings
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[color:var(--text-primary)]">
          Workspace configuration
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-[color:var(--text-muted)]">
          Account, tenancy, and repository scaffolding are in place. This page
          follows the flatter workspace language so structure comes from
          hierarchy and dividers rather than stacked cards.
        </p>
      </div>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="space-y-8">
          <section className="border-t border-[color:var(--line)] pt-4">
            <p className="text-sm font-medium text-[color:var(--text-primary)]">
              Account
            </p>
            <dl className="mt-4 space-y-4 text-sm text-[color:var(--text-muted)]">
              <div className="flex items-center justify-between gap-3 border-b border-[color:var(--line)] pb-3">
                <dt>Name</dt>
                <dd className="text-[color:var(--text-primary)]">
                  {snapshot?.name ?? "Unknown user"}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt>Email</dt>
                <dd className="text-[color:var(--text-primary)]">
                  {snapshot?.email ?? "Unknown email"}
                </dd>
              </div>
            </dl>
          </section>

          <section className="border-t border-[color:var(--line)] pt-4">
            <p className="text-sm font-medium text-[color:var(--text-primary)]">
              Personal workspace
            </p>
            {workspace ? (
              <dl className="mt-4 space-y-4 text-sm text-[color:var(--text-muted)]">
                <div className="flex items-center justify-between gap-3 border-b border-[color:var(--line)] pb-3">
                  <dt>Name</dt>
                  <dd className="text-[color:var(--text-primary)]">
                    {workspace.name}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3 border-b border-[color:var(--line)] pb-3">
                  <dt>Slug</dt>
                  <dd className="font-mono text-xs text-[color:var(--accent-strong)]">
                    {workspace.slug}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt>Repositories</dt>
                  <dd className="text-[color:var(--text-primary)]">
                    {repositories.length}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="mt-4 text-sm leading-7 text-[color:var(--text-muted)]">
                Your workspace will appear here after the initial account
                bootstrap completes.
              </p>
            )}
          </section>
        </div>

        <div className="space-y-8 border-l border-[color:var(--line)] pl-6">
          <section className="border-b border-[color:var(--line)] pb-5">
            <p className="text-sm font-medium text-[color:var(--text-primary)]">
              Repositories
            </p>
            <div className="mt-4 divide-y divide-[color:var(--line)] border-y border-[color:var(--line)]">
              {repositories.length ? (
                repositories.map((repository) => (
                  <div
                    key={repository.id}
                    className="grid gap-2 px-0 py-4 text-sm text-[color:var(--text-muted)]"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium text-[color:var(--text-primary)]">
                        {repository.name}
                      </span>
                      <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-[color:var(--text-soft)]">
                        {repository.isDefault ? "Default" : repository.visibility}
                      </span>
                    </div>
                    <p className="font-mono text-xs text-[color:var(--accent-strong)]">
                      {repository.slug}
                    </p>
                    <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[color:var(--text-soft)]">
                      {repository.folders.length} folders scaffolded
                    </p>
                  </div>
                ))
              ) : (
                <p className="px-0 py-4 text-sm leading-7 text-[color:var(--text-muted)]">
                  Repository creation is ready at the data layer and will be
                  exposed through forms next.
                </p>
              )}
            </div>
          </section>

          <section className="border-b border-[color:var(--line)] pb-5">
            <p className="text-sm font-medium text-[color:var(--text-primary)]">
              Memberships
            </p>
            <div className="mt-4 divide-y divide-[color:var(--line)] border-y border-[color:var(--line)]">
              {memberships.length ? (
                memberships.map((membership) => (
                  <div
                    key={membership.organization.id}
                    className="grid gap-2 px-0 py-4 text-sm text-[color:var(--text-muted)]"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium text-[color:var(--text-primary)]">
                        {membership.organization.name}
                      </span>
                      <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-[color:var(--text-soft)]">
                        {membership.role}
                      </span>
                    </div>
                    <p className="font-mono text-xs text-[color:var(--accent-strong)]">
                      {membership.organization.slug}
                    </p>
                  </div>
                ))
              ) : (
                <p className="px-0 py-4 text-sm leading-7 text-[color:var(--text-muted)]">
                  Shared organization memberships will appear here once invite
                  flows are added.
                </p>
              )}
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}
