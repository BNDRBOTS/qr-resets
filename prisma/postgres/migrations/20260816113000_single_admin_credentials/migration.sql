CREATE TABLE "AdminCredential" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "recoveryKeyHash" TEXT,
  "credentialVersion" INTEGER NOT NULL DEFAULT 1,
  "bootstrappedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "passwordUpdatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "recoveryKeyConfiguredAt" TIMESTAMPTZ(3),
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminCredential_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AdminCredential_credentialVersion_check" CHECK ("credentialVersion" >= 1)
);

CREATE UNIQUE INDEX "AdminCredential_email_key" ON "AdminCredential"("email");

CREATE TRIGGER "AdminCredential_set_updatedAt"
BEFORE UPDATE ON "AdminCredential"
FOR EACH ROW EXECUTE FUNCTION public.bndr_set_updated_at();

-- The application server owns credential access. Supabase browser roles must
-- never read or mutate password/recovery hashes directly.
ALTER TABLE "AdminCredential" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON TABLE "AdminCredential" FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON TABLE "AdminCredential" FROM authenticated';
  END IF;
END;
$$;
