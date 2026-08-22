// BNDR. — Short-lived signed password-recovery grants (dependency-free core)
// -----------------------------------------------------------------------------
// A valid recovery key is exchanged for a short-lived, server-signed grant.
// The grant is bound to the current credential version. The first successful
// password reset increments that version, which invalidates grant replay.

import { createHmac, timingSafeEqual } from "node:crypto";

export const ADMIN_RECOVERY_TICKET_TTL_MS = 10 * 60 * 1000;
const TICKET_DOMAIN = "bndr-admin-password-reset-v1";

export type AdminRecoveryGrant = {
  id: string;
  email: string;
  credentialVersion: number;
};

type RecoveryTicketPayload = AdminRecoveryGrant & {
  issuedAt: number;
  expiresAt: number;
};

export type AdminRecoveryTicketVerification =
  | { kind: "success"; grant: AdminRecoveryGrant }
  | { kind: "invalid" }
  | { kind: "expired" };

function encodeBase64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function sign(secret: string, payload: string): Buffer {
  return createHmac("sha256", secret)
    .update(TICKET_DOMAIN, "utf8")
    .update("\0", "utf8")
    .update(payload, "utf8")
    .digest();
}

function validSecret(secret: string): boolean {
  return secret.trim().length >= 32;
}

function validGrant(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    candidate.id.length > 0 &&
    typeof candidate.email === "string" &&
    candidate.email.length > 0 &&
    typeof candidate.credentialVersion === "number" &&
    Number.isInteger(candidate.credentialVersion) &&
    candidate.credentialVersion >= 1
  );
}

export function issueAdminRecoveryTicket(
  secret: string,
  grant: AdminRecoveryGrant,
  now = Date.now(),
): string {
  if (!validSecret(secret)) {
    throw new Error("Recovery ticket signing secret is unavailable.");
  }
  if (!validGrant(grant)) {
    throw new Error("Recovery grant is invalid.");
  }

  const payload: RecoveryTicketPayload = {
    ...grant,
    issuedAt: now,
    expiresAt: now + ADMIN_RECOVERY_TICKET_TTL_MS,
  };
  const encoded = encodeBase64Url(JSON.stringify(payload));
  const signature = sign(secret, encoded).toString("base64url");
  return `${encoded}.${signature}`;
}

export function verifyAdminRecoveryTicket(
  secret: string,
  token: string,
  now = Date.now(),
): AdminRecoveryTicketVerification {
  if (!validSecret(secret) || !token || token.length > 4096) {
    return { kind: "invalid" };
  }

  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return { kind: "invalid" };
  }

  let suppliedSignature: Buffer;
  try {
    suppliedSignature = Buffer.from(parts[1], "base64url");
  } catch {
    return { kind: "invalid" };
  }
  const expectedSignature = sign(secret, parts[0]);
  if (
    suppliedSignature.length !== expectedSignature.length ||
    !timingSafeEqual(suppliedSignature, expectedSignature)
  ) {
    return { kind: "invalid" };
  }

  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
  } catch {
    return { kind: "invalid" };
  }
  if (!payload || typeof payload !== "object") return { kind: "invalid" };

  const candidate = payload as Record<string, unknown>;
  if (
    !validGrant(candidate) ||
    typeof candidate.issuedAt !== "number" ||
    !Number.isInteger(candidate.issuedAt) ||
    typeof candidate.expiresAt !== "number" ||
    !Number.isInteger(candidate.expiresAt) ||
    candidate.expiresAt <= candidate.issuedAt ||
    candidate.expiresAt - candidate.issuedAt !== ADMIN_RECOVERY_TICKET_TTL_MS ||
    candidate.issuedAt > now + 60_000
  ) {
    return { kind: "invalid" };
  }

  if (candidate.expiresAt <= now) return { kind: "expired" };

  return {
    kind: "success",
    grant: {
      id: candidate.id as string,
      email: candidate.email as string,
      credentialVersion: candidate.credentialVersion as number,
    },
  };
}
