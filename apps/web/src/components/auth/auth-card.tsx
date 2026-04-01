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
    <section className="overflow-hidden rounded-[32px] border border-white/10 bg-slate-950/65 shadow-[0_24px_100px_rgba(0,0,0,0.45)]">
      <div className="border-b border-white/8 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.14),_transparent_40%),linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,6,23,0.92))] px-6 py-6 sm:px-8">
        <div className="inline-flex items-center rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.28em] text-emerald-200">
          Biota ELN
        </div>
        <h1 className="mt-5 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          {title}
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300 sm:text-base">
          {description}
        </p>
      </div>

      <div className="grid gap-6 px-6 py-6 sm:px-8 lg:grid-cols-[minmax(0,1fr)_220px] lg:gap-8">
        <div>{children}</div>

        <aside className="rounded-3xl border border-white/8 bg-white/[0.03] p-4">
          <p className="text-xs uppercase tracking-[0.28em] text-slate-500">
            Workspace
          </p>
          <div className="mt-4 space-y-3 text-sm text-slate-300">
            <div className="rounded-2xl border border-white/8 bg-slate-950/50 px-3 py-3">
              Private by default
            </div>
            <div className="rounded-2xl border border-white/8 bg-slate-950/50 px-3 py-3">
              Organization sharing later
            </div>
            <div className="rounded-2xl border border-white/8 bg-slate-950/50 px-3 py-3">
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
      className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-medium text-slate-100 transition hover:border-emerald-300/30 hover:bg-emerald-400/10"
    >
      {label}
    </Link>
  );
}
