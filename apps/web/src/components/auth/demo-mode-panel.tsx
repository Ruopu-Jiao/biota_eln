type DemoModePanelProps = {
  title: string;
  description: string;
  ctaLabel: string;
  ctaHref: string;
  email?: string;
  password?: string;
};

export function DemoModePanel({
  title,
  description,
  ctaLabel,
  ctaHref,
  email,
  password,
}: DemoModePanelProps) {
  return (
    <section className="rounded-3xl border border-emerald-400/15 bg-emerald-400/8 p-4">
      <p className="text-xs uppercase tracking-[0.28em] text-emerald-200/70">
        Local demo mode
      </p>
      <h2 className="mt-2 text-sm font-semibold text-white">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-300">{description}</p>

      {email && password ? (
        <div className="mt-4 grid gap-2">
          <div className="rounded-2xl border border-white/8 bg-slate-950/55 px-3 py-2">
            <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">
              Email
            </p>
            <p className="mt-1 font-mono text-sm text-emerald-100">{email}</p>
          </div>
          <div className="rounded-2xl border border-white/8 bg-slate-950/55 px-3 py-2">
            <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">
              Password
            </p>
            <p className="mt-1 font-mono text-sm text-emerald-100">
              {password}
            </p>
          </div>
        </div>
      ) : null}

      <a
        href={ctaHref}
        className="mt-4 inline-flex items-center rounded-full border border-emerald-300/30 bg-emerald-400/12 px-4 py-2 text-sm font-medium text-emerald-100 transition hover:bg-emerald-400/18"
      >
        {ctaLabel}
      </a>
    </section>
  );
}
