// BNDR. Data-safety contract tests.
// Pins: (1) restricted-egress DNS/transport failures can never surface as
// confirmed-dead, while genuine evidenced HTTP 404/410/451 verdicts survive,
// (2) corroborated identity matching (shared host/phone/email ALONE never
// auto-merges; multiple plausible canonical matches are ambiguous, never
// first-match), (3) append is the admin default and replace is dry-runnable
// and snapshot-protected, (4) durable snapshots persist a canonical dataset
// hash and restores prove exact count+hash recovery, (5) database-side
// pagination with the full weighted search semantics preserved, (6) PII
// cleanup is dry-runnable and snapshot-protected, (7) the merge evaluation
// script is self-contained in the package.

import { strict as assert } from "node:assert";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  RESTRICTED_EGRESS_SAFE_STATUS,
  admissionDecision,
  canonicalResourceRowForHash,
  classifyIdentityMatch,
  computeResourceDatasetHash,
  deadEvidenceKind,
  effectiveOrganizationStatus,
} from "../src/lib/verification-core.mjs";

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), "utf8");

const deadRecord = {
  recordId: "m_dead",
  name: "Example Org",
  organizationStatus: "WEBSITE_DEAD_CONFIRMED",
  errors: [],
};

test("restricted egress demotes confirmed-dead to a safe effective status and preserves the raw status", () => {
  const demoted = effectiveOrganizationStatus(deadRecord, { egressRestricted: true });
  assert.equal(demoted.status, RESTRICTED_EGRESS_SAFE_STATUS);
  assert.equal(demoted.demoted, true);
  assert.equal(demoted.rawStatus, "WEBSITE_DEAD_CONFIRMED");
  assert.match(demoted.note, /not evidence the site is dead/i);

  const trusted = effectiveOrganizationStatus(deadRecord, { egressRestricted: false });
  assert.equal(trusted.status, "WEBSITE_DEAD_CONFIRMED");
  assert.equal(trusted.demoted, false);

  const verified = effectiveOrganizationStatus(
    { ...deadRecord, organizationStatus: "VERIFIED" },
    { egressRestricted: true },
  );
  assert.equal(verified.status, "VERIFIED");
  assert.equal(verified.demoted, false);
});

const deadWithHttpEvidence = {
  recordId: "m_dead_http",
  name: "Gone Org",
  organizationStatus: "WEBSITE_DEAD_CONFIRMED",
  urls: [
    {
      requested_url: "https://gone.example.org/",
      website_status: "PAGE_MISSING_OR_MOVED",
      attempts: [{ outcome: "HTTP_RESPONSE", status: 404 }],
    },
  ],
  errors: [],
};

test("genuine evidenced HTTP 404/410/451 dead verdicts survive restricted egress; only DNS/transport uncertainty demotes", () => {
  assert.equal(deadEvidenceKind(deadWithHttpEvidence), "http_response");
  assert.equal(deadEvidenceKind(deadRecord), "dns_transport");

  const kept = effectiveOrganizationStatus(deadWithHttpEvidence, { egressRestricted: true });
  assert.equal(kept.status, "WEBSITE_DEAD_CONFIRMED");
  assert.equal(kept.demoted, false);
  assert.match(kept.note, /authentic HTTP 404\/410\/451/);

  // DNS-only failure under the same restriction still demotes.
  const dnsOnly = {
    ...deadRecord,
    urls: [
      {
        requested_url: "https://gone.example.org/",
        website_status: "DEAD_CONFIRMED_DNS",
        dns_status: "ALL_HOST_VARIANTS_DNS_FAILURE",
        attempts: [{ outcome: "TRANSPORT_ERROR", status: null, error_type: "gaierror" }],
      },
    ],
  };
  const demoted = effectiveOrganizationStatus(dnsOnly, { egressRestricted: true });
  assert.equal(demoted.status, RESTRICTED_EGRESS_SAFE_STATUS);
  assert.equal(demoted.demoted, true);
});

test("admission decisions never carry a confirmed-dead reason from a restricted-egress run", () => {
  const base = {
    record: deadRecord,
    exclusion: null,
    duplicateKind: "none",
    issues: [],
    mappingOk: true,
    verifierRan: true,
  };
  const restricted = admissionDecision({ ...base, egressRestricted: true });
  assert.equal(restricted.publishState, "held");
  assert.match(restricted.reason, /^organization_status_unreachable_in_restricted_environment/);

  const trusted = admissionDecision({ ...base, egressRestricted: false });
  assert.equal(trusted.publishState, "held");
  assert.match(trusted.reason, /^organization_status_website_dead_confirmed/);
});

