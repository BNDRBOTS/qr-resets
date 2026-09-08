-- Durable resource snapshots: full-row history captured before destructive
-- operations (bulk replace, restore), with audited dry-runnable restore.
CREATE TABLE "ResourceSnapshot" (
    "id" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "trigger" TEXT NOT NULL DEFAULT 'manual',
    "rowCount" INTEGER NOT NULL,
    "datasetHash" TEXT,
    "dataJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResourceSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ResourceSnapshot_createdAt_idx" ON "ResourceSnapshot"("createdAt");

CREATE INDEX "ResourceSnapshot_trigger_idx" ON "ResourceSnapshot"("trigger");

ALTER TABLE "ResourceSnapshot" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON TABLE "ResourceSnapshot" FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON TABLE "ResourceSnapshot" FROM authenticated';
  END IF;
END;
$$;
