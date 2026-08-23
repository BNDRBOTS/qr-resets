#!/usr/bin/env node

import { createHash } from "node:crypto";
import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import { extname, join, relative } from "node:path";

const root = new URL("../", import.meta.url).pathname;
const failures = [];

function fail(message) {
  failures.push(message);
}
function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (["node_modules", ".next", ".git"].includes(name)) continue;
    const target = join(dir, name);
    if (statSync(target).isDirectory()) out.push(...walk(target));
    else out.push(target);
  }
  return out;
}

const required = [
  "prisma/schema.prisma",
  "prisma/sqlite/schema.prisma",
  "prisma/postgres/schema.prisma",
  "prisma/postgres/migrations/20260806000000_postgres_verified_dataset/migration.sql",
  "prisma/postgres/migrations/20260808090000_qr_resets_baseline/migration.sql",
  "prisma/postgres/migrations/20260816113000_single_admin_credentials/migration.sql",
  "prisma/verified-resources.csv",
  "prisma/verified-resources.json",
  "prisma/category-resolution.json",
  "prisma/category-taxonomy.json",
  "supabase/schema.sql",
  "src/proxy.ts",
  "src/app/api/admin/resources/route.ts",
  "src/app/api/admin/resources/[id]/route.ts",
  "src/app/api/admin/resources/import/route.ts",
  "src/app/api/admin/verify-urls/route.ts",
  "src/app/api/qr/requests/route.ts",
  "src/app/api/qr/donations/webhook/route.ts",
  "scripts/seed-verified-resources.mjs",
  "scripts/verify-runtime-env.mjs",
  "scripts/verify-imports.mjs",
  "scripts/verify-syntax.mjs",
  "scripts/release-verify.mjs",
  "tests/export-safety.test.mjs",
  "tests/ssrf.test.mjs",
  "tests/release-contract.test.mjs",
  "railway.toml",
];
for (const item of required) {
  if (!existsSync(join(root, item))) fail(`Missing required file: ${item}`);
}

const files = walk(root);
const forbiddenNames = /(?:\.db$|\.sqlite\d*$|seed-data(?:-.*)?\.ts$|^seed\.ts$|pending-register\.json$|url-verification\.json$)/i;
for (const file of files) {
  const rel = relative(root, file);
  if (forbiddenNames.test(rel.split("/").at(-1) ?? "")) {
    fail(`Obsolete bundled data/runtime file: ${rel}`);
  }
}

const textFiles = files.filter((file) =>
  [".ts", ".tsx", ".js", ".mjs", ".json", ".prisma", ".sql", ".toml", ".md"].includes(extname(file)),
);
const forbiddenContent = [
  ["deleted inline admin state", /setAdminMode/],
  ["obsolete custom SQLite filename", /custom\.db/i],
  ["old hard-coded resource total", /\b674\s+resources\b/i],
  ["hard-coded hotline records", /curated-911|curated-988|CURATED_HOTLINES/],
  ["old TypeScript seed arrays", /SEED_RESOURCES|SEED_ADDITIONS|SEED_MASTER_MERGE/],
];
for (const file of textFiles) {
  const rel = relative(root, file);
  if (rel === "scripts/verify-package.mjs") continue;
  const content = readFileSync(file, "utf8");
  for (const [label, pattern] of forbiddenContent) {
    if (pattern.test(content)) fail(`${rel}: contains ${label}`);
  }
}

const migrationPaths = readdirSync(join(root, "prisma/postgres/migrations"), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => join(root, "prisma/postgres/migrations", entry.name, "migration.sql"))
  .filter((file) => existsSync(file))
  .sort();
const supabasePath = join(root, "supabase/schema.sql");
if (migrationPaths.length && existsSync(supabasePath)) {
  const combined = Buffer.from(migrationPaths.map((file) => readFileSync(file, "utf8").trimEnd()).join("\n\n"));
  const supabase = Buffer.from(readFileSync(supabasePath, "utf8").trimEnd());
  if (!combined.equals(supabase)) {
    fail("supabase/schema.sql differs from ordered Prisma migrations");
  }
}

