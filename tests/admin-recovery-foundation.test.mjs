import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  authenticatePersistentAdmin,
  credentialVersionMatches,
  ensurePersistentAdminCredential,
  resetPersistentAdminPassword,
  verifyPersistentAdminRecovery,
  SINGLE_ADMIN_CREDENTIAL_ID,
} from "../src/lib/admin-credential-core.ts";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

class MemoryAdminStore {
  constructor(state = null) {
    this.state = state ? structuredClone(state) : null;
  }

  async get() {
    return this.state ? structuredClone(this.state) : null;
  }

  async bootstrapIfMissing(input) {
    if (!this.state) this.state = structuredClone(input);
    return structuredClone(this.state);
  }

  async setRecoveryKeyHashIfMissing(hash) {
    if (!this.state) throw new Error("missing admin state");
    if (!this.state.recoveryKeyHash) this.state.recoveryKeyHash = hash;
    return structuredClone(this.state);
  }

  async replacePassword(passwordHash) {
    if (!this.state) throw new Error("missing admin state");
    this.state.passwordHash = passwordHash;
    this.state.credentialVersion += 1;
    return structuredClone(this.state);
  }
}

const fakeCrypto = {
  async hashPassword(password) {
    return `bcrypt:${password}`;
  },
  async verifyPassword(password, hash) {
    return hash === `bcrypt:${password}`;
  },
  isPasswordHash(value) {
    return value.startsWith("bcrypt:");
  },
  hashRecoveryKey(value) {
    return `digest:${value}`;
  },
  verifyRecoveryKey(value, hash) {
    return hash === `digest:${value}`;
  },
};

function deps(store, env) {
  return { store, crypto: fakeCrypto, env };
}

const recoveryKey = "recovery-key-abcdefghijklmnopqrstuvwxyz";

test("legacy Railway credentials bootstrap one persistent admin record", async () => {
  const store = new MemoryAdminStore();
  const state = await ensurePersistentAdminCredential(
    deps(store, {
      adminEmail: " Admin@Example.org ",
      adminPassword: "initial-password",
      adminRecoveryKey: recoveryKey,
    }),
  );

  assert.deepEqual(state, {
    id: SINGLE_ADMIN_CREDENTIAL_ID,
    email: "admin@example.org",
    passwordHash: "bcrypt:initial-password",
    recoveryKeyHash: `digest:${recoveryKey}`,
    credentialVersion: 1,
  });
  assert.notEqual(state.passwordHash, "initial-password");
  assert.notEqual(state.recoveryKeyHash, recoveryKey);
});

test("persistent credential wins across restart and stale env cannot roll password back", async () => {
  const store = new MemoryAdminStore();
  await ensurePersistentAdminCredential(
    deps(store, {
      adminEmail: "admin@example.org",
      adminPassword: "first-password",
      adminRecoveryKey: recoveryKey,
    }),
  );

  const restarted = await ensurePersistentAdminCredential(
    deps(store, {
      adminEmail: "different@example.org",
      adminPassword: "stale-railway-password",
      adminRecoveryKey: "different-recovery-key-abcdefghijklmnopqrstuvwxyz",
    }),
  );

  assert.equal(restarted.email, "admin@example.org");
  assert.equal(restarted.passwordHash, "bcrypt:first-password");
  assert.equal(restarted.recoveryKeyHash, `digest:${recoveryKey}`);
  assert.equal(restarted.credentialVersion, 1);
});

test("an unusable optional recovery key fails closed for recovery without breaking login", async () => {
  const store = new MemoryAdminStore();
  const state = await ensurePersistentAdminCredential(
    deps(store, {
      adminEmail: "admin@example.org",
      adminPassword: "initial-password",
      adminRecoveryKey: "too-short",
    }),
  );
  assert.equal(state.recoveryKeyHash, null);
  assert.deepEqual(
    await authenticatePersistentAdmin(
      deps(store, { adminRecoveryKey: "still-short" }),
      "admin@example.org",
      "initial-password",
    ),
    {
      id: SINGLE_ADMIN_CREDENTIAL_ID,
      email: "admin@example.org",
      credentialVersion: 1,
    },
  );
  assert.deepEqual(
    await verifyPersistentAdminRecovery(deps(store, {}), recoveryKey),
    { kind: "recovery-unavailable" },
  );
});

