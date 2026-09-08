import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { schemaPath, storageBackend, resolvedDatabaseUrl } from "./storage-backend.mjs";

const command = process.argv[2] || "generate";
const root = fileURLToPath(new URL("../", import.meta.url));
const prismaBin = process.platform === "win32"
  ? path.join(root, "node_modules", ".bin", "prisma.cmd")
  : path.join(root, "node_modules", ".bin", "prisma");
const env = { ...process.env };
const backend = storageBackend(env);

if (backend === "sqlite" && !env.DATABASE_URL?.startsWith("file:")) {
  // Build-time generation does not need the persistent volume. Give Prisma a
  // valid local URL so generation remains independent from Railway runtime.
  env.DATABASE_URL = pathToFileURL(path.join(root, ".build", "bndr-build.db")).href;
} else {
  env.DATABASE_URL = resolvedDatabaseUrl(env);
}

let args;
if (command === "generate") args = ["generate", "--schema", schemaPath(env)];
else if (command === "push") args = ["db", "push", "--skip-generate", "--schema", schemaPath(env)];
else if (command === "deploy") args = ["migrate", "deploy", "--schema", schemaPath(env)];
else throw new Error(`Unknown prisma command: ${command}`);

const result = spawnSync(prismaBin, args, { cwd: root, env, stdio: "inherit" });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
