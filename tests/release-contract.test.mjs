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

test("requested sand-bone and black default palette is literal", () => {
  const css = read("src/app/globals.css");
  assert.match(css, /--background: #F3EDE6;/);
  assert.match(css, /--foreground: #111111;/);
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

test("health requires durable persistence and configured single-admin access", () => {
  const health = read("src/app/api/health/route.ts");
  assert.match(health, /persistenceReady\(\)/);
  assert.match(health, /adminConfigured\(\)/);
  assert.match(health, /dbReady && datasetReady && persistence && admin/);
});

test("release verifier requires production start plus HTTP 200 health before runtime pass", () => {
  const source = read("scripts/release-verify.mjs");
  assert.match(source, /production-start-health/);
  assert.match(source, /npm", \["run", "start"\]/);
  assert.match(source, /\/api\/health/);
  assert.match(source, /response\?\.status === 200/);
  assert.match(source, /productionRuntimeVerified = true/);
});
