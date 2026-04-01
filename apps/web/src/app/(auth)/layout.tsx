import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { PublicAuthLayout } from "@/components/auth/public-auth-layout";
import { getServerAuthSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function AuthLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getServerAuthSession();

  if (session?.user) {
    redirect("/");
  }

  return <PublicAuthLayout>{children}</PublicAuthLayout>;
}
