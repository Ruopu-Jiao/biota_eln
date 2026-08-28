import type { ReactNode } from "react";

type PublicAuthLayoutProps = {
  children: ReactNode;
};

export function PublicAuthLayout({ children }: PublicAuthLayoutProps) {
  return (
    <div className="min-h-screen bg-[color:var(--bg)] px-4 text-[color:var(--text-primary)] sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-screen w-full max-w-3xl items-center justify-center py-8">
        <div className="w-full">{children}</div>
      </div>
    </div>
  );
}
