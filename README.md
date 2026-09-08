# BNDR LLC — ResourceCite + QR Resets

One Next.js application containing two sibling product views:

- **ResourceCite** — the default public resource directory.
- **QR Resets™** — a prototype-only concept preview. Request storage, payment collection, donation webhooks, case funding, and QR mutation workflows are intentionally disabled in this release.

## Launch architecture

The default production backend is self-contained on Railway:

- **SQLite on a Railway persistent Volume** for server-owned ResourceCite/admin data.
- **114 packaged canonical resource rows** seeded idempotently on startup.
- **Verification runs, review state, snapshots, audit history, imports, and ResourceCite site-copy revisions** persist server-side.
- **Browser localStorage** remains for private visitor-side saved resources, notes, collections, comparison state, contact history, weekly goals, recent views, ratings, and similar workspace state.
- **PostgreSQL/Supabase remains optional** through the preserved alternate schema/migrations.

ResourceCite always opens first on a fresh application load. The default visitor theme is light; the existing cool-blue dark theme remains selectable.

## Railway minimum setup

Attach a Volume at `/data`, then set:

```text
ADMIN_EMAIL=you@example.com
ADMIN_PASSWORD=a-long-private-password
```

Deploy. Railway provides the public domain and volume path at runtime. The application prepares the database without destructive reset, preserves canonical resource data, and exposes `/api/health` for deployment readiness.

See `RAILWAY_DEPLOY.md` for the exact lifecycle and optional PostgreSQL/Supabase mode.

## Commands

```bash
npm run dev
npm run build
npm run start
npm run test:contracts
npm run test:ingestion
npm run verify:package
npm run verify:dataset
npm run verify:imports
npm run verify:syntax
npm run verify:release
```

## Resource verification

The bundled verifier-v4 pipeline is the evidence authority for candidate expansion. Canonical rows are protected; uncertain, conflicting, ambiguous, or offline-only candidates remain held/unpublished until evidence supports publication. Public presentation omits raw machine metadata while provenance, verification evidence, tags, and audit history remain available internally.
