import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { findUserForCredentials, prisma } from "@biota/db";
import { getDemoCredentials, getDemoUser, isDemoAuthMode } from "@/lib/auth/demo.server";
import { signInSchema } from "@/lib/auth/schemas";
import { verifyPassword } from "@/lib/auth/password";

const demoMode = isDemoAuthMode();
const demoCredentials = getDemoCredentials();

export const authOptions: NextAuthOptions = {
  adapter: demoMode ? undefined : PrismaAdapter(prisma),
  session: {
    strategy: demoMode ? "jwt" : "database",
  },
  pages: {
    signIn: "/sign-in",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: {
          label: "Email",
          type: "email",
          placeholder: "name@lab.org",
        },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = signInSchema.safeParse(credentials);

        if (!parsed.success) {
          return null;
        }

        if (demoMode) {
          if (
            parsed.data.email === demoCredentials.email &&
            parsed.data.password === demoCredentials.password
          ) {
            return getDemoUser();
          }

          return null;
        }

        const credentialRecord = await findUserForCredentials(
          parsed.data.email
        );

        if (!credentialRecord?.passwordCredential) {
          return null;
        }

        const isValid = await verifyPassword(
          credentialRecord.passwordCredential.hash,
          parsed.data.password
        );

        if (!isValid) {
          return null;
        }

        return {
          id: credentialRecord.id,
          email: credentialRecord.email,
          name: credentialRecord.name,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) {
        token.sub = user.id;
      }

      return token;
    },
    session({ session, user, token }) {
      if (session.user) {
        session.user.id = user?.id ?? token.sub ?? "unknown-user";
      }

      return session;
    },
  },
};
