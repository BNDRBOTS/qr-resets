#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(new URL("../", import.meta.url).pathname);
const now = new Date().toISOString();
const report = {
  packageVersion: JSON.parse(readFileSync(`${root}/package.json`, "utf8")).version,
  generatedAt: now,
  artifactEnvironment: { node: process.version, npm: npmVersion() },
  gates: [],
  productionRuntimeVerified: false,
};

function npmVersion() {
  const r = spawnSync("npm", ["--version"], { cwd: root, encoding: "utf8" });
  return r.status === 0 ? r.stdout.trim() : null;
}
function run(name, command, args, options = {}) {
  const started = Date.now();
  const r = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, ...(options.env ?? {}) },
    maxBuffer: 16 * 1024 * 1024,
  });
  const gate = {
    name,
    command: [command, ...args].join(" "),
    status: r.status === 0 ? "PASS" : "FAIL",
    exitCode: r.status,
    durationMs: Date.now() - started,
    stdout: (r.stdout ?? "").trim().slice(-12000),
    stderr: (r.stderr ?? "").trim().slice(-12000),
  };
  report.gates.push(gate);
  return gate;
}
function blocked(name, reason) {
  report.gates.push({ name, status: "BLOCKED", reason });
}

run("package-contract", "node", ["scripts/verify-package.mjs"]);
run("canonical-dataset", "node", ["scripts/verify-dataset.mjs"]);
run("import-graph", "node", ["scripts/verify-imports.mjs"]);
run("typescript-syntax", "node", ["scripts/verify-syntax.mjs"]);
run("dependency-free-contract-tests", "npm", ["run", "test:contracts"]);

// Runtime verification only passes after the real dependency-installed chain:
// typecheck -> lint -> production build -> production start -> HTTP 200 health.
// Missing dependencies/configuration are recorded as BLOCKED, never converted
// into a pass or a deployment-readiness claim.
if (existsSync(`${root}/node_modules/next/package.json`) && existsSync(`${root}/node_modules/typescript/package.json`)) {
  const typecheck = run("typecheck", "npm", ["run", "typecheck"]);
  if (typecheck.status !== "PASS") {
    blocked("lint", "typecheck failed");
    blocked("next-production-build", "typecheck failed");
    blocked("production-start-health", "production build did not complete");
  } else {
    const lint = run("lint", "npm", ["run", "lint"]);
    if (lint.status !== "PASS") {
      blocked("next-production-build", "lint failed");
      blocked("production-start-health", "production build did not complete");
    } else {
      const build = run("next-production-build", "npm", ["run", "build:next"]);
      if (build.status === "PASS") {
        const runtime = await runProductionHealth();
        if (runtime.status === "PASS") report.productionRuntimeVerified = true;
      } else {
        blocked("production-start-health", "production build failed");
      }
    }
  }
} else {
  blocked("typecheck", "project dependencies are not installed in this execution tree");
  blocked("lint", "project dependencies are not installed in this execution tree");
  blocked("next-production-build", "project dependencies are not installed in this execution tree");
  blocked("production-start-health", "production build is unavailable because project dependencies are not installed");
}

const requiredStatic = report.gates.filter((g) => [
  "package-contract",
  "canonical-dataset",
  "import-graph",
  "typescript-syntax",
  "dependency-free-contract-tests",
].includes(g.name));
report.staticReleaseGatesPass = requiredStatic.every((g) => g.status === "PASS");
report.sourceTreeSha256 = treeDigest();
writeFileSync(`${root}/RELEASE_VERIFICATION.json`, JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({
  staticReleaseGatesPass: report.staticReleaseGatesPass,
  productionRuntimeVerified: report.productionRuntimeVerified,
  sourceTreeSha256: report.sourceTreeSha256,
  output: "RELEASE_VERIFICATION.json",
}, null, 2));
if (!report.staticReleaseGatesPass) process.exit(1);

