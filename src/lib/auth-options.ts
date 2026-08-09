// BNDR. — NextAuth v4 options (server-only)
// ----------------------------------------------------------------------------
// Credentials provider for the single BNDR administrator.
// ADMIN_PASSWORD_HASH is preferred. ADMIN_PASSWORD is an explicit Railway-secret
// fallback so launch does not require a separate hash-generation step.
// There are never hardcoded/default credentials.

import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { timingSafeEqual } from "node:crypto";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

function canonicalEmail(v: string): string {
  return v.trim().toLowerCase();
}

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
        // Fail closed if the operator has not configured admin env.
        if (!ADMIN_EMAIL || (!ADMIN_PASSWORD_HASH && !ADMIN_PASSWORD)) {
          return null;
        }
        const email = credentials?.email ? canonicalEmail(credentials.email) : "";
        const password = credentials?.password ?? "";
        if (!email || !password) return null;

        const forwarded = req.headers?.["x-forwarded-for"];
        const client =
          typeof forwarded === "string"
            ? forwarded.split(",")[0]?.trim() || "unknown"
            : "unknown";
        try {
          const rateLimit = await checkRateLimit(
            `${client}:${email}`,
            RATE_LIMITS.signIn,
          );
          if (!rateLimit.allowed) return null;
        } catch (error) {
          console.error("[auth] sign-in rate limit unavailable", error);
          return null;
        }

        if (email !== canonicalEmail(ADMIN_EMAIL)) return null;

        let ok = false;
        try {
          if (ADMIN_PASSWORD_HASH) {
            ok = await bcrypt.compare(password, ADMIN_PASSWORD_HASH);
          } else if (ADMIN_PASSWORD) {
            const supplied = Buffer.from(password);
            const expected = Buffer.from(ADMIN_PASSWORD);
            ok = supplied.length === expected.length && timingSafeEqual(supplied, expected);
          }
        } catch {
          ok = false;
        }
        if (!ok) return null;

        return {
          id: email,
          email,
          role: "admin" as const,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user && (user as { role?: string }).role === "admin") {
        token.role = "admin";
        token.email = user.email ?? token.email;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.role === "admin" && session.user) {
        (session.user as { role?: string }).role = "admin";
      } else if (session.user) {
        // Never leak a non-admin role to the client as admin.
        delete (session.user as { role?: string }).role;
      }
      return session;
    },
  },
};

export type AdminSessionUser = {
  email: string;
  role: "admin";
};