const canonicalRows = [
  {
    id: "row-1",
    name: "Example Legal Aid",
    email: "help@example-legal.org",
    phoneRaw: null,
    phoneNormalized: "+16025550100",
    website: "https://www.example-legal.org",
  },
];

test("single-signal identity overlaps never auto-merge: they are ambiguous and held for review", () => {
  const hostOnly = classifyIdentityMatch(
    { name: "Totally Different Name", url: "http://example-legal.org/contact" },
    canonicalRows,
  );
  assert.equal(hostOnly.kind, "ambiguous");
  assert.equal(hostOnly.match, null);
  assert.ok(Array.isArray(hostOnly.matches) && hostOnly.matches.length === 1);

  const phoneOnly = classifyIdentityMatch(
    { name: "Another Org", phone: "(602) 555-0100" },
    canonicalRows,
  );
  assert.equal(phoneOnly.kind, "ambiguous");

  const emailOnly = classifyIdentityMatch(
    { name: "Another Org", email: "HELP@EXAMPLE-LEGAL.ORG" },
    canonicalRows,
  );
  assert.equal(emailOnly.kind, "ambiguous");

  const nameOnly = classifyIdentityMatch({ name: "example  legal aid" }, canonicalRows);
  assert.equal(nameOnly.kind, "ambiguous");
});

test("only name+contact corroboration is strong; shared contact channels alone stay ambiguous", () => {
  const nameAndPhone = classifyIdentityMatch(
    { name: "Example Legal Aid", phone: "602-555-0100" },
    canonicalRows,
  );
  assert.equal(nameAndPhone.kind, "strong");
  assert.equal(nameAndPhone.match.id, "row-1");
  assert.ok(Array.isArray(nameAndPhone.matches));

  // STRENGTHENED (previously auto-merged): email+host WITHOUT a name match is
  // exactly the umbrella-organization trap - one host and one intake mailbox
  // legitimately serving multiple distinct programs. It must go to review,
  // never auto-merge.
  const emailAndHost = classifyIdentityMatch(
    { name: "Renamed Org", email: "help@example-legal.org", url: "example-legal.org" },
    canonicalRows,
  );
  assert.equal(emailAndHost.kind, "ambiguous");
  assert.equal(emailAndHost.match, null);

  const disjoint = classifyIdentityMatch(
    { name: "Fresh Org", email: "team@fresh.org", url: "https://fresh.org" },
    canonicalRows,
  );
  assert.equal(disjoint.kind, "none");
  assert.deepEqual(disjoint.matches, []);

  const ignored = classifyIdentityMatch(
    { name: "Example Legal Aid", phone: "602-555-0100" },
    canonicalRows,
    "row-1",
  );
  assert.equal(ignored.kind, "none");
});

test("multiple plausible canonical matches are ambiguous for review, never first-match", () => {
  const twoPlausible = [
    canonicalRows[0],
    {
      id: "row-2",
      name: "Example Legal Aid",
      email: null,
      phoneRaw: null,
      phoneNormalized: null,
      website: "https://example-legal.org",
    },
  ];
  const multi = classifyIdentityMatch(
    { name: "Example Legal Aid", phone: "602 555 0100", url: "https://example-legal.org/x" },
    twoPlausible,
  );
  assert.equal(multi.kind, "ambiguous");
  assert.equal(multi.match, null);
  assert.equal(multi.matches.length, 2);
  assert.equal(multi.matches.filter((entry) => entry.corroborated).length, 2);
});

test("dataset hashing is deterministic, order-insensitive, and content-sensitive", () => {
  const rowA = {
    id: "a",
    name: "Alpha",
    priority: 1,
    verified: true,
    published: true,
    tags: "x",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    piipassAt: null,
  };
  const rowB = {
    id: "b",
    name: "Beta",
    priority: 0,
    verified: false,
    published: true,
    tags: "y",
    createdAt: "2026-01-03T00:00:00.000Z",
    updatedAt: "2026-01-04T00:00:00.000Z",
    piipassAt: null,
  };
  const h1 = computeResourceDatasetHash([rowA, rowB]);
  const h2 = computeResourceDatasetHash([rowB, rowA]);
  assert.equal(h1, h2, "row order must not change the dataset hash");

  // Prisma returns Date objects; snapshots store ISO strings. Both must hash
  // identically or restore proofs would false-negative.
  const dateAsString = {
    ...rowA,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
  };
  assert.equal(computeResourceDatasetHash([dateAsString, rowB]), h1);

  const mutated = { ...rowA, name: "Alpha 2" };
  assert.notEqual(computeResourceDatasetHash([mutated, rowB]), h1);
  assert.equal(canonicalResourceRowForHash(rowA).createdAt, "2026-01-01T00:00:00.000Z");
  assert.equal(computeResourceDatasetHash([]), computeResourceDatasetHash([]));
});

