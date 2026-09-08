// Next.js instrumentation: starts the durable verification worker in the
// Node.js server runtime. The worker claims persisted verification runs and
// resumes unfinished work after deploys, restarts, crashes, and recycles.

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startVerificationWorker } = await import("@/lib/verification-worker");
    startVerificationWorker();
  }
}
