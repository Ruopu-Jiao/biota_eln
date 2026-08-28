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
    <section className="rounded-[16px] border border-[color:var(--accent-soft)] bg-[color:var(--accent-muted)] p-4">
      <p className="text-xs uppercase tracking-[0.28em] text-[color:var(--text-soft)]">
        Local demo mode
      </p>
      <h2 className="mt-2 text-sm font-semibold text-[color:var(--text-primary)]">
        {title}
      </h2>
      <p className="mt-2 text-sm leading-6 text-[color:var(--text-muted)]">
        {description}
      </p>

      {email && password ? (
        <div className="mt-4 grid gap-2">
          <div className="rounded-[12px] border border-[color:var(--line)] bg-[color:var(--surface-strong)] px-3 py-2">
            <p className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--text-soft)]">
              Email
            </p>
            <p className="mt-1 font-mono text-sm text-[color:var(--text-primary)]">
              {email}
            </p>
          </div>
          <div className="rounded-[12px] border border-[color:var(--line)] bg-[color:var(--surface-strong)] px-3 py-2">
            <p className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--text-soft)]">
              Password
            </p>
            <p className="mt-1 font-mono text-sm text-[color:var(--text-primary)]">
              {password}
            </p>
          </div>
        </div>
      ) : null}

      <a
        href={ctaHref}
        className="mt-4 inline-flex items-center rounded-full border border-[color:var(--accent-soft)] bg-[color:var(--surface-strong)] px-4 py-2 text-sm font-medium text-[color:var(--text-primary)] transition hover:bg-[color:var(--accent-muted)]"
      >
        {ctaLabel}
      </a>
    </section>
  );
}