const payload = JSON.parse(readFileSync(join(root, "prisma/verified-resources.json"), "utf8"));
const csv = readFileSync(join(root, "prisma/verified-resources.csv"));
const EXPECTED_SOURCE_SHA256 = "5e9a8438ee652c9be5b44fb781a2ba94db9dafffddcc720c254bc291aab2d72b";
const csvHash = createHash("sha256").update(csv).digest("hex");
if (csvHash !== EXPECTED_SOURCE_SHA256) fail(`Source CSV hash changed: ${csvHash}`);
if (payload.dataset?.sha256 !== csvHash) fail("Verified CSV and JSON hashes differ");
if (payload.resources?.length !== 114) fail(`Expected 114 resources; found ${payload.resources?.length}`);
if (new Set(payload.resources?.map((row) => row.id)).size !== 114) fail("Resource IDs are not unique");
if (payload.resources?.some((row) => !row.name || !row.category || row.published !== true)) {
  fail("A verified row is missing name/category or is not published");
}

for (const file of files.filter((file) => /src\/app\/api\/admin\/.*\/route\.ts$/.test(file))) {
  const rel = relative(root, file);
  const content = readFileSync(file, "utf8");
  if (!/requireAdmin(?:RateLimited|Response)|getAdminSession/.test(content)) {
    fail(`${rel}: missing server-side admin authorization`);
  }
}

