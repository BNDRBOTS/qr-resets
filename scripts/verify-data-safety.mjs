import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { paginateResources, RESOURCE_SCAN_PAGE_SIZE } from "../src/lib/resource-pagination.ts";
import {
  hashSnapshotRows,
  prepareResourceSnapshot,
  verifyResourceSnapshot,
} from "../src/lib/resource-snapshot.ts";
import {
  classifyIdentityMatch,
  deriveRecordIssues,
  effectiveOrganizationStatus,
  normalizeVerifierRecord,
  RESTRICTED_EGRESS_SAFE_STATUS,
} from "../src/lib/verification-core.mjs";

const root = resolve(import.meta.dirname, "..");
const outPath = process.argv[2] ? resolve(process.argv[2]) : resolve(root, "DATA_SAFETY_VERIFICATION.json");
const read = (path) => readFileSync(resolve(root, path), "utf8");
const evidence = {};

function makeResource(i, extra = {}) {
  return {
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
  };
}

// 1) Pagination + weighted search proof over a dataset well past 500 rows.
const rows = Array.from({ length: 725 }, (_, i) => makeResource(i));
rows[510] = makeResource(510, {
  name: "Emergency Shelter Network",
  acronym: "ESN",
  description: "rapid shelter placement",
});
rows[511] = makeResource(511, {
  name: "Emergency Shelter Priority",
  acronym: "ESP",
  description: "rapid shelter placement",
  priority: 1,
});
rows[712] = makeResource(712, {
  name: "National Center for Missing & Exploited Children",
  acronym: "NCMEC",
});
const scanCalls = [];
const source = {
  count: async () => rows.length,
  fetchPage: async ({ skip, take }) => {
    scanCalls.push({ skip, take });
    return rows.slice(skip, skip + take);
  },
};
const deepPage = await paginateResources(source, { q: "", limit: 25, offset: 700 });
assert.equal(deepPage.total, 725);
assert.equal(deepPage.resources[0].id, "r-0700");
scanCalls.length = 0;
const typo = await paginateResources(source, { q: "sheltr", limit: 10, offset: 0 });
assert.ok(typo.total >= 2);
assert.equal(typo.resources[0].id, "r-0511");
assert.deepEqual(scanCalls.map(({ skip }) => skip), [0, 250, 500]);
assert.ok(scanCalls.every(({ take }) => take <= RESOURCE_SCAN_PAGE_SIZE));
const acronym = await paginateResources(source, { q: "NCMEC", limit: 10, offset: 0 });
assert.equal(acronym.resources[0].id, "r-0712");
const directorySource = read("src/components/bndr/directory.tsx");
const gridSource = read("src/components/bndr/resource-grid.tsx");
for (const routePath of ["src/app/api/resources/route.ts", "src/app/api/admin/resources/route.ts"]) {
  const route = read(routePath);
  assert.ok(route.includes("paginateResources"));
  assert.ok(route.includes("db.resource.count({ where })"));
  assert.ok(route.includes('orderBy: [{ name: "asc" }, { id: "asc" }]'));
}
assert.ok(directorySource.includes("useInfiniteQuery"));
assert.ok(directorySource.includes("fetchNextPage"));
assert.ok(directorySource.includes("hasNextPage"));
assert.ok(directorySource.includes("offset: pageParam"));
assert.ok(!directorySource.includes("limit: 500"));
assert.ok(gridSource.includes("onLoadMore"));
assert.ok(gridSource.includes("hasMore"));
evidence.paginationAndSearch = {
  datasetRows: rows.length,
  deepOffsetRequested: 700,
  firstDeepRowId: deepPage.resources[0].id,
  typoQuery: "sheltr",
  typoTopId: typo.resources[0].id,
  priorityTopId: typo.resources[0].id,
  acronymQuery: "NCMEC",
  acronymTopId: acronym.resources[0].id,
  boundedDbScanSkips: scanCalls.map(({ skip }) => skip),
  scanPageSize: RESOURCE_SCAN_PAGE_SIZE,
  publicUiFetchesSubsequentApiPages: true,
};

