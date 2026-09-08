import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { normalizeSiteCopy, SITE_COPY_DEFAULTS } from "@/lib/site-copy";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const published = await db.siteCopyRevision.findFirst({
      where: { status: "published" },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      select: { id: true, contentJson: true, publishedAt: true },
    });
    return NextResponse.json({
      content: published ? normalizeSiteCopy(published.contentJson) : { ...SITE_COPY_DEFAULTS },
      revisionId: published?.id ?? null,
      publishedAt: published?.publishedAt ?? null,
    });
  } catch (error) {
    console.error("[api/site-copy GET]", error);
    return NextResponse.json({
      content: { ...SITE_COPY_DEFAULTS },
      revisionId: null,
      publishedAt: null,
    });
  }
}
