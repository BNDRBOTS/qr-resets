import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildRuntimeEnv } from "./runtime-env.mjs";
import { schemaPath, storageBackend } from "./storage-backend.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const prismaBin = process.platform === "win32" ? path.join(root, "node_modules", ".bin", "prisma.cmd") : path.join(root, "node_modules", ".bin", "prisma");
const env = await buildRuntimeEnv(process.env);
const backend = storageBackend(env);

const args = backend === "postgres"
  ? ["migrate", "deploy", "--schema", schemaPath(env)]
  : ["db", "push", "--skip-generate", "--schema", schemaPath(env)];

const schemaResult = spawnSync(prismaBin, args, { cwd: root, env, stdio: "inherit" });
if (schemaResult.error) throw schemaResult.error;
if (schemaResult.status !== 0) process.exit(schemaResult.status ?? 1);

const seedResult = spawnSync(process.execPath, ["scripts/seed-verified-resources.mjs"], { cwd: root, env, stdio: "inherit" });
if (seedResult.error) throw seedResult.error;
if (seedResult.status !== 0) process.exit(seedResult.status ?? 1);

console.log(`[database] backend=${backend} persistence=${env.BNDR_PERSISTENCE_READY === "1" ? "durable" : "ephemeral"}`);
