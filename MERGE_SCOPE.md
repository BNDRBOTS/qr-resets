# Merge scope — 1.1.4

## Controlling sources

- Production chassis: `bndr-workspace-one-verified-114-railway-fixed(1).zip`
- QR / dual-view source: `bndr-clean (2).zip`
- Canonical dataset: 114-row `verified-resources.csv`

## Preserved from the production chassis

- Resource Directory public UI and user workflows
- server-gated NextAuth admin console
- PostgreSQL/Supabase schema and migration path (preserved as optional backend)
- canonical resource dataset, taxonomy and provenance
- resource/admin API surface
- URL verification, audit, export and outreach functions
- Railway deployment lifecycle and DB-backed health contract

## Merged from the QR source

- Resource Directory ↔ QR Resets™ in-place switcher/router
- full QR Resets page/component layer
- pinned QR source-copy module
- Phoenix participation calculator
- QR navigation and supporting shared components

## Corrective production work in 1.1.4

- literal sand-bone `#F3EDE6` default surface + black `#111111` text/controls
- cool-blue circular hero halos; equal `70vmin × 70vmin` geometry, never oblong
- black local BNDR logo derivative for light mode, preserving source aspect ratio; top-left in both views
- explicit mobile switcher labels
- removed build-time Google-font network dependency
- real QR request persistence and admin review
- same-origin mutation protection for browser state changes
- server-side admin authorization and real actor identity
- bounded inputs and rate limits
- signed/idempotent donation webhook persistence
- SSRF-safe URL verification with resolved-address pinning and redirect revalidation
- escaped print HTML and formula-safe CSV exports
- truthful public/private pending-register boundary
- additive deploy seed and canonical dataset health gate
- Supabase RLS/revocation schema parity with ordered Prisma migrations
- Railway Railpack build/start/health configuration
- Railway-local SQLite backend on a persistent Volume as the default launch path
- browser localStorage preserved for private user-side saved state
- runtime auth/rate-limit secrets persisted on the Railway Volume when not explicitly configured

No production-base file is silently dropped. `MERGE_MANIFEST.json` records the current path/hash comparison against the production chassis.
