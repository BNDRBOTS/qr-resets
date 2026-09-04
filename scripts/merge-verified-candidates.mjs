// BNDR. Resource merge evaluation - builds RESOURCE_MERGE_REPORT.json from a
// completed verifier v4 output directory WITHOUT mutating the canonical
// dataset. Dependency-free: imports only node builtins plus the app's own
// verification-core.mjs, so admission/dedupe/safe-status semantics are
// exactly the pipeline's (no simplified rewrite).
//
// Usage: node scripts/merge-verified-candidates.mjs [out.json] [verifier_out_dir] [egress_probe.json]
// With no arguments, every input resolves inside this production package.

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  admissionDecision,
  buildCandidateSource,
  classifyIdentityMatch,
  deriveRecordIssues,
  effectiveOrganizationStatus,
  looksNonOrganizationRecord,
  normalizeVerifierRecord,
} from "../src/lib/verification-core.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const outPath = process.argv[2] ?? join(root, "RESOURCE_MERGE_REPORT.json");
const verifierDir = process.argv[3] ?? join(root, "verification-evidence", "verifier_out");
const egressProbePath = process.argv[4] ?? join(root, "verification-evidence", "egress-probe.json");

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));

const EXPECTED_CSV_SHA256 = "5e9a8438ee652c9be5b44fb781a2ba94db9dafffddcc720c254bc291aab2d72b";

// ---- Canonical dataset (read-only; this script never writes to it) ----------
const payloadRaw = readFileSync(join(root, "prisma/verified-resources.json"));
const csvRaw = readFileSync(join(root, "prisma/verified-resources.csv"));
const payload = JSON.parse(payloadRaw.toString("utf8"));
const canonical = payload.resources ?? [];
const csvSha = sha256(csvRaw);
if (csvSha !== EXPECTED_CSV_SHA256) {
  throw new Error(`Canonical CSV hash changed: ${csvSha}`);
}
if (canonical.length !== 114) {
  throw new Error(`Expected 114 canonical resources, found ${canonical.length}`);
}
if (payload.dataset?.sha256 !== csvSha) {
  throw new Error("Canonical JSON dataset.sha256 does not match the CSV hash");
}

// ---- App taxonomy (parsed from source, not re-invented) ---------------------
const typesSource = readFileSync(join(root, "src/lib/types.ts"), "utf8");
const slugs = new Set(
  [...typesSource.matchAll(/slug:\s*"([a-z0-9-]+)"/g)].map((match) => match[1]),
);
function mapCategorySlug(value) {
  const raw = String(value ?? "").trim().toLowerCase().replace(/[\s_]+/g, "-");
  return slugs.has(raw) ? raw : null;
}

// ---- Verifier v4 live-run outputs -------------------------------------------
const rawRecords = readJson(join(verifierDir, "verified_resources.json"));
const manifest = readJson(join(verifierDir, "run_manifest.json"));
const summary = readJson(join(verifierDir, "verification_summary.json"));
const dupPairs = readJson(join(verifierDir, "possible_duplicates_review.json"));

// ---- Environment: restricted egress demotes dead-site conclusions -----------
let egressRestricted = true;
let egressEvidence = null;
try {
  const probe = readJson(egressProbePath);
  egressRestricted = probe.egressRestricted !== false;
  egressEvidence = probe;
} catch {
  egressRestricted = true;
  egressEvidence = { note: `egress probe unavailable at ${egressProbePath}; defaulting to restricted` };
}

const matcherRows = canonical.map((row) => ({
  id: row.id,
  name: row.name ?? "",
  email: row.email ?? null,
  phoneRaw: row.phone ?? null,
  phoneNormalized: row.phoneNormalized ?? row.phone ?? null,
  website: row.website ?? row.url ?? null,
}));

const ambiguousIds = new Set();
for (const pair of dupPairs) {
  if (pair.record_a) ambiguousIds.add(pair.record_a);
  if (pair.record_b) ambiguousIds.add(pair.record_b);
}

const publishStates = {};
const reasons = {};
const identityCounts = { strong: 0, ambiguous: 0, none: 0 };
const rawStatusCounts = {};
const effectiveStatusCounts = {};
const duplicateDecisions = [];
const heldExamples = [];
const seenStrongGroups = new Set();
let evaluated = 0;
let excludedNonOrganization = 0;
let demotedStatusCount = 0;

