// BNDR. — Persistent single-admin credential service (server-only)

import { db } from "@/lib/db";
import {
  authenticatePersistentAdmin,
  credentialVersionMatches,
  ensurePersistentAdminCredential,
  resetPersistentAdminPassword,
  resetPersistentAdminPasswordWithGrant,
  verifyPersistentAdminRecovery,
  SINGLE_ADMIN_CREDENTIAL_ID,
  type AdminCredentialBootstrapEnv,
  type AdminCredentialState,
  type AdminCredentialStore,
  type AdminRecoveryGrant,
} from "@/lib/admin-credential-core";
import { adminCredentialCrypto } from "@/lib/admin-credential-crypto";

function toState(row: {
  id: string;
  email: string;
  passwordHash: string;
  recoveryKeyHash: string | null;
  credentialVersion: number;
}): AdminCredentialState {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.passwordHash,
    recoveryKeyHash: row.recoveryKeyHash,
    credentialVersion: row.credentialVersion,
  };
}

const store: AdminCredentialStore = {
  async get() {
    const row = await db.adminCredential.findUnique({
      where: { id: SINGLE_ADMIN_CREDENTIAL_ID },
    });
    return row ? toState(row) : null;
  },

  async bootstrapIfMissing(input) {
    const row = await db.adminCredential.upsert({
      where: { id: SINGLE_ADMIN_CREDENTIAL_ID },
      update: {},
      create: {
        ...input,
        passwordUpdatedAt: new Date(),
        recoveryKeyConfiguredAt: input.recoveryKeyHash ? new Date() : null,
      },
    });
    return toState(row);
  },

  async setRecoveryKeyHashIfMissing(hash) {
    await db.adminCredential.updateMany({
      where: {
        id: SINGLE_ADMIN_CREDENTIAL_ID,
        recoveryKeyHash: null,
      },
      data: {
        recoveryKeyHash: hash,
        recoveryKeyConfiguredAt: new Date(),
      },
    });
    const row = await db.adminCredential.findUnique({
      where: { id: SINGLE_ADMIN_CREDENTIAL_ID },
    });
    if (!row) throw new Error("Persistent admin credential is unavailable.");
    return toState(row);
  },

  async replacePassword(passwordHash) {
    const row = await db.adminCredential.update({
      where: { id: SINGLE_ADMIN_CREDENTIAL_ID },
      data: {
        passwordHash,
        passwordUpdatedAt: new Date(),
        credentialVersion: { increment: 1 },
      },
    });
    return toState(row);
  },
};

function bootstrapEnv(): AdminCredentialBootstrapEnv {
  return {
    adminEmail: process.env.ADMIN_EMAIL,
    adminPassword: process.env.ADMIN_PASSWORD,
    adminPasswordHash: process.env.ADMIN_PASSWORD_HASH,
    adminRecoveryKey: process.env.ADMIN_RECOVERY_KEY,
  };
}

function deps() {
  return { store, crypto: adminCredentialCrypto, env: bootstrapEnv() };
}

export async function ensureAdminCredential() {
  return ensurePersistentAdminCredential(deps());
}

export async function authenticateAdminCredential(
  email: string,
  password: string,
) {
  return authenticatePersistentAdmin(deps(), email, password);
}

export async function resetAdminPasswordWithRecovery(
  recoveryKey: string,
  newPassword: string,
) {
  return resetPersistentAdminPassword(deps(), recoveryKey, newPassword);
}

export async function verifyAdminRecoveryCredential(recoveryKey: string) {
  return verifyPersistentAdminRecovery(deps(), recoveryKey);
}

export async function resetAdminPasswordWithRecoveryGrant(
  grant: AdminRecoveryGrant,
  newPassword: string,
) {
  return resetPersistentAdminPasswordWithGrant(deps(), grant, newPassword);
}


export async function isAdminCredentialVersionCurrent(token: {
  credentialVersion?: unknown;
  email?: unknown;
}): Promise<boolean> {
  const state = await store.get();
  return credentialVersionMatches(token, state);
}
