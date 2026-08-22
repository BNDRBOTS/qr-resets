import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  classifyAdminSignInResponse,
  performAdminSignIn,
  readAdminLoginCredentials,
} from "../src/lib/admin-login-client.ts";
import {
  ADMIN_AUTH_ERROR,
  applyAdminRoleToSession,
  applyAdminRoleToToken,
  isAdminSession,
  isAdminToken,
} from "../src/lib/admin-auth-core.ts";

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

function formData(email, password) {
  const data = new FormData();
  data.set("email", email);
  data.set("password", password);
  return data;
}

test("manually typed credentials are read from the submitted browser form", () => {
  assert.deepEqual(
    readAdminLoginCredentials(formData(" Admin@Example.org ", "typed-password")),
    { email: "Admin@Example.org", password: "typed-password" },
  );
});

test("browser-autofilled credentials are accepted from DOM FormData without React field state", () => {
  const credentials = readAdminLoginCredentials(
    formData("autofill@example.org", "password-manager-value"),
  );
  assert.deepEqual(credentials, {
    email: "autofill@example.org",
    password: "password-manager-value",
  });

  const component = read("src/components/bndr/admin-login-form.tsx");
  assert.match(component, /new FormData\(e\.currentTarget\)/);
  assert.doesNotMatch(component, /value=\{email\}|value=\{password\}/);
  assert.doesNotMatch(component, /onChange=\{[^}]*setEmail|onChange=\{[^}]*setPassword/);
});

test("wrong credentials remain opaque to the client", () => {
  assert.deepEqual(
    classifyAdminSignInResponse({
      error: "CredentialsSignin",
      status: 401,
      ok: false,
      url: null,
    }),
    { kind: "invalid-credentials" },
  );

  const component = read("src/components/bndr/admin-login-form.tsx");
  assert.match(component, /Invalid email or password\./);
  assert.doesNotMatch(component, /email (?:does not exist|not found)|password (?:is wrong|incorrect)/i);
});

test("rate limiting is distinguishable from bad credentials without credential leakage", () => {
  assert.equal(ADMIN_AUTH_ERROR.RATE_LIMITED, "RateLimited");
  assert.deepEqual(
    classifyAdminSignInResponse({
      error: ADMIN_AUTH_ERROR.RATE_LIMITED,
      status: 401,
      ok: false,
      url: null,
    }),
    { kind: "rate-limited" },
  );

  const auth = read("src/lib/auth-options.ts");
  assert.match(auth, /throw new Error\(ADMIN_AUTH_ERROR\.RATE_LIMITED\)/);
  assert.match(auth, /throw new Error\(ADMIN_AUTH_ERROR\.UNAVAILABLE\)/);
});

test("failed authentication requests return an unavailable result instead of hanging", async () => {
  const result = await performAdminSignIn(
    { email: "admin@example.org", password: "secret" },
    "/admin",
    async () => {
      throw new TypeError("network unavailable");
    },
  );
  assert.deepEqual(result, { kind: "unavailable" });

  const component = read("src/components/bndr/admin-login-form.tsx");
  assert.match(component, /try\s*\{/);
  assert.match(component, /finally\s*\{\s*setLoading\(false\)/);
});

test("empty or malformed NextAuth responses fail closed", () => {
  assert.deepEqual(classifyAdminSignInResponse(undefined), { kind: "unavailable" });
  assert.deepEqual(classifyAdminSignInResponse(null), { kind: "unavailable" });
  assert.deepEqual(classifyAdminSignInResponse({ ok: true, url: null }), {
    kind: "unavailable",
  });
  assert.deepEqual(classifyAdminSignInResponse({ ok: false, url: "/admin" }), {
    kind: "unavailable",
  });
});

test("successful sign-in uses exact submitted credentials and callback URL", async () => {
  let seen = null;
  const result = await performAdminSignIn(
    { email: "admin@example.org", password: "exact password" },
    "/admin",
    async (options) => {
      seen = options;
      return { error: null, status: 200, ok: true, url: "/admin" };
    },
  );

  assert.deepEqual(seen, {
    email: "admin@example.org",
    password: "exact password",
    redirect: false,
    callbackUrl: "/admin",
  });
  assert.deepEqual(result, { kind: "success", url: "/admin" });
});

test("successful auth callback creates an admin session accepted by both admin gates", () => {
  const token = applyAdminRoleToToken(
    { sub: "admin@example.org" },
    { role: "admin", email: "admin@example.org", credentialVersion: 1 },
  );
  assert.equal(token.role, "admin");
  assert.equal(token.email, "admin@example.org");
  assert.equal(token.credentialVersion, 1);
  assert.equal(isAdminToken(token), true);

  const session = applyAdminRoleToSession(
    { user: { email: "admin@example.org" } },
    token,
  );
  assert.equal(session.user?.role, "admin");
  assert.equal(isAdminSession(session), true);

  const adminPage = read("src/app/admin/page.tsx");
  const proxy = read("src/proxy.ts");
  assert.match(adminPage, /isAdminSession\(session\)/);
  assert.match(proxy, /isAdminToken\(token\)/);
});

test("non-admin sessions remain rejected", () => {
  const session = applyAdminRoleToSession(
    { user: { email: "someone@example.org", role: "admin" } },
    { role: "user" },
  );
  assert.equal("role" in session.user, false);
  assert.equal(isAdminSession(session), false);
  assert.equal(isAdminToken({ role: "user", credentialVersion: 1 }), false);
  assert.equal(isAdminToken({ role: "admin" }), false);
});

test("login control disables only while an authentication request is running", () => {
  const component = read("src/components/bndr/admin-login-form.tsx");
  assert.match(component, /if \(!credentials\)[\s\S]*return;[\s\S]*setLoading\(true\)/);
  assert.match(component, /<Button type="submit" className="w-full" disabled=\{loading\}>/);
  assert.doesNotMatch(component, /disabled=\{loading \|\| !email \|\| !password\}/);
});
