// Bridge to the bundled Python resource verifier v4 (verifier/resource_verifier_core.py).
// The Python implementation is canonical; this module only manages invocation,
// checkpoint streaming, and output parsing. No verification semantics live here.

import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { lookup } from "node:dns/promises";

const VERIFIER_SCRIPT = join(process.cwd(), "verifier", "resource_verifier_core.py");
const PYTHON_CANDIDATES = ["python3", "python"];
const CHECKPOINT_POLL_MS = 5_000;
const DEFAULT_TIMEOUT_MS = 30 * 60 * 1000;

export type VerifierProbe = {
  available: boolean;
  python: string | null;
  version: string | null;
  error: string | null;
};

export type EgressProbe = {
  egressRestricted: boolean;
  probes: Array<{ host: string; ok: boolean; error: string | null }>;
};

export type VerifierInputRecord = Record<string, unknown> & {
  record_id?: string;
  name?: string;
};

export type VerifierBatchResult = {
  records: Array<Record<string, unknown>>;
  manifest: Record<string, unknown> | null;
  reviewPairs: Array<Record<string, unknown>>;
  exitCode: number | null;
  stderrTail: string;
};

function runCommand(command: string, args: string[], timeoutMs: number): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
    }, timeoutMs);
    child.stdout.on("data", (chunk) => { stdout += String(chunk); });
    child.stderr.on("data", (chunk) => { stderr += String(chunk); });
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({ code: null, stdout, stderr: `${stderr}\n${String(error)}` });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
  });
}

/** Locate a Python interpreter and confirm the bundled verifier version. */
export async function probeVerifier(): Promise<VerifierProbe> {
  if (!existsSync(VERIFIER_SCRIPT)) {
    return { available: false, python: null, version: null, error: "verifier script missing" };
  }
  for (const python of PYTHON_CANDIDATES) {
    const result = await runCommand(python, [VERIFIER_SCRIPT, "--version"], 30_000);
    if (result.code === 0) {
      const version = `${result.stdout}\n${result.stderr}`.match(/(\d+\.\d+\.\d+)/)?.[1] ?? null;
      return { available: true, python, version, error: null };
    }
  }
  return { available: false, python: null, version: null, error: "python interpreter unavailable" };
}

/**
 * Detect restricted network egress using neutral control hosts. When control
 * hosts fail DNS, "dead website" conclusions are environment artifacts and
 * must be demoted (network_failure_is_dead=false).
 */
export async function probeEgress(): Promise<EgressProbe> {
  const hosts = ["example.com", "google.com", "cloudflare.com"];
  const probes: EgressProbe["probes"] = [];
  for (const host of hosts) {
    try {
      await lookup(host);
      probes.push({ host, ok: true, error: null });
    } catch (error) {
      probes.push({ host, ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  }
  const reachable = probes.filter((probe) => probe.ok).length;
  return { egressRestricted: reachable === 0, probes };
}

async function readJsonIfExists(path: string): Promise<unknown | null> {
  try {
    const text = await readFile(path, "utf8");
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Run the bundled verifier v4 against a batch of records.
 * - Streams checkpoint_partial.json through onCheckpoint so callers can
 *   persist progress per record while the run executes.
 * - network=false adds --no-network (used only for smoke tests; production
 *   runs always attempt live network and let the verifier record failures).
 */
export async function runVerifierBatch(options: {
  records: VerifierInputRecord[];
  outDir: string;
  network: boolean;
  timeoutMs?: number;
  onCheckpoint?: (records: Array<Record<string, unknown>>) => Promise<void> | void;
}): Promise<VerifierBatchResult> {
  const probe = await probeVerifier();
  if (!probe.available || !probe.python) {
    throw new Error(`verifier v4 unavailable: ${probe.error ?? "unknown"}`);
  }

  await mkdir(options.outDir, { recursive: true });
  const inputPath = join(options.outDir, "input.json");
  await writeFile(inputPath, JSON.stringify({ resources: options.records }, null, 2), "utf8");

  const args = [VERIFIER_SCRIPT, inputPath, "-o", options.outDir];
  if (!options.network) args.push("--no-network");

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const checkpointPath = join(options.outDir, "checkpoint_partial.json");

  const child = spawn(probe.python, args, { stdio: ["ignore", "pipe", "pipe"] });
  let stderr = "";
  child.stdout.on("data", () => { /* verifier progress goes to checkpoint files */ });
  child.stderr.on("data", (chunk) => {
    stderr = `${stderr}${String(chunk)}`.slice(-8_000);
  });

  let finished = false;
  const exitCode: number | null = await new Promise((resolve) => {
    const killTimer = setTimeout(() => {
      child.kill("SIGKILL");
    }, timeoutMs);

    const poll = setInterval(() => {
      void (async () => {
        if (finished || !options.onCheckpoint) return;
        const partial = await readJsonIfExists(checkpointPath);
        const records = Array.isArray(partial)
          ? partial
          : Array.isArray((partial as { records?: unknown[] } | null)?.records)
            ? ((partial as { records: unknown[] }).records)
            : null;
        if (records) {
          try {
            await options.onCheckpoint(records as Array<Record<string, unknown>>);
          } catch {
            // Checkpoint persistence must never kill the verifier run.
          }
        }
      })();
    }, CHECKPOINT_POLL_MS);

    child.on("error", () => {
      finished = true;
      clearTimeout(killTimer);
      clearInterval(poll);
      resolve(null);
    });
    child.on("close", (code) => {
      finished = true;
      clearTimeout(killTimer);
      clearInterval(poll);
      resolve(code);
    });
  });

  const verified = await readJsonIfExists(join(options.outDir, "verified_resources.json"));
  const manifest = await readJsonIfExists(join(options.outDir, "run_manifest.json"));
  const reviewPairs = await readJsonIfExists(join(options.outDir, "possible_duplicates_review.json"));

  const records = Array.isArray(verified)
    ? (verified as Array<Record<string, unknown>>)
    : Array.isArray((verified as { records?: unknown[] } | null)?.records)
      ? (((verified as { records: unknown[] }).records) as Array<Record<string, unknown>>)
      : [];

  return {
    records,
    manifest: manifest && typeof manifest === "object" && !Array.isArray(manifest) ? (manifest as Record<string, unknown>) : null,
    reviewPairs: Array.isArray(reviewPairs) ? (reviewPairs as Array<Record<string, unknown>>) : [],
    exitCode,
    stderrTail: stderr,
  };
}