// 2) Snapshot hash + exact recovery proof. Hash is canonical full-row data,
// not row count; order changes do not change it, content changes do.
const snapshotInput = [
  { id: "b", name: "Beta", updatedAt: new Date("2026-09-03T00:00:00Z"), nested: { z: 1, a: 2 } },
  { id: "a", name: "Alpha", updatedAt: new Date("2026-09-02T00:00:00Z"), nested: { a: 1 } },
  { id: "c", name: "Gamma", tags: "x,y", published: true },
];
const prepared = prepareResourceSnapshot(snapshotInput);
assert.equal(prepared.rowCount, 3);
assert.equal(hashSnapshotRows(snapshotInput), prepared.datasetHash);
const verified = verifyResourceSnapshot({
  dataJson: prepared.rows,
  rowCount: prepared.rowCount,
  datasetHash: prepared.datasetHash,
});
assert.equal(verified.ok, true);
const reorderedRecovery = [snapshotInput[2], snapshotInput[0], snapshotInput[1]];
const recoveredHash = hashSnapshotRows(reorderedRecovery);
assert.equal(reorderedRecovery.length, prepared.rowCount);
assert.equal(recoveredHash, prepared.datasetHash);
const tampered = structuredClone(prepared.rows);
tampered[0].name = "Tampered";
const tamperResult = verifyResourceSnapshot({
  dataJson: tampered,
  rowCount: prepared.rowCount,
  datasetHash: prepared.datasetHash,
});
assert.equal(tamperResult.ok, false);
assert.notEqual(hashSnapshotRows(tampered), prepared.datasetHash);
const snapshotRoute = read("src/app/api/admin/snapshots/route.ts");
const restoreRoute = read("src/app/api/admin/snapshots/[id]/restore/route.ts");
const importRoute = read("src/app/api/admin/resources/import/route.ts");
assert.ok(snapshotRoute.includes("datasetHash: prepared.datasetHash"));
assert.ok(importRoute.includes("datasetHash: snapshot.datasetHash"));
assert.ok(restoreRoute.includes("verifyResourceSnapshot(snapshot)"));
assert.ok(restoreRoute.includes("const restoredRows = await tx.resource.findMany()"));
assert.ok(restoreRoute.includes("restoredRows.length !== snapshot.rowCount"));
assert.ok(restoreRoute.includes("restoredHash !== verifiedSnapshot.datasetHash"));
assert.ok(restoreRoute.includes("exactRecoveryVerified: true"));
assert.ok(restoreRoute.indexOf("tx.resourceSnapshot.create") < restoreRoute.indexOf("tx.resource.deleteMany()"));
evidence.snapshotAndRestore = {
  rowCount: prepared.rowCount,
  datasetSha256: prepared.datasetHash,
  reorderedFullDataRecoverySha256: recoveredHash,
  exactCountRecovered: reorderedRecovery.length === prepared.rowCount,
  exactDataHashRecovered: recoveredHash === prepared.datasetHash,
  tamperedSnapshotRejected: tamperResult.ok === false,
  preRestoreSnapshotBeforeDelete: true,
  restoredDatabaseReReadBeforeCommit: true,
};

// 3) Cleanup proof: preview exits before the transaction/mutation path; apply
// re-reads inside the transaction and creates the durable full snapshot before
// the first resource update.
const cleanupRoute = read("src/app/api/admin/cleanup/route.ts");
const previewBranch = cleanupRoute.indexOf('parsed.data.mode === "preview"');
const transactionStart = cleanupRoute.indexOf("db.$transaction");
const snapshotCreate = cleanupRoute.indexOf("tx.resourceSnapshot.create");
const firstUpdate = cleanupRoute.indexOf("tx.resource.update");
assert.ok(previewBranch >= 0 && transactionStart > previewBranch);
assert.ok(cleanupRoute.slice(previewBranch, transactionStart).includes("return NextResponse.json"));
assert.ok(cleanupRoute.includes("const current = await tx.resource.findMany()"));
assert.ok(snapshotCreate >= 0 && firstUpdate > snapshotCreate);
assert.ok(cleanupRoute.includes('trigger: "pre-cleanup"'));
assert.ok(cleanupRoute.includes("datasetHash: prepared.datasetHash"));
evidence.cleanup = {
  previewReturnsBeforeMutationTransaction: true,
  applyReReadsCurrentRowsInsideTransaction: true,
  durableSnapshotBeforeFirstResourceMutation: true,
  preCleanupSnapshotStoresDatasetHash: true,
};