const verifyRoute = readFileSync(join(root, "src/app/api/admin/verify-urls/route.ts"), "utf8");
if (!/verifiableRows/.test(verifyRoute) || /verifyUrls\(rows,/.test(verifyRoute)) {
  fail("URL verifier still passes nullable websites to verifyUrls");
}


// ---- Merged-site contract ---------------------------------------------------
const EXPECTED_QR_CONTENT_SHA256 = "d74917157f39676e1cb54f18460d5347b1d27d603e5e784b426d23d66f2bfa44";
const qrContentPath = join(root, "src/lib/qr-resets-content.ts");
const qrContentHash = createHash("sha256").update(readFileSync(qrContentPath)).digest("hex");
if (qrContentHash !== EXPECTED_QR_CONTENT_SHA256) {
  fail(`QR source-copy module changed unexpectedly: ${qrContentHash}`);
}

const siteSwitcher = readFileSync(join(root, "src/components/shared/site-switcher.tsx"), "utf8");
if (!siteSwitcher.includes('label: "Resource Directory"') || !siteSwitcher.includes('label: "QR Resets™"')) {
  fail("Dual-view switcher labels are missing");
}
const siteRouter = readFileSync(join(root, "src/components/shared/site-router.tsx"), "utf8");
if (!siteRouter.includes("<Directory />") || !siteRouter.includes("<QrSite />")) {
  fail("Root site router is not wired to both views");
}
const qrSite = readFileSync(join(root, "src/components/qr/qr-site.tsx"), "utf8");
if (!qrSite.includes("h-[70vmin] w-[70vmin]") || !qrSite.includes("bndr-hero-halo")) {
  fail("QR hero halo is not a true 70vmin circle using the shared theme-aware halo");
}
if (qrSite.includes("h-[60vmin] w-[90vmin]") || qrSite.includes("ellipse_at_center")) {
  fail("Old oblong QR hero halo remains");
}
const directoryHero = readFileSync(join(root, "src/components/bndr/hero.tsx"), "utf8");
if (!directoryHero.includes("h-[70vmin] w-[70vmin]") || directoryHero.includes("h-[60vmin] w-[90vmin]")) {
  fail("Resource Directory hero halo is not a true 70vmin circle");
}
if (!qrSite.includes("<Logo size={128}") || !qrSite.includes('fetch("/api/qr/requests"')) {
  fail("QR hero logo/request persistence wiring is incomplete");
}
if (!qrSite.includes("NEXT_PUBLIC_QR_DONATE_MONTHLY_URL") || !qrSite.includes("Payment link not configured yet")) {
  fail("QR payment-link safe-disable contract is incomplete");
}
const sharedLogo = readFileSync(join(root, "src/components/shared/logo.tsx"), "utf8");
if (!sharedLogo.includes("BndrLogo") || sharedLogo.includes("QR_LOGO_URL")) {
  fail("QR view is not using the local production BNDR logo");
}
const bndrLogo = readFileSync(join(root, "src/components/bndr/bndr-logo.tsx"), "utf8");
if (!bndrLogo.includes("/bndr-logo-black.png") || !existsSync(join(root, "public/bndr-logo-black.png")) || !existsSync(join(root, "public/bndr-logo-cropped.png"))) {
  fail("Local non-distorted BNDR logo derivatives are missing");
}
const missionConnection = readFileSync(join(root, "src/components/shared/mission-connection.tsx"), "utf8");
if (/675 verified resources/.test(missionConnection)) fail("Stale hard-coded resource count remains in merged UI");
const prismaSchema = readFileSync(join(root, "prisma/schema.prisma"), "utf8");
for (const model of ["AdminCredential", "QrResetRequest", "QrRequestReview", "QrResetCase", "QrDonationEvent"]) {
  if (!prismaSchema.includes(`model ${model} {`)) fail(`Missing Prisma model: ${model}`);
}
const qrMigration = readFileSync(join(root, "prisma/postgres/migrations/20260808090000_qr_resets_baseline/migration.sql"), "utf8");
for (const table of ["QrResetRequest", "QrRequestReview", "QrResetCase", "QrDonationEvent"]) {
  if (!qrMigration.includes(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`)) {
    fail(`QR migration does not enable RLS for ${table}`);
  }
}
const healthRoute = readFileSync(join(root, "src/app/api/health/route.ts"), "utf8");
if (!healthRoute.includes("db.datasetImport.findUnique") || !healthRoute.includes("sourceDatasetHash: EXPECTED_DATASET_SHA256") || !healthRoute.includes("datasetReady") || !healthRoute.includes("persistenceReady()") || !healthRoute.includes("adminConfigured()") || !healthRoute.includes("const ready = dbReady && datasetReady && persistence;") || !healthRoute.includes("status: ready ? 200 : 503")) {
  fail("Health endpoint is not a real DB + dataset + durable-persistence readiness gate with non-blocking admin diagnostics");
}
if (healthRoute.includes("dbReady && datasetReady && persistence && admin")) {
  fail("Admin credentials must not be a Railway deployment health prerequisite");
}
const adminDashboard = readFileSync(join(root, "src/components/bndr/admin-dashboard.tsx"), "utf8");
if (!adminDashboard.includes("<AdminQrRequests />")) fail("Admin QR request review UI is not wired");

for (const doc of ["PRODUCTION_QA.md", "MERGE_MANIFEST.json", "RAILWAY_DEPLOY.md"]) {
  if (!existsSync(join(root, doc))) fail(`Missing release document: ${doc}`);
}

const railwayConfig = readFileSync(join(root, "railway.toml"), "utf8");
if (!/builder\s*=\s*"railpack"/.test(railwayConfig)) fail("Railway builder is not current Railpack");
if (/NIXPACKS/i.test(railwayConfig)) fail("Obsolete Nixpacks builder remains in Railway config");
if (/preDeployCommand/.test(railwayConfig)) fail("Railway preDeployCommand must not initialize volume-backed SQLite because volumes are unavailable pre-deploy");
if (!/startCommand\s*=\s*"npm run start"/.test(railwayConfig)) fail("Railway start command is missing runtime DB initialization path");
if (existsSync(join(root, "nixpacks.toml"))) fail("Obsolete nixpacks.toml remains in production package");

const layoutSource = readFileSync(join(root, "src/app/layout.tsx"), "utf8");
if (/next\/font\/google/.test(layoutSource)) fail("Build-time Google font dependency remains");

const directorySource = readFileSync(join(root, "src/components/bndr/directory.tsx"), "utf8");
if (/Strongest five for your stated need/i.test(directorySource)) fail("Stale strongest-five priority claim remains");

const requestOrigin = readFileSync(join(root, "src/lib/request-origin.ts"), "utf8");
if (!requestOrigin.includes("NEXTAUTH_URL") || !requestOrigin.includes("ORIGIN_REQUIRED") || !requestOrigin.includes("ORIGIN_FORBIDDEN")) {
  fail("Same-origin mutation guard is incomplete");
}
const requireAdmin = readFileSync(join(root, "src/lib/require-admin.ts"), "utf8");
if (!requireAdmin.includes("requireSameOriginMutation(req)")) fail("Admin mutation gate does not enforce same-origin requests");
const qrRequestRoute = readFileSync(join(root, "src/app/api/qr/requests/route.ts"), "utf8");
if (!qrRequestRoute.includes("requireSameOriginMutation(req)")) fail("Public QR request mutation does not enforce same-origin requests");

const publicPending = readFileSync(join(root, "src/app/api/pending/route.ts"), "utf8");
const publicPendingSelect = publicPending.match(/select:\s*\{([^}]*)\}/)?.[1] ?? "";
if (!/name:\s*true/.test(publicPendingSelect) || !/reason:\s*true/.test(publicPendingSelect) || /phone|website|sourceNote|notes/.test(publicPendingSelect)) {
  fail("Public pending register exposes more than bounded name/reason data");
}

const allApiSource = files
  .filter((file) => /src\/app\/api\/.*\/route\.ts$/.test(file))
  .map((file) => readFileSync(file, "utf8"))
  .join("\n");
if (/session\?\.user\?\.email\s*\?\?\s*["']admin["']|session\?\.user\?\.email\s*\|\|\s*["']admin["']/.test(allApiSource)) {
  fail("Synthetic admin actor fallback remains in API audit writes");
}

const globalsCss = readFileSync(join(root, "src/app/globals.css"), "utf8");
if (!globalsCss.includes("--theme-light-background: #F3EDE6;") || !globalsCss.includes("--theme-light-foreground: #111111;")) {
  fail("Day palette no longer preserves literal sand-bone #F3EDE6 + black foreground");
}
if (!globalsCss.includes("--theme-light-primary: #FF355E;") || !globalsCss.includes("--brand-accent: var(--theme-light-primary);")) {
  fail("Day accent is not globally wired to exact #FF355E");
}
if (!globalsCss.includes("--theme-dark-primary: oklch(0.68 0.16 235);") || !globalsCss.includes("--brand-accent: var(--theme-dark-primary);")) {
  fail("Night mode no longer preserves the existing cool-blue accent family");
}
if (!globalsCss.includes("--glass-surface:") || !globalsCss.includes("--shadow-surface:") || !globalsCss.includes(".bndr-glass-panel")) {
  fail("Global dimensional/glass surface tokens are incomplete");
}
if (!globalsCss.includes("circle at center") || globalsCss.includes("ellipse at center")) {
  fail("Hero halo gradient is not explicitly circular");
}

const categoryGrid = readFileSync(join(root, "src/components/bndr/category-grid.tsx"), "utf8");
if (!categoryGrid.includes("CATEGORIES.map") || /sort\([^)]*count|slice\(0,\s*6\)|top 6/i.test(categoryGrid)) {
  fail("Category browser is ranking or truncating categories instead of giving equal default prominence");
}
const categoryPills = readFileSync(join(root, "src/components/bndr/category-pills.tsx"), "utf8");
if (!categoryPills.includes("bndr-filter-pill") || categoryPills.includes("rounded-r-none") || categoryPills.includes("border-l-0")) {
  fail("Category filter pills regressed to asymmetric joined controls");
}
const resourceCardSource = readFileSync(join(root, "src/components/bndr/resource-card.tsx"), "utf8");
if (/md:col-span-2|lg:col-span-3/.test(resourceCardSource) || /tags\.slice\(0,\s*isPriority/.test(resourceCardSource)) {
  fail("Priority resources still receive disproportionate card footprint/content treatment");
}
if (directorySource.includes("FeaturedSpotlight") || !directorySource.includes("pageSize={500}")) {
  fail("Directory still applies a universal featured spotlight or does not render the complete result set");
}
const defaultSearchSource = readFileSync(join(root, "src/lib/search.ts"), "utf8");
if (!defaultSearchSource.includes("a.name.localeCompare(b.name)")) {
  fail("Default all-resources ordering is not neutral alphabetical ordering");
}

const emojiPattern = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u;
for (const file of files.filter((file) => [".ts", ".tsx", ".js", ".mjs", ".md"].includes(extname(file)))) {
  const rel = relative(root, file);
  if (emojiPattern.test(readFileSync(file, "utf8"))) fail(`${rel}: emoji/symbol glyph remains`);
}

const authSource = readFileSync(join(root, "src/lib/auth-options.ts"), "utf8");
const adminCredentialSource = readFileSync(join(root, "src/lib/admin-credentials.ts"), "utf8");
const adminCredentialCore = readFileSync(join(root, "src/lib/admin-credential-core.ts"), "utf8");
const adminCredentialCrypto = readFileSync(join(root, "src/lib/admin-credential-crypto.ts"), "utf8");
if (!adminCredentialSource.includes("process.env.ADMIN_EMAIL") || !adminCredentialSource.includes("process.env.ADMIN_PASSWORD_HASH") || !adminCredentialSource.includes("process.env.ADMIN_PASSWORD")) {
  fail("Persistent admin credentials do not preserve the Railway bootstrap path");
}
if (!adminCredentialSource.includes("process.env.ADMIN_RECOVERY_KEY") || !adminCredentialCore.includes("bootstrapIfMissing") || !adminCredentialCore.includes("credentialVersionMatches")) {
  fail("Single-admin recovery/bootstrap/version foundation is incomplete");
}
if (!authSource.includes("authenticateAdminCredential(email, password)") || !authSource.includes("isAdminCredentialVersionCurrent(token)")) {
  fail("NextAuth is not using persistent credentials and version checks");
}
if (!adminCredentialCrypto.includes("bcrypt.hash") || !adminCredentialCrypto.includes("bcrypt.compare") || !adminCredentialCrypto.includes("timingSafeEqual")) {
  fail("Persistent admin credential cryptography is incomplete");
}
if (/ADMIN_(?:EMAIL|PASSWORD|PASSWORD_HASH|RECOVERY_KEY)\s*=\s*["'][^"']+["']/.test(adminCredentialSource + authSource)) {
  fail("Hard-coded admin credentials detected");
}


// ---- Corrective behavior gates ---------------------------------------------
const rootApi = readFileSync(join(root, "src/app/api/route.ts"), "utf8");
if (!rootApi.includes('version: "1.1.4"')) fail("Root API version is not 1.1.4");
const searchEngine = readFileSync(join(root, "src/lib/search.ts"), "utf8");
if (!searchEngine.includes("return sorted.slice(offset, offset + limit)")) fail("Empty-query search does not honor pagination");
if (searchEngine.includes("Fuzzy + Semantic Search Engine")) fail("Search implementation is still mislabeled semantic");
const directory = readFileSync(join(root, "src/components/bndr/directory.tsx"), "utf8");
if (!directory.includes("isError") || !directory.includes("Resource directory unavailable") || !directory.includes("[query, addSearch]")) {
  fail("Directory error-state/search-history loop correction is incomplete");
}
const urlVerify = readFileSync(join(root, "src/lib/url-verify.ts"), "utf8");
if (!urlVerify.includes('| "restricted"') || !urlVerify.includes('| "server-error"') || !urlVerify.includes("verified: byStatus.live")) {
  fail("URL verification status/count truthfulness correction is incomplete");
}
const urlVerifyRoute = readFileSync(join(root, "src/app/api/admin/verify-urls/route.ts"), "utf8");
if (!urlVerifyRoute.includes("readBoundedJson") || !urlVerifyRoute.includes("urlVerifyCommandSchema") || !urlVerifyRoute.includes("verified: mergedStatus.live")) {
  fail("URL verification API bounded/merged-report correction is incomplete");
}
const linkAudit = readFileSync(join(root, "src/components/bndr/admin-link-audit.tsx"), "utf8");
if (!linkAudit.includes("hasActiveViewFilter ? filtered : results") || !linkAudit.includes("find((item) => item.resourceId === id)")) {
  fail("Link Audit filtered-export/recheck correction is incomplete");
}
const publishRoute = readFileSync(join(root, "src/app/api/admin/publish/route.ts"), "utf8");
if (!publishRoute.includes("db.$transaction") || !publishRoute.includes("before: { published:") || !publishRoute.includes("after: { published:")) {
  fail("Publish mutation/audit is not transactional with before/after evidence");
}
const cleanupRoute = readFileSync(join(root, "src/app/api/admin/cleanup/route.ts"), "utf8");
if (!cleanupRoute.includes("db.$transaction") || !cleanupRoute.includes('action: "piipass-resource"')) {
  fail("Cleanup mutation/audit transaction gate is incomplete");
}
const hotlineRoute = readFileSync(join(root, "src/app/api/hotlines/route.ts"), "utf8");
if (!hotlineRoute.includes("verified: true") || !hotlineRoute.includes("phoneNormalized: { not: null }") || !hotlineRoute.includes("phoneRaw: { not: null }")) {
  fail("Public hotline endpoint is not restricted to published verified contactable rows");
}
for (const boundary of ["src/app/error.tsx", "src/app/not-found.tsx", "src/app/loading.tsx"]) {
  if (!existsSync(join(root, boundary))) fail(`Missing route-level failure/loading boundary: ${boundary}`);
}
if (!existsSync(join(root, ".npmrc")) || !readFileSync(join(root, ".npmrc"), "utf8").includes("registry=https://registry.npmjs.org/")) {
  fail("Public npm registry contract is missing from .npmrc");
}

const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
if (!String(packageJson.engines?.node ?? "").startsWith(">=22")) fail("Node 22+ engine missing");
if (packageJson.packageManager !== "npm@10.9.2") fail("Deterministic npm package-manager declaration missing");
if (packageJson.scripts?.build !== "npm run db:generate && npm run verify:prebuild && npm run build:next") fail("Production build does not generate the selected Prisma backend before verification and Next build");
if (!String(packageJson.scripts?.["verify:prebuild"] ?? "").includes("npm run verify:syntax") || !String(packageJson.scripts?.["verify:prebuild"] ?? "").includes("npm run test:contracts") || !String(packageJson.scripts?.["verify:prebuild"] ?? "").includes("npm run typecheck")) fail("Prebuild verification is missing syntax, contract tests, or typecheck");
if (!packageJson.scripts?.["verify:release"]) fail("Release verification command missing");
if (packageJson.scripts?.start !== "node scripts/start-production.mjs") fail("Production start does not initialize the Railway backend before launching standalone Next");
if (!packageJson.scripts?.["db:seed:verified"]) fail("Source dataset seed command missing");
if (packageJson.scripts?.["db:prepare"] !== "node scripts/prepare-database.mjs") {
  fail("Database preparation script is not backend-aware");
}
const storageBackendSource = readFileSync(join(root, "scripts/storage-backend.mjs"), "utf8");
if (!storageBackendSource.includes('STORAGE_BACKEND || "sqlite"') || !storageBackendSource.includes("RAILWAY_VOLUME_MOUNT_PATH")) {
  fail("Railway-local SQLite is not the explicit default persistence backend");
}
const startProductionSource = readFileSync(join(root, "scripts/start-production.mjs"), "utf8");
if (!startProductionSource.includes("Railway SQLite mode requires an attached persistent volume") || !startProductionSource.includes('["db", "push"') || !startProductionSource.includes("seed-verified-resources.mjs")) {
  fail("Production start does not enforce durable Railway SQLite + schema + seed initialization");
}

const seedScript = readFileSync(join(root, "scripts/seed-verified-resources.mjs"), "utf8");
if (/\.deleteMany\s*\(/.test(seedScript)) {
  fail("Deployment seed contains a destructive deleteMany call");
}
if (!seedScript.includes("tx.resource.upsert") || !seedScript.includes("tx.category.upsert") || !seedScript.includes("tx.datasetImport.upsert")) {
  fail("Deployment seed is not additive/idempotent for packaged rows");
}

const resourceService = readFileSync(join(root, "src/lib/resource-service.ts"), "utf8");
if (/actor\s*=\s*["']admin["']/.test(resourceService)) {
  fail("Resource mutation service still permits a synthetic hard-coded admin actor");
}
for (const mutationRoute of [
  "src/app/api/admin/resources/route.ts",
  "src/app/api/admin/resources/[id]/route.ts",
  "src/app/api/admin/resources/import/route.ts",
  "src/app/api/admin/verify-urls/route.ts",
  "src/app/api/admin/spam-check/route.ts",
]) {
  const content = readFileSync(join(root, mutationRoute), "utf8");
  if (/actor:\s*["']admin["']/.test(content)) {
    fail(`${mutationRoute}: audit actor is still hard-coded as admin`);
  }
}
const piiPipeline = readFileSync(join(root, "src/lib/pii.ts"), "utf8");
for (const rawPiiTemplate of ["${input.phoneRaw}", "${rawEmail}", "${rawSite}"]) {
  if (piiPipeline.includes(rawPiiTemplate)) {
    fail(`PII normalization notes still interpolate raw contact data: ${rawPiiTemplate}`);
  }
}

if (failures.length) {
  console.error(`BNDR package verification FAILED (${failures.length})`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log("BNDR package verification PASS");
console.log(`Files scanned: ${files.length}`);
const sourceVerified = payload.resources.filter((row) => row.verified === true).length;
console.log(`Dataset rows: ${payload.resources.length}`);
console.log(`Source-verified flags: ${sourceVerified}`);
console.log(`Dataset SHA-256: ${csvHash}`);
