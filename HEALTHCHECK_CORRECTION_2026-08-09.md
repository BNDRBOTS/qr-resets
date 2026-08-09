# Railway healthcheck correction — 2026-08-09

Observed deployment: build completed successfully, Docker image exported/pushed, then Railway retried `/api/health` for the full 180-second window and never received HTTP 200.

Root code defect corrected here: `/api/health` treated missing `ADMIN_EMAIL` / `ADMIN_PASSWORD(_HASH)` as a service-health failure (HTTP 503). Railway healthchecks are deployment readiness checks for whether the service can serve traffic; admin bootstrap configuration is a feature configuration, not public-service liveness.

The corrected health contract still requires:
- database reachable;
- canonical 114-row dataset present;
- durable Railway persistence ready.

It still reports `admin: true|false`, but admin configuration no longer changes the HTTP status. Admin authentication remains closed when credentials are absent; this correction does not create default credentials or weaken the auth check.

The existing startup safety gate is preserved: Railway SQLite mode still refuses to start without an attached persistent Volume (`RAILWAY_VOLUME_MOUNT_PATH`). That requirement cannot be satisfied by repository code because the Volume is a Railway service resource.
