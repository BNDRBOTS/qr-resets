# Railway deploy — BNDR LLC ResourceCite + QR Resets

## Default architecture

No external database is required.

- App/API: this Next.js service on Railway.
- Persistent admin/server data: SQLite file `bndr.db` on a Railway Volume.
- Canonical directory seed: packaged 114-resource dataset, idempotently upserted at service start.
- ResourceCite verification/review, snapshots, site-copy revisions, pending records, and audit data: same SQLite database.
- Public user saved resources, notes, collections, comparison state, contact log, and similar advocate state: browser `localStorage`; never required on the server.
- PostgreSQL/Supabase: preserved as an optional explicit backend, not a launch dependency.

## Railway setup required

1. Deploy the repository/service.
2. Attach one Railway Volume to this service and mount it at `/data` (recommended).
3. Add two sealed service variables:
   - `ADMIN_EMAIL`
   - `ADMIN_PASSWORD` (12+ characters) OR `ADMIN_PASSWORD_HASH` (bcrypt)
4. Generate/attach a public Railway domain.
5. Deploy.

Do NOT set `DATABASE_URL` for the default SQLite mode.
Do NOT add `NEXTAUTH_SECRET`, `RATE_LIMIT_PEPPER`, or `NEXTAUTH_URL` unless you want to override defaults. At runtime the app persists generated auth/rate-limit secrets on the volume and derives `NEXTAUTH_URL` from `RAILWAY_PUBLIC_DOMAIN`.

## What the start command does

`npm run start` executes `scripts/start-production.mjs` before launching Next:

1. Resolves `STORAGE_BACKEND` (`sqlite` by default).
2. Refuses Railway production SQLite if no persistent volume is attached.
3. Sets `DATABASE_URL=file:///<absolute-volume-path>/bndr.db`.
4. Creates/updates the SQLite schema with Prisma `db push` without `--accept-data-loss`; destructive schema changes therefore fail instead of being silently accepted.
5. Idempotently seeds/upserts the canonical 114 resource rows without deleting admin-created data.
6. Persists auth/rate-limit secrets on the volume when not explicitly supplied.
7. Starts `.next/standalone/server.js` on `0.0.0.0:$PORT`.
8. Railway health-checks `/api/health`.

`/api/health` returns HTTP 200 when the DB is reachable, all 114 canonical resources are present, and Railway persistence is durable. Admin credential configuration is reported in the JSON diagnostics but does not block public deployment health; admin sign-in remains unavailable until credentials are configured.

## Optional PostgreSQL / Supabase

To deliberately switch backends later:

- `STORAGE_BACKEND=postgres`
- `DATABASE_URL=postgresql://...`

The preserved PostgreSQL Prisma schema/migrations live under `prisma/postgres/`; the Supabase SQL baseline remains under `supabase/schema.sql`.

## QR Resets prototype boundary

QR Resets is non-operational in this release. Request persistence, donation/payment activation, donation webhooks, case funding, and QR mutation workflows are hard-disabled. Do not configure payment variables as a way to bypass this release boundary.
