import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import {
  admissionDecision,
  buildCandidateSource,
  deriveRecordIssues,
  looksNonOrganizationRecord,
  normalizeVerifierRecord,
  pickBestWebsite,
  PUBLISH_STATES,
} from "../src/lib/verification-core.mjs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const exists = (path) => existsSync(new URL(`../${path}`, import.meta.url));

const NO_EXCLUSION = { excluded: false, reasons: [] };

function deadDnsRecord() {
  return normalizeVerifierRecord({
    record_id: "rec_dead",
    name: "Patient Advocate Foundation",
    organization_status: "WEBSITE_DEAD_CONFIRMED",
    urls: [
      {
        requested_url: "https://www.patientadvocate.org",
        website_status: "DEAD_CONFIRMED_DNS",
        status_reason: "gaierror: [Errno -2] Name or service not known",
        dns_status: "ALL_HOST_VARIANTS_DNS_FAILURE",
      },
    ],
    phones: [],
    emails: [],
  });
}

function cleanVerifiedRecord() {
  return normalizeVerifierRecord({
    record_id: "rec_clean",
    name: "Example Legal Aid Society",
    organization_status: "VERIFIED",
    urls: [
      {
        requested_url: "https://example-legal-aid.org",
        canonical_url: "https://www.example-legal-aid.org",
        website_status: "VERIFIED_REACHABLE",
        name_similarity: 0.92,
      },
    ],
    phones: [{ value: "+1-555-0100", status: "CORROBORATED", format_status: "PLAUSIBLE_NANP" }],
    emails: [{ value: "help@example-legal-aid.org", status: "DOMAIN_RESOLVES", format_status: "VALID_SYNTAX" }],
    description: "Free legal aid for protective parents.",
  });
}

// ---- Adapter contract: network_failure_is_dead = false ----------------------

test("DNS-based death in a restricted environment demotes to an environment-caveated warning", () => {
  const issues = deriveRecordIssues(deadDnsRecord(), { egressRestricted: true });
  const codes = issues.map((issue) => issue.code);
  assert.ok(codes.includes("UNREACHABLE_IN_RESTRICTED_ENVIRONMENT"));
  assert.ok(!codes.includes("WEBSITE_DEAD_REPORTED"));
  const issue = issues.find((item) => item.code === "UNREACHABLE_IN_RESTRICTED_ENVIRONMENT");
  assert.equal(issue.severity, "warning");
  assert.match(issue.evidence.environment, /not evidence the site is dead/);
});

test("DNS-based death with open egress stays a reviewable critical issue, never an auto-exclusion", () => {
  const record = deadDnsRecord();
  const issues = deriveRecordIssues(record, { egressRestricted: false });
  const dead = issues.find((item) => item.code === "WEBSITE_DEAD_REPORTED");
  assert.ok(dead);
  assert.equal(dead.severity, "critical");
  const decision = admissionDecision({
    record,
    exclusion: NO_EXCLUSION,
    duplicateKind: "none",
    issues,
    mappingOk: true,
    egressRestricted: false,
    verifierRan: true,
  });
  assert.equal(decision.publishState, "held");
  assert.match(decision.reason, /^organization_status_website_dead_confirmed/);
});

// ---- Adapter contract: reachable_page_is_identity_proof = false --------------

test("a reachable page with weak name similarity produces IDENTITY_UNCONFIRMED", () => {
  const record = normalizeVerifierRecord({
    record_id: "rec_weak",
    name: "Some Advocacy Org",
    organization_status: "PARTIALLY_VERIFIED",
    urls: [
      {
        requested_url: "https://unrelated-site.example",
        website_status: "VERIFIED_REACHABLE",
        name_similarity: 0.1,
      },
    ],
  });
  const issues = deriveRecordIssues(record, { egressRestricted: false });
  const identity = issues.find((item) => item.code === "IDENTITY_UNCONFIRMED");
  assert.ok(identity);
  assert.equal(identity.severity, "warning");
});