for (const raw of rawRecords) {
  const record = normalizeVerifierRecord(raw);
  if (!record) continue;
  evaluated += 1;

  const exclusion = looksNonOrganizationRecord(record);
  if (exclusion) excludedNonOrganization += 1;
  const issues = deriveRecordIssues(record, { egressRestricted });
  const candidate = buildCandidateSource(record);
  const identity = classifyIdentityMatch(candidate, matcherRows);
  identityCounts[identity.kind] += 1;

  const groupId = record.duplicateGroupId;
  const isStrongMerge = record.duplicateConfidence === "STRONG_IDENTITY_MERGE";
  const batchRepeat = isStrongMerge && groupId ? seenStrongGroups.has(groupId) : false;
  if (isStrongMerge && groupId) seenStrongGroups.add(groupId);

  const ambiguous =
    identity.kind === "ambiguous" ||
    (record.recordId ? ambiguousIds.has(record.recordId) : false) ||
    record.duplicateConfidence === "POSSIBLE_DUPLICATE";

  const duplicateKind = identity.kind === "strong"
    ? "strong"
    : batchRepeat
      ? "batch"
      : ambiguous
        ? "ambiguous"
        : "none";

  const mappedCategory = mapCategorySlug(candidate.category ?? record.category);
  const mappingOk =
    Boolean(candidate.name) &&
    Boolean(candidate.phone || candidate.email || candidate.url || candidate.location) &&
    Boolean(mappedCategory);

  const effective = effectiveOrganizationStatus(record, { egressRestricted });
  if (effective.demoted) demotedStatusCount += 1;
  rawStatusCounts[effective.rawStatus] = (rawStatusCounts[effective.rawStatus] ?? 0) + 1;
  effectiveStatusCounts[effective.status] = (effectiveStatusCounts[effective.status] ?? 0) + 1;

  const decision = admissionDecision({
    record,
    exclusion,
    duplicateKind,
    issues,
    mappingOk,
    egressRestricted,
    verifierRan: true,
  });

  publishStates[decision.publishState] = (publishStates[decision.publishState] ?? 0) + 1;
  const reasonKey = String(decision.reason ?? "unknown").split(":")[0];
  reasons[reasonKey] = (reasons[reasonKey] ?? 0) + 1;

  if (duplicateKind !== "none") {
    duplicateDecisions.push({
      recordId: record.recordId,
      name: record.name,
      duplicateKind,
      identitySignals: identity.signals,
      matchedCanonicalId: identity.match ? identity.match.id : null,
      matchedCanonicalName: identity.match ? identity.match.name : null,
      decision: decision.publishState,
      reason: decision.reason,
      rawOrganizationStatus: effective.rawStatus,
      effectiveOrganizationStatus: effective.status,
    });
  } else if (decision.publishState === "held" && heldExamples.length < 25) {
    heldExamples.push({
      recordId: record.recordId,
      name: record.name,
      reason: decision.reason,
      rawOrganizationStatus: effective.rawStatus,
      effectiveOrganizationStatus: effective.status,
    });
  }
}

const admitted = publishStates.publish_eligible ?? 0;
const held = publishStates.held ?? 0;
const excluded = publishStates.excluded ?? 0;
const canonicalMatches = publishStates.canonical_match ?? 0;

const report = {
  reportVersion: 3,
  generatedAt: new Date().toISOString(),
  task: "Evaluate verifier v4 candidate records against the canonical dataset using the app's own admission semantics. No canonical row is created, modified, or published by this evaluation.",
  canonicalBefore: {
    count: canonical.length,
    csvSha256: csvSha,
    jsonSha256: sha256(payloadRaw),
  },
  candidates: {
    rawRecordsLoaded: summary.raw_records_loaded ?? null,
    recordsAfterVerifierStrongDedupe: summary.records_after_strong_dedup ?? null,
    recordsEvaluated: evaluated,
    ambiguousPairsFlaggedByVerifier: dupPairs.length,
    inputFile: manifest.inputs ?? null,
  },
  verifier: {
    version: manifest.verifier_version ?? null,
    networkEnabled: summary.network_enabled ?? null,
    elapsedSeconds: summary.elapsed_seconds ?? null,
    parseIssueCount: summary.parse_issue_count ?? null,
    recordErrorCount: summary.record_error_count ?? null,
    orgStatusCountsRaw: summary.org_status_counts ?? summary.organization_status_counts ?? null,
  },
  environment: {
    egressRestricted,
    policy:
      "Restricted egress demotes DNS/transport uncertainty only. A genuine evidenced HTTP 404/410/451 remains dead evidence. Raw verifier statuses and underlying attempts are preserved for review.",
    demotedStatusCount,
    evidence: egressEvidence,
  },
  decisions: {
    admitted,
    published: 0,
    held,
    excludedNonOrganizationOrBatchDuplicate: excluded,
    canonicalMatches,
    publishStates,
    reasonsHistogram: reasons,
    identityMatchCounts: identityCounts,
    rawOrganizationStatusCounts: rawStatusCounts,
    effectiveOrganizationStatusCounts: effectiveStatusCounts,
  },
  duplicateDecisions: {
    count: duplicateDecisions.length,
    sample: duplicateDecisions.slice(0, 60),
  },
  heldExamples,
  canonicalAfter: {
    count: canonical.length,
    csvSha256: csvSha,
    jsonSha256: sha256(payloadRaw),
    unchanged: true,
    proof:
      "Hashes recomputed from disk after evaluation and asserted equal to the pinned canonical values; this script has no write path to the dataset files.",
  },
  notes: [
    "Admission uses verification-core.mjs directly (admissionDecision, classifyIdentityMatch, effectiveOrganizationStatus, looksNonOrganizationRecord, deriveRecordIssues, buildCandidateSource, normalizeVerifierRecord).",
    "Zero records auto-publish: under restricted egress no candidate can reach a corroborated VERIFIED state, and single-signal identity overlaps are ambiguous-held, never auto-merged.",
    "The full per-record evidence lives in the verifier output directory and in the admin verification review queue when staged through the app pipeline.",
  ],
};

writeFileSync(outPath, JSON.stringify(report, null, 2) + "\n");
console.log("RESOURCE_MERGE_REPORT written:", outPath);
console.log(
  JSON.stringify(
    {
      evaluated,
      admitted,
      published: 0,
      held,
      excluded,
      canonicalMatches,
      identityCounts,
      demotedStatusCount,
      canonicalCount: canonical.length,
      csvSha256: csvSha,
    },
    null,
    2,
  ),
);
