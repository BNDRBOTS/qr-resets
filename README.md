# BNDR Resource Directory + QR Resets

One Next.js application with a persistent same-page switch between **Resource Directory** and **QR Resets™**.

## Launch architecture

The app now defaults to a self-contained Railway backend:

- **SQLite on a Railway persistent Volume** for server-owned data.
- **114 packaged verified resource rows** seeded idempotently on startup.
- **QR request/admin persistence** in the same backend.
- **Browser localStorage** for saved resources, notes, collections, comparison state, contact history, weekly goals, recent views, ratings, and similar private user-side state.
- **PostgreSQL/Supabase remains optional** and is not required to launch.

### Railway minimum setup

Attach a Volume at `/data`, then set:

```text
ADMIN_EMAIL=you@example.com
ADMIN_PASSWORD=a-long-private-password
```

Deploy. Railway provides the public domain and volume path at runtime. The app creates the SQLite database and stable runtime secrets on the volume, seeds the dataset, starts Next, and exposes `/api/health` as the deployment readiness check.

See `RAILWAY_DEPLOY.md` for the exact lifecycle and optional PostgreSQL/Supabase mode.

## Commands

```bash
npm run dev
npm run build
npm run start
npm run test:contracts
npm run verify:package
npm run verify:dataset
npm run verify:imports
npm run verify:syntax
npm run verify:release
```

## Payment rail

Payment is deliberately decoupled from core operation. Resource search, local user saves, request submission and admin processing work without Stripe. Real donation collection requires configured payment links and Stripe webhook secret; without those, the donation controls remain disabled.
