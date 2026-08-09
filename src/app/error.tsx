"use client";

export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <main className="min-h-screen bg-background px-6 py-24 text-foreground">
      <div className="mx-auto max-w-xl rounded-2xl border border-border bg-card p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Request failed</p>
        <h1 className="mt-3 text-2xl font-semibold">This view could not be loaded.</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          No empty or successful state is being substituted for the failure.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          Retry
        </button>
      </div>
    </main>
  );
}
