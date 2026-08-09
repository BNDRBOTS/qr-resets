import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const sha256 = (path) => createHash("sha256").update(readFileSync(new URL(`../${path}`, import.meta.url))).digest("hex");

const CANONICAL = "5e9a8438ee652c9be5b44fb781a2ba94db9dafffddcc720c254bc291aab2d72b";

test("canonical dataset remains exactly 114 packaged resources", () => {
  assert.equal(sha256("prisma/verified-resources.csv"), CANONICAL);
  const data = JSON.parse(read("prisma/verified-resources.json"));
  assert.equal(data.resources.length, 114);
  assert.equal(new Set(data.resources.map((row) => row.id)).size, 114);
  assert.equal(data.resources.every((row) => row.published === true), true);
});

test("dual-view router keeps Resource Directory and QR Resets in one app", () => {
  const switcher = read("src/components/shared/site-switcher.tsx");
  const router = read("src/components/shared/site-router.tsx");
  assert.match(switcher, /label: "Resource Directory"/);
  assert.match(switcher, /label: "QR Resets™"/);
  assert.match(switcher, /compact \? info\.short : info\.label/);
  assert.match(router, /<Directory \/>/);
  assert.match(router, /<QrSite \/>/);
});

test("both hero halos are circular and use equal dimensions", () => {
  const directoryHero = read("src/components/bndr/hero.tsx");
  const qrSite = read("src/components/qr/qr-site.tsx");
  const css = read("src/app/globals.css");
  assert.match(directoryHero, /h-\[70vmin\] w-\[70vmin\]/);
  assert.match(qrSite, /h-\[70vmin\] w-\[70vmin\]/);
  assert.doesNotMatch(directoryHero, /h-\[60vmin\] w-\[90vmin\]/);
  assert.match(css, /radial-gradient\(\s*circle at center/);
});

test("global day/night palette preserves bone, exact magenta, and existing dark blue", () => {
  const css = read("src/app/globals.css");
  assert.match(css, /--theme-light-background: #F3EDE6;/);
  assert.match(css, /--theme-light-foreground: #111111;/);
  assert.match(css, /--theme-light-primary: #FF355E;/);
  assert.match(css, /--theme-dark-primary: oklch\(0\.68 0\.16 235\);/);
  assert.match(css, /--brand-accent: var\(--theme-light-primary\);/);
  assert.match(css, /\.dark\s*\{[\s\S]*--brand-accent: var\(--theme-dark-primary\);/);
  assert.match(css, /\.bndr-glass-panel/);
});

test("Railway initializes durable local storage at service start and uses real health path", () => {
  const railway = read("railway.toml");
  const pkg = JSON.parse(read("package.json"));
  assert.match(railway, /builder = "railpack"/);
  assert.match(railway, /buildCommand = "npm run build"/);
  assert.doesNotMatch(railway, /preDeployCommand/);
  assert.match(railway, /healthcheckPath = "\/api\/health"/);
  assert.equal(pkg.scripts.start, "node scripts/start-production.mjs");
  assert.equal(pkg.scripts["db:prepare"], "node scripts/prepare-database.mjs");
  assert.match(read("scripts/start-production.mjs"), /Railway SQLite mode requires an attached persistent volume/);
  assert.match(read("scripts/start-production.mjs"), /\["db", "push"/);
});

test("deployment seed is additive and canonical health check is data-backed", () => {
  const seed = read("scripts/seed-verified-resources.mjs");
  const health = read("src/app/api/health/route.ts");
  assert.doesNotMatch(seed, /\.deleteMany\s*\(/);
  assert.match(seed, /tx\.resource\.upsert/);
  assert.match(seed, /tx\.datasetImport\.upsert/);
  assert.match(health, /db\.datasetImport\.findUnique/);
  assert.match(health, /sourceDatasetHash: EXPECTED_DATASET_SHA256/);
  assert.match(health, /status: ready \? 200 : 503/);
});

test("Railway config uses current railpack builder and start-time volume initialization", () => {
  const railway = read("railway.toml");
  assert.match(railway, /builder\s*=\s*"railpack"/);
  assert.match(railway, /buildCommand\s*=\s*"npm run build"/);
  assert.doesNotMatch(railway, /preDeployCommand/);
  assert.match(railway, /startCommand\s*=\s*"npm run start"/);
  assert.match(railway, /healthcheckPath\s*=\s*"\/api\/health"/);
});

test("build is self-contained from Google font network fetches", () => {
  assert.doesNotMatch(read("src/app/layout.tsx"), /next\/font\/google/);
});

test("browser mutations are same-origin gated", () => {
  const guard = read("src/lib/request-origin.ts");
  assert.match(guard, /NEXTAUTH_URL/);
  assert.match(guard, /ORIGIN_REQUIRED/);
  assert.match(guard, /ORIGIN_FORBIDDEN/);
  assert.match(read("src/lib/require-admin.ts"), /requireSameOriginMutation\(req\)/);
  assert.match(read("src/app/api/qr/requests/route.ts"), /requireSameOriginMutation\(req\)/);
});

test("public pending register exposes only name and reason", () => {
  const source = read("src/app/api/pending/route.ts");
  assert.match(source, /select:\s*\{\s*name:\s*true,\s*reason:\s*true\s*\}/);
  assert.doesNotMatch(source, /select:\s*\{[^}]*phone/i);
  assert.doesNotMatch(source, /select:\s*\{[^}]*website/i);
  assert.doesNotMatch(source, /select:\s*\{[^}]*sourceNote/i);
});

test("directory priority copy does not assert a strongest-five invariant", () => {
  const source = read("src/components/bndr/directory.tsx");
  assert.doesNotMatch(source, /Strongest five for your stated need/i);
  assert.match(source, /Priority resources/);
});


test("Railway-local SQLite is default while PostgreSQL/Supabase remains opt-in", () => {
  const backend = read("scripts/storage-backend.mjs");
  const sqliteSchema = read("prisma/sqlite/schema.prisma");
  const postgresSchema = read("prisma/postgres/schema.prisma");
  assert.match(backend, /STORAGE_BACKEND \|\| "sqlite"/);
  assert.match(backend, /RAILWAY_VOLUME_MOUNT_PATH/);
  assert.match(sqliteSchema, /provider = "sqlite"/);
  assert.match(postgresSchema, /provider = "postgresql"/);
});

test("browser-side advocate state remains localStorage-backed", () => {
  for (const file of [
    "src/components/bndr/use-saved-resources.ts",
    "src/components/bndr/use-resource-notes.ts",
    "src/components/bndr/use-contact-log.ts",
    "src/components/bndr/use-collections.ts",
  ]) {
    assert.match(read(file), /localStorage/);
  }
});

test("Railway health gates real data readiness without making admin setup a deploy prerequisite", () => {
  const health = read("src/app/api/health/route.ts");
  assert.match(health, /persistenceReady\(\)/);
  assert.match(health, /adminConfigured\(\)/);
  assert.match(health, /const ready = dbReady && datasetReady && persistence;/);
  assert.doesNotMatch(health, /dbReady && datasetReady && persistence && admin/);
});

test("release verifier requires production start plus HTTP 200 health before runtime pass", () => {
  const source = read("scripts/release-verify.mjs");
  assert.match(source, /production-start-health/);
  assert.match(source, /npm", \["run", "start"\]/);
  assert.match(source, /\/api\/health/);
  assert.match(source, /response\?\.status === 200/);
  assert.match(source, /productionRuntimeVerified = true/);
});


test("category and resource presentation is neutral by default", () => {
  const grid = read("src/components/bndr/category-grid.tsx");
  const pills = read("src/components/bndr/category-pills.tsx");
  const directory = read("src/components/bndr/directory.tsx");
  const card = read("src/components/bndr/resource-card.tsx");
  const search = read("src/lib/search.ts");
  assert.match(grid, /CATEGORIES\.map/);
  assert.doesNotMatch(grid, /slice\(0,\s*6\)|sort\([^)]*count|top 6/i);
  assert.match(pills, /bndr-filter-pill/);
  assert.doesNotMatch(pills, /rounded-r-none|border-l-0/);
  assert.doesNotMatch(directory, /FeaturedSpotlight/);
  assert.match(directory, /pageSize=\{500\}/);
  assert.doesNotMatch(card, /md:col-span-2|lg:col-span-3/);
  assert.doesNotMatch(card, /tags\.slice\(0,\s*isPriority/);
  assert.match(search, /a\.name\.localeCompare\(b\.name\)/);
});

test("emoji glyphs are removed and custom BNDR SVG icons are present", () => {
  const files = [
    "src/components/bndr/category-grid.tsx",
    "src/components/bndr/advocate-dashboard.tsx",
    "src/components/bndr/saved-resources-panel.tsx",
    "src/components/bndr/use-goal-celebration.ts",
    "src/components/qr/qr-site.tsx",
  ];
  const emoji = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u;
  for (const file of files) assert.doesNotMatch(read(file), emoji);
  const icons = read("src/components/shared/bndr-icons.tsx");
  assert.match(icons, /function IconFrame/);
  assert.match(icons, /export function CategoryGlyph/);
  assert.match(icons, /export function BndrCheckIcon/);
});

test("source normalizer and canonical data remain byte-identical to v2 baseline", () => {
  assert.equal(sha256("src/lib/pii.ts"), "092ea94d6772f7f6d1ab6eed68ddfe7f52cb946babc6625b7de385fdaed8d72e");
  assert.equal(sha256("src/app/api/admin/resources/import/route.ts"), "a7464c48cf64f225e62cb1a03c0770466560b18c9e516ba5a4438d4322c732a8");
  assert.equal(sha256("src/components/bndr/admin-bulk-import.tsx"), "92491d384d27761bb02897bb3771563db3b48f05d30b1f6152ae2864196882b7");
  assert.equal(sha256("prisma/verified-resources.csv"), CANONICAL);
});

test("admin login and resource creation remain environment-backed and server-gated", () => {
  const auth = read("src/lib/auth-options.ts");
  const adminRoute = read("src/app/api/admin/resources/route.ts");
  const adminPage = read("src/app/admin/page.tsx");
  assert.match(auth, /process\.env\.ADMIN_EMAIL/);
  assert.match(auth, /process\.env\.ADMIN_PASSWORD_HASH/);
  assert.match(auth, /process\.env\.ADMIN_PASSWORD/);
  assert.doesNotMatch(auth, /ADMIN_(?:EMAIL|PASSWORD|PASSWORD_HASH)\s*=\s*["'][^"']+["']/);
  assert.match(adminPage, /getServerSession\(authOptions\)/);
  assert.match(adminRoute, /requireAdminRateLimited\(req, RATE_LIMITS\.resourceMutation\)/);
  assert.match(adminRoute, /createResourceRecord\(parsed\.data, actor\)/);
});

test("category contact coverage is global dataset-backed rather than filtered-result derived", () => {
  const statsRoute = read("src/app/api/stats/route.ts");
  const directory = read("src/components/bndr/directory.tsx");
  const types = read("src/lib/types.ts");
  assert.match(statsRoute, /categoryContactCoverage/);
  assert.match(statsRoute, /db\.resource\.groupBy/);
  assert.match(statsRoute, /published:\s*true/);
  assert.match(directory, /stats\?\.categoryContactCoverage/);
  assert.doesNotMatch(directory, /for \(const resource of resources\)[\s\S]{0,600}categoryStats/);
  assert.match(types, /categoryContactCoverage:/);
});
