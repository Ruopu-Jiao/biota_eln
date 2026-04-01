import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import {
  demoSessionCookieName,
  demoSessionCookieValue,
} from "@/lib/auth/demo-cookie";
import { getDemoUser, isDemoAuthMode } from "@/lib/auth/demo.server";

export async function getServerAuthSession() {
  if (isDemoAuthMode()) {
    const cookieStore = await cookies();
    const demoCookie = cookieStore.get(demoSessionCookieName)?.value;

    if (demoCookie === demoSessionCookieValue) {
      return { user: getDemoUser() };
    }
  }

  return getServerSession(authOptions);
}

export async function requireServerSession() {
  const session = await getServerAuthSession();

  if (!session?.user) {
    redirect("/sign-in");
  }

  return session;
}
