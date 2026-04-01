import { AuthCard, AuthLink } from "@/components/auth/auth-card";
import { DemoModePanel } from "@/components/auth/demo-mode-panel";
import { SignInForm } from "@/components/auth/sign-in-form";

export default function SignInPage() {
  return (
    <AuthCard
      title="Welcome back"
      description="Sign in to your workspace to pick up protocols, entries, and shared biological records."
      footer={<AuthLink href="/register" label="Need an account?" />}
    >
      <div className="space-y-4">
        <SignInForm />
        <DemoModePanel
          title="Use local demo mode"
          description="If you do not have a database running yet, open the demo workspace directly. Sample credentials are still listed below if you want to test the form path."
          ctaLabel="Open demo workspace"
          ctaHref="/api/demo-login"
          email="demo@biota.local"
          password="biota-demo"
        />
      </div>
    </AuthCard>
  );
}
