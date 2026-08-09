# Source provenance — BNDR Resource Directory + QR Resets™ 1.1.4

## Production chassis

- Archive: `bndr-workspace-one-verified-114-railway-fixed(1).zip`
- SHA-256: `df1143eb7f1d9d2f474334b30c6cda8e37feed8f10c05d5bbf88de18de424e7b`
- Role: production Resource Directory chassis, admin/API layer, optional PostgreSQL/Supabase schema, Railway deployment contract, and canonical 114-row resource dataset.

## Dual-view / QR source

- Archive: `bndr-clean (2).zip`
- SHA-256: `f7dc3183507dba9a320c1db20a0831aa0159fd1c02d3a32c639829a54b54d7a2`
- Role: Resource Directory ↔ QR Resets™ switcher/router and complete QR Resets UI/content/calculator implementation.
- Preserved QR content module SHA-256: `d74917157f39676e1cb54f18460d5347b1d27d603e5e784b426d23d66f2bfa44`

## Canonical resource dataset

- Packaged file: `prisma/verified-resources.csv`
- SHA-256: `5e9a8438ee652c9be5b44fb781a2ba94db9dafffddcc720c254bc291aab2d72b`
- Parsed rows: 114
- Source verification flags: 103 `verified=true`, 11 `verified=false`
- Deployment representation: 114 `published=true`; source verification flags are not rewritten.

The original CSV is retained byte-for-byte. `prisma/verified-resources.json` is the validated deployment/import representation. Category-resolution and taxonomy provenance remain under `prisma/`.

## Supplied QR/mission material

The supplied QR/mission text inputs and canonical resource CSV are retained under `docs/source-inputs/` as source material. The merged app does not silently rewrite the pinned QR source-copy module while applying infrastructure, security, routing, persistence, and visual-shell repairs around it.

## 1.1.4 backend correction

The original PostgreSQL/Supabase work is preserved under `prisma/postgres/` and `supabase/`. The default production backend is now Railway-local SQLite on a persistent Volume, selected without requiring `DATABASE_URL`. This change preserves the existing server API/admin behavior while removing an unnecessary external-database launch dependency.
