#!/usr/bin/env node
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const dataDir = await mkdtemp(path.join(os.tmpdir(), "qr-resets-e2e-"));
const adminEmail = "controlled-e2e@bndr.local";
const adminPassword = "Controlled-E2E-Only-9e8d2c4a";
const timeoutAt = Date.now() + 240_000;
let server;
let stdout = "";
let stderr = "";

function fail(message) {
  const detail = [
    message,
    stdout ? `--- server stdout ---\n${stdout.slice(-12000)}` : "",
    stderr ? `--- server stderr ---\n${stderr.slice(-12000)}` : "",
  ].filter(Boolean).join("\n");
  throw new Error(detail);
}

async function freePort() {
  return await new Promise((resolvePort, reject) => {
    const listener = net.createServer();
    listener.once("error", reject);
    listener.listen(0, "127.0.0.1", () => {
      const address = listener.address();
      const port = typeof address === "object" && address ? address.port : null;
      listener.close((error) => error ? reject(error) : resolvePort(port));
    });
  });
}

const port = await freePort();
if (!port) fail("Unable to allocate isolated E2E port.");
const base = `http://127.0.0.1:${port}`;

const runtimeEnv = {
  ...process.env,
  NODE_ENV: "production",
  PORT: String(port),
  HOSTNAME: "127.0.0.1",
  STORAGE_BACKEND: "sqlite",
  BNDR_DATA_DIR: dataDir,
  BNDR_SKIP_PACKAGED_SEED: "1",
  ADMIN_EMAIL: adminEmail,
  ADMIN_PASSWORD: adminPassword,
  NEXTAUTH_URL: base,
};
for (const key of [
  "RAILWAY_SERVICE_ID",
  "RAILWAY_VOLUME_MOUNT_PATH",
  "RAILWAY_PUBLIC_DOMAIN",
  "DATABASE_URL",
  "VERIFICATION_WORKER_DISABLED",
]) {
  delete runtimeEnv[key];
}

const cookies = new Map();

function absorbCookies(headers) {
  const values = typeof headers.getSetCookie === "function"
    ? headers.getSetCookie()
    : [headers.get("set-cookie")].filter(Boolean);
  for (const value of values) {
    const chunks = String(value).split(/,(?=\s*[^;,=\s]+=[^;,]*)/g);
    for (const chunk of chunks) {
      const first = chunk.trim().split(";", 1)[0];
      const eq = first.indexOf("=");
      if (eq > 0) cookies.set(first.slice(0, eq), first.slice(eq + 1));
    }
  }
}

function cookieHeader() {
  return [...cookies.entries()].map(([key, value]) => `${key}=${value}`).join("; ");
}

async function request(pathname, options = {}) {
  const headers = new Headers(options.headers ?? {});
  if (cookies.size) headers.set("Cookie", cookieHeader());
  if (options.method && options.method !== "GET" && options.method !== "HEAD") {
    headers.set("Origin", base);
  }
  const response = await fetch(`${base}${pathname}`, {
    ...options,
    headers,
    redirect: options.redirect ?? "manual",
    signal: AbortSignal.timeout(20_000),
  });
  absorbCookies(response.headers);
  return response;
}

async function json(pathname, options = {}) {
  const response = await request(pathname, options);
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    fail(`${options.method ?? "GET"} ${pathname} returned non-JSON HTTP ${response.status}: ${text.slice(0, 500)}`);
  }
  if (!response.ok) {
    fail(`${options.method ?? "GET"} ${pathname} failed HTTP ${response.status}: ${text.slice(0, 1000)}`);
  }
  return body;
}

