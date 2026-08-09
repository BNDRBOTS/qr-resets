// BNDR. — Authorization helpers (server-only)
// ----------------------------------------------------------------------------
// requireAdmin()        → throws / returns null redirect for non-admin
// requireAdminResponse()→ NextResponse 401/403 for API routes
// requireAdminRateLimited() → combined auth + rate-limit check
// isAdminRequest()      → boolean check for use inside handlers
//
// Client state is NEVER authorization. Only a verified NextAuth JWT session
// with role === "admin" grants access.

import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth-options";
import type { RateLimitConfig } from "@/lib/rate-limit";
import { requireSameOriginMutation } from "@/lib/request-origin";

export async function getAdminSession() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as { role?: string } | undefined)?.role !== "admin") {
    return null;
  }
  return session;
}

export async function isAdminRequest(): Promise<boolean> {
  const session = await getAdminSession();
  return session !== null;
}

/**
 * Returns null if the request is authorized (admin session present).
 * Otherwise returns a 401 JSON response the handler should return directly.
 */
export async function requireAdminResponse(): Promise<NextResponse | null> {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json(
      {
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required.",
        },
      },
      { status: 401 },
    );
  }
  return null;
}

/**
 * Combined auth + rate-limit check for admin API routes.
 * Returns null if authorized and within rate limit.
 * Returns 401 if unauthenticated, or 429 if rate-limited.
 *
 * Usage:
 *   const blocked = await requireAdminRateLimited(req, RATE_LIMITS.resourceMutation);
 *   if (blocked) return blocked;
 */
export async function requireAdminRateLimited(
  req: Request,
  config: RateLimitConfig,
): Promise<NextResponse | null> {
  // 1. Auth check
  const authBlocked = await requireAdminResponse();
  if (authBlocked) return authBlocked;

  // 2. Reject cross-origin state changes before any mutation handler runs.
  const originBlocked = requireSameOriginMutation(req);
  if (originBlocked) return originBlocked;

  // 3. Rate-limit check — dynamically import to avoid pulling the crypto/db
  //    dependency chain into every route that imports require-admin.ts.
  const { checkRateLimit, getClientId } = await import("@/lib/rate-limit");
  const session = await getAdminSession();
  const clientId = session?.user?.email ?? getClientId(req);
  const rl = await checkRateLimit(clientId, config);
  if (!rl.allowed) {
    const retryAfter = Math.ceil((rl.resetAt - Date.now()) / 1000);
    return NextResponse.json(
      {
        error: {
          code: "RATE_LIMITED",
          message: "Too many requests. Please try again later.",
          retryAfter,
        },
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.max(1, retryAfter)),
          "X-RateLimit-Remaining": String(rl.remaining),
          "X-RateLimit-Reset": String(rl.resetAt),
        },
      },
    );
  }
  return null;
}

/**
 * Standardized API error envelope.
 * Raw provider/Prisma/network errors stay server-side.
 */
export function apiError(
  code: string,
  message: string,
  status: number,
  requestId?: string,
) {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        ...(requestId ? { requestId } : {}),
      },
    },
    { status },
  );
}