// ---- Admission policy: auto_publish = false, held-by-default ----------------

test("clean VERIFIED record becomes publish_eligible (never auto-published)", () => {
  const record = cleanVerifiedRecord();
  const issues = deriveRecordIssues(record, { egressRestricted: false });
  const decision = admissionDecision({
    record,
    exclusion: NO_EXCLUSION,
    duplicateKind: "none",
    issues,
    mappingOk: true,
    egressRestricted: false,
    verifierRan: true,
  });
  assert.deepEqual(decision, { publishState: "publish_eligible", reason: "verified_clean" });
  assert.ok(PUBLISH_STATES.includes("publish_eligible"));
});

test("restricted egress blocks publish-eligibility even for VERIFIED records", () => {
  const record = cleanVerifiedRecord();
  const decision = admissionDecision({
    record,
    exclusion: NO_EXCLUSION,
    duplicateKind: "none",
    issues: [],
    mappingOk: true,
    egressRestricted: true,
    verifierRan: true,
  });
  assert.equal(decision.publishState, "held");
  assert.equal(decision.reason, "restricted_network_environment_cannot_corroborate");
});

test("dedupe classification: strong -> canonical_match, ambiguous -> held, batch -> excluded", () => {
  const record = cleanVerifiedRecord();
  const base = {
    record,
    exclusion: NO_EXCLUSION,
    issues: [],
    mappingOk: true,
    egressRestricted: false,
    verifierRan: true,
  };
  assert.equal(
    admissionDecision({ ...base, duplicateKind: "strong" }).publishState,
    "canonical_match",
  );
  assert.equal(admissionDecision({ ...base, duplicateKind: "ambiguous" }).publishState, "held");
  assert.equal(admissionDecision({ ...base, duplicateKind: "batch" }).publishState, "excluded");
});

test("critical issues, mapping failures, and missing verifier runs all hold the record", () => {
  const record = cleanVerifiedRecord();
  const base = {
    record,
    exclusion: NO_EXCLUSION,
    duplicateKind: "none",
    mappingOk: true,
    egressRestricted: false,
    verifierRan: true,
  };
  const critical = admissionDecision({
    ...base,
    issues: [{ field: "phone", code: "IMPLAUSIBLE_PHONE", severity: "critical", currentValue: null, suggestedValue: null, evidence: null }],
  });
  assert.equal(critical.publishState, "held");
  assert.match(critical.reason, /^critical_issues:IMPLAUSIBLE_PHONE/);
  assert.equal(
    admissionDecision({ ...base, issues: [], mappingOk: false }).publishState,
    "held",
  );
  assert.equal(
    admissionDecision({ ...base, issues: [], verifierRan: false }).reason,
    "verifier_did_not_run",
  );
});

test("non-VERIFIED statuses are held with the status embedded in the reason", () => {
  const record = normalizeVerifierRecord({
    record_id: "rec_insufficient",
    name: "Sparse Record",
    organization_status: "INSUFFICIENT_SOURCE_DATA",
  });
  const decision = admissionDecision({
    record,
    exclusion: NO_EXCLUSION,
    duplicateKind: "none",
    issues: [],
    mappingOk: true,
    egressRestricted: false,
    verifierRan: true,
  });
  assert.equal(decision.publishState, "held");
  assert.equal(decision.reason, "organization_status_insufficient_source_data");
});

// ---- Non-organization narrative/personal record exclusion -------------------

test("personal prose names are excluded even with contact evidence", () => {
  const record = normalizeVerifierRecord({
    record_id: "rec_personal",
    name: "Notes about my son and my case hearing next week",
    organization_status: "UNVERIFIED_CONTACT_ONLY",
    phones: [{ value: "+1-555-0000" }],
  });
  const exclusion = looksNonOrganizationRecord(record);
  assert.equal(exclusion.excluded, true);
  assert.ok(exclusion.reasons.includes("personal_prose_name"));
  const decision = admissionDecision({
    record,
    exclusion,
    duplicateKind: "none",
    issues: [],
    mappingOk: true,
    egressRestricted: false,
    verifierRan: true,
  });
  assert.equal(decision.publishState, "excluded");
  assert.match(decision.reason, /^non_organization_record:/);
});