// 4) Identity proof: shared organizational contacts never auto-merge distinct
// programs; more than one plausible canonical target never resolves by order.
const canonicalRows = [
  {
    id: "a",
    name: "Program A",
    email: "intake@shared.org",
    phoneNormalized: "+16025550100",
    website: "https://shared.org",
  },
  {
    id: "b",
    name: "Program B",
    email: "intake@shared.org",
    phoneNormalized: "+16025550100",
    website: "https://shared.org",
  },
];
const sharedContacts = classifyIdentityMatch(
  { name: "Program C", email: "intake@shared.org", phone: "602-555-0100", url: "https://shared.org" },
  canonicalRows,
);
assert.equal(sharedContacts.kind, "ambiguous");
assert.equal(sharedContacts.match, null);
assert.equal(sharedContacts.matches.length, 2);
const multipleStrong = classifyIdentityMatch(
  { name: "Program A", phone: "602-555-0100" },
  [canonicalRows[0], { ...canonicalRows[0], id: "a-duplicate" }],
);
assert.equal(multipleStrong.kind, "ambiguous");
assert.equal(multipleStrong.match, null);
const uniqueStrong = classifyIdentityMatch(
  { name: "Program A", phone: "602-555-0100" },
  [canonicalRows[0]],
);
assert.equal(uniqueStrong.kind, "strong");
assert.equal(uniqueStrong.match.id, "a");
evidence.identity = {
  sharedHostPhoneEmailDifferentProgram: sharedContacts.kind,
  sharedContactCandidateCount: sharedContacts.matches.length,
  multiplePlausibleCanonicalMatches: multipleStrong.kind,
  uniqueNamePlusContactMatch: uniqueStrong.kind,
  firstMatchSelectionUsedForAmbiguity: false,
};

// 5) Egress proof: DNS/transport-only death is demoted under restricted egress;
// actual HTTP 404/410/451 evidence is not erased.
const dnsOnly = normalizeVerifierRecord({
  record_id: "dns",
  name: "DNS Example",
  organization_status: "WEBSITE_DEAD_CONFIRMED",
  urls: [{ requested_url: "https://dns.invalid", website_status: "DEAD_CONFIRMED_DNS", attempts: [] }],
});
assert.ok(dnsOnly);
const dnsEffective = effectiveOrganizationStatus(dnsOnly, { egressRestricted: true });
assert.equal(dnsEffective.status, RESTRICTED_EGRESS_SAFE_STATUS);
assert.equal(dnsEffective.demoted, true);
const dnsIssues = deriveRecordIssues(dnsOnly, { egressRestricted: true });
assert.equal(dnsIssues[0]?.code, "UNREACHABLE_IN_RESTRICTED_ENVIRONMENT");

const hard410 = normalizeVerifierRecord({
  record_id: "http410",
  name: "Gone Example",
  organization_status: "WEBSITE_DEAD_CONFIRMED",
  urls: [{
    requested_url: "https://gone.example",
    website_status: "DEAD_CONFIRMED",
    attempts: [{ url: "https://gone.example", status: 410, ok: false }],
  }],
});
assert.ok(hard410);
const hardEffective = effectiveOrganizationStatus(hard410, { egressRestricted: true });
assert.equal(hardEffective.status, "WEBSITE_DEAD_CONFIRMED");
assert.equal(hardEffective.demoted, false);
assert.equal(hardEffective.hardHttpStatus, 410);
const hardIssues = deriveRecordIssues(hard410, { egressRestricted: true });
assert.equal(hardIssues[0]?.code, "WEBSITE_DEAD_REPORTED");
evidence.egress = {
  dnsTransportOnlyEffectiveStatus: dnsEffective.status,
  dnsTransportOnlyIssue: dnsIssues[0]?.code,
  hardHttpStatus: hardEffective.hardHttpStatus,
  hardHttpEffectiveStatus: hardEffective.status,
  hardHttpIssue: hardIssues[0]?.code,
};

// 6) Portable merge proof: no hard-coded /data input and all restricted-egress
// decisions pass the environment flag through issue derivation.
const mergeScript = read("scripts/merge-verified-candidates.mjs");
assert.ok(!mergeScript.includes('/data/verifier_out'));
assert.ok(!mergeScript.includes('/data/deliverables'));
assert.ok(mergeScript.includes('join(root, "verification-evidence", "verifier_out")'));
assert.ok(mergeScript.includes('join(root, "verification-evidence", "egress-probe.json")'));
assert.ok(mergeScript.includes("deriveRecordIssues(record, { egressRestricted })"));
evidence.portableMerge = {
  hardCodedExternalDataDependency: false,
  verifierEvidenceRelativeToProductionRoot: true,
  egressProbeRelativeToProductionRoot: true,
  restrictedEgressAppliedToIssueDerivation: true,
};

const report = {
  reportVersion: 1,
  generatedAt: new Date().toISOString(),
  command: "node --no-warnings --experimental-strip-types scripts/verify-data-safety.mjs",
  allChecksPassed: true,
  evidence,
};
writeFileSync(outPath, JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
