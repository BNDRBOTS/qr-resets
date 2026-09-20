import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const EXPECTED_VERIFIER_VERSION = "4.0.0";
export const PYTHON_CANDIDATES = ["python3", "python"];

function run(command, args, timeoutMs) {
  return new Promise((resolveRun) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolveRun(value);
    };
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      finish({ code: null, stdout, stderr: `${stderr}\ncommand timed out`.trim() });
    }, timeoutMs);
    child.stdout.on("data", (chunk) => { stdout += String(chunk); });
    child.stderr.on("data", (chunk) => { stderr += String(chunk); });
    child.once("error", (error) => finish({ code: null, stdout, stderr: `${stderr}\n${String(error)}`.trim() }));
    child.once("close", (code) => finish({ code, stdout, stderr }));
  });
}

export async function probeVerifierRuntime(scriptPath, options = {}) {
  const absolute = resolve(scriptPath);
  if (!existsSync(absolute)) {
    return {
      ok: false,
      scriptPath: absolute,
      python: null,
      version: null,
      error: "bundled verifier script is missing",
    };
  }

  for (const python of PYTHON_CANDIDATES) {
    const result = await run(python, [absolute, "--version"], options.timeoutMs ?? 30_000);
    if (result.code !== 0) continue;
    const version = `${result.stdout}\n${result.stderr}`.match(/(\d+\.\d+\.\d+)/)?.[1] ?? null;
    if (version !== EXPECTED_VERIFIER_VERSION) {
      return {
        ok: false,
        scriptPath: absolute,
        python,
        version,
        error: `expected verifier ${EXPECTED_VERIFIER_VERSION}, got ${version ?? "unknown"}`,
      };
    }
    return { ok: true, scriptPath: absolute, python, version, error: null };
  }

  return {
    ok: false,
    scriptPath: absolute,
    python: null,
    version: null,
    error: "python3/python unavailable or unable to execute bundled verifier",
  };
}

export async function assertVerifierRuntime(scriptPath, options = {}) {
  const probe = await probeVerifierRuntime(scriptPath, options);
  if (!probe.ok) {
    throw new Error(
      `Verifier runtime preflight failed: ${probe.error}; script=${probe.scriptPath}`,
    );
  }
  return probe;
}

const invokedDirectly =
  process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (invokedDirectly) {
  const scriptPath = process.argv[2];
  if (!scriptPath) {
    console.error("Usage: node scripts/verify-verifier-runtime.mjs <verifier-script-path>");
    process.exit(2);
  }
  try {
    const result = await assertVerifierRuntime(scriptPath);
    console.log(JSON.stringify(result));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
