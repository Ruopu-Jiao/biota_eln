const settings = ["Account", "Organization", "Repositories", "Appearance"];

export default function SettingsPage() {
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
          Account, team, and workspace preferences will live here once
          authentication and tenancy are wired in.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {settings.map((setting) => (
          <div
            key={setting}
            className="rounded-2xl border border-white/8 bg-white/5 p-4"
          >
            <p className="text-sm font-medium text-white">{setting}</p>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Placeholder settings panel.
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