test("existing admin may adopt a recovery key once without replacing credentials", async () => {
  const store = new MemoryAdminStore();
  await ensurePersistentAdminCredential(
    deps(store, {
      adminEmail: "admin@example.org",
      adminPassword: "initial-password",
    }),
  );

  const withRecovery = await ensurePersistentAdminCredential(
    deps(store, {
      adminEmail: "ignored@example.org",
      adminPassword: "ignored-password",
      adminRecoveryKey: recoveryKey,
    }),
  );

  assert.equal(withRecovery.email, "admin@example.org");
  assert.equal(withRecovery.passwordHash, "bcrypt:initial-password");
  assert.equal(withRecovery.recoveryKeyHash, `digest:${recoveryKey}`);
  assert.equal(withRecovery.credentialVersion, 1);
});

test("recovery proof can be verified independently for later username recovery without mutation", async () => {
  const store = new MemoryAdminStore();
  await ensurePersistentAdminCredential(
    deps(store, {
      adminEmail: "admin@example.org",
      adminPassword: "old-password-123",
      adminRecoveryKey: recoveryKey,
    }),
  );

  assert.deepEqual(
    await verifyPersistentAdminRecovery(deps(store, {}), recoveryKey),
    {
      kind: "success",
      admin: {
        id: SINGLE_ADMIN_CREDENTIAL_ID,
        email: "admin@example.org",
        credentialVersion: 1,
      },
    },
  );
  assert.deepEqual(
    await verifyPersistentAdminRecovery(
      deps(store, {}),
      "wrong-recovery-key-abcdefghijklmnopqrstuvwxyz",
    ),
    { kind: "invalid-recovery" },
  );
  assert.equal((await store.get()).credentialVersion, 1);
});

test("wrong recovery credential fails closed without changing password or version", async () => {
  const store = new MemoryAdminStore();
  await ensurePersistentAdminCredential(
    deps(store, {
      adminEmail: "admin@example.org",
      adminPassword: "old-password-123",
      adminRecoveryKey: recoveryKey,
    }),
  );

  const result = await resetPersistentAdminPassword(
    deps(store, {}),
    "wrong-recovery-key-abcdefghijklmnopqrstuvwxyz",
    "new-password-456",
  );
  assert.deepEqual(result, { kind: "invalid-recovery" });

  const state = await store.get();
  assert.equal(state.passwordHash, "bcrypt:old-password-123");
  assert.equal(state.credentialVersion, 1);
});

test("successful password recovery changes bcrypt material and increments credential version", async () => {
  const store = new MemoryAdminStore();
  await ensurePersistentAdminCredential(
    deps(store, {
      adminEmail: "admin@example.org",
      adminPassword: "old-password-123",
      adminRecoveryKey: recoveryKey,
    }),
  );

  const reset = await resetPersistentAdminPassword(
    deps(store, {}),
    recoveryKey,
    "new-password-456",
  );
  assert.deepEqual(reset, { kind: "success", credentialVersion: 2 });

  assert.equal(
    await authenticatePersistentAdmin(
      deps(store, {}),
      "admin@example.org",
      "old-password-123",
    ),
    null,
  );
  assert.deepEqual(
    await authenticatePersistentAdmin(
      deps(store, {}),
      "ADMIN@example.org",
      "new-password-456",
    ),
    {
      id: SINGLE_ADMIN_CREDENTIAL_ID,
      email: "admin@example.org",
      credentialVersion: 2,
    },
  );
});