test("verification pipeline persists the safe effective status and raw-status evidence", () => {
  const pipeline = read("src/lib/verification-pipeline.ts");
  assert.ok(pipeline.includes("classifyIdentityMatch"));
  assert.ok(pipeline.includes("effectiveOrganizationStatus"));
  assert.ok(pipeline.includes("organizationStatus: effectiveStatus.status"));
  assert.ok(pipeline.includes("rawOrganizationStatus: effectiveStatus.rawStatus"));
});

test("append is the admin import default; replace requires typed confirmation and stays dry-runnable", () => {
  const route = read("src/app/api/admin/resources/import/route.ts");
  assert.ok(route.includes('mode: z.enum(["append", "replace"]).default("append")'));
  assert.ok(route.includes("dryRun: z.boolean().optional()"));
  assert.ok(route.includes("REPLACE_CONFIRMATION_REQUIRED"));
  assert.ok(route.includes("wouldRemove"));
  assert.ok(route.includes("wouldStage"));

  const component = read("src/components/bndr/admin-bulk-import.tsx");
  assert.ok(component.includes('useState<ImportMode>("append")'));
  assert.ok(component.includes("Dry run"));
  assert.ok(
    component.indexOf('<option value="append">') < component.indexOf('<option value="replace">'),
    "append option should be listed before replace",
  );
});

test("bulk replace captures a durable, hash-stamped snapshot before any row is deleted", () => {
  const route = read("src/app/api/admin/resources/import/route.ts");
  const snapshotIndex = route.indexOf("tx.resourceSnapshot.create");
  const deleteIndex = route.indexOf("tx.resource.deleteMany()");
  assert.ok(snapshotIndex > -1, "replace path must create a snapshot");
  assert.ok(deleteIndex > -1);
  assert.ok(snapshotIndex < deleteIndex, "snapshot must be captured before deleteMany");
  assert.ok(route.includes('trigger: "pre-replace-import"'));
  assert.ok(route.includes("datasetHash: computeResourceDatasetHash(current)"));
});

test("snapshots persist a dataset hash; restores verify it before AND prove it after, inside the transaction", () => {
  const list = read("src/app/api/admin/snapshots/route.ts");
  assert.ok(list.includes("requireAdminRateLimited"));
  assert.ok(list.includes("resourceSnapshot.count"));
  assert.ok(!list.includes("dataJson: true"), "list endpoint must not ship full row payloads");
  assert.ok(list.includes("datasetHash: computeResourceDatasetHash(current)"));

  const restore = read("src/app/api/admin/snapshots/[id]/restore/route.ts");
  assert.ok(restore.includes("requireAdminRateLimited"));
  assert.ok(restore.includes("dryRun"));
  assert.ok(restore.includes('trigger: "pre-restore"'));
  assert.ok(restore.includes('action: "snapshot-restore"'));
  assert.ok(restore.includes("SNAPSHOT_INTEGRITY"));
  const preRestoreIndex = restore.indexOf("tx.resourceSnapshot.create");
  const deleteIndex = restore.indexOf("tx.resource.deleteMany()");
  assert.ok(preRestoreIndex > -1 && deleteIndex > -1 && preRestoreIndex < deleteIndex);

  // Row-count is NOT integrity: the snapshot's own hash must be recomputed
  // and verified before restore, and the persisted rows must be re-read and
  // hash-proven after createMany, inside the same transaction, with a
  // dedicated failure code that rolls the restore back.
  assert.ok(restore.includes("const payloadHash = computeResourceDatasetHash(rows)"));
  assert.ok(restore.includes("RESTORE_VERIFICATION_FAILED"));
  assert.ok(restore.includes("hashVerified: true"));
  const proofIndex = restore.indexOf("computeResourceDatasetHash(persisted)");
  const createManyIndex = restore.indexOf("tx.resource.createMany");
  assert.ok(
    proofIndex > -1 && createManyIndex > -1 && proofIndex > createManyIndex,
    "restore must re-read and hash-prove persisted rows after createMany",
  );
  assert.ok(restore.includes("verified: { rowCount: persisted.length, datasetHash: persistedHash }"));
});

