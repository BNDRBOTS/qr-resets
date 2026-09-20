import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Railpack installs Python while retaining Node as the application provider", () => {
  const railpack = JSON.parse(read("railpack.json"));
  assert.equal(railpack.provider, "node");
  assert.match(String(railpack.packages?.python ?? ""), /^3\.1[0-9]/);
});

test("standalone bundle contains verifier and production start preflights it before database work", () => {
  const pkg = JSON.parse(read("package.json"));
  assert.match(pkg.scripts["build:next"], /cp -R verifier \.next\/standalone\/verifier/);
  assert.match(pkg.scripts.build, /test:e2e:controlled/);

  const start = read("scripts/start-production.mjs");
  const preflight = start.indexOf("assertVerifierRuntime");
  const dbPush = start.indexOf('["db", "push"');
  const seed = start.indexOf("seed-verified-resources.mjs");
  assert.ok(preflight >= 0 && dbPush > preflight && seed > preflight);
  assert.match(start, /cwd: standaloneRoot/);
  assert.match(start, /BNDR_SKIP_PACKAGED_SEED is forbidden in Railway runtime/);
});

test("health readiness requires the executable verifier as well as DB, dataset, and persistence", () => {
  const health = read("src/app/api/health/route.ts");
  assert.match(health, /function verifierReady\(\)/);
  assert.match(health, /BNDR_VERIFIER_VERSION.*4\.0\.0/s);
  assert.match(health, /const ready = dbReady && datasetReady && persistence && verifier;/);
});

test("worker and pipeline enforce bounded retries and successful versioned verifier completion", () => {
  const worker = read("src/lib/verification-worker.ts");
  assert.match(worker, /attempts: \{ lt: MAX_RUN_ATTEMPTS \}/);
  assert.doesNotMatch(worker, /attempts: \{ lte: MAX_RUN_ATTEMPTS \}/);

  const pipeline = read("src/lib/verification-pipeline.ts");
  assert.match(pipeline, /probeVerifier\(\)/);
  assert.match(pipeline, /batch\.exitCode !== 0/);
  assert.match(pipeline, /manifestVersion/);
  assert.match(pipeline, /sourceIndexes/);
  assert.match(pipeline, /bySourceIndex/);
  assert.match(pipeline, /verifier_strong_identity_merge_constituent/);
});

test("publication requires a completed supported verifier run and is atomic with canonical creation", () => {
  const route = read("src/app/api/admin/verification/results/[id]/publish/route.ts");
  assert.match(route, /VERIFICATION_INCOMPLETE/);
  assert.match(route, /row\.run\.status !== "completed"/);
  assert.match(route, /VERIFIER_MIN_VERSION/);
  assert.match(route, /db\.\$transaction\(async \(tx\)/);
  assert.match(route, /createResourceRecordInTransaction\(tx, input, actor\)/);

  const service = read("src/lib/resource-service.ts");
  assert.match(service, /export async function createResourceRecordInTransaction/);
});

test("controlled E2E exercises actual HTTP parse-to-publish path in an isolated seed-free database", () => {
  const e2e = read("scripts/controlled-verification-e2e.mjs");
  for (const fragment of [
    "/api/admin/parse",
    "/api/admin/resources/import",
    "/api/admin/verification/runs",
    "/api/admin/verification/results",
    "/publish",
    "/api/admin/snapshots",
    "/restore",
  ]) {
    const escaped = fragment.replace(/[.*+?^$(){}|[\]\\]/g, "\\$&");
    assert.match(e2e, new RegExp(escaped));
  }
  assert.match(e2e, /BNDR_SKIP_PACKAGED_SEED: "1"/);
  assert.match(e2e, /delete runtimeEnv\[key\]/);
  assert.match(e2e, /productionDatasetTouched: false/);
});
