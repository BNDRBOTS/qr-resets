// BNDR. — Production cryptography for persistent admin credentials (server-only)

import bcrypt from "bcryptjs";
import { createHash, timingSafeEqual } from "node:crypto";
import type { AdminCredentialCrypto } from "@/lib/admin-credential-core";

const BCRYPT_ROUNDS = 12;
const BCRYPT_HASH = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;
const RECOVERY_HASH_DOMAIN = "bndr-admin-recovery-v1\0";

function recoveryDigest(value: string): Buffer {
  return createHash("sha256")
    .update(RECOVERY_HASH_DOMAIN)
    .update(value, "utf8")
    .digest();
}

export const adminCredentialCrypto: AdminCredentialCrypto = {
  async hashPassword(password) {
    return bcrypt.hash(password, BCRYPT_ROUNDS);
  },

  async verifyPassword(password, passwordHash) {
    try {
      return await bcrypt.compare(password, passwordHash);
    } catch {
      return false;
    }
  },

  isPasswordHash(value) {
    return BCRYPT_HASH.test(value);
  },

  hashRecoveryKey(recoveryKey) {
    return recoveryDigest(recoveryKey).toString("hex");
  },

  verifyRecoveryKey(recoveryKey, recoveryKeyHash) {
    if (!/^[a-f0-9]{64}$/i.test(recoveryKeyHash)) return false;
    const supplied = recoveryDigest(recoveryKey);
    const expected = Buffer.from(recoveryKeyHash, "hex");
    return supplied.length === expected.length && timingSafeEqual(supplied, expected);
  },
};
