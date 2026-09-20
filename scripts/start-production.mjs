import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildRuntimeEnv } from "./runtime-env.mjs";
import { schemaPath, storageBackend } from "./storage-backend.mjs";
import { assertVerifierRuntime } from "./verify-verifier-runtime.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const standaloneRoot = path.join(root, ".next", "standalone");
const verifierScript = path.join(standaloneRoot, "verifier", "resource_verifier_core.py");
const prismaBin = process.platform === "win32" ? path.join(root, "node_modules", ".bin", "prisma.cmd") : path.join(root, "node_modules", ".bin", "prisma");
const requestedBackend = storageBackend(process.env);
if (requestedBackend === "sqlite" && process.env.RAILWAY_SERVICE_ID && !process.env.RAILWAY_VOLUME_MOUNT_PATH?.trim()) {
  throw new Error("Railway SQLite mode requires an attached persistent volume. Mount one at /data (recommended). Refusing an ephemeral production backend.");
}
const env = await buildRuntimeEnv(process.env);
const backend = storageBackend(env);

// Fail before any database initialization or seed activity unless the exact
// bundled verifier is present and executable by Python in the final image.
const verifier = await assertVerifierRuntime(verifierScript);
env.BNDR_VERIFIER_READY = "1";
env.BNDR_VERIFIER_VERSION = verifier.version ?? "";
env.BNDR_VERIFIER_PYTHON = verifier.python ?? "";

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, env, stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} failed (${signal || code})`));
    });
  });
}

if (backend === "postgres") {
  await run(prismaBin, ["migrate", "deploy", "--schema", schemaPath(env)]);
} else {
  // Railway volumes are mounted only when the service starts, so SQLite schema
  // preparation belongs here rather than in preDeployCommand.
  await run(prismaBin, ["db", "push", "--skip-generate", "--schema", schemaPath(env)]);
}
if (env.BNDR_SKIP_PACKAGED_SEED === "1") {
  if (env.RAILWAY_SERVICE_ID) {
    throw new Error("BNDR_SKIP_PACKAGED_SEED is forbidden in Railway runtime.");
  }
  console.log("[database] packaged resource seed skipped for isolated verification test");
} else {
  await run(process.execPath, ["scripts/seed-verified-resources.mjs"]);
}

const server = spawn(process.execPath, ["server.js"], {
  cwd: standaloneRoot,
  env: { ...env, HOSTNAME: "0.0.0.0" },
  stdio: "inherit",
});

for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => server.kill(signal));
}
server.once("error", (error) => { throw error; });
server.once("exit", (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
