import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { findUserForCredentials, prisma } from "@biota/db";
import { signInSchema } from "@/lib/auth/schemas";
import { verifyPassword } from "@/lib/auth/password";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "database",
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
    session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
      }

      return session;
    },
  },
};
