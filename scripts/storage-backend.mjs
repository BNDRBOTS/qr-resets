import path from "node:path";
import { pathToFileURL } from "node:url";

export function storageBackend(env = process.env) {
  const raw = (env.STORAGE_BACKEND || "sqlite").trim().toLowerCase();
  if (["postgres", "postgresql", "supabase"].includes(raw)) return "postgres";
  if (["sqlite", "railway", "local"].includes(raw)) return "sqlite";
  throw new Error(`Unsupported STORAGE_BACKEND=${raw}. Use sqlite (default) or postgres.`);
}

export function schemaPath(env = process.env) {
  return storageBackend(env) === "postgres"
    ? "prisma/postgres/schema.prisma"
    : "prisma/sqlite/schema.prisma";
}

export function resolvedSqliteDataDir(env = process.env) {
  return env.RAILWAY_VOLUME_MOUNT_PATH?.trim()
    || env.BNDR_DATA_DIR?.trim()
    || path.resolve(process.cwd(), "data");
}

export function resolvedDatabaseUrl(env = process.env) {
  if (storageBackend(env) === "postgres") {
    const url = env.DATABASE_URL?.trim();
    if (!url || !/^postgres(?:ql)?:\/\//i.test(url)) {
      throw new Error("STORAGE_BACKEND=postgres requires a PostgreSQL DATABASE_URL.");
    }
    return url;
  }
  const configured = env.DATABASE_URL?.trim();
  if (configured?.startsWith("file:")) return configured;
  return pathToFileURL(path.join(resolvedSqliteDataDir(env), "bndr.db")).href;
}

export function railwayPersistenceReady(env = process.env) {
  if (storageBackend(env) === "postgres") return true;
  if (!env.RAILWAY_SERVICE_ID) return true;
  return Boolean(env.RAILWAY_VOLUME_MOUNT_PATH?.trim());
}
