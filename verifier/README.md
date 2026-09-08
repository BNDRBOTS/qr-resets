# Bundled Resource Verifier v4 (canonical semantics)

This directory contains the canonical batch resource verifier
(`resource_verifier_core.py`, VERSION 4.0.0) exactly as supplied in the
authoritative handoff package. It is NOT a TypeScript port. The application
invokes this verifier as an external process so that no fallback or evidence
semantics are lost.

- The app-side integration lives in `src/lib/verifier-v4.ts` (process
  invocation), `src/lib/verification-pipeline.ts` (staging + persistence), and
  `src/lib/verification-worker.ts` (durable queue worker).
- The worker writes verifier inputs/outputs under the runtime data directory
  (`BNDR_DATA_DIR`), never inside the repository tree.
- Python 3.10+ is required on the host for live verification. When Python or
  the verifier is unavailable, staged candidates remain in
  `PENDING_VERIFICATION` with a critical `VERIFIER_UNAVAILABLE` issue; the
  queue retries with backoff. Records are never fabricated as verified.
- Optional dependencies (`phonenumbers`, `dnspython`, `certifi`, `openpyxl`)
  improve corroboration quality; the verifier has documented stdlib fallbacks
  and records dependency availability in `run_manifest.json`.

Do not modify `resource_verifier_core.py` in place. Treat it as a vendored
artifact with provenance in `docs/MERGE_MANIFEST.json` and the handoff
package.
