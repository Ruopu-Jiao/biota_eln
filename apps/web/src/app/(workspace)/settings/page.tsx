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
    <section className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-emerald-200/70">
          Settings
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-white">
          Workspace configuration
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
          Account, personal workspace, and repository tenancy are now wired into
          the foundation and ready for the next feature waves.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="space-y-4">
          <section className="rounded-2xl border border-white/8 bg-white/5 p-4">
            <p className="text-sm font-medium text-white">Account</p>
            <dl className="mt-3 space-y-2 text-sm text-slate-300">
              <div className="flex items-center justify-between gap-3">
                <dt>Name</dt>
                <dd className="text-white">
                  {snapshot?.name ?? "Unknown user"}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt>Email</dt>
                <dd className="text-white">
                  {snapshot?.email ?? "Unknown email"}
                </dd>
              </div>
            </dl>
          </section>

          <section className="rounded-2xl border border-white/8 bg-white/5 p-4">
            <p className="text-sm font-medium text-white">Personal workspace</p>
            {workspace ? (
              <dl className="mt-3 space-y-2 text-sm text-slate-300">
                <div className="flex items-center justify-between gap-3">
                  <dt>Name</dt>
                  <dd className="text-white">{workspace.name}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt>Slug</dt>
                  <dd className="font-mono text-xs text-emerald-200">
                    {workspace.slug}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt>Repositories</dt>
                  <dd className="text-white">{repositories.length}</dd>
                </div>
              </dl>
            ) : (
              <p className="mt-3 text-sm leading-6 text-slate-400">
                Your workspace will appear here after the initial account
                bootstrap completes.
              </p>
            )}
          </section>
        </div>

        <div className="space-y-4">
          <section className="rounded-2xl border border-white/8 bg-white/5 p-4">
            <p className="text-sm font-medium text-white">Repositories</p>
            <div className="mt-3 space-y-3">
              {repositories.length ? (
                repositories.map((repository) => (
                  <div
                    key={repository.id}
                    className="rounded-xl border border-white/8 bg-slate-950/55 px-3 py-3 text-sm text-slate-300"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium text-white">
                        {repository.name}
                      </span>
                      <span className="text-xs uppercase tracking-[0.22em] text-slate-500">
                        {repository.isDefault
                          ? "Default"
                          : repository.visibility}
                      </span>
                    </div>
                    <p className="mt-2 font-mono text-xs text-emerald-200">
                      {repository.slug}
                    </p>
                    <p className="mt-2 text-xs text-slate-400">
                      {repository.folders.length} folders scaffolded
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm leading-6 text-slate-400">
                  Repository creation is ready at the data layer and will be
                  exposed through forms next.
                </p>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-white/8 bg-white/5 p-4">
            <p className="text-sm font-medium text-white">Memberships</p>
            <div className="mt-3 space-y-3">
              {memberships.length ? (
                memberships.map((membership) => (
                  <div
                    key={membership.organization.id}
                    className="rounded-xl border border-white/8 bg-slate-950/55 px-3 py-3 text-sm text-slate-300"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium text-white">
                        {membership.organization.name}
                      </span>
                      <span className="text-xs uppercase tracking-[0.22em] text-slate-500">
                        {membership.role}
                      </span>
                    </div>
                    <p className="mt-2 font-mono text-xs text-emerald-200">
                      {membership.organization.slug}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm leading-6 text-slate-400">
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
