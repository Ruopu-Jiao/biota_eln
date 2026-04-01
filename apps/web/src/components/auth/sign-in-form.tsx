"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { AuthField } from "@/components/auth/auth-field";
import { signInSchema } from "@/lib/auth/schemas";
import { DEFAULT_AUTH_REDIRECT } from "@/lib/auth/constants";

export function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(
    searchParams.get("error")
  );
  const registered = searchParams.get("registered") === "1";

  async function handleSubmit(formData: FormData) {
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

    setErrorMessage(null);

    startTransition(async () => {
      const result = await signIn("credentials", {
        email: parsed.data.email,
        password: parsed.data.password,
        callbackUrl: DEFAULT_AUTH_REDIRECT,
        redirect: false,
      });

      if (result?.error) {
        setErrorMessage("We couldn't sign you in with those credentials.");
        return;
      }

      router.push(result?.url ?? DEFAULT_AUTH_REDIRECT);
      router.refresh();
    });
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <AuthField
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        placeholder="name@lab.org"
        required
      />
      <AuthField
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        placeholder="Enter your password"
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

      <button
        type="submit"
        className="inline-flex w-full items-center justify-center rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-70"
        disabled={isPending}
      >
        {isPending ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
