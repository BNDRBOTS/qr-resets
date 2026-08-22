import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ensurePersistentAdminCredential,
  verifyPersistentAdminRecovery,
} from "../src/lib/admin-credential-core.ts";
import { performAdminEmailRecovery } from "../src/lib/admin-recovery-client.ts";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

class MemoryAdminStore {
  state = null;
  async get() { return this.state ? { ...this.state } : null; }
  async bootstrapIfMissing(input) {
    if (!this.state) this.state = { ...input };
    return { ...this.state };
  }
  async setRecoveryKeyHashIfMissing(hash) {
    if (!this.state) throw new Error("missing state");
    if (!this.state.recoveryKeyHash) this.state.recoveryKeyHash = hash;
    return { ...this.state };
  }
  async replacePassword(passwordHash) {
    if (!this.state) throw new Error("missing state");
    this.state = {
      ...this.state,
      passwordHash,
      credentialVersion: this.state.credentialVersion + 1,
    };
    return { ...this.state };
  }
}

const fakeCrypto = {
  async hashPassword(password) { return `bcrypt:${password}`; },
  async verifyPassword(password, hash) { return hash === `bcrypt:${password}`; },
  isPasswordHash(value) { return value.startsWith("bcrypt:"); },
  hashRecoveryKey(value) { return `digest:${value}`; },
  verifyRecoveryKey(value, hash) { return hash === `digest:${value}`; },
};

const recoveryKey = "recovery-key-abcdefghijklmnopqrstuvwxyz";

function deps(store) {
  return {
    store,
    crypto: fakeCrypto,
    env: {
      adminEmail: "admin@example.org",
      adminPassword: "old-password-123",
      adminRecoveryKey: recoveryKey,
    },
  };
}

test("invalid recovery proof does not disclose the administrator email", async () => {
  const store = new MemoryAdminStore();
  await ensurePersistentAdminCredential(deps(store));
  const result = await verifyPersistentAdminRecovery(
    deps(store),
    "wrong-recovery-key-abcdefghijklmnopqrstuvwxyz",
  );
  assert.deepEqual(result, { kind: "invalid-recovery" });

  const client = await performAdminEmailRecovery("wrong-key", async () => ({
    ok: false,
    status: 401,
    async json() { return { error: { code: "RECOVERY_DENIED", message: "Recovery credentials were not accepted." } }; },
  }));
  assert.deepEqual(client, { kind: "denied" });
  assert.equal(JSON.stringify(client).includes("admin@example.org"), false);
});

test("email recovery attempts use the shared recovery-proof rate limit and map 429 without disclosure", async () => {
  const route = read("src/app/api/admin-recovery/email/route.ts");
  assert.match(route, /RATE_LIMITS\.adminRecoveryProof/);
  assert.match(route, /requireSameOriginMutation\(req\)/);

  const result = await performAdminEmailRecovery(recoveryKey, async () => ({
    ok: false,
    status: 429,
    async json() { return { error: { code: "RATE_LIMITED" } }; },
  }));
  assert.deepEqual(result, { kind: "rate-limited" });
});

test("successful recovery proof returns the canonical single-admin email", async () => {
  const store = new MemoryAdminStore();
  await ensurePersistentAdminCredential(deps(store));
  const proof = await verifyPersistentAdminRecovery(deps(store), recoveryKey);
  assert.equal(proof.kind, "success");
  if (proof.kind !== "success") throw new Error("proof failed");
  assert.equal(proof.admin.email, "admin@example.org");

  const client = await performAdminEmailRecovery(recoveryKey, async () => ({
    ok: true,
    status: 200,
    async json() { return { ok: true, email: proof.admin.email }; },
  }));
  assert.deepEqual(client, { kind: "success", email: "admin@example.org" });
});

test("email is absent from URLs, logs, health paths, and every failed recovery response", () => {
  const route = read("src/app/api/admin-recovery/email/route.ts");
  const client = read("src/lib/admin-recovery-client.ts");
  const health = read("src/app/api/health/route.ts");

  assert.match(client, /fetcher\("\/api\/admin-recovery\/email"/);
  assert.doesNotMatch(client, /admin-recovery\/email\?[^\n]*email/);
  assert.doesNotMatch(route, /console\.(?:log|error)\([^\n]*(?:recovery\.admin\.email|parsed\.data|recoveryKey)/);
  assert.doesNotMatch(route, /jsonError\([^\n]*email/);
  assert.doesNotMatch(health, /\b(?:adminEmail|email)\s*:/);
  assert.match(route, /\{ ok: true, email: recovery\.admin\.email \}/);
});

test("login clearly explains username=email and recovered flow returns to normal sign in", () => {
  const login = read("src/components/bndr/admin-login-form.tsx");
  const form = read("src/components/bndr/admin-forgot-email-form.tsx");

  assert.match(login, /Forgot email \/ username\?/);
  assert.match(login, /AdminForgotEmailForm/);
  assert.match(form, /Your username is the admin email used to sign in\./);
  assert.match(form, /Admin email \(username\)/);
  assert.match(form, /Back to sign in/);
  assert.match(form, /onClick=\{onCancel\}/);
  assert.doesNotMatch(form, /console\./);
});