async function runProductionHealth() {
  const name = "production-start-health";
  const started = Date.now();
  const port = 3217;
  let stdout = "";
  let stderr = "";
  const runtimeData = `${root}/.runtime-verification-data`;
  const runtimeEnv = {
    ...process.env,
    NODE_ENV: "production",
    PORT: String(port),
    HOSTNAME: "0.0.0.0",
    STORAGE_BACKEND: "sqlite",
    BNDR_DATA_DIR: runtimeData,
    ADMIN_EMAIL: process.env.ADMIN_EMAIL || "release-check@bndr.local",
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || "release-check-only-9d2f68c1",
    NEXTAUTH_URL: `http://127.0.0.1:${port}`,
  };
  // The local release verifier intentionally has no RAILWAY_SERVICE_ID, so the
  // runtime can use its isolated temporary SQLite directory without pretending
  // it is a Railway persistent volume.
  delete runtimeEnv.RAILWAY_SERVICE_ID;
  delete runtimeEnv.RAILWAY_VOLUME_MOUNT_PATH;
  delete runtimeEnv.DATABASE_URL;

  const child = spawn("npm", ["run", "start"], {
    cwd: root,
    env: runtimeEnv,
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (chunk) => { stdout = (stdout + chunk).slice(-12000); });
  child.stderr.on("data", (chunk) => { stderr = (stderr + chunk).slice(-12000); });

  let response = null;
  let error = null;
  const deadline = Date.now() + 60000;
  try {
    while (Date.now() < deadline) {
      if (child.exitCode !== null) {
        error = `server exited before health check with code ${child.exitCode}`;
        break;
      }
      try {
        response = await fetch(`http://127.0.0.1:${port}/api/health`, { signal: AbortSignal.timeout(1500) });
        if (response.status === 200) break;
      } catch (err) {
        error = err instanceof Error ? err.message : String(err);
      }
      await new Promise((resolveWait) => setTimeout(resolveWait, 500));
    }
  } finally {
    if (child.exitCode === null) child.kill("SIGTERM");
    await Promise.race([
      new Promise((resolveExit) => child.once("exit", resolveExit)),
      new Promise((resolveWait) => setTimeout(resolveWait, 2000)),
    ]);
    if (child.exitCode === null) child.kill("SIGKILL");
  }

  const status = response?.status === 200 ? "PASS" : "FAIL";
  const gate = {
    name,
    command: `STORAGE_BACKEND=sqlite PORT=${port} npm run start; GET /api/health`,
    status,
    httpStatus: response?.status ?? null,
    durationMs: Date.now() - started,
    stdout: stdout.trim(),
    stderr: stderr.trim(),
    ...(status === "FAIL" ? { error: error ?? "health endpoint did not return HTTP 200 within 60 seconds" } : {}),
  };
  report.gates.push(gate);
  return gate;
}

function treeDigest() {
  // Deterministic digest of source/config/data that determines runtime;
  // excludes generated verification output to avoid self-reference.
  const r = spawnSync("python3", ["-c", `
import hashlib, pathlib
root=pathlib.Path(${JSON.stringify(root)})
roots=['src','prisma','scripts','tests','supabase','public']
extra=['package.json','next.config.ts','railway.toml','tsconfig.json','postcss.config.mjs','.env.example','.npmrc']
h=hashlib.sha256()
files=[]
for name in roots:
 p=root/name
 if p.exists(): files += [x for x in p.rglob('*') if x.is_file()]
for name in extra:
 p=root/name
 if p.exists(): files.append(p)
for p in sorted(set(files), key=lambda x:str(x.relative_to(root))):
 rel=str(p.relative_to(root)).replace('\\\\','/')
 h.update(rel.encode()); h.update(b'\\0'); h.update(p.read_bytes()); h.update(b'\\0')
print(h.hexdigest())
`], { cwd: root, encoding: "utf8" });
  if (r.status === 0) return r.stdout.trim();
  return createHash("sha256").update("tree-digest-unavailable").digest("hex");
}
