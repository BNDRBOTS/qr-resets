# Production QA — 1.1.4

## Corrected backend contract

The application no longer requires an undefined external PostgreSQL/Supabase database to become functional.

**Default production backend:** Railway Volume + SQLite.

This is sufficient for the current single-service/single-admin ResourceCite intent: resource updates, imports, verification/review state, audit history, pending records, snapshots, URL verification history, and controlled ResourceCite site-copy revisions have durable server-side persistence. Public visitor workspace state that is intentionally private remains in browser localStorage. QR Resets request/payment/case mutation remains disabled in this release.

PostgreSQL/Supabase support is preserved under `prisma/postgres/` and `supabase/`, but requires an explicit `STORAGE_BACKEND=postgres` choice.

## Deployment truth gate

On Railway, SQLite mode refuses to start without an attached persistent volume. This prevents an apparently healthy deployment that would silently lose admin changes on redeploy.

The health endpoint requires:

- database query succeeds;
- canonical dataset import record is present;
- exactly 114 canonical published rows are present;
- persistence is durable in Railway production;
- single-admin credential status is reported diagnostically but is not a Railway deployment-health prerequisite.

## Dependency-free gates executed in this artifact environment

- package contract: PASS
- canonical dataset: PASS — 114 rows, expected SHA-256
- internal import graph: PASS — 224 source files, 582 local import edges, 0 broken imports, 0 undeclared external roots
- TypeScript/TSX syntax parse: PASS — 224 files, 0 diagnostics
- contract/security/product tests: PASS — 124/124
- data-safety verification: PASS

## Environment-limited gates

This artifact environment could not complete a clean npm dependency install because registry DNS/network access failed. Dependency-required ingestion/typecheck/lint/build/start/browser gates remain BLOCKED here rather than being reported as PASS. QR Resets payments and request intake are intentionally disabled by release design, not missing configuration.
