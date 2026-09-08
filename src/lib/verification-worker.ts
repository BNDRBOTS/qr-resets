// Durable verification worker.
//
// Runs are persisted queue rows (VerificationRun). This worker claims runs
// with an atomic compare-and-swap, heartbeats while processing, and reclaims
// stale runs whose worker died (deploy, crash, restart, scaling event, or
// process recycle). A run surviving in the database is only half the story;
// this loop is what guarantees unfinished work is resumed or retried.

import { db } from "@/lib/db";
import {
  MAX_RUN_ATTEMPTS,
  processVerificationRun,
  scheduleRetryOrFail,
} from "@/lib/verification-pipeline";

const POLL_INTERVAL_MS = 15_000;
const HEARTBEAT_INTERVAL_MS = 20_000;
export const STALE_CLAIM_MS = 120_000;

type WorkerState = {
  workerId: string;
  timer: ReturnType<typeof setInterval> | null;
  busy: boolean;
  stopped: boolean;
};

const WORKER_KEY = Symbol.for("bndr.verification.worker");

function getState(): WorkerState | null {
  return ((globalThis as Record<symbol, unknown>)[WORKER_KEY] as WorkerState | undefined) ?? null;
}

function setState(state: WorkerState | null): void {
  (globalThis as Record<symbol, unknown>)[WORKER_KEY] = state ?? undefined;
}

/**
 * Claim the next runnable verification run.
 * Runnable = queued and due for its next attempt, or running with a stale
 * heartbeat (its worker died). The claim is an atomic CAS on
 * (id, status, attempts): losing a race claims nothing.
 */
async function claimNextRun(workerId: string) {
  const now = new Date();
  const staleBefore = new Date(Date.now() - STALE_CLAIM_MS);

  const candidate = await db.verificationRun.findFirst({
    where: {
      OR: [
        {
          status: "queued",
          attempts: { lt: MAX_RUN_ATTEMPTS },
          OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
        },
        {
          status: "running",
          attempts: { lte: MAX_RUN_ATTEMPTS },
          heartbeatAt: { lt: staleBefore },
        },
      ],
    },
    orderBy: { createdAt: "asc" },
  });
  if (!candidate) return null;

  const claimed = await db.verificationRun.updateMany({
    where: { id: candidate.id, status: candidate.status, attempts: candidate.attempts },
    data: {
      status: "running",
      claimedBy: workerId,
      heartbeatAt: new Date(),
      startedAt: candidate.startedAt ?? new Date(),
      nextAttemptAt: null,
      error: null,
      attempts: { increment: 1 },
    },
  });
  if (claimed.count !== 1) return null;

  return db.verificationRun.findUnique({ where: { id: candidate.id } });
}

async function tick(state: WorkerState): Promise<void> {
  if (state.busy || state.stopped) return;
  state.busy = true;
  try {
    const run = await claimNextRun(state.workerId);
    if (!run) return;

    const heartbeat = setInterval(() => {
      void db.verificationRun
        .updateMany({ where: { id: run.id, claimedBy: state.workerId }, data: { heartbeatAt: new Date() } })
        .catch(() => undefined);
    }, HEARTBEAT_INTERVAL_MS);

    try {
      await processVerificationRun(run.id, state.workerId);
    } catch (error) {
      await scheduleRetryOrFail(run.id, error instanceof Error ? error.message : String(error));
    } finally {
      clearInterval(heartbeat);
    }
  } catch (error) {
    console.error("[verification-worker] tick failed", error);
  } finally {
    state.busy = false;
  }
}

/** Start the singleton worker loop for this process. Safe to call repeatedly. */
export function startVerificationWorker(): void {
  if (process.env.VERIFICATION_WORKER_DISABLED === "1") {
    console.log("[verification-worker] disabled via VERIFICATION_WORKER_DISABLED=1");
    return;
  }
  const existing = getState();
  if (existing && !existing.stopped) return;

  const state: WorkerState = {
    workerId: `worker-${process.pid}-${Math.random().toString(36).slice(2, 10)}`,
    timer: null,
    busy: false,
    stopped: false,
  };
  state.timer = setInterval(() => {
    void tick(state);
  }, POLL_INTERVAL_MS);
  if (typeof state.timer.unref === "function") state.timer.unref();
  setState(state);
  console.log(`[verification-worker] started ${state.workerId}`);
  void tick(state);
}

/** Stop the worker loop (tests and graceful shutdown). */
export function stopVerificationWorker(): void {
  const state = getState();
  if (!state) return;
  state.stopped = true;
  if (state.timer) clearInterval(state.timer);
  setState(null);
}