test("instructional no-contact prose is excluded; real organizations are not", () => {
  const instructional = normalizeVerifierRecord({
    record_id: "rec_instr",
    name: "How to ask for records: be sure to write down every clerk name you speak to",
    organization_status: "INSUFFICIENT_SOURCE_DATA",
  });
  assert.equal(looksNonOrganizationRecord(instructional).excluded, true);
  const org = cleanVerifiedRecord();
  assert.equal(looksNonOrganizationRecord(org).excluded, false);
});

// ---- Candidate mapping -------------------------------------------------------

test("buildCandidateSource prefers suggested name and the best canonical URL", () => {
  const record = normalizeVerifierRecord({
    record_id: "rec_map",
    name: "legalaid.example.org Example Legal Aid",
    suggested_name: "Example Legal Aid",
    category: "Legal Aid",
    organization_status: "VERIFIED",
    urls: [
      { requested_url: "https://dead.example", website_status: "DEAD_CONFIRMED_DNS" },
      {
        requested_url: "https://example-legal-aid.org",
        canonical_url: "https://www.example-legal-aid.org",
        website_status: "VERIFIED_REACHABLE",
      },
    ],
    phones: [{ value: "+1-555-0100" }, { value: "+1-555-0101" }],
    emails: [{ value: "a@example.org" }, { value: "b@example.org" }],
    addresses: [{ value: "100 Main St, Phoenix, AZ" }],
    description: "desc",
    source_document: "master extract",
  });
  assert.equal(pickBestWebsite(record), "https://www.example-legal-aid.org");
  const source = buildCandidateSource(record);
  assert.equal(source.name, "Example Legal Aid");
  assert.equal(source.url, "https://www.example-legal-aid.org");
  assert.equal(source.phone, "+1-555-0100 | +1-555-0101");
  assert.equal(source.email, "a@example.org");
  assert.equal(source.location, "100 Main St, Phoenix, AZ");
});

test("normalizeVerifierRecord rejects non-records and keeps integer source indexes", () => {
  assert.equal(normalizeVerifierRecord(null), null);
  assert.equal(normalizeVerifierRecord("text"), null);
  assert.equal(normalizeVerifierRecord({ description: "no identity" }), null);
  const record = normalizeVerifierRecord({
    record_id: "rec_idx",
    name: "Org",
    source_indexes: [21, 288, "x", 1.5],
  });
  assert.deepEqual(record.sourceIndexes, [21, 288]);
});

// ---- Durable pipeline structure ----------------------------------------------

test("schema persists a durable verification queue (claims, heartbeats, retries, per-record rows)", () => {
  for (const schemaPath of ["prisma/schema.prisma", "prisma/postgres/schema.prisma", "prisma/sqlite/schema.prisma"]) {
    const schema = read(schemaPath);
    assert.match(schema, /model VerificationRun/, schemaPath);
    assert.match(schema, /claimedBy\s+String\?/, schemaPath);
    assert.match(schema, /heartbeatAt\s+DateTime\?/, schemaPath);
    assert.match(schema, /nextAttemptAt\s+DateTime\?/, schemaPath);
    assert.match(schema, /model VerificationResult/, schemaPath);
    assert.match(schema, /@@unique\(\[runId, recordId\]\)/, schemaPath);
    assert.match(schema, /model VerificationIssue/, schemaPath);
  }
});

