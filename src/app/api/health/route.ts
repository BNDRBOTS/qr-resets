// BNDR. API — production readiness check
// ----------------------------------------------------------------------------
// Health validates the backend that is actually in use. Railway-local SQLite is
// the default; PostgreSQL/Supabase is opt-in with STORAGE_BACKEND=postgres.
// Public deployment readiness requires: database reachable, canonical 114-row
// dataset present, durable persistence on Railway, and single-admin credentials.

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

export async function GET() {
  let dbReady = false;
  let datasetReady = false;

  try {
    const [datasetImport, sourceRows] = await Promise.all([
      db.datasetImport.findUnique({
        where: { datasetHash: EXPECTED_DATASET_SHA256 },
        select: { rowCount: true },
      }),
      db.resource.count({
        where: {
          sourceDatasetHash: EXPECTED_DATASET_SHA256,
          published: true,
        },
      }),
    ]);

    dbReady = true;
    datasetReady =
      datasetImport?.rowCount === EXPECTED_DATASET_ROWS &&
      sourceRows === EXPECTED_DATASET_ROWS;
  } catch {
    dbReady = false;
    datasetReady = false;
  }

  const persistence = persistenceReady();
  const admin = adminConfigured();
  const ready = dbReady && datasetReady && persistence && admin;

  return NextResponse.json(
    {
      version: VERSION,
      ready,
      backend: backendMode(),
      db: dbReady,
      dataset: datasetReady,
      persistence,
      admin,
    },
    { status: ready ? 200 : 503 },
  );
}
