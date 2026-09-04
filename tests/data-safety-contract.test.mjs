// BNDR. Data-safety contract tests.
// Pins: (1) restricted-egress DNS/transport failures can never surface as
// confirmed-dead (safe effective status, raw evidence preserved), (2)
// corroborated identity matching (hostname/phone/email/name ALONE never
// auto-merges), (3) append is the admin default and replace is dry-runnable
// and snapshot-protected, (4) durable snapshots + audited restore, (5)
// database-side pagination/search with stable ordering and true counts.

import { strict as assert } from "node:assert";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  RESTRICTED_EGRESS_SAFE_STATUS,
  admissionDecision,
  classifyIdentityMatch,
  effectiveOrganizationStatus,
  deriveRecordIssues,
} from "../src/lib/verification-core.mjs";
import { paginateResources } from "../src/lib/resource-pagination.ts";
import {
  hashSnapshotRows,
  prepareResourceSnapshot,
  verifyResourceSnapshot,
} from "../src/lib/resource-snapshot.ts";

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
  assert.match(demoted.note, /not proof the site is dead/i);

  const hard404 = {
    ...deadRecord,
    suggestedName: "",
    flags: [],
    phones: [],
    emails: [],
    addresses: [],
    urls: [{
      website_status: "DEAD_CONFIRMED",
      requested_url: "https://example.org/missing",
      attempts: [{ outcome: "HTTP_RESPONSE", status: 404 }],
    }],
  };
  const evidenced = effectiveOrganizationStatus(hard404, { egressRestricted: true });
  assert.equal(evidenced.status, "WEBSITE_DEAD_CONFIRMED");
  assert.equal(evidenced.demoted, false);
  assert.equal(evidenced.hardHttpStatus, 404);
  const hardIssues = deriveRecordIssues(hard404, { egressRestricted: true });
  assert.equal(hardIssues[0]?.code, "WEBSITE_DEAD_REPORTED");

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

