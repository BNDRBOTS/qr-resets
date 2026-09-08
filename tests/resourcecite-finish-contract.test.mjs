import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("new sessions enter ResourceCite in light mode without persisted QR selection", () => {
  const site = read("src/lib/use-site.ts");
  const layout = read("src/app/layout.tsx");
  const switcher = read("src/components/shared/site-switcher.tsx");
  assert.match(site, /site:\s*"bndr"/);
  assert.doesNotMatch(site, /localStorage|persist\(/);
  assert.match(layout, /defaultTheme="light"/);
  assert.match(switcher, /label:\s*"ResourceCite"/);
  assert.match(switcher, /label:\s*"QR Resets™"/);
});

test("ResourceCite hero is factual, dynamic, and has a working browse action without priority theater", () => {
  const hero = read("src/components/bndr/hero.tsx");
  const stats = read("src/components/bndr/stats-strip.tsx");
  assert.match(hero, />\s*ResourceCite\s*</);
  assert.match(hero, /resources indexed/);
  assert.match(hero, /Browse all \{total\.toLocaleString\(\)\}/);
  assert.match(hero, /onClick=\{onBrowseAll\}/);
  assert.doesNotMatch(hero, /Priority resources|Priority Resources|priority resources/i);
  assert.doesNotMatch(stats, /Priority matches|operator-marked|indexed & normalized|source-derived/i);
});

test("public categories hide zero-count entries and expose one coherent category control", () => {
  const pills = read("src/components/bndr/category-pills.tsx");
  const grid = read("src/components/bndr/category-grid.tsx");
  const icons = read("src/components/shared/bndr-icons.tsx");
  assert.match(pills, /CATEGORIES\.filter\(\(c\) => \(counts\[c\.slug\] \?\? 0\) > 0\)/);
  assert.doesNotMatch(pills, /Info|InfoIcon|aria-label=.*info/i);
  assert.match(grid, /CATEGORIES\.filter\(\(cat\) => \(counts\[cat\.slug\] \?\? 0\) > 0\)/);
  assert.doesNotMatch(grid, /Source-backed category|phonePct|emailPct|webPct|coverage/i);
  assert.match(grid, /onClick=\{\(\) => onSelect\(cat\.slug\)\}/);
  assert.match(icons, /function CategoryGlyph/);
  assert.ok((icons.match(/return <[A-Z][A-Za-z]+ \{\.\.\.props\}/g) ?? []).length <= 6,
    "category icons should be a small reusable broad-domain family");
});

test("ResourceCite dark mode lifts public supporting text out of low-contrast gray", () => {
  const directory = read("src/components/bndr/directory.tsx");
  const css = read("src/app/globals.css");
  assert.match(directory, /bndr-resourcecite/);
  assert.match(css, /\.dark \.bndr-resourcecite \[class\*="text-muted-foreground"\]/);
  assert.match(css, /rgba\(248, 251, 255, 0\.84\)/);
});

test("public resource cards keep useful actions and contacts while hiding raw/internal metadata", () => {
  const card = read("src/components/bndr/resource-card.tsx");
  const detail = read("src/components/bndr/resource-detail-dialog.tsx");
  assert.match(card, /bndr-public-card/);
  assert.match(card, /Compare/);
  assert.match(card, /Save resource/);
  assert.match(card, /Share resource/);
  assert.doesNotMatch(card, /resource\.tags|sourceNote|Phone available|Email available|Web available|Address available/);
  assert.doesNotMatch(detail, /r\.tags|resource\.tags|sourceNote/);
  assert.match(detail, /Share/);
  assert.match(detail, /Print/);
  assert.match(detail, /Compare/);
});

test("mobile comparison scroll is contained inside the compare surface", () => {
  const compare = read("src/components/bndr/compare-modal.tsx");
  assert.match(compare, /overflow-x-auto/);
  assert.match(compare, /overscroll-x-contain/);
  assert.match(compare, /WebkitOverflowScrolling:\s*"touch"/);
  assert.match(compare, /touchAction:\s*"pan-x pan-y"/);
});

test("Crisis Navigator owns its internal scroll-progress ring and no longer collides with ResourceCite BackToTop", () => {
  const crisis = read("src/components/bndr/crisis-help-button.tsx");
  const directory = read("src/components/bndr/directory.tsx");
  assert.match(crisis, /scrollYProgress/);
  assert.match(crisis, /pathLength:\s*progress/);
  assert.match(crisis, /safe-area-inset-right/);
  assert.match(crisis, /safe-area-inset-bottom/);
  assert.doesNotMatch(directory, /<BackToTop/);
});

test("individual permanent delete snapshots before mutation and supports hash-verified exact undo", () => {
  const service = read("src/lib/resource-service.ts");
  const dashboard = read("src/components/bndr/admin-dashboard.tsx");
  const restore = read("src/app/api/admin/resources/[id]/restore-deleted/route.ts");
  const snapshotPos = service.indexOf('trigger: "pre-delete"');
  const deletePos = service.indexOf("await tx.resource.delete");
  assert.ok(snapshotPos >= 0 && deletePos > snapshotPos, "snapshot must precede delete");
  assert.match(service, /verifyResourceSnapshot\(snapshot\)/);
  assert.match(dashboard, /Permanently delete/);
  assert.match(dashboard, /Undo delete/);
  assert.match(restore, /snapshot\.trigger !== "pre-delete"/);
  assert.match(restore, /hashSnapshotRows\(\[priorRow\]\)/);
  assert.match(restore, /restoredRowHash !== expectedRowHash/);
  assert.match(restore, /exactRecoveryVerified:\s*true/);
});

test("cleanup and verification material transitions require consequence confirmations", () => {
  const cleanup = read("src/components/bndr/admin-cleanup.tsx");
  const verification = read("src/components/bndr/admin-verification.tsx");
  assert.match(cleanup, /confirm\(/);
  assert.match(cleanup, /affected|resource/i);
  for (const label of ["Accept", "Dismiss", "Reopen", "Publish", "Mark reviewed", "Exclude", "Move back to held"]) {
    assert.ok(verification.includes(label), `missing verification action ${label}`);
  }
  assert.ok((verification.match(/confirm\(/g) ?? []).length >= 4, "consequential verification paths must confirm before mutation");
  assert.match(verification, /More actions/);
});

test("ResourceCite site copy is controlled, versioned, authenticated, bounded, and separate from QR copy", () => {
  const dashboard = read("src/components/bndr/admin-dashboard.tsx");
  const editor = read("src/components/bndr/admin-site-copy.tsx");
  const adminRoute = read("src/app/api/admin/site-copy/route.ts");
  const publicRoute = read("src/app/api/site-copy/route.ts");
  const schema = read("prisma/schema.prisma");
  assert.match(dashboard, /value="site-copy"/);
  assert.match(editor, /ResourceCite site copy/);
  assert.match(editor, /Save draft/);
  assert.match(editor, /Publish saved draft/);
  assert.match(editor, /Revision history/);
  assert.match(editor, /QR Resets copy, layout, data, and application behavior are outside this editor/);
  assert.match(adminRoute, /requireAdminRateLimited/);
  assert.match(adminRoute, /readBoundedJson\(req, BODY_LIMITS\.resourceMutation\)/);
  assert.match(adminRoute, /site-copy-draft/);
  assert.match(adminRoute, /site-copy-publish/);
  assert.match(adminRoute, /site-copy-restore/);
  assert.match(publicRoute, /where:\s*\{ status: "published" \}/);
  assert.match(schema, /model SiteCopyRevision/);
});

test("QR Resets remains structurally prototype-only", () => {
  const requestRoute = read("src/app/api/qr/requests/route.ts");
  const donationRoute = read("src/app/api/qr/donations/webhook/route.ts");
  assert.match(requestRoute, /demoOnly:\s*true/);
  assert.match(requestRoute, /status:\s*503/);
  assert.doesNotMatch(requestRoute, /qrResetRequest\.(create|update|upsert|delete)/);
  assert.match(donationRoute, /demoOnly:\s*true/);
  assert.doesNotMatch(donationRoute, /qrDonationEvent\.(create|update|upsert|delete)/);
});
