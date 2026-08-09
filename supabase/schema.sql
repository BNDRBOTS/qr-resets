-- BNDR. Resource Directory PostgreSQL/Supabase baseline.
-- Resource records are imported separately from prisma/verified-resources.json.

CREATE TABLE "Resource" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "acronym" TEXT,
  "description" TEXT,
  "category" TEXT NOT NULL,
  "sourceCategory" TEXT,
  "subcategory" TEXT,
  "phoneRaw" TEXT,
  "phoneNormalized" TEXT,
  "phoneDisplay" TEXT,
  "email" TEXT,
  "address" TEXT,
  "website" TEXT,
  "tags" TEXT NOT NULL DEFAULT '',
  "priority" INTEGER NOT NULL DEFAULT 0,
  "verified" BOOLEAN NOT NULL DEFAULT false,
  "published" BOOLEAN NOT NULL DEFAULT false,
  "sourceNote" TEXT,
  "piipassAt" TIMESTAMPTZ(3),
  "piipassNotes" TEXT,
  "sourceDatasetHash" TEXT,
  "sourceRow" INTEGER,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Resource_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Resource_priority_check" CHECK ("priority" BETWEEN 0 AND 10)
);

CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "resourceId" TEXT,
  "actor" TEXT NOT NULL DEFAULT 'system',
  "summary" TEXT NOT NULL,
  "details" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Category" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RateLimitAttempt" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "namespace" TEXT NOT NULL,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RateLimitAttempt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PendingResource" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "website" TEXT,
  "phone" TEXT,
  "sources" JSONB,
  "notes" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PendingResource_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UrlVerificationRun" (
  "id" TEXT NOT NULL,
  "total" INTEGER NOT NULL,
  "verified" INTEGER NOT NULL,
  "durationMs" INTEGER NOT NULL,
  "ranAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UrlVerificationRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UrlVerificationResult" (
  "id" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "resourceId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "website" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "statusCode" INTEGER,
  "finalUrl" TEXT,
  "note" TEXT NOT NULL,
  "offTopicReason" TEXT,
  "durationMs" INTEGER NOT NULL,
  "checkedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "UrlVerificationResult_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "UrlVerificationResult_status_check"
    CHECK ("status" IN ('live', 'dead', 'uncertain', 'off-topic', 'invalid'))
);

CREATE TABLE "DatasetImport" (
  "id" TEXT NOT NULL,
  "datasetHash" TEXT NOT NULL,
  "filename" TEXT NOT NULL,
  "rowCount" INTEGER NOT NULL,
  "mode" TEXT NOT NULL DEFAULT 'replace',
  "appliedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DatasetImport_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");
CREATE UNIQUE INDEX "UrlVerificationResult_runId_resourceId_key" ON "UrlVerificationResult"("runId", "resourceId");
CREATE UNIQUE INDEX "DatasetImport_datasetHash_key" ON "DatasetImport"("datasetHash");
CREATE INDEX "Resource_category_idx" ON "Resource"("category");
CREATE INDEX "Resource_priority_idx" ON "Resource"("priority");
CREATE INDEX "Resource_acronym_idx" ON "Resource"("acronym");
CREATE INDEX "Resource_published_idx" ON "Resource"("published");
CREATE INDEX "Resource_verified_idx" ON "Resource"("verified");
CREATE INDEX "Resource_updatedAt_idx" ON "Resource"("updatedAt");
CREATE INDEX "Resource_sourceDatasetHash_idx" ON "Resource"("sourceDatasetHash");
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");
CREATE INDEX "AuditLog_resourceId_idx" ON "AuditLog"("resourceId");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
CREATE INDEX "Category_sortOrder_idx" ON "Category"("sortOrder");
CREATE INDEX "RateLimitAttempt_key_expiresAt_idx" ON "RateLimitAttempt"("key", "expiresAt");
CREATE INDEX "RateLimitAttempt_namespace_expiresAt_idx" ON "RateLimitAttempt"("namespace", "expiresAt");
CREATE INDEX "PendingResource_reason_idx" ON "PendingResource"("reason");
CREATE INDEX "PendingResource_createdAt_idx" ON "PendingResource"("createdAt");
CREATE INDEX "UrlVerificationRun_ranAt_idx" ON "UrlVerificationRun"("ranAt");
CREATE INDEX "UrlVerificationResult_resourceId_idx" ON "UrlVerificationResult"("resourceId");
CREATE INDEX "UrlVerificationResult_status_idx" ON "UrlVerificationResult"("status");
CREATE INDEX "UrlVerificationResult_checkedAt_idx" ON "UrlVerificationResult"("checkedAt");
CREATE INDEX "DatasetImport_appliedAt_idx" ON "DatasetImport"("appliedAt");

ALTER TABLE "AuditLog"
  ADD CONSTRAINT "AuditLog_resourceId_fkey"
  FOREIGN KEY ("resourceId") REFERENCES "Resource"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "UrlVerificationResult"
  ADD CONSTRAINT "UrlVerificationResult_runId_fkey"
  FOREIGN KEY ("runId") REFERENCES "UrlVerificationRun"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UrlVerificationResult"
  ADD CONSTRAINT "UrlVerificationResult_resourceId_fkey"
  FOREIGN KEY ("resourceId") REFERENCES "Resource"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION public.bndr_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW."updatedAt" = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.bndr_set_updated_at() FROM PUBLIC;