test("password reset invalidates prior session versions at the server authorization layer", async () => {
  const store = new MemoryAdminStore();
  const before = await ensurePersistentAdminCredential(
    deps(store, {
      adminEmail: "admin@example.org",
      adminPassword: "old-password-123",
      adminRecoveryKey: recoveryKey,
    }),
  );
  const oldToken = {
    email: before.email,
    credentialVersion: before.credentialVersion,
  };
  assert.equal(credentialVersionMatches(oldToken, before), true);

  await resetPersistentAdminPassword(
    deps(store, {}),
    recoveryKey,
    "new-password-456",
  );
  const after = await store.get();
  assert.equal(credentialVersionMatches(oldToken, after), false);
  assert.equal(
    credentialVersionMatches(
      { email: after.email, credentialVersion: after.credentialVersion },
      after,
    ),
    true,
  );
});

test("production storage and crypto contracts use both database backends and no plaintext recovery storage", () => {
  for (const schemaPath of [
    "prisma/schema.prisma",
    "prisma/sqlite/schema.prisma",
    "prisma/postgres/schema.prisma",
  ]) {
    const schema = read(schemaPath);
    assert.match(schema, /model AdminCredential \{/);
    assert.match(schema, /passwordHash\s+String/);
    assert.match(schema, /recoveryKeyHash\s+String\?/);
    assert.match(schema, /credentialVersion\s+Int\s+@default\(1\)/);
    assert.doesNotMatch(schema, /recoveryKey\s+String(?:\s|$)/);
    assert.doesNotMatch(schema, /password\s+String(?:\s|$)/);
  }

  const crypto = read("src/lib/admin-credential-crypto.ts");
  assert.match(crypto, /bcrypt\.hash\(password, BCRYPT_ROUNDS\)/);
  assert.match(crypto, /bcrypt\.compare\(password, passwordHash\)/);
  assert.match(crypto, /createHash\("sha256"\)/);
  assert.match(crypto, /timingSafeEqual\(supplied, expected\)/);
});

test("recovery mutations are same-origin gated, independently rate-limited, bounded, and opaque", () => {
  const proof = read("src/app/api/admin-recovery/verify/route.ts");
  const reset = read("src/app/api/admin-recovery/password/route.ts");
  assert.match(proof, /requireSameOriginMutation\(req\)/);
  assert.match(reset, /requireSameOriginMutation\(req\)/);
  assert.match(proof, /RATE_LIMITS\.adminRecoveryProof/);
  assert.match(reset, /RATE_LIMITS\.adminRecoveryReset/);
  assert.match(proof, /readBoundedJson\(req, BODY_LIMITS\.adminRecovery\)/);
  assert.match(reset, /readBoundedJson\(req, BODY_LIMITS\.adminRecovery\)/);
  assert.match(proof, /Recovery credentials were not accepted\./);
  assert.doesNotMatch(proof, /console\.(?:log|error)\([^\n]*(?:recoveryKey|parsed\.data)/);
  assert.doesNotMatch(reset, /console\.(?:log|error)\([^\n]*(?:resetToken|newPassword|parsed\.data)/);

  const rateLimit = read("src/lib/rate-limit.ts");
  assert.match(rateLimit, /adminRecoveryProof:\s*\{[\s\S]*max:\s*5/);
  assert.match(rateLimit, /adminRecoveryReset:\s*\{[\s\S]*max:\s*5/);
});

test("persistent credential source of truth is wired into login and JWT version checks", () => {
  const auth = read("src/lib/auth-options.ts");
  assert.match(auth, /authenticateAdminCredential\(email, password\)/);
  assert.match(auth, /credentialVersion: authenticated\.credentialVersion/);
  assert.match(auth, /isAdminCredentialVersionCurrent\(token\)/);
  assert.match(auth, /revokeAdminToken\(token\)/);
  assert.doesNotMatch(auth, /timingSafeEqual|bcrypt\.compare/);
});
