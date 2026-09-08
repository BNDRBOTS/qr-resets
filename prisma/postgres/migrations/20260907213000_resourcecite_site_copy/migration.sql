CREATE TABLE "SiteCopyRevision" (
    "id" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "contentJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),
    CONSTRAINT "SiteCopyRevision_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SiteCopyRevision_status_createdAt_idx" ON "SiteCopyRevision"("status", "createdAt");
CREATE INDEX "SiteCopyRevision_publishedAt_idx" ON "SiteCopyRevision"("publishedAt");
