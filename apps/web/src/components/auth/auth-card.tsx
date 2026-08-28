import type { ReactNode } from "react";
import Link from "next/link";

type AuthCardProps = {
  title: string;
  description: string;
  footer?: ReactNode;
  children: ReactNode;
};

export function AuthCard({
  title,
  description,
  footer,
  children,
}: AuthCardProps) {
  return (
    <section className="w-full overflow-hidden rounded-[20px] border border-[color:var(--line)] bg-[color:var(--surface-strong)] shadow-[0_16px_48px_rgba(15,15,15,0.08)]">
      <div className="border-b border-[color:var(--line)] bg-[color:var(--surface-muted)] px-6 py-6 sm:px-8">
        <div className="inline-flex items-center rounded-full border border-[color:var(--line)] bg-[color:var(--surface-strong)] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.28em] text-[color:var(--text-soft)]">
          Biota ELN
        </div>
        <h1 className="mt-5 text-3xl font-semibold tracking-tight text-[color:var(--text-primary)] sm:text-4xl">
          {title}
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-[color:var(--text-muted)] sm:text-base">
          {description}
        </p>
      </div>

      <div className="grid gap-6 px-6 py-6 sm:px-8 lg:grid-cols-[minmax(0,1fr)_220px] lg:gap-8">
        <div>{children}</div>

        <aside className="rounded-[16px] border border-[color:var(--line)] bg-[color:var(--surface-muted)] p-4">
          <p className="text-xs uppercase tracking-[0.28em] text-[color:var(--text-soft)]">
            Workspace
          </p>
          <div className="mt-4 space-y-3 text-sm text-[color:var(--text-muted)]">
            <div className="rounded-[12px] border border-[color:var(--line)] bg-[color:var(--surface-strong)] px-3 py-3">
              Private by default
            </div>
            <div className="rounded-[12px] border border-[color:var(--line)] bg-[color:var(--surface-strong)] px-3 py-3">
              Organization sharing later
            </div>
            <div className="rounded-[12px] border border-[color:var(--line)] bg-[color:var(--surface-strong)] px-3 py-3">
              Sequence-aware workflows
            </div>
          </div>

          {footer ? <div className="mt-5">{footer}</div> : null}
        </aside>
      </div>
    </section>
  );
}

type AuthLinkProps = {
  href: string;
  label: string;
};

export function AuthLink({ href, label }: AuthLinkProps) {
  return (
    <Link
      href={href}
      className="inline-flex items-center rounded-full border border-[color:var(--line)] bg-[color:var(--surface-strong)] px-3 py-1.5 text-sm font-medium text-[color:var(--text-muted)] transition hover:border-[color:var(--line-strong)] hover:text-[color:var(--text-primary)]"
    >
      {label}
    </Link>
  );
}
