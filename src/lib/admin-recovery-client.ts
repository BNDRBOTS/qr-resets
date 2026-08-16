// BNDR. — Browser helpers for the administrator password-recovery flow

export type AdminRecoveryProofResult =
  | { kind: "success"; resetToken: string; expiresInSeconds: number }
  | { kind: "denied" }
  | { kind: "rate-limited" }
  | { kind: "unavailable" };


export type AdminEmailRecoveryResult =
  | { kind: "success"; email: string }
  | { kind: "denied" }
  | { kind: "rate-limited" }
  | { kind: "unavailable" };

export type AdminPasswordResetResult =
  | { kind: "success" }
  | { kind: "expired" }
  | { kind: "denied" }
  | { kind: "weak-password" }
  | { kind: "rate-limited" }
  | { kind: "unavailable" };

type FetchLike = (
  input: string,
  init?: RequestInit,
) => Promise<Pick<Response, "ok" | "status" | "json">>;

async function safeJson(response: Pick<Response, "json">): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function errorCode(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const error = (body as { error?: unknown }).error;
  if (!error || typeof error !== "object") return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}

export async function performAdminRecoveryProof(
  recoveryKey: string,
  fetcher: FetchLike = fetch,
): Promise<AdminRecoveryProofResult> {
  try {
    const response = await fetcher("/api/admin-recovery/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recoveryKey }),
    });
    const body = await safeJson(response);

    if (response.ok) {
      const candidate = body as {
        ok?: unknown;
        resetToken?: unknown;
        expiresInSeconds?: unknown;
      } | null;
      if (
        candidate?.ok === true &&
        typeof candidate.resetToken === "string" &&
        candidate.resetToken.length > 0 &&
        typeof candidate.expiresInSeconds === "number" &&
        candidate.expiresInSeconds > 0
      ) {
        return {
          kind: "success",
          resetToken: candidate.resetToken,
          expiresInSeconds: candidate.expiresInSeconds,
        };
      }
      return { kind: "unavailable" };
    }

    switch (errorCode(body)) {
      case "RECOVERY_DENIED":
        return { kind: "denied" };
      case "RATE_LIMITED":
        return { kind: "rate-limited" };
      default:
        return { kind: "unavailable" };
    }
  } catch {
    return { kind: "unavailable" };
  }
}

export async function performAdminPasswordReset(
  resetToken: string,
  newPassword: string,
  fetcher: FetchLike = fetch,
): Promise<AdminPasswordResetResult> {
  try {
    const response = await fetcher("/api/admin-recovery/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resetToken, newPassword }),
    });
    const body = await safeJson(response);

    if (response.ok) {
      if ((body as { ok?: unknown } | null)?.ok === true) {
        return { kind: "success" };
      }
      return { kind: "unavailable" };
    }

    switch (errorCode(body)) {
      case "RECOVERY_EXPIRED":
        return { kind: "expired" };
      case "RECOVERY_DENIED":
        return { kind: "denied" };
      case "WEAK_PASSWORD":
        return { kind: "weak-password" };
      case "RATE_LIMITED":
        return { kind: "rate-limited" };
      default:
        return { kind: "unavailable" };
    }
  } catch {
    return { kind: "unavailable" };
  }
}

export async function performAdminEmailRecovery(
  recoveryKey: string,
  fetcher: FetchLike = fetch,
): Promise<AdminEmailRecoveryResult> {
  try {
    const response = await fetcher("/api/admin-recovery/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recoveryKey }),
    });
    const body = await safeJson(response);

    if (response.ok) {
      const candidate = body as { ok?: unknown; email?: unknown } | null;
      if (
        candidate?.ok === true &&
        typeof candidate.email === "string" &&
        candidate.email.length > 0
      ) {
        return { kind: "success", email: candidate.email };
      }
      return { kind: "unavailable" };
    }

    switch (errorCode(body)) {
      case "RECOVERY_DENIED":
        return { kind: "denied" };
      case "RATE_LIMITED":
        return { kind: "rate-limited" };
      default:
        return { kind: "unavailable" };
    }
  } catch {
    return { kind: "unavailable" };
  }
}

