# Production QA — 1.1.4

## Corrected backend contract

The application no longer requires an undefined external PostgreSQL/Supabase database to become functional.

**Default production backend:** Railway Volume + SQLite.

This is sufficient for the current single-service/single-admin intent: resource updates, imports, audit history, pending records, URL verification history, QR Reset request intake/review/case state, and donation webhook records all have durable server-side persistence. Public advocate/user state that is intentionally private remains in browser localStorage.

PostgreSQL/Supabase support is preserved under `prisma/postgres/` and `supabase/`, but requires an explicit `STORAGE_BACKEND=postgres` choice.

## Deployment truth gate

On Railway, SQLite mode refuses to start without an attached persistent volume. This prevents an apparently healthy deployment that would silently lose admin changes on redeploy.

The health endpoint requires:

- database query succeeds;
- canonical dataset import record is present;
- exactly 114 canonical published rows are present;
- persistence is durable in Railway production;
- single-admin credentials are configured.

## Dependency-free gates executed in this artifact environment

- package contract: PASS
- canonical dataset: PASS — 114 rows, expected SHA-256
- internal import graph: PASS — 463 local import edges, 0 broken
- TypeScript/TSX syntax parse: PASS — 186 files, 0 diagnostics
- contract/security tests: PASS — 30/30
- storage backend resolver tests: PASS — SQLite default, `/data/bndr.db` resolution, Railway volume refusal gate

## Known external configuration dependency

Live donation collection still requires an actual payment provider configuration. The app cannot truthfully collect money without payment URLs/Stripe webhook configuration. This does not block the Resource Directory, local saved-state functions, QR request intake, or admin backend.
