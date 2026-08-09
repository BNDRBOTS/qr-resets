// BNDR. — Database-backed fixed-window rate limiting (server-only)
// ----------------------------------------------------------------------------
// Client identifiers are irreversibly hashed before storage. The runtime
// persists RATE_LIMIT_PEPPER beside the Railway SQLite database when the
// operator does not supply one explicitly.

import { db } from "@/lib/db";
import { createHash } from "node:crypto";

const WINDOW_MS = 60 * 1000;

export interface RateLimitConfig {
  windowMs: number;
  max: number;
  namespace: string;
}

export const RATE_LIMITS = {
  signIn: { windowMs: 15 * 60 * 1000, max: 5, namespace: "signin" },
  adminRead: { windowMs: WINDOW_MS, max: 180, namespace: "adminread" },
  resourceMutation: { windowMs: WINDOW_MS, max: 30, namespace: "resmut" },
  smartPaste: { windowMs: WINDOW_MS, max: 10, namespace: "smartpaste" },
  cleanup: { windowMs: 15 * 60 * 1000, max: 2, namespace: "cleanup" },
  spamCheck: { windowMs: 15 * 60 * 1000, max: 2, namespace: "spam" },
  urlVerify: { windowMs: 15 * 60 * 1000, max: 1, namespace: "urlverify" },
  bulkImport: { windowMs: 15 * 60 * 1000, max: 4, namespace: "bulkimport" },
  qrRequest: { windowMs: 15 * 60 * 1000, max: 5, namespace: "qrrequest" },
} as const;

function rateLimitPepper(): string {
  const pepper = process.env.RATE_LIMIT_PEPPER;
  if (!pepper) {
    throw new Error("RATE_LIMIT_PEPPER is required");
  }
  return pepper;
}

function hashClientId(raw: string): string {
  return createHash("sha256")
    .update(`${rateLimitPepper()}:${raw}`)
    .digest("hex");
}

export function getClientId(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  const firstForwarded = forwarded?.split(",")[0]?.trim();
  if (firstForwarded) return firstForwarded;

  const real = req.headers.get("x-real-ip")?.trim();
  if (real) return real;

  return "unknown";
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

const developmentMemoryStore = new Map<
  string,
  { count: number; resetAt: number }
>();

function checkDevelopmentMemoryLimit(
  key: string,
  now: number,
  config: RateLimitConfig,
): RateLimitResult {
  const existing = developmentMemoryStore.get(key);
  if (!existing || existing.resetAt <= now) {
    const resetAt = now + config.windowMs;
    developmentMemoryStore.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: config.max - 1, resetAt };
  }

  existing.count += 1;
  return {
    allowed: existing.count <= config.max,
    remaining: Math.max(0, config.max - existing.count),
    resetAt: existing.resetAt,
  };
}

export async function checkRateLimit(
  clientRaw: string,
  config: RateLimitConfig,
): Promise<RateLimitResult> {
  const key = `${config.namespace}:${hashClientId(clientRaw)}`;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + config.windowMs);
    try {
      return await db.$transaction(
        async (tx) => {
          await tx.rateLimitAttempt.deleteMany({
            where: {
              namespace: config.namespace,
              expiresAt: { lte: now },
            },
          });

          const current = await tx.rateLimitAttempt.count({
            where: {
              key,
              expiresAt: { gt: now },
            },
          });

          const oldest = await tx.rateLimitAttempt.findFirst({
            where: {
              key,
              expiresAt: { gt: now },
            },
            orderBy: { expiresAt: "asc" },
            select: { expiresAt: true },
          });

          const resetAt = oldest?.expiresAt.getTime() ?? expiresAt.getTime();
          if (current >= config.max) {
            return { allowed: false, remaining: 0, resetAt };
          }

          await tx.rateLimitAttempt.create({
            data: {
              key,
              namespace: config.namespace,
              expiresAt,
            },
          });

          return {
            allowed: true,
            remaining: Math.max(0, config.max - current - 1),
            resetAt,
          };
        },
      );
    } catch (error) {
      const retryable =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2034";
      if (retryable && attempt < 2) continue;

      if (process.env.NODE_ENV !== "production") {
        console.warn(
          "[rate-limit] database unavailable; development fallback",
          error,
        );
        return checkDevelopmentMemoryLimit(key, now.getTime(), config);
      }
      throw error;
    }
  }

  throw new Error("Rate-limit transaction failed after retries");
}
