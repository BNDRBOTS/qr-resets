// BNDR. API - publication gate.
// Publishing appends a new canonical resource from an evidence-qualified
// candidate. Gates enforce: no duplicates of canonical rows, no excluded
// records, review required for holds, and no unresolved critical issues.
// Nothing is ever auto-published; this endpoint is the only path to publish.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAdminSession, requireAdminRateLimited, apiError } from "@/lib/require-admin";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { createResourceRecord } from "@/lib/resource-service";
import { ResourceIngestionError } from "@/lib/resource-ingestion";
import { ORG_VERIFIED } from "@/lib/verification-core.mjs";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

function pick(source: Record<string, unknown> | null, keys: string[]): string {
  for (const key of keys) {
    const value = source?.[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

export async function POST(req: NextRequest, context: RouteContext) {
  const blocked = await requireAdminRateLimited(req, RATE_LIMITS.resourceMutation);
  if (blocked) return blocked;

  try {
    const { id } = await context.params;
    const session = await getAdminSession();
    const actor = session?.user?.email;
    if (!actor) return apiError("UNAUTHORIZED", "Authentication required.", 401);

    const row = await db.verificationResult.findUnique({
      where: { id },
      include: { issues: true },
    });
    if (!row) return apiError("NOT_FOUND", "Verification result not found.", 404);

    if (row.publishState === "published") {
      return apiError("ALREADY_PUBLISHED", "This candidate is already published.", 409);
    }
    if (row.publishState === "canonical_match" || row.duplicateKind === "strong") {
      return apiError(
        "CANONICAL_MATCH",
        "This candidate matches an existing canonical resource; publishing would duplicate it.",
        409,
      );
    }
    if (row.publishState === "excluded") {
      return apiError("EXCLUDED_RECORD", "Excluded records cannot be published.", 409);
    }
    const gateOpen =
      row.publishState === "publish_eligible" ||
      (row.publishState === "held" && row.reviewState === "reviewed");
    if (!gateOpen) {
      return apiError(
        "PUBLISH_GATE",
        "Only publish-eligible candidates or explicitly reviewed holds can be published.",
        409,
      );
    }
    const unresolvedCritical = row.issues.filter(
      (issue) => issue.severity === "critical" && issue.reviewState === "unresolved",
    );
    if (unresolvedCritical.length) {
      return apiError(
        "UNRESOLVED_CRITICAL_ISSUES",
        `Resolve ${unresolvedCritical.length} critical issue(s) (accept or dismiss) before publishing.`,
        409,
      );
    }

    // sourceJson holds admin-reviewed edits; candidateJson holds the staged
    // source. Both tolerant shapes are supported: canonical candidate keys
    // (url/location/source) and app/import keys (website/address/sourceNote).
    const source = (row.sourceJson ?? row.candidateJson) as Record<string, unknown> | null;
    const name = pick(source, ["name", "Resource_Name"]) || row.name;
    const category = row.category ?? pick(source, ["category", "Category"]);
    if (!name.trim() || !category.trim()) {
      return apiError(
        "SCHEMA_MAPPING_INCOMPLETE",
        "Set the candidate's name and category (via review source edits) before publishing.",
        400,
      );
    }

    const input = {
      name,
      description: pick(source, ["description", "Description_Context"]),
      category: category.trim(),
      phoneRaw: pick(source, ["phone", "Phone"]) || null,
      email: pick(source, ["email", "Email"]) || null,
      website: pick(source, ["url", "website", "URL"]) || null,
      address: pick(source, ["location", "address", "Location"]) || null,
      sourceNote:
        pick(source, ["source", "sourceNote", "Source_Document"]) || "verification-pipeline",
      verified: row.organizationStatus === ORG_VERIFIED,
      published: true,
    } as Parameters<typeof createResourceRecord>[0];

    try {
      const created = await createResourceRecord(input, actor);
      await db.$transaction(async (tx) => {
        await tx.verificationResult.update({
          where: { id },
          data: {
            publishState: "published",
            resourceId: created.id,
            reviewState: "reviewed",
            resolvedAt: new Date(),
            resolvedBy: actor,
          },
        });
        await tx.auditLog.create({
          data: {
            action: "verification-publish",
            resourceId: created.id,
            actor,
            summary: `Published verified candidate '${name}' to the directory`,
            details: JSON.stringify({ resultId: id, resourceId: created.id }),
          },
        });
      });
      return NextResponse.json({
        ok: true,
        resourceId: created.id,
        name: created.name,
        verified: created.verified,
        published: true,
      });
    } catch (error) {
      if (error instanceof ResourceIngestionError) {
        const status = error.code.startsWith("DUPLICATE_") ? 409 : 400;
        return apiError(error.code, error.message, status);
      }
      throw error;
    }
  } catch (error) {
    console.error("[api/admin/verification/results/[id]/publish POST]", error);
    return apiError("INTERNAL", "Failed to publish verification result.", 500);
  }
}
