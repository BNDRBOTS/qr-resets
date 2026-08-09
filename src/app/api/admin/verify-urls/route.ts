// BNDR. API — authenticated resource URL verification.
// Results are stored in PostgreSQL, not the deployment filesystem.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  verifyUrls,
  type UrlVerificationReport as RuntimeUrlVerificationReport
} from "@/lib/url-verify";
import type {
  UrlVerificationReport,
  UrlVerificationResult,
} from "@/lib/types";
import { getAdminSession, requireAdminRateLimited, apiError } from "@/lib/require-admin";
import { RATE_LIMITS } from "@/lib/rate-limit";
import {
  getLatestUrlVerificationReport,
  saveUrlVerificationReport,
  summarizeUrlResults,
} from "@/lib/url-verification-store";
import {
  BODY_LIMITS,
  BoundedBodyError,
  readBoundedJson,
  urlVerifyCommandSchema,
} from "@/lib/zod-schemas";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function toSharedReport(
  report: RuntimeUrlVerificationReport,
): UrlVerificationReport {
  return {
    ...report,
    results: report.results as UrlVerificationResult[],
  };
}

export async function GET(req: NextRequest) {
  const blocked = await requireAdminRateLimited(req, RATE_LIMITS.adminRead);
  if (blocked) return blocked;

  try {
    return NextResponse.json(await getLatestUrlVerificationReport());
  } catch (error) {
    console.error("[api/admin/verify-urls GET]", error);
    return apiError("INTERNAL", "Failed to load URL verification report.", 500);
  }
}

export async function POST(req: NextRequest) {
  const blocked = await requireAdminRateLimited(req, RATE_LIMITS.urlVerify);
  if (blocked) return blocked;

  try {
    const concurrency = Math.max(
      1,
      Math.min(
        24,
        Number.parseInt(req.nextUrl.searchParams.get("concurrency") ?? "12", 10) ||
          12,
      ),
    );

    let ids: string[] | null = null;
    try {
      const body = await readBoundedJson<unknown>(req, BODY_LIMITS.command);
      const parsed = urlVerifyCommandSchema.safeParse(body);
      if (!parsed.success) {
        return apiError(
          "VALIDATION_ERROR",
          parsed.error.issues[0]?.message ?? "Invalid URL verification request.",
          400,
        );
      }
      if (parsed.data.ids && parsed.data.ids.length > 0) ids = parsed.data.ids;
    } catch (error) {
      if (error instanceof BoundedBodyError) {
        return apiError(error.code, error.message, error.code === "PAYLOAD_TOO_LARGE" ? 413 : 400);
      }
      throw error;
    }

    const rows = await db.resource.findMany({
      where: {
        website: { not: null },
        ...(ids ? { id: { in: ids } } : {}),
      },
      select: { id: true, name: true, website: true },
    });

    const verifiableRows = rows.flatMap((row) =>
      row.website
        ? [{ id: row.id, name: row.name, website: row.website }]
        : [],
    );

    const prior = ids ? await getLatestUrlVerificationReport() : null;
    const freshRuntime = await verifyUrls(verifiableRows, concurrency);
    const fresh = toSharedReport(freshRuntime);

    let finalReport = fresh;
    if (ids && prior && prior.results.length > 0) {
      const freshById = new Map(
        fresh.results.map((result) => [result.resourceId, result]),
      );
      const merged: UrlVerificationResult[] = [];
      const seen = new Set<string>();

      for (const result of prior.results) {
        const replacement = freshById.get(result.resourceId);
        if (replacement) {
          merged.push(replacement);
          seen.add(result.resourceId);
        } else {
          merged.push(result);
        }
      }
      for (const result of fresh.results) {
        if (!seen.has(result.resourceId)) merged.push(result);
      }

      const mergedStatus = summarizeUrlResults(merged);
      finalReport = {
        total: merged.length,
        verified: mergedStatus.live,
        byStatus: mergedStatus,
        results: merged,
        ranAt: new Date().toISOString(),
        durationMs: fresh.durationMs,
      };
    }

    await saveUrlVerificationReport(finalReport);

    const session = await getAdminSession();
    const actor = session?.user?.email;
    if (!actor) return apiError("UNAUTHORIZED", "Authentication required.", 401);
    await db.auditLog.create({
      data: {
        action: "url-verify",
        actor,
        summary: ids
          ? `URL re-check: ${fresh.total} resource(s) checked; ${fresh.verified} live; report contains ${finalReport.total}`
          : `URL verification: ${fresh.total} resource(s) checked; ${fresh.verified} live`,
        details: JSON.stringify({
          byStatus: fresh.byStatus,
          durationMs: fresh.durationMs,
          subset: Boolean(ids),
          reportTotal: finalReport.total,
          flagged: fresh.results.filter((result) => result.status !== "live"),
        }),
      },
    });

    return NextResponse.json(finalReport);
  } catch (error) {
    console.error("[api/admin/verify-urls POST]", error);
    return apiError("INTERNAL", "Failed to verify URLs.", 500);
  }
}
