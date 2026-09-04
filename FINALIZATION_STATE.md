# Finalization state

This derivative starts from the exact uploaded `qr-resets-3-repaired-candidate.zip`.

Changes intentionally applied before the Fable handoff:

- global QueryProvider placement from the verified v4 improvement
- QR request UI converted to local prototype-only interaction
- QR request API hard-disabled with zero database mutation
- QR donation CTAs hard-disabled regardless of environment variables
- QR donation webhook hard-disabled with zero database mutation
- operational QR Requests admin tab removed; admin QR mutation route disabled
- explicit prototype disclosures added at request, donation, and footer points
- explicit return-to-Directory controls added/standardized for admin login, 404, and global error
- metadata no longer describes QR request intake as active
- global default theme changed to the existing cool-blue dark palette; the existing #FF355E light/red palette remains selectable
- QR mobile header now exposes the same theme toggle directly beside the site switcher
- dependency-free regression tests added for these boundaries

Historical release documents inside this repository describe earlier operational QR request/donation plumbing. Treat those statements as historical implementation provenance, not the release requirement for this derivative.

The remaining work for Fable is specified outside this project in the handoff bundle, especially resource-verifier integration, mobile/browser validation, theme/default visual confirmation, and clean-environment build/runtime gates.
