-- Resource verification pipeline: durable verifier-v4 run queue, per-record
-- verification results, and field-level issue review state.
-- The application server owns this queue. Supabase browser roles must never
-- read or mutate staged candidate payloads, evidence, or review state.

CREATE TABLE "VerificationRun" (
  "id" TEXT NOT NULL,
  "origin" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'queued',
  "actor" TEXT NOT NULL DEFAULT 'system',
  "claimedBy" TEXT,
  "heartbeatAt" TIMESTAMPTZ(3),
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMPTZ(3),
  "verifierVersion" TEXT,
  "startedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMPTZ(3),
  "inputHashes" JSONB,
  "settings" JSONB,
  "summary" JSONB,
  "error" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VerificationRun_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "VerificationRun_attempts_check" CHECK ("attempts" >= 0)
);

CREATE INDEX "VerificationRun_status_idx" ON "VerificationRun"("status");
CREATE INDEX "VerificationRun_origin_idx" ON "VerificationRun"("origin");
CREATE INDEX "VerificationRun_createdAt_idx" ON "VerificationRun"("createdAt");
CREATE INDEX "VerificationRun_heartbeatAt_idx" ON "VerificationRun"("heartbeatAt");

CREATE TABLE "VerificationResult" (
  "id" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "recordId" TEXT NOT NULL,
  "resourceId" TEXT,
  "name" TEXT NOT NULL,
  "suggestedName" TEXT,
  "category" TEXT,
  "organizationStatus" TEXT NOT NULL DEFAULT 'PENDING_VERIFICATION',
  "organizationReason" TEXT,
  "duplicateGroupId" TEXT,
  "duplicateConfidence" TEXT,
  "duplicateKind" TEXT NOT NULL DEFAULT 'none',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "publishState" TEXT NOT NULL DEFAULT 'held',
  "reviewState" TEXT NOT NULL DEFAULT 'unreviewed',
  "resolvedAt" TIMESTAMPTZ(3),
  "resolvedBy" TEXT,
  "candidateJson" JSONB,
  "evidenceJson" JSONB,
  "flagsJson" JSONB,
  "viabilityJson" JSONB,
  "sourceJson" JSONB,
  "errorsJson" JSONB,
  "checkedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VerificationResult_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "VerificationResult_attempts_check" CHECK ("attempts" >= 0),
  CONSTRAINT "VerificationResult_runId_fkey" FOREIGN KEY ("runId") REFERENCES "VerificationRun"("id") ON DELETE CASCADE,
  CONSTRAINT "VerificationResult_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE SET NULL
);

CREATE UNIQUE INDEX "VerificationResult_runId_recordId_key" ON "VerificationResult"("runId", "recordId");
CREATE INDEX "VerificationResult_organizationStatus_idx" ON "VerificationResult"("organizationStatus");
CREATE INDEX "VerificationResult_publishState_idx" ON "VerificationResult"("publishState");
CREATE INDEX "VerificationResult_reviewState_idx" ON "VerificationResult"("reviewState");
CREATE INDEX "VerificationResult_resourceId_idx" ON "VerificationResult"("resourceId");
CREATE INDEX "VerificationResult_checkedAt_idx" ON "VerificationResult"("checkedAt");

CREATE TABLE "VerificationIssue" (
  "id" TEXT NOT NULL,
  "resultId" TEXT NOT NULL,
  "field" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "currentValue" TEXT,
  "suggestedValue" TEXT,
  "evidenceJson" JSONB,
  "reviewState" TEXT NOT NULL DEFAULT 'unresolved',
  "resolvedAt" TIMESTAMPTZ(3),
  "resolvedBy" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VerificationIssue_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "VerificationIssue_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "VerificationResult"("id") ON DELETE CASCADE
);

CREATE INDEX "VerificationIssue_resultId_idx" ON "VerificationIssue"("resultId");
CREATE INDEX "VerificationIssue_severity_idx" ON "VerificationIssue"("severity");
CREATE INDEX "VerificationIssue_reviewState_idx" ON "VerificationIssue"("reviewState");

CREATE TRIGGER "VerificationRun_set_updatedAt"
BEFORE UPDATE ON "VerificationRun"
FOR EACH ROW EXECUTE FUNCTION public.bndr_set_updated_at();

CREATE TRIGGER "VerificationResult_set_updatedAt"
BEFORE UPDATE ON "VerificationResult"
FOR EACH ROW EXECUTE FUNCTION public.bndr_set_updated_at();

CREATE TRIGGER "VerificationIssue_set_updatedAt"
BEFORE UPDATE ON "VerificationIssue"
FOR EACH ROW EXECUTE FUNCTION public.bndr_set_updated_at();

ALTER TABLE "VerificationRun" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "VerificationResult" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "VerificationIssue" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON TABLE "VerificationRun" FROM anon';
    EXECUTE 'REVOKE ALL ON TABLE "VerificationResult" FROM anon';
    EXECUTE 'REVOKE ALL ON TABLE "VerificationIssue" FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON TABLE "VerificationRun" FROM authenticated';
    EXECUTE 'REVOKE ALL ON TABLE "VerificationResult" FROM authenticated';
    EXECUTE 'REVOKE ALL ON TABLE "VerificationIssue" FROM authenticated';
  END IF;
END;
$$;
