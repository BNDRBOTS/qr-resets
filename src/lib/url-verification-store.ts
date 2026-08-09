// Server-only persistence for URL verification reports.
// Stored in PostgreSQL so reports survive Railway restarts and redeploys.

import { db } from "@/lib/db";
import type {
  UrlStatus,
  UrlVerificationReport,
  UrlVerificationResult,
} from "@/lib/types";

export const EMPTY_URL_VERIFICATION_REPORT: UrlVerificationReport = {
  total: 0,
  verified: 0,
  byStatus: {
    live: 0,
    dead: 0,
    uncertain: 0,
    "off-topic": 0,
    invalid: 0,
  },
  results: [],
  ranAt: null,
  durationMs: 0,
};

export function summarizeUrlResults(
  results: UrlVerificationResult[],
): UrlVerificationReport["byStatus"] {
  const byStatus: UrlVerificationReport["byStatus"] = {
    live: 0,
    dead: 0,
    uncertain: 0,
    "off-topic": 0,
    invalid: 0,
  };
  for (const result of results) byStatus[result.status] += 1;
  return byStatus;
}

export async function getLatestUrlVerificationReport(): Promise<UrlVerificationReport> {
  const run = await db.urlVerificationRun.findFirst({
    orderBy: { ranAt: "desc" },
    include: {
      results: { orderBy: { name: "asc" } },
    },
  });

  if (!run) return EMPTY_URL_VERIFICATION_REPORT;

  const results: UrlVerificationResult[] = run.results.map((result) => ({
    resourceId: result.resourceId,
    name: result.name,
    website: result.website,
    status: result.status as UrlStatus,
    statusCode: result.statusCode,
    finalUrl: result.finalUrl,
    note: result.note,
    offTopicReason: result.offTopicReason,
    durationMs: result.durationMs,
    checkedAt: result.checkedAt.toISOString(),
  }));

  const byStatus = summarizeUrlResults(results);

  return {
    total: results.length,
    verified: byStatus.live,
    byStatus,
    results,
    ranAt: run.ranAt.toISOString(),
    durationMs: run.durationMs,
  };
}

export async function saveUrlVerificationReport(
  report: UrlVerificationReport,
): Promise<void> {
  await db.$transaction(async (tx) => {
    const run = await tx.urlVerificationRun.create({
      data: {
        total: report.total,
        verified: report.verified,
        durationMs: report.durationMs,
        ranAt: report.ranAt ? new Date(report.ranAt) : new Date(),
      },
    });

    if (report.results.length > 0) {
      await tx.urlVerificationResult.createMany({
        data: report.results.map((result) => ({
          runId: run.id,
          resourceId: result.resourceId,
          name: result.name,
          website: result.website,
          status: result.status,
          statusCode: result.statusCode,
          finalUrl: result.finalUrl,
          note: result.note,
          offTopicReason: result.offTopicReason,
          durationMs: result.durationMs,
          checkedAt: new Date(result.checkedAt),
        })),
      });
    }

    // Retain ten complete audit snapshots; resource deletion cascades its URL
    // results without affecting other resources or the resource audit log.
    const staleRuns = await tx.urlVerificationRun.findMany({
      orderBy: { ranAt: "desc" },
      skip: 10,
      select: { id: true },
    });
    if (staleRuns.length > 0) {
      await tx.urlVerificationRun.deleteMany({
        where: { id: { in: staleRuns.map((item) => item.id) } },
      });
    }
  });
}
