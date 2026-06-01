import type { ReactNode } from "react";

type PublicAuthLayoutProps = {
  children: ReactNode;
};

export function PublicAuthLayout({ children }: PublicAuthLayoutProps) {
  return (
    <div className="relative min-h-screen overflow-hidden px-4 py-6 sm:px-6 lg:px-8">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.14),_transparent_24%),radial-gradient(circle_at_top_right,_rgba(14,165,233,0.12),_transparent_22%),linear-gradient(180deg,rgba(2,6,23,0.9),rgba(2,6,23,0.98))]" />
      <div className="absolute inset-x-0 top-0 -z-10 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />

      <div className="mx-auto flex w-full max-w-3xl items-start justify-center">
        <div className="w-full">{children}</div>
      </div>
    </div>
  );
}
