import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getAdminSession, requireAdminRateLimited, apiError } from "@/lib/require-admin";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { normalizeSiteCopy, SITE_COPY_DEFAULTS, siteCopyContentSchema } from "@/lib/site-copy";
import { readBoundedJson, BODY_LIMITS, BoundedBodyError } from "@/lib/zod-schemas";

export const dynamic = "force-dynamic";

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("save-draft"), content: siteCopyContentSchema }),
  z.object({ action: z.literal("publish"), revisionId: z.string().min(1) }),
  z.object({ action: z.literal("restore"), revisionId: z.string().min(1) }),
]);

async function actorEmail() {
  const session = await getAdminSession();
  return session?.user?.email ?? null;
}

export async function GET(req: NextRequest) {
  const blocked = await requireAdminRateLimited(req, RATE_LIMITS.adminRead);
  if (blocked) return blocked;
  try {
    const [published, draft, history] = await Promise.all([
      db.siteCopyRevision.findFirst({
        where: { status: "published" },
        orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      }),
      db.siteCopyRevision.findFirst({ where: { status: "draft" }, orderBy: { createdAt: "desc" } }),
      db.siteCopyRevision.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
    ]);
    return NextResponse.json({
      published: published
        ? { ...published, contentJson: normalizeSiteCopy(published.contentJson) }
        : { id: null, contentJson: { ...SITE_COPY_DEFAULTS }, publishedAt: null },
      draft: draft ? { ...draft, contentJson: normalizeSiteCopy(draft.contentJson) } : null,
      history: history.map((row) => ({ ...row, contentJson: normalizeSiteCopy(row.contentJson) })),
    });
  } catch (error) {
    console.error("[api/admin/site-copy GET]", error);
    return apiError("INTERNAL", "Failed to load ResourceCite site copy.", 500);
  }
}

export async function POST(req: NextRequest) {
  const blocked = await requireAdminRateLimited(req, RATE_LIMITS.resourceMutation);
  if (blocked) return blocked;
  const actor = await actorEmail();
  if (!actor) return apiError("UNAUTHORIZED", "Authentication required.", 401);

  let body: unknown;
  try {
    body = await readBoundedJson(req, BODY_LIMITS.resourceMutation);
  } catch (error) {
    if (error instanceof BoundedBodyError) return apiError(error.code, error.message, 400);
    return apiError("VALIDATION_ERROR", "Invalid JSON body.", 400);
  }
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid site-copy action.", 400);
  }

  try {
    if (parsed.data.action === "save-draft") {
      const content = parsed.data.content;
      const created = await db.$transaction(async (tx) => {
        await tx.siteCopyRevision.updateMany({ where: { status: "draft" }, data: { status: "superseded" } });
        const row = await tx.siteCopyRevision.create({
          data: { actor, status: "draft", contentJson: content },
        });
        await tx.auditLog.create({
          data: {
            action: "site-copy-draft",
            actor,
            summary: "Saved a ResourceCite site-copy draft",
            details: JSON.stringify({ revisionId: row.id }),
          },
        });
        return row;
      });
      return NextResponse.json({ ok: true, revision: created });
    }

    if (parsed.data.action === "publish") {
      const source = await db.siteCopyRevision.findUnique({ where: { id: parsed.data.revisionId } });
      if (!source) return apiError("NOT_FOUND", "Copy revision not found.", 404);
      const content = normalizeSiteCopy(source.contentJson);
      const published = await db.$transaction(async (tx) => {
        await tx.siteCopyRevision.updateMany({ where: { status: "published" }, data: { status: "superseded" } });
        const row = await tx.siteCopyRevision.create({
          data: { actor, status: "published", contentJson: content, publishedAt: new Date() },
        });
        if (source.status === "draft") {
          await tx.siteCopyRevision.update({ where: { id: source.id }, data: { status: "superseded" } });
        }
        await tx.auditLog.create({
          data: {
            action: "site-copy-publish",
            actor,
            summary: "Published ResourceCite site copy",
            details: JSON.stringify({ sourceRevisionId: source.id, publishedRevisionId: row.id }),
          },
        });
        return row;
      });
      return NextResponse.json({ ok: true, revision: published });
    }

    const source = await db.siteCopyRevision.findUnique({ where: { id: parsed.data.revisionId } });
    if (!source) return apiError("NOT_FOUND", "Copy revision not found.", 404);
    const content = normalizeSiteCopy(source.contentJson);
    const restored = await db.$transaction(async (tx) => {
      await tx.siteCopyRevision.updateMany({ where: { status: "published" }, data: { status: "superseded" } });
      const row = await tx.siteCopyRevision.create({
        data: { actor, status: "published", contentJson: content, publishedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          action: "site-copy-restore",
          actor,
          summary: "Restored a prior ResourceCite site-copy revision",
          details: JSON.stringify({ sourceRevisionId: source.id, restoredRevisionId: row.id }),
        },
      });
      return row;
    });
    return NextResponse.json({ ok: true, revision: restored });
  } catch (error) {
    console.error("[api/admin/site-copy POST]", error);
    return apiError("INTERNAL", "Failed to update ResourceCite site copy.", 500);
  }
}
