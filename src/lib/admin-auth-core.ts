// BNDR. — Small auth primitives shared by the NextAuth server and login client.
// This module intentionally has no Node-only or browser-only dependencies.

export const ADMIN_AUTH_ERROR = {
  RATE_LIMITED: "RateLimited",
  UNAVAILABLE: "AuthenticationUnavailable",
} as const;

type MutableToken = Record<string, unknown> & {
  role?: unknown;
  email?: unknown;
  credentialVersion?: unknown;
};

type AuthUser = {
  role?: unknown;
  email?: string | null;
  credentialVersion?: unknown;
};

type MutableSession = {
  user?: (Record<string, unknown> & { role?: unknown }) | null;
};

function validCredentialVersion(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1;
}

export function applyAdminRoleToToken<T extends MutableToken>(
  token: T,
  user?: AuthUser | null,
): T {
  if (
    user?.role === "admin" &&
    user.email &&
    validCredentialVersion(user.credentialVersion)
  ) {
    token.role = "admin";
    token.email = user.email;
    token.credentialVersion = user.credentialVersion;
  }
  return token;
}

export function revokeAdminToken<T extends MutableToken>(token: T): T {
  delete token.role;
  delete token.credentialVersion;
  return token;
}

export function applyAdminRoleToSession<T extends MutableSession>(
  session: T,
  token: { role?: unknown },
): T {
  if (!session.user) return session;

  if (token.role === "admin") {
    session.user.role = "admin";
  } else {
    delete session.user.role;
  }
  return session;
}

export function isAdminToken(token: unknown): boolean {
  if (!token || typeof token !== "object") return false;
  const candidate = token as { role?: unknown; credentialVersion?: unknown };
  return (
    candidate.role === "admin" &&
    validCredentialVersion(candidate.credentialVersion)
  );
}

export function isAdminSession(session: unknown): boolean {
  if (!session || typeof session !== "object") return false;
  const user = (session as { user?: unknown }).user;
  if (!user || typeof user !== "object") return false;
  return (user as { role?: unknown }).role === "admin";
}
