export default function Loading() {
  return (
    <main className="min-h-screen bg-background px-6 py-24 text-foreground" aria-busy="true" aria-live="polite">
      <div className="mx-auto max-w-xl rounded-2xl border border-border bg-card p-8">
        <p className="text-sm font-medium text-muted-foreground">Loading…</p>
      </div>
    </main>
  );
}
