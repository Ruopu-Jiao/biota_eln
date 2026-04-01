import { AuthCard, AuthLink } from "@/components/auth/auth-card";
import { SignInForm } from "@/components/auth/sign-in-form";

export default function SignInPage() {
  return (
    <AuthCard
      title="Welcome back"
      description="Sign in to your workspace to pick up protocols, entries, and shared biological records."
      footer={<AuthLink href="/register" label="Need an account?" />}
    >
      <SignInForm />
    </AuthCard>
  );
}