test("worker claims runs atomically, heartbeats, and reclaims stale processing runs", () => {
  const worker = read("src/lib/verification-worker.ts");
  assert.match(worker, /updateMany/);
  assert.match(worker, /status: candidate\.status, attempts: candidate\.attempts/);
  assert.match(worker, /attempts: \{ increment: 1 \}/);
  assert.match(worker, /STALE_CLAIM_MS/);
  assert.match(worker, /heartbeatAt: \{ lt: staleBefore \}/);
  assert.match(worker, /nextAttemptAt/);
  const instrumentation = read("src/instrumentation.ts");
  assert.match(instrumentation, /NEXT_RUNTIME === "nodejs"/);
  assert.match(instrumentation, /startVerificationWorker/);
});

test("pipeline stages durable runs, persists per-record checkpoints, and never fabricates VERIFIED", () => {
  const pipeline = read("src/lib/verification-pipeline.ts");
  assert.match(pipeline, /stageVerificationRun/);
  assert.match(pipeline, /processVerificationRun/);
  assert.match(pipeline, /onCheckpoint/);
  assert.match(pipeline, /persistExternalVerifierRun/);
  assert.doesNotMatch(pipeline, /organizationStatus:\s*"VERIFIED"/);
  const bridge = read("src/lib/verifier-v4.ts");
  assert.match(bridge, /checkpoint_partial\.json/);
  assert.match(bridge, /probeEgress/);
  assert.match(bridge, /--no-network/);
});

test("bundled verifier v4 ships with the app and keeps canonical semantics external", () => {
  assert.ok(exists("verifier/resource_verifier_core.py"));
  const verifier = read("verifier/resource_verifier_core.py");
  assert.match(verifier, /VERSION = "4\.0\.0"/);
  assert.ok(exists("verifier/README.md"));
});

// ---- Route wiring --------------------------------------------------------------

test("append imports stage the automatic pipeline instead of writing canonical rows", () => {
  const route = read("src/app/api/admin/resources/import/route.ts");
  assert.match(route, /stageVerificationRun/);
  assert.match(route, /origin: "bulk-import"/);
  assert.match(route, /staged: prepared\.length/);
  assert.match(route, /mode === "replace" \? \(await tx\.resource\.deleteMany\(\)\)\.count : 0/);
});

test("new resources are automatically queued for verification", () => {
  const route = read("src/app/api/admin/resources/route.ts");
  assert.match(route, /verifyExistingResources/);
  assert.match(route, /origin: "resource-created"/);
});

test("all verification admin routes are authenticated and rate limited", () => {
  const routes = [
    "src/app/api/admin/verification/runs/route.ts",
    "src/app/api/admin/verification/results/route.ts",
    "src/app/api/admin/verification/results/[id]/route.ts",
    "src/app/api/admin/verification/results/[id]/publish/route.ts",
    "src/app/api/admin/verification/issues/[id]/route.ts",
    "src/app/api/admin/verification/import/route.ts",
    "src/app/api/admin/verification/verify/route.ts",
  ];
  for (const path of routes) {
    const route = read(path);
    assert.match(route, /requireAdminRateLimited/, path);
  }
});

test("publication gate blocks unresolved critical issues and never silently overwrites", () => {
  const route = read("src/app/api/admin/verification/results/[id]/publish/route.ts");
  assert.match(route, /UNRESOLVED_CRITICAL_ISSUES/);
  assert.match(route, /publish_eligible/);
  assert.match(route, /reviewState === "reviewed"/);
  assert.match(route, /DUPLICATE_/);
  assert.match(route, /createResourceRecord/);
});

test("artifact upload is recovery/interchange only, not the primary workflow", () => {
  const route = read("src/app/api/admin/verification/import/route.ts");
  assert.match(route, /NOT the primary verification workflow/);
  assert.match(route, /recovery/i);
  const ui = read("src/components/bndr/admin-verification.tsx");
  assert.match(ui, /not the normal path/);
  assert.match(ui, /never need to export data or upload verifier files/);
});

test("admin dashboard exposes the Verification tab", () => {
  const dashboard = read("src/components/bndr/admin-dashboard.tsx");
  assert.match(dashboard, /value="verification"/);
  assert.match(dashboard, /<AdminVerification \/>/);
});
