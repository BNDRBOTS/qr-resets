// BNDR. API — production readiness check
// ----------------------------------------------------------------------------
// Health validates the backend that is actually in use. Railway-local SQLite is
// the default; PostgreSQL/Supabase is opt-in with STORAGE_BACKEND=postgres.
// Railway deployment readiness requires the server-owned data path to be usable:
// database reachable, immutable baseline import recorded, durable persistence,
// and an executable verifier. Live resource rows are administrator-owned state
// after bootstrap and are not silently treated as a deploy-time invariant.
// Admin credentials are reported diagnostically but do not make the public app unhealthy.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const VERSION = "1.1.4";
const EXPECTED_DATASET_SHA256 =
  "5e9a8438ee652c9be5b44fb781a2ba94db9dafffddcc720c254bc291aab2d72b";
const EXPECTED_DATASET_ROWS = 114;

function backendMode() {
  return process.env.STORAGE_BACKEND_RESOLVED || process.env.STORAGE_BACKEND || "sqlite";
}

function adminConfigured() {
  return Boolean(
    process.env.ADMIN_EMAIL?.trim() &&
      (process.env.ADMIN_PASSWORD_HASH?.trim() || process.env.ADMIN_PASSWORD?.trim()),
  );
}

function persistenceReady() {
  const backend = backendMode().toLowerCase();
  if (["postgres", "postgresql", "supabase"].includes(backend)) return true;
  if (!process.env.RAILWAY_SERVICE_ID) return true;
  return process.env.BNDR_PERSISTENCE_READY === "1" && Boolean(process.env.RAILWAY_VOLUME_MOUNT_PATH?.trim());
}

function verifierReady() {
  return process.env.BNDR_VERIFIER_READY === "1" &&
    process.env.BNDR_VERIFIER_VERSION?.trim() === "4.0.0" &&
    Boolean(process.env.BNDR_VERIFIER_PYTHON?.trim());
}

export async function GET() {
  let dbReady = false;
  let datasetReady = false;

  try {
    const datasetImport = await db.datasetImport.findUnique({
      where: { datasetHash: EXPECTED_DATASET_SHA256 },
      select: { rowCount: true },
    });

    dbReady = true;
    datasetReady = datasetImport?.rowCount === EXPECTED_DATASET_ROWS;
  } catch {
    dbReady = false;
    datasetReady = false;
  }

  const persistence = persistenceReady();
  const verifier = verifierReady();
  const admin = adminConfigured();
  const ready = dbReady && datasetReady && persistence && verifier;

  return NextResponse.json(
    {
      version: VERSION,
      ready,
      backend: backendMode(),
      db: dbReady,
      dataset: datasetReady,
      persistence,
      verifier,
      verifierVersion: process.env.BNDR_VERIFIER_VERSION?.trim() || null,
      admin,
    },
    { status: ready ? 200 : 503 },
  );
}
