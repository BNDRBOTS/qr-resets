import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  authenticatePersistentAdmin,
  credentialVersionMatches,
  ensurePersistentAdminCredential,
  resetPersistentAdminPasswordWithGrant,
  verifyPersistentAdminRecovery,
  SINGLE_ADMIN_CREDENTIAL_ID,
} from "../src/lib/admin-credential-core.ts";
import {
  issueAdminRecoveryTicket,
  verifyAdminRecoveryTicket,
  ADMIN_RECOVERY_TICKET_TTL_MS,
} from "../src/lib/admin-recovery-ticket-core.ts";
import {
  applyAdminRoleToSession,
  applyAdminRoleToToken,
  isAdminSession,
  isAdminToken,
} from "../src/lib/admin-auth-core.ts";
import {
  performAdminPasswordReset,
  performAdminRecoveryProof,
} from "../src/lib/admin-recovery-client.ts";

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

function deps(store, env = {}) {
  return { store, crypto: fakeCrypto, env };
}

const recoveryKey = "recovery-key-abcdefghijklmnopqrstuvwxyz";
const signingSecret = "a".repeat(64);

test("forgot-password UI exposes recovery action without changing the login architecture", () => {
  const login = read("src/components/bndr/admin-login-form.tsx");
  const recovery = read("src/components/bndr/admin-forgot-password-form.tsx");
  assert.match(login, /Forgot password\?/);
  assert.match(login, /AdminForgotPasswordForm/);
  assert.match(recovery, /Recovery key/);
  assert.match(recovery, /New password/);
  assert.match(recovery, /Confirm new password/);
  assert.match(recovery, /Back to sign in/);
  assert.doesNotMatch(recovery, /ADMIN_EMAIL|ADMIN_PASSWORD|process\.env/);
});

test("recovery proof client handles success, denial, rate limit, malformed response, and network failure", async () => {
  const success = await performAdminRecoveryProof(recoveryKey, async () => ({
    ok: true,
    status: 200,
    async json() { return { ok: true, resetToken: "signed.ticket", expiresInSeconds: 600 }; },
  }));
  assert.deepEqual(success, { kind: "success", resetToken: "signed.ticket", expiresInSeconds: 600 });

  const denied = await performAdminRecoveryProof(recoveryKey, async () => ({
    ok: false,
    status: 401,
    async json() { return { error: { code: "RECOVERY_DENIED" } }; },
  }));
  assert.deepEqual(denied, { kind: "denied" });

  const limited = await performAdminRecoveryProof(recoveryKey, async () => ({
    ok: false,
    status: 429,
    async json() { return { error: { code: "RATE_LIMITED" } }; },
  }));
  assert.deepEqual(limited, { kind: "rate-limited" });

  assert.deepEqual(
    await performAdminRecoveryProof(recoveryKey, async () => ({
      ok: true,
      status: 200,
      async json() { return { ok: true }; },
    })),
    { kind: "unavailable" },
  );
  assert.deepEqual(
    await performAdminRecoveryProof(recoveryKey, async () => { throw new TypeError("offline"); }),
    { kind: "unavailable" },
  );
});

test("password reset client maps expired, weak, rate-limited and successful responses without sensitive detail", async () => {
  for (const [code, expected] of [
    ["RECOVERY_EXPIRED", "expired"],
    ["RECOVERY_DENIED", "denied"],
    ["WEAK_PASSWORD", "weak-password"],
    ["RATE_LIMITED", "rate-limited"],
  ]) {
    const result = await performAdminPasswordReset("ticket", "new-password-456", async () => ({
      ok: false,
      status: code === "RATE_LIMITED" ? 429 : code === "WEAK_PASSWORD" ? 400 : 401,
      async json() { return { error: { code } }; },
    }));
    assert.deepEqual(result, { kind: expected });
  }

  assert.deepEqual(
    await performAdminPasswordReset("ticket", "new-password-456", async () => ({
      ok: true,
      status: 200,
      async json() { return { ok: true }; },
    })),
    { kind: "success" },
  );
});

test("signed recovery grants expire, reject tampering, and are bound to credential version", () => {
  const now = 1_700_000_000_000;
  const grant = { id: SINGLE_ADMIN_CREDENTIAL_ID, email: "admin@example.org", credentialVersion: 1 };
  const token = issueAdminRecoveryTicket(signingSecret, grant, now);

  assert.deepEqual(verifyAdminRecoveryTicket(signingSecret, token, now + 1), {
    kind: "success",
    grant,
  });
  assert.deepEqual(
    verifyAdminRecoveryTicket(signingSecret, `${token.slice(0, -1)}x`, now + 1),
    { kind: "invalid" },
  );
  assert.deepEqual(
    verifyAdminRecoveryTicket(signingSecret, token, now + ADMIN_RECOVERY_TICKET_TTL_MS),
    { kind: "expired" },
  );
});

