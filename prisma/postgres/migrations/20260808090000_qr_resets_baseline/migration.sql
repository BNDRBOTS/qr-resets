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