async function postJson(pathname, body) {
  return json(pathname, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function patchJson(pathname, body) {
  return json(pathname, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function waitForServer() {
  let lastError = "";
  while (Date.now() < timeoutAt) {
    if (server.exitCode !== null) fail(`production server exited early with code ${server.exitCode}`);
    try {
      const response = await request("/api/auth/csrf");
      if (response.ok) return JSON.parse(await response.text());
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 500));
  }
  fail(`production server never became ready: ${lastError}`);
}

async function signIn(initialCsrf) {
  const csrfToken = initialCsrf?.csrfToken || (await json("/api/auth/csrf"))?.csrfToken;
  if (!csrfToken) fail("NextAuth CSRF token missing.");
  const form = new URLSearchParams({
    csrfToken,
    email: adminEmail,
    password: adminPassword,
    callbackUrl: `${base}/admin`,
    json: "true",
  });
  const response = await request("/api/auth/callback/credentials", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
  });
  if (![200, 302, 303].includes(response.status)) {
    fail(`credentials sign-in failed HTTP ${response.status}: ${(await response.text()).slice(0, 500)}`);
  }
  const session = await json("/api/auth/session");
  if (session?.user?.role !== "admin" || session?.user?.email !== adminEmail) {
    fail(`admin session was not established: ${JSON.stringify(session)}`);
  }
}

async function waitForRun(runId) {
  while (Date.now() < timeoutAt) {
    const payload = await json("/api/admin/verification/runs?take=100");
    const run = payload.runs?.find((item) => item.id === runId);
    if (run?.status === "completed") {
      if (run.error) fail(`verification run completed with error: ${run.error}`);
      if (!run.verifierVersion) fail("verification run completed without verifierVersion");
      return run;
    }
    if (run?.status === "failed") fail(`verification run failed: ${run.error ?? "unknown"}`);
    await new Promise((resolveWait) => setTimeout(resolveWait, 1000));
  }
  fail(`verification run ${runId} did not complete before timeout`);
}

server = spawn("npm", ["run", "start"], {
  cwd: root,
  env: runtimeEnv,
  stdio: ["ignore", "pipe", "pipe"],
});
server.stdout.on("data", (chunk) => { stdout = (stdout + String(chunk)).slice(-20000); });
server.stderr.on("data", (chunk) => { stderr = (stderr + String(chunk)).slice(-20000); });

try {
  const csrf = await waitForServer();
  await signIn(csrf);

  const input = [
    "Name: Controlled Verification Test Organization",
    "Category: Legal Aid",
    "Website: https://example.com/",
    "Description: Synthetic integration-test record used only in an isolated temporary database.",
  ].join("\n");

  const parsed = await postJson("/api/admin/parse", { text: input, format: "txt" });
  if (parsed?.parsed?.name !== "Controlled Verification Test Organization") {
    fail(`parse stage returned unexpected payload: ${JSON.stringify(parsed)}`);
  }
  if (parsed?.parsed?.category !== "legal-aid-court-access") {
    fail(`parse/normalizer category mismatch: ${JSON.stringify(parsed)}`);
  }

  const staged = await postJson("/api/admin/resources/import", {
    mode: "append",
    resources: [parsed.parsed],
  });
  if (!staged?.runId || staged.staged !== 1 || staged.inserted !== 0) {
    fail(`stage response is inconsistent: ${JSON.stringify(staged)}`);
  }

  const run = await waitForRun(staged.runId);
  const resultsPayload = await json(`/api/admin/verification/results?runId=${encodeURIComponent(staged.runId)}&take=10`);
  if (resultsPayload.total !== 1 || resultsPayload.results?.length !== 1) {
    fail(`expected exactly one persisted verification result: ${JSON.stringify(resultsPayload)}`);
  }

  const result = resultsPayload.results[0];
  if (!result.checkedAt || !result.evidenceJson || result.organizationStatus === "PENDING_VERIFICATION") {
    fail(`verifier evidence/results were not persisted: ${JSON.stringify(result)}`);
  }
  if (!["held", "publish_eligible"].includes(result.publishState)) {
    fail(`controlled candidate is not reviewable/publishable: ${result.publishState}`);
  }

  for (const issue of result.issues ?? []) {
    if (issue.reviewState === "unresolved") {
      await patchJson(`/api/admin/verification/issues/${encodeURIComponent(issue.id)}`, {
        reviewState: "dismissed",
      });
    }
  }
  await patchJson(`/api/admin/verification/results/${encodeURIComponent(result.id)}`, {
    reviewState: "reviewed",
  });

  const published = await postJson(
    `/api/admin/verification/results/${encodeURIComponent(result.id)}/publish`,
    {},
  );
  if (!published?.resourceId || published.published !== true) {
    fail(`publication failed: ${JSON.stringify(published)}`);
  }

  const resources = await json("/api/admin/resources?limit=10&offset=0");
  if (resources.total !== 1 || resources.resources?.[0]?.id !== published.resourceId) {
    fail(`published resource was not persisted exactly once: ${JSON.stringify(resources)}`);
  }

  const snapshot = await postJson("/api/admin/snapshots", {
    reason: "controlled E2E recovery proof",
  });
  if (snapshot.rowCount !== 1 || !snapshot.datasetHash) {
    fail(`snapshot creation failed: ${JSON.stringify(snapshot)}`);
  }
  const restoreDryRun = await postJson(
    `/api/admin/snapshots/${encodeURIComponent(snapshot.id)}/restore`,
    { dryRun: true },
  );
  if (
    restoreDryRun.dryRun !== true ||
    restoreDryRun.currentCount !== 1 ||
    restoreDryRun.wouldRestore !== 1 ||
    restoreDryRun.snapshotHash !== snapshot.datasetHash
  ) {
    fail(`snapshot recovery dry-run failed: ${JSON.stringify(restoreDryRun)}`);
  }

  console.log(JSON.stringify({
    ok: true,
    flow: [
      "input",
      "parse",
      "stage",
      "worker",
      "verifier",
      "persisted-evidence-results",
      "review",
      "publish",
      "snapshot-recovery-dry-run",
    ],
    runId: staged.runId,
    verifierVersion: run.verifierVersion,
    publishStateBeforeReview: result.publishState,
    organizationStatus: result.organizationStatus,
    isolatedResourceCount: resources.total,
    productionDatasetTouched: false,
  }, null, 2));
} finally {
  if (server && server.exitCode === null) {
    server.kill("SIGTERM");
    await Promise.race([
      new Promise((resolveExit) => server.once("exit", resolveExit)),
      new Promise((resolveWait) => setTimeout(resolveWait, 3000)),
    ]);
    if (server.exitCode === null) server.kill("SIGKILL");
  }
  await rm(dataDir, { recursive: true, force: true });
}

// Node's fetch/Undici pool may retain idle keep-alive handles after the
// controlled HTTP run. The test has completed and all child/temp resources
// are closed above, so terminate explicitly instead of leaving Railway's build
// step waiting on an otherwise idle event loop.
process.exit(0);