test("complete recovery flow: proof -> reset -> old rejected -> new accepted -> admin gate accessible", async () => {
  const store = new MemoryAdminStore();
  const initial = await ensurePersistentAdminCredential(
    deps(store, {
      adminEmail: "admin@example.org",
      adminPassword: "old-password-123",
      adminRecoveryKey: recoveryKey,
    }),
  );
  assert.equal(initial.credentialVersion, 1);

  const proof = await verifyPersistentAdminRecovery(deps(store), recoveryKey);
  assert.equal(proof.kind, "success");
  if (proof.kind !== "success") throw new Error("proof failed");

  const ticket = issueAdminRecoveryTicket(signingSecret, proof.admin, 1000);
  const verified = verifyAdminRecoveryTicket(signingSecret, ticket, 1001);
  assert.equal(verified.kind, "success");
  if (verified.kind !== "success") throw new Error("ticket failed");

  const reset = await resetPersistentAdminPasswordWithGrant(
    deps(store),
    verified.grant,
    "new-password-456",
  );
  assert.deepEqual(reset, { kind: "success", credentialVersion: 2 });

  assert.equal(
    await authenticatePersistentAdmin(deps(store), "admin@example.org", "old-password-123"),
    null,
  );
  const authenticated = await authenticatePersistentAdmin(
    deps(store),
    "admin@example.org",
    "new-password-456",
  );
  assert.deepEqual(authenticated, {
    id: SINGLE_ADMIN_CREDENTIAL_ID,
    email: "admin@example.org",
    credentialVersion: 2,
  });

  const current = await store.get();
  assert.equal(
    credentialVersionMatches({ email: "admin@example.org", credentialVersion: 1 }, current),
    false,
  );
  assert.equal(credentialVersionMatches(authenticated, current), true);

  const token = applyAdminRoleToToken(
    { sub: authenticated.id },
    { role: "admin", email: authenticated.email, credentialVersion: authenticated.credentialVersion },
  );
  assert.equal(isAdminToken(token), true);
  const session = applyAdminRoleToSession({ user: { email: authenticated.email } }, token);
  assert.equal(isAdminSession(session), true);
  assert.match(read("src/app/admin/page.tsx"), /isAdminSession\(session\)/);
});

test("a recovery grant cannot be replayed after a successful password reset", async () => {
  const store = new MemoryAdminStore();
  await ensurePersistentAdminCredential(
    deps(store, {
      adminEmail: "admin@example.org",
      adminPassword: "old-password-123",
      adminRecoveryKey: recoveryKey,
    }),
  );
  const proof = await verifyPersistentAdminRecovery(deps(store), recoveryKey);
  if (proof.kind !== "success") throw new Error("proof failed");

  assert.deepEqual(
    await resetPersistentAdminPasswordWithGrant(deps(store), proof.admin, "new-password-456"),
    { kind: "success", credentialVersion: 2 },
  );
  assert.deepEqual(
    await resetPersistentAdminPasswordWithGrant(deps(store), proof.admin, "third-password-789"),
    { kind: "invalid-recovery" },
  );
});

test("recovery endpoints are same-origin protected, independently rate-limited, bounded, and avoid recovery-key echo", () => {
  const verifyRoute = read("src/app/api/admin-recovery/verify/route.ts");
  const resetRoute = read("src/app/api/admin-recovery/password/route.ts");
  assert.match(verifyRoute, /requireSameOriginMutation\(req\)/);
  assert.match(resetRoute, /requireSameOriginMutation\(req\)/);
  assert.match(verifyRoute, /RATE_LIMITS\.adminRecoveryProof/);
  assert.match(resetRoute, /RATE_LIMITS\.adminRecoveryReset/);
  assert.match(verifyRoute, /readBoundedJson\(req, BODY_LIMITS\.adminRecovery\)/);
  assert.match(resetRoute, /readBoundedJson\(req, BODY_LIMITS\.adminRecovery\)/);
  assert.doesNotMatch(resetRoute, /parsed\.data\.recoveryKey/);
  assert.doesNotMatch(verifyRoute, /console\.(?:log|error)\([^\n]*(?:recoveryKey|parsed\.data)/);
  assert.doesNotMatch(resetRoute, /console\.(?:log|error)\([^\n]*(?:resetToken|newPassword|parsed\.data)/);
});