test("ResourceSnapshot is modeled in every schema and shipped as a migration", () => {
  for (const schema of [
    "prisma/schema.prisma",
    "prisma/sqlite/schema.prisma",
    "prisma/postgres/schema.prisma",
  ]) {
    assert.ok(read(schema).includes("model ResourceSnapshot"), `${schema} missing ResourceSnapshot`);
  }
  assert.ok(
    existsSync(join(root, "prisma/postgres/migrations/20260903200000_resource_snapshots/migration.sql")),
    "snapshot migration missing",
  );
  const supabase = read("supabase/schema.sql");
  assert.ok(supabase.includes('"ResourceSnapshot"'));
  assert.ok(supabase.includes('REVOKE ALL ON TABLE \\"ResourceSnapshot\\" FROM anon') || supabase.includes('REVOKE ALL ON TABLE "ResourceSnapshot" FROM anon'));
});

test("public and admin listings paginate in the database and preserve the weighted search semantics", () => {
  for (const path of [
    "src/app/api/resources/route.ts",
    "src/app/api/admin/resources/route.ts",
  ]) {
    const route = read(path);
    assert.ok(
      route.includes("createSearchAccumulator"),
      `${path} must rank queries with the shared weighted fuzzy/typo/acronym/priority engine`,
    );
    assert.ok(route.includes("db.resource.count({ where })"), `${path} must return true database counts`);
    assert.ok(route.includes("skip: offset"));
    assert.ok(route.includes("take: limit"));
    assert.ok(
      route.includes('orderBy: [{ name: "asc" }, { id: "asc" }]'),
      `${path} browse ordering must mirror the engine's neutral empty-query ordering`,
    );
    assert.ok(
      route.includes("cursor: { id: cursor }"),
      `${path} search path must stream candidates in stable keyset batches`,
    );
    assert.ok(
      !route.includes("where.OR") && !route.includes("OR: ["),
      `${path} must not degrade search to SQL contains filters`,
    );
  }
  const search = read("src/lib/search.ts");
  assert.ok(search.includes("export function createSearchAccumulator"));
  assert.ok(search.includes("export function compareScored"));
  assert.ok(search.includes("return sorted.slice(offset, offset + limit)"));
});

test("PII cleanup is dry-runnable and captures a durable hash-stamped snapshot before mutating", () => {
  const route = read("src/app/api/admin/cleanup/route.ts");
  assert.ok(route.includes("cleanupCommandSchema"));
  assert.ok(route.includes("dryRun: true"));
  assert.ok(route.includes('trigger: "pre-cleanup"'));
  assert.ok(route.includes("datasetHash: computeResourceDatasetHash(current)"));
  assert.ok(route.includes('action: "piipass-resource"'));
  assert.ok(route.includes("preCleanupSnapshotId"));
  const snapshotIndex = route.indexOf("tx.resourceSnapshot.create");
  const updateIndex = route.indexOf("tx.resource.update(");
  assert.ok(
    snapshotIndex > -1 && updateIndex > -1 && snapshotIndex < updateIndex,
    "pre-cleanup snapshot must be captured before any update",
  );

  const api = read("src/lib/api.ts");
  assert.ok(api.includes('runCleanup(mode: "preview" | "apply")'));

  const component = read("src/components/bndr/admin-cleanup.tsx");
  assert.ok(component.includes('runCleanup("preview")'));
  assert.ok(component.includes('runCleanup("apply")'));
  assert.ok(component.includes("Dry run"));
});

test("merge evaluation script is self-contained in the package (no external /data paths)", () => {
  const script = read("scripts/merge-verified-candidates.mjs");
  assert.ok(!script.includes("/data/"), "script must not hard-code sandbox paths");
  assert.ok(script.includes('join(root, "verifier", "out")'));
  assert.ok(script.includes('join(root, "reports", "RESOURCE_MERGE_REPORT.json")'));
  assert.ok(script.includes("mkdirSync(dirname(outPath), { recursive: true })"));
  assert.ok(
    existsSync(join(root, "verifier/out/verified_resources.json")),
    "verifier outputs must ship inside the package",
  );
  assert.ok(existsSync(join(root, "verifier/out/run_manifest.json")));
  assert.ok(existsSync(join(root, "verifier/out/verification_summary.json")));
  assert.ok(existsSync(join(root, "verifier/out/possible_duplicates_review.json")));
  assert.ok(existsSync(join(root, "verifier/out/egress-probe.json")));
});

test("admin api client exposes snapshot list, capture, and dry-runnable, hash-proven restore", () => {
  const api = read("src/lib/api.ts");
  assert.ok(api.includes("fetchSnapshots"));
  assert.ok(api.includes("createSnapshot"));
  assert.ok(api.includes("restoreSnapshot"));
  assert.ok(api.includes("/api/admin/snapshots"));
  assert.ok(api.includes("verified?: { rowCount: number; datasetHash: string }"));

  const dashboard = read("src/components/bndr/admin-dashboard.tsx");
  assert.ok(dashboard.includes("AdminSnapshots"));
});
