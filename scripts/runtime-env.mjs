import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { resolvedDatabaseUrl, resolvedSqliteDataDir, storageBackend, railwayPersistenceReady } from "./storage-backend.mjs";

async function persistentSecret(name, filename, dataDir, env) {
  if (env[name]?.trim()) return env[name].trim();
  await mkdir(dataDir, { recursive: true });
  const target = path.join(dataDir, filename);
  try {
    const existing = (await readFile(target, "utf8")).trim();
    if (existing) return existing;
  } catch {}
  const generated = randomBytes(48).toString("base64url");
  await writeFile(target, generated, { mode: 0o600 });
  return generated;
}

export async function buildRuntimeEnv(base = process.env) {
  const env = { ...base };
  const backend = storageBackend(env);
  env.STORAGE_BACKEND_RESOLVED = backend;
  env.DATABASE_URL = resolvedDatabaseUrl(env);

  const dataDir = backend === "sqlite" ? resolvedSqliteDataDir(env) : (env.RAILWAY_VOLUME_MOUNT_PATH?.trim() || path.resolve(process.cwd(), "data"));
  await mkdir(dataDir, { recursive: true });
  env.BNDR_DATA_DIR = dataDir;
  env.BNDR_PERSISTENCE_READY = railwayPersistenceReady(env) ? "1" : "0";

  env.NEXTAUTH_SECRET = await persistentSecret("NEXTAUTH_SECRET", ".nextauth-secret", dataDir, env);
  env.RATE_LIMIT_PEPPER = await persistentSecret("RATE_LIMIT_PEPPER", ".rate-limit-pepper", dataDir, env);

  if (!env.NEXTAUTH_URL?.trim() && env.RAILWAY_PUBLIC_DOMAIN?.trim()) {
    env.NEXTAUTH_URL = `https://${env.RAILWAY_PUBLIC_DOMAIN.trim()}`;
  }

  // Stable, non-secret instance fingerprint for health diagnostics only.
  env.BNDR_STORAGE_FINGERPRINT = createHash("sha256").update(`${backend}:${dataDir}`).digest("hex").slice(0, 12);
  return env;
}
