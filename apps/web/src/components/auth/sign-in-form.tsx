"use client";

import { FormEvent, useState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { AuthField } from "@/components/auth/auth-field";
import { signInSchema } from "@/lib/auth/schemas";
import { DEFAULT_AUTH_REDIRECT } from "@/lib/auth/constants";

export function SignInForm() {
  const demoEmail =
    process.env.NEXT_PUBLIC_BIOTA_DEMO_EMAIL ?? "demo@biota.local";
  const demoPassword =
    process.env.NEXT_PUBLIC_BIOTA_DEMO_PASSWORD ?? "biota-demo";
  const searchParams = useSearchParams();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(
    searchParams.get("error"),
  );
  const registered = searchParams.get("registered") === "1";
  const demoMode = searchParams.get("demo") === "1";

  async function completeSignIn(email: string, password: string) {
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        callbackUrl: DEFAULT_AUTH_REDIRECT,
        redirect: false,
      });

      if (result?.error) {
        setErrorMessage("We couldn't sign you in with those credentials.");
        return;
      }

      window.location.assign(result?.url ?? DEFAULT_AUTH_REDIRECT);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function continueDemoMode() {
    setErrorMessage(null);
    setIsSubmitting(true);
    window.location.assign("/api/demo-login");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const parsed = signInSchema.safeParse({
      email: formData.get("email"),
      password: formData.get("password"),
    });

    if (!parsed.success) {
      setErrorMessage(
        parsed.error.issues[0]?.message ?? "Invalid credentials."
      );
      return;
    }

    if (
      demoMode &&
      parsed.data.email === demoEmail &&
      parsed.data.password === demoPassword
    ) {
      await continueDemoMode();
      return;
    }

    await completeSignIn(parsed.data.email, parsed.data.password);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <AuthField
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        placeholder="name@lab.org"
        hint={demoMode ? `Demo: ${demoEmail}` : undefined}
        defaultValue={demoMode ? demoEmail : undefined}
        required
      />
      <AuthField
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        placeholder="Enter your password"
        hint={demoMode ? `Demo: ${demoPassword}` : undefined}
        defaultValue={demoMode ? demoPassword : undefined}
        required
      />

      <div className="flex items-center justify-between gap-3 pt-1">
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            name="remember"
            className="h-4 w-4 rounded border-white/20 bg-slate-950/70 text-emerald-400 focus:ring-emerald-400/20"
          />
          Remember me
        </label>
        <span className="text-sm font-medium text-slate-500">
          Password recovery will land with auth flows.
        </span>
      </div>

      {errorMessage ? (
        <p className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
          {errorMessage}
        </p>
      ) : null}

      {!errorMessage && registered ? (
        <p className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-50">
          Your account is ready. Sign in to open your workspace.
        </p>
      ) : null}

      {demoMode ? (
        <div className="space-y-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-50">
          <p>
            Demo mode is active. Use the sample credentials below or continue
            directly into the demo workspace.
          </p>
          <a
            href="/api/demo-login"
            className="inline-flex w-full items-center justify-center rounded-2xl border border-emerald-300/30 bg-emerald-300/12 px-4 py-3 text-sm font-semibold text-emerald-50 transition hover:bg-emerald-300/18 disabled:cursor-not-allowed disabled:opacity-70"
          >
            Continue with demo workspace
          </a>
        </div>
      ) : null}

      <button
        type="submit"
        className="inline-flex w-full items-center justify-center rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-70"
        disabled={isSubmitting}
      >
        {isSubmitting ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
