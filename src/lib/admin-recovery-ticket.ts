// BNDR. — Production recovery-ticket wrapper (server-only)

import {
  ADMIN_RECOVERY_TICKET_TTL_MS,
  issueAdminRecoveryTicket,
  verifyAdminRecoveryTicket,
  type AdminRecoveryGrant,
} from "@/lib/admin-recovery-ticket-core";

function signingSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET ?? "";
  if (secret.trim().length < 32) {
    throw new Error("NEXTAUTH_SECRET is required for account recovery.");
  }
  return secret;
}

export function createAdminRecoveryTicket(grant: AdminRecoveryGrant): string {
  return issueAdminRecoveryTicket(signingSecret(), grant);
}

export function parseAdminRecoveryTicket(token: string) {
  return verifyAdminRecoveryTicket(signingSecret(), token);
}

export const ADMIN_RECOVERY_TICKET_TTL_SECONDS = Math.floor(
  ADMIN_RECOVERY_TICKET_TTL_MS / 1000,
);
