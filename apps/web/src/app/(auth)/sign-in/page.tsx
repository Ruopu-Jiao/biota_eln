import Link from "next/link";

export default function SignInPage() {
  return (
    <main className="mx-auto w-full max-w-sm">
      <section className="space-y-7">
        <div className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-[0.24em] text-[color:var(--text-soft)]">
            Biota ELN
          </p>
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-[color:var(--text-primary)]">
              Demo workspace
            </h1>
            <p className="text-sm leading-6 text-[color:var(--text-muted)]">
              Open the demo account to explore the current notebook, protocol,
              and sequence workspace.
            </p>
          </div>
        </div>

        <a
          href="/api/demo-login"
          className="inline-flex w-full items-center justify-center border border-[color:var(--accent-soft)] bg-[color:var(--accent-strong)] px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90"
        >
          Log in with demo account
        </a>

        <nav
          aria-label="Account links"
          className="flex items-center justify-center gap-5 border-t border-[color:var(--line)] pt-5 text-sm text-[color:var(--text-muted)]"
        >
          <Link
            href="/register"
            className="transition hover:text-[color:var(--text-primary)]"
          >
            Create account
          </Link>
          <Link
            href="/wiki"
            className="transition hover:text-[color:var(--text-primary)]"
          >
            What is biotaELN?
          </Link>
        </nav>
      </section>
    </main>
  );
}