test("only one unambiguous name+contact identity match classifies strong; shared contacts and multi-match cases require review", () => {
  const nameAndPhone = classifyIdentityMatch(
    { name: "Example Legal Aid", phone: "602-555-0100" },
    canonicalRows,
  );
  assert.equal(nameAndPhone.kind, "strong");
  assert.equal(nameAndPhone.match.id, "row-1");

  const emailAndHost = classifyIdentityMatch(
    { name: "Renamed Org", email: "help@example-legal.org", url: "example-legal.org" },
    canonicalRows,
  );
  assert.equal(emailAndHost.kind, "ambiguous", "shared contacts without the same program name require review");

  const sharedProgramContacts = classifyIdentityMatch(
    { name: "Program A", phone: "602-555-0100", url: "example-legal.org" },
    [
      { ...canonicalRows[0], id: "a", name: "Program A" },
      { ...canonicalRows[0], id: "b", name: "Program B" },
    ],
  );
  assert.equal(sharedProgramContacts.kind, "ambiguous");
  assert.equal(sharedProgramContacts.match, null);
  assert.equal(sharedProgramContacts.matches.length, 2);

  const duplicateCanonicalTargets = classifyIdentityMatch(
    { name: "Same Program", phone: "602-555-0100" },
    [
      { ...canonicalRows[0], id: "a", name: "Same Program" },
      { ...canonicalRows[0], id: "b", name: "Same Program" },
    ],
  );
  assert.equal(duplicateCanonicalTargets.kind, "ambiguous", "multiple strong candidates must never resolve by first match");

  const disjoint = classifyIdentityMatch(
    { name: "Fresh Org", email: "team@fresh.org", url: "https://fresh.org" },
    canonicalRows,
  );
  assert.equal(disjoint.kind, "none");

  const ignored = classifyIdentityMatch(
    { name: "Example Legal Aid", phone: "602-555-0100" },
    canonicalRows,
    "row-1",
  );
  assert.equal(ignored.kind, "none");
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

test("bulk replace captures a durable snapshot before any row is deleted", () => {
  const route = read("src/app/api/admin/resources/import/route.ts");
  const snapshotIndex = route.indexOf("tx.resourceSnapshot.create");
  const deleteIndex = route.indexOf("tx.resource.deleteMany()");
  assert.ok(snapshotIndex > -1, "replace path must create a snapshot");
  assert.ok(deleteIndex > -1);
  assert.ok(snapshotIndex < deleteIndex, "snapshot must be captured before deleteMany");
  assert.ok(route.includes('trigger: "pre-replace-import"'));
});

test("snapshot routes are authenticated, rate limited, and restores are audited, reversible, and dry-runnable", () => {
  const list = read("src/app/api/admin/snapshots/route.ts");
  assert.ok(list.includes("requireAdminRateLimited"));
  assert.ok(list.includes("resourceSnapshot.count"));
  assert.ok(!list.includes("dataJson: true"), "list endpoint must not ship full row payloads");

  const restore = read("src/app/api/admin/snapshots/[id]/restore/route.ts");
  assert.ok(restore.includes("requireAdminRateLimited"));
  assert.ok(restore.includes("dryRun"));
  assert.ok(restore.includes('trigger: "pre-restore"'));
  assert.ok(restore.includes('action: "snapshot-restore"'));
  assert.ok(restore.includes("SNAPSHOT_INTEGRITY"));
  const preRestoreIndex = restore.indexOf("tx.resourceSnapshot.create");
  const deleteIndex = restore.indexOf("tx.resource.deleteMany()");
  assert.ok(preRestoreIndex > -1 && deleteIndex > -1 && preRestoreIndex < deleteIndex);
  assert.ok(restore.includes("restoredHash !== verifiedSnapshot.datasetHash"));
  assert.ok(restore.includes("exactRecoveryVerified: true"));

  const sourceRows = [
    { id: "b", name: "Beta", updatedAt: new Date("2026-09-03T00:00:00Z"), nested: { z: 1, a: 2 } },
    { id: "a", name: "Alpha", updatedAt: new Date("2026-09-02T00:00:00Z"), nested: { a: 1 } },
  ];
  const prepared = prepareResourceSnapshot(sourceRows);
  assert.equal(prepared.rowCount, 2);
  assert.equal(hashSnapshotRows(sourceRows), prepared.datasetHash);
  const verified = verifyResourceSnapshot({
    dataJson: prepared.rows,
    rowCount: prepared.rowCount,
    datasetHash: prepared.datasetHash,
  });
  assert.equal(verified.ok, true);
  const tampered = structuredClone(prepared.rows);
  tampered[0].name = "Changed";
  const rejected = verifyResourceSnapshot({
    dataJson: tampered,
    rowCount: prepared.rowCount,
    datasetHash: prepared.datasetHash,
  });
  assert.equal(rejected.ok, false);
  assert.match(rejected.reason, /hash mismatch/i);
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

test("public/admin pagination reaches beyond 500 while preserving weighted fuzzy/typo/acronym/priority search semantics", async () => {
  const make = (i, extra = {}) => ({
    id: `r-${String(i).padStart(4, "0")}`,
    name: `Resource ${String(i).padStart(4, "0")}`,
    acronym: null,
    description: "general assistance",
    category: "housing-financial-aid",
    subcategory: null,
    phoneRaw: null,
    phoneNormalized: null,
    email: null,
    address: null,
    website: null,
    tags: "",
    priority: 0,
    verified: true,
    published: true,
    sourceNote: null,
    piipassAt: null,
    piipassNotes: null,
    createdAt: "2026-09-03T00:00:00.000Z",
    updatedAt: "2026-09-03T00:00:00.000Z",
    ...extra,
  });
  const rows = Array.from({ length: 625 }, (_, i) => make(i));
  rows[510] = make(510, { name: "Emergency Shelter Network", acronym: "ESN", description: "rapid shelter placement" });
  rows[511] = make(511, { name: "Emergency Shelter Priority", acronym: "ESP", description: "rapid shelter placement", priority: 1 });
  rows[612] = make(612, { name: "National Center for Missing & Exploited Children", acronym: "NCMEC" });
  const calls = [];
  const source = {
    count: async () => rows.length,
    fetchPage: async ({ skip, take }) => {
      calls.push({ skip, take });
      return rows.slice(skip, skip + take);
    },
  };

  const deep = await paginateResources(source, { q: "", limit: 25, offset: 600 });
  assert.equal(deep.total, 625);
  assert.equal(deep.resources[0].id, "r-0600");

  calls.length = 0;
  const typo = await paginateResources(source, { q: "sheltr", limit: 10, offset: 0 });
  assert.ok(typo.total >= 2, "typo-only fuzzy matches must survive database traversal");
  assert.equal(typo.resources[0].id, "r-0511", "priority boost must remain part of weighted ranking");
  assert.deepEqual(calls.map((c) => c.skip), [0, 250, 500]);
  assert.ok(calls.every((c) => c.take <= 250), "search must read the DB in bounded pages");

  const acronym = await paginateResources(source, { q: "NCMEC", limit: 10, offset: 0 });
  assert.equal(acronym.resources[0].id, "r-0612");

  for (const path of ["src/app/api/resources/route.ts", "src/app/api/admin/resources/route.ts"]) {
    const route = read(path);
    assert.ok(route.includes("paginateResources"), `${path} must use the shared ranked pagination path`);
    assert.ok(route.includes("db.resource.count({ where })"));
  }
  const directory = read("src/components/bndr/directory.tsx");
  assert.ok(directory.includes("useInfiniteQuery"));
  assert.ok(directory.includes("fetchNextPage"));
  assert.ok(!directory.includes("limit: 500"), "public UI must not hard-stop at 500 rows");
});

test("admin api client exposes snapshot list, capture, and dry-runnable restore", () => {
  const api = read("src/lib/api.ts");
  assert.ok(api.includes("fetchSnapshots"));
  assert.ok(api.includes("createSnapshot"));
  assert.ok(api.includes("restoreSnapshot"));
  assert.ok(api.includes("/api/admin/snapshots"));

  const dashboard = read("src/components/bndr/admin-dashboard.tsx");
  assert.ok(dashboard.includes("AdminSnapshots"));
});
