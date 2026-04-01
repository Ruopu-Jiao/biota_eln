import { registerAction } from "@/lib/auth/actions";
import { AuthCard, AuthLink } from "@/components/auth/auth-card";
import { AuthField } from "@/components/auth/auth-field";
import { AuthSubmitButton } from "@/components/auth/auth-submit-button";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <AuthCard
      title="Create your lab workspace"
      description="Set up a private Biota ELN account now and expand into shared organizations later."
      footer={<AuthLink href="/sign-in" label="Already have an account?" />}
    >
      <form action={registerAction} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <AuthField
            label="First name"
            name="firstName"
            type="text"
            autoComplete="given-name"
            placeholder="Ruopu"
            required
          />
          <AuthField
            label="Last name"
            name="lastName"
            type="text"
            autoComplete="family-name"
            placeholder="Jiao"
            required
          />
        </div>

        <AuthField
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="name@lab.org"
          required
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <AuthField
            label="Password"
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder="Create a strong password"
            required
          />
          <AuthField
            label="Confirm password"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            placeholder="Repeat the password"
            required
          />
        </div>

        <AuthField
          label="Workspace name"
          name="workspaceName"
          type="text"
          placeholder="My Lab"
          hint="This can become your personal organization later."
          required
        />

        <label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
          <input
            type="checkbox"
            name="terms"
            className="mt-1 h-4 w-4 rounded border-white/20 bg-slate-950/70 text-emerald-400 focus:ring-emerald-400/20"
            required
          />
          <span>
            I understand this is an early-access workspace and that organization
            sharing, protocols, entities, and sequence tools will evolve over
            time.
          </span>
        </label>

        {error ? (
          <p className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </p>
        ) : null}

        <AuthSubmitButton label="Create account" />
      </form>
    </AuthCard>
  );
}
