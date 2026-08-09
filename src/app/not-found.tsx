import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-background px-6 py-24 text-foreground">
      <div className="mx-auto max-w-xl rounded-2xl border border-border bg-card p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">404</p>
        <h1 className="mt-3 text-2xl font-semibold">Page not found.</h1>
        <Link
          href="/"
          className="mt-6 inline-flex rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          Resource Directory
        </Link>
      </div>
    </main>
  );
}