CREATE TRIGGER "Resource_set_updatedAt"
BEFORE UPDATE ON "Resource"
FOR EACH ROW EXECUTE FUNCTION public.bndr_set_updated_at();
CREATE TRIGGER "Category_set_updatedAt"
BEFORE UPDATE ON "Category"
FOR EACH ROW EXECUTE FUNCTION public.bndr_set_updated_at();
CREATE TRIGGER "PendingResource_set_updatedAt"
BEFORE UPDATE ON "PendingResource"
FOR EACH ROW EXECUTE FUNCTION public.bndr_set_updated_at();

-- Defense in depth for Supabase's exposed public schema. The Next.js server
-- connects as the database owner; browser-facing anon/authenticated roles have
-- no direct table policies or privileges.
ALTER TABLE "Resource" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Category" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RateLimitAttempt" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PendingResource" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UrlVerificationRun" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UrlVerificationResult" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DatasetImport" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated';
  END IF;
END;
$$;

CREATE TABLE "QrResetRequest" (
  "id" TEXT NOT NULL,
  "displayName" TEXT,
  "contactMethod" TEXT,
  "contactDetails" TEXT,
  "location" TEXT,
  "situation" TEXT,
  "urgentProblem" TEXT,
  "blockers" TEXT,
  "proposedHelp" TEXT,
  "unwantedSupport" TEXT,
  "deadline" TEXT,
  "alreadyWorking" TEXT,
  "currentHelp" TEXT,
  "planPreference" TEXT,
  "documentsNote" TEXT,
  "consentRequired" JSONB NOT NULL,
  "consentOptional" JSONB,
  "status" TEXT NOT NULL DEFAULT 'received',
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QrResetRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "QrResetRequest_status_check" CHECK ("status" IN ('received','reviewing','needs-info','approved','alternate-offered','declined','withdrawn','closed'))
);

CREATE TABLE "QrRequestReview" (
  "id" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "stage" INTEGER NOT NULL DEFAULT 1,
  "decision" TEXT NOT NULL,
  "reasonCode" TEXT,
  "notes" TEXT,
  "actor" TEXT NOT NULL DEFAULT 'system',
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QrRequestReview_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "QrRequestReview_stage_check" CHECK ("stage" BETWEEN 1 AND 2)
);

CREATE TABLE "QrResetCase" (
  "id" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'planning',
  "approvedCents" INTEGER,
  "fundedCents" INTEGER NOT NULL DEFAULT 0,
  "plan" JSONB,
  "activatedAt" TIMESTAMPTZ(3),
  "closedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QrResetCase_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "QrResetCase_amounts_check" CHECK (("approvedCents" IS NULL OR "approvedCents" >= 0) AND "fundedCents" >= 0)
);

CREATE TABLE "QrDonationEvent" (
  "id" TEXT NOT NULL,
  "processor" TEXT NOT NULL DEFAULT 'stripe',
  "processorEventId" TEXT NOT NULL,
  "checkoutId" TEXT,
  "amountCents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'usd',
  "recurring" BOOLEAN NOT NULL DEFAULT false,
  "status" TEXT NOT NULL,
  "resetCaseId" TEXT,
  "metadata" JSONB,
  "occurredAt" TIMESTAMPTZ(3) NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QrDonationEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "QrDonationEvent_amount_check" CHECK ("amountCents" >= 0)
);

CREATE UNIQUE INDEX "QrResetCase_requestId_key" ON "QrResetCase"("requestId");
CREATE UNIQUE INDEX "QrDonationEvent_processorEventId_key" ON "QrDonationEvent"("processorEventId");
CREATE INDEX "QrResetRequest_status_idx" ON "QrResetRequest"("status");
CREATE INDEX "QrResetRequest_createdAt_idx" ON "QrResetRequest"("createdAt");
CREATE INDEX "QrRequestReview_requestId_idx" ON "QrRequestReview"("requestId");
CREATE INDEX "QrRequestReview_stage_idx" ON "QrRequestReview"("stage");
CREATE INDEX "QrRequestReview_decision_idx" ON "QrRequestReview"("decision");
CREATE INDEX "QrResetCase_status_idx" ON "QrResetCase"("status");
CREATE INDEX "QrResetCase_createdAt_idx" ON "QrResetCase"("createdAt");
CREATE INDEX "QrDonationEvent_status_idx" ON "QrDonationEvent"("status");
CREATE INDEX "QrDonationEvent_resetCaseId_idx" ON "QrDonationEvent"("resetCaseId");
CREATE INDEX "QrDonationEvent_occurredAt_idx" ON "QrDonationEvent"("occurredAt");

ALTER TABLE "QrRequestReview" ADD CONSTRAINT "QrRequestReview_requestId_fkey"
  FOREIGN KEY ("requestId") REFERENCES "QrResetRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QrResetCase" ADD CONSTRAINT "QrResetCase_requestId_fkey"
  FOREIGN KEY ("requestId") REFERENCES "QrResetRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "QrDonationEvent" ADD CONSTRAINT "QrDonationEvent_resetCaseId_fkey"
  FOREIGN KEY ("resetCaseId") REFERENCES "QrResetCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TRIGGER "QrResetRequest_set_updatedAt"
BEFORE UPDATE ON "QrResetRequest"
FOR EACH ROW EXECUTE FUNCTION public.bndr_set_updated_at();
CREATE TRIGGER "QrResetCase_set_updatedAt"
BEFORE UPDATE ON "QrResetCase"
FOR EACH ROW EXECUTE FUNCTION public.bndr_set_updated_at();

ALTER TABLE "QrResetRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "QrRequestReview" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "QrResetCase" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "QrDonationEvent" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON TABLE "QrResetRequest", "QrRequestReview", "QrResetCase", "QrDonationEvent" FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON TABLE "QrResetRequest", "QrRequestReview", "QrResetCase", "QrDonationEvent" FROM authenticated';
  END IF;
END;
$$;
