import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("QueryProvider is global and not duplicated on the public root", () => {
  const providers = read("src/components/providers.tsx");
  const page = read("src/app/page.tsx");
  assert.match(providers, /<SessionProvider>[\s\S]*<QueryProvider>\{children\}<\/QueryProvider>[\s\S]*<\/SessionProvider>/);
  assert.doesNotMatch(page, /QueryProvider/);
  assert.match(page, /<LinkStatusProvider>[\s\S]*<SkipToMain \/>[\s\S]*<SiteRouter \/>/);
});

test("QR request preview performs no client network submission", () => {
  const qr = read("src/components/qr/qr-site.tsx");
  assert.doesNotMatch(qr, /fetch\(["']\/api\/qr\/requests/);
  assert.match(qr, /Nothing entered here is submitted, transmitted, or stored/);
  assert.match(qr, /Prototype preview only/);
});

test("QR public request route is a hard no-write boundary", () => {
  const route = read("src/app/api/qr/requests/route.ts");
  assert.doesNotMatch(route, /from ["']@\/lib\/db["']/);
  assert.doesNotMatch(route, /qrResetRequest\.(create|update|upsert|delete)/);
  assert.match(route, /demoOnly: true/);
  assert.match(route, /status: 503/);
});

test("QR donation UI and webhook cannot activate payments", () => {
  const qr = read("src/components/qr/qr-site.tsx");
  const route = read("src/app/api/qr/donations/webhook/route.ts");
  assert.doesNotMatch(qr, /NEXT_PUBLIC_QR_DONATE_/);
  assert.doesNotMatch(route, /from ["']@\/lib\/db["']/);
  assert.doesNotMatch(route, /qrDonationEvent\.(create|update|upsert|delete)/);
  assert.match(route, /demoOnly: true/);
});

test("admin exposes no operational QR request queue", () => {
  const dashboard = read("src/components/bndr/admin-dashboard.tsx");
  const adminRoute = read("src/app/api/admin/qr/requests/[id]/route.ts");
  assert.doesNotMatch(dashboard, /AdminQrRequests/);
  assert.doesNotMatch(dashboard, /value="qr-requests"/);
  assert.doesNotMatch(adminRoute, /qrResetRequest\.(create|update|upsert|delete)/);
});

test("standalone non-root views have explicit return paths", () => {
  const login = read("src/components/bndr/admin-login-form.tsx");
  const admin = read("src/app/admin/page.tsx");
  const notFound = read("src/app/not-found.tsx");
  const error = read("src/app/error.tsx");
  for (const source of [login, admin, notFound, error]) {
    assert.match(source, /Back to ResourceCite/);
  }
});

test("fresh site state always starts on ResourceCite", () => {
  const site = read("src/lib/use-site.ts");
  assert.match(site, /site: "bndr"/);
});


test("light is the global default while the cool-blue dark palette remains mobile-accessible", () => {
  const layout = read("src/app/layout.tsx");
  const css = read("src/app/globals.css");
  const bndrHeader = read("src/components/bndr/site-header.tsx");
  const qrNav = read("src/components/qr/qr-nav.tsx");
  assert.match(layout, /defaultTheme="light"/);
  assert.match(css, /--theme-light-primary:\s*#FF355E/);
  assert.match(css, /--theme-dark-primary:\s*oklch\(0\.68 0\.16 235\)/);
  assert.match(bndrHeader, /md:hidden[\s\S]*<ThemeToggle \/>/);
  assert.match(qrNav, /<ThemeToggle \/>[\s\S]*<SiteSwitcher compact \/>/);
});
