import type { ReactNode } from "react";
import Link from "next/link";

type PublicAuthLayoutProps = {
  children: ReactNode;
};

export function PublicAuthLayout({ children }: PublicAuthLayoutProps) {
  return (
    <div className="relative overflow-hidden px-4 py-6 sm:px-6 lg:px-8">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.14),_transparent_24%),radial-gradient(circle_at_top_right,_rgba(14,165,233,0.12),_transparent_22%),linear-gradient(180deg,rgba(2,6,23,0.9),rgba(2,6,23,0.98))]" />
      <div className="absolute inset-x-0 top-0 -z-10 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />

      <div className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
        <section className="rounded-[32px] border border-white/10 bg-slate-950/55 p-6 shadow-[0_24px_90px_rgba(0,0,0,0.35)] backdrop-blur">
          <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.28em] text-slate-300">
            Public access
          </div>

          <h2 className="mt-6 max-w-lg text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            An ELN that feels like a focused scientific IDE.
          </h2>
          <p className="mt-4 max-w-xl text-sm leading-7 text-slate-300 sm:text-base">
            Biota ELN is built for notebook entries, reusable protocols,
            sequence-aware entities, and organization sharing without losing the
            clarity of a clean workspace.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {[
              "Notebook entries with structure",
              "Plasmids, gDNA, sgRNAs, primers",
              "Reusable protocol blocks",
              "Scoped organization sharing",
            ].map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-white/8 bg-white/5 px-4 py-3 text-sm text-slate-200"
              >
                {item}
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/sign-in"
              className="inline-flex items-center rounded-full border border-emerald-300/30 bg-emerald-400/12 px-4 py-2 text-sm font-medium text-emerald-100 transition hover:bg-emerald-400/18"
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-100 transition hover:border-white/20 hover:bg-white/10"
            >
              Create account
            </Link>
          </div>
        </section>

        <div className="flex items-center justify-center">{children}</div>
      </div>
    </div>
  );
}
