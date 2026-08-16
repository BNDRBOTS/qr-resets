// BNDR. — NextAuth v4 options (server-only)
// -----------------------------------------------------------------------------
// Credentials provider for the single BNDR administrator. Railway environment
// credentials are a one-time bootstrap path; persistent credential state is the
// source of truth after it exists.

import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import {
  ADMIN_AUTH_ERROR,
  applyAdminRoleToSession,
  applyAdminRoleToToken,
  isAdminToken,
  revokeAdminToken,
} from "@/lib/admin-auth-core";
import {
  authenticateAdminCredential,
  isAdminCredentialVersionCurrent,
} from "@/lib/admin-credentials";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: { signIn: "/admin/login" },
  providers: [
    CredentialsProvider({
      name: "Admin",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        const email = credentials?.email?.trim() ?? "";
        const password = credentials?.password ?? "";
        if (!email || !password) return null;

        const forwarded = req.headers?.["x-forwarded-for"];
        const client =
          typeof forwarded === "string"
            ? forwarded.split(",")[0]?.trim() || "unknown"
            : "unknown";

        try {
          const rateLimit = await checkRateLimit(
            `${client}:${email.toLowerCase()}`,
            RATE_LIMITS.signIn,
          );
          if (!rateLimit.allowed) {
            throw new Error(ADMIN_AUTH_ERROR.RATE_LIMITED);
          }
        } catch (error) {
          if (
            error instanceof Error &&
            error.message === ADMIN_AUTH_ERROR.RATE_LIMITED
          ) {
            throw error;
          }
          console.error("[auth] sign-in rate limit unavailable");
          throw new Error(ADMIN_AUTH_ERROR.UNAVAILABLE);
        }

        try {
          const authenticated = await authenticateAdminCredential(email, password);
          if (!authenticated) return null;

          return {
            id: authenticated.id,
            email: authenticated.email,
            role: "admin" as const,
            credentialVersion: authenticated.credentialVersion,
          };
        } catch {
          console.error("[auth] persistent credential store unavailable");
          throw new Error(ADMIN_AUTH_ERROR.UNAVAILABLE);
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        return applyAdminRoleToToken(
          token,
          user as {
            role?: unknown;
            email?: string | null;
            credentialVersion?: unknown;
          },
        ) as typeof token;
      }

      if (isAdminToken(token)) {
        try {
          const current = await isAdminCredentialVersionCurrent(token);
          if (!current) revokeAdminToken(token);
        } catch {
          // Database/version checks fail closed: a stale/unverifiable admin JWT
          // must never retain authorization.
          revokeAdminToken(token);
        }
      }
      return token;
    },
    async session({ session, token }) {
      return applyAdminRoleToSession(session, token) as typeof session;
    },
  },
};

export type AdminSessionUser = {
  email: string;
  role: "admin";
};
