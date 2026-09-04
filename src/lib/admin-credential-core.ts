// BNDR. — Single-admin credential state machine (dependency-injected)
// -----------------------------------------------------------------------------
// Keeps the persistence/rotation rules testable without coupling them to Prisma.
// Production adapters live in admin-credentials.ts and admin-credential-crypto.ts.

export const SINGLE_ADMIN_CREDENTIAL_ID = "single-admin" as const;
export const MIN_ADMIN_PASSWORD_LENGTH = 12;
export const MIN_ADMIN_RECOVERY_KEY_LENGTH = 24;
export const MAX_ADMIN_PASSWORD_LENGTH = 256;

export type AdminCredentialState = {
  id: string;
  email: string;
  passwordHash: string;
  recoveryKeyHash: string | null;
  credentialVersion: number;
};

export type AdminCredentialBootstrapInput = {
  id: string;
  email: string;
  passwordHash: string;
  recoveryKeyHash: string | null;
  credentialVersion: number;
};

export interface AdminCredentialStore {
  get(): Promise<AdminCredentialState | null>;
  bootstrapIfMissing(input: AdminCredentialBootstrapInput): Promise<AdminCredentialState>;
  setRecoveryKeyHashIfMissing(hash: string): Promise<AdminCredentialState>;
  replacePassword(passwordHash: string): Promise<AdminCredentialState>;
}

export interface AdminCredentialCrypto {
  hashPassword(password: string): Promise<string>;
  verifyPassword(password: string, passwordHash: string): Promise<boolean>;
  isPasswordHash(value: string): boolean;
  hashRecoveryKey(recoveryKey: string): string;
  verifyRecoveryKey(recoveryKey: string, recoveryKeyHash: string): boolean;
}

export type AdminCredentialBootstrapEnv = {
  adminEmail?: string;
  adminPassword?: string;
  adminPasswordHash?: string;
  adminRecoveryKey?: string;
};

export type AdminCredentialDeps = {
  store: AdminCredentialStore;
  crypto: AdminCredentialCrypto;
  env: AdminCredentialBootstrapEnv;
};

export type AdminAuthenticationResult = {
  id: string;
  email: string;
  credentialVersion: number;
};

export type AdminPasswordResetResult =
  | { kind: "success"; credentialVersion: number }
  | { kind: "invalid-recovery" }
  | { kind: "recovery-unavailable" };

export type AdminRecoveryGrant = {
  id: string;
  email: string;
  credentialVersion: number;
};

export type AdminRecoveryVerificationResult =
  | { kind: "success"; admin: AdminAuthenticationResult }
  | { kind: "invalid-recovery" }
  | { kind: "recovery-unavailable" };

export class AdminCredentialConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminCredentialConfigurationError";
  }
}

export function canonicalAdminEmail(value: string): string {
  return value.trim().toLowerCase();
}

function normalizedRecoveryKey(value: string | undefined): string | null {
  if (value === undefined) return null;
  const normalized = value.trim();
  // Recovery is optional. An unusable optional key must fail closed for
  // recovery without taking down ordinary admin authentication.
  if (normalized.length < MIN_ADMIN_RECOVERY_KEY_LENGTH) return null;
  return normalized;
}

function hasBootstrapCredential(env: AdminCredentialBootstrapEnv): boolean {
  return Boolean(
    env.adminEmail?.trim() &&
      (env.adminPasswordHash?.trim() || env.adminPassword),
  );
}

async function bootstrapPasswordHash(
  env: AdminCredentialBootstrapEnv,
  crypto: AdminCredentialCrypto,
): Promise<string> {
  const suppliedHash = env.adminPasswordHash?.trim();
  if (suppliedHash) {
    if (!crypto.isPasswordHash(suppliedHash)) {
      throw new AdminCredentialConfigurationError(
        "ADMIN_PASSWORD_HASH must be a valid bcrypt hash.",
      );
    }
    return suppliedHash;
  }

  const suppliedPassword = env.adminPassword;
  if (!suppliedPassword) {
    throw new AdminCredentialConfigurationError(
      "ADMIN_PASSWORD or ADMIN_PASSWORD_HASH is required to bootstrap the admin credential.",
    );
  }
  return crypto.hashPassword(suppliedPassword);
}

async function configureRecoveryKeyIfMissing(
  state: AdminCredentialState,
  deps: AdminCredentialDeps,
): Promise<AdminCredentialState> {
  if (state.recoveryKeyHash) return state;

  const recoveryKey = normalizedRecoveryKey(deps.env.adminRecoveryKey);
  if (!recoveryKey) return state;

  const recoveryKeyHash = deps.crypto.hashRecoveryKey(recoveryKey);
  return deps.store.setRecoveryKeyHashIfMissing(recoveryKeyHash);
}

/**
 * Return the persistent single-admin state. If none exists, seed it once from
 * the legacy Railway environment credentials. Existing persistent state always
 * wins, so restarts or stale environment values cannot roll credentials back.
 *
 * A recovery key may be added later only while the persistent recovery hash is
 * still empty; it is never silently replaced on subsequent restarts.
 */
export async function ensurePersistentAdminCredential(
  deps: AdminCredentialDeps,
): Promise<AdminCredentialState | null> {
  const existing = await deps.store.get();
  if (existing) {
    return configureRecoveryKeyIfMissing(existing, deps);
  }

  // Preserve the public-app behavior when admin credentials have never been
  // configured: authentication remains unavailable rather than blocking startup.
  if (!hasBootstrapCredential(deps.env)) return null;

  const email = canonicalAdminEmail(deps.env.adminEmail ?? "");
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AdminCredentialConfigurationError(
      "ADMIN_EMAIL must be a valid email address to bootstrap the admin credential.",
    );
  }

  const passwordHash = await bootstrapPasswordHash(deps.env, deps.crypto);
  const recoveryKey = normalizedRecoveryKey(deps.env.adminRecoveryKey);
  const recoveryKeyHash = recoveryKey
    ? deps.crypto.hashRecoveryKey(recoveryKey)
    : null;

  const state = await deps.store.bootstrapIfMissing({
    id: SINGLE_ADMIN_CREDENTIAL_ID,
    email,
    passwordHash,
    recoveryKeyHash,
    credentialVersion: 1,
  });

  // If another request won the bootstrap race without a recovery key, allow
  // this request to fill that one missing field exactly once.
  return configureRecoveryKeyIfMissing(state, deps);
}

export async function authenticatePersistentAdmin(
  deps: AdminCredentialDeps,
  emailInput: string,
  password: string,
): Promise<AdminAuthenticationResult | null> {
  const state = await ensurePersistentAdminCredential(deps);
  if (!state) return null;

  const email = canonicalAdminEmail(emailInput);
  if (!email || email !== state.email || !password) return null;

  const valid = await deps.crypto.verifyPassword(password, state.passwordHash);
  if (!valid) return null;

  return {
    id: state.id,
    email: state.email,
    credentialVersion: state.credentialVersion,
  };
}

export async function verifyPersistentAdminRecovery(
  deps: AdminCredentialDeps,
  recoveryKeyInput: string,
): Promise<AdminRecoveryVerificationResult> {
  const state = await ensurePersistentAdminCredential(deps);
  if (!state?.recoveryKeyHash) return { kind: "recovery-unavailable" };

  const recoveryKey = recoveryKeyInput.trim();
  if (
    !recoveryKey ||
    !deps.crypto.verifyRecoveryKey(recoveryKey, state.recoveryKeyHash)
  ) {
    return { kind: "invalid-recovery" };
  }

  return {
    kind: "success",
    admin: {
      id: state.id,
      email: state.email,
      credentialVersion: state.credentialVersion,
    },
  };
}

function assertValidAdminPassword(newPassword: string): void {
  if (
    newPassword.length < MIN_ADMIN_PASSWORD_LENGTH ||
    newPassword.length > MAX_ADMIN_PASSWORD_LENGTH
  ) {
    throw new AdminCredentialConfigurationError(
      `Admin passwords must be between ${MIN_ADMIN_PASSWORD_LENGTH} and ${MAX_ADMIN_PASSWORD_LENGTH} characters.`,
    );
  }
}

export async function resetPersistentAdminPassword(
  deps: AdminCredentialDeps,
  recoveryKeyInput: string,
  newPassword: string,
): Promise<AdminPasswordResetResult> {
  assertValidAdminPassword(newPassword);

  const recovery = await verifyPersistentAdminRecovery(deps, recoveryKeyInput);
  if (recovery.kind !== "success") return recovery;

  const passwordHash = await deps.crypto.hashPassword(newPassword);
  const updated = await deps.store.replacePassword(passwordHash);
  return {
    kind: "success",
    credentialVersion: updated.credentialVersion,
  };
}


export async function resetPersistentAdminPasswordWithGrant(
  deps: AdminCredentialDeps,
  grant: AdminRecoveryGrant,
  newPassword: string,
): Promise<AdminPasswordResetResult> {
  assertValidAdminPassword(newPassword);

  const state = await ensurePersistentAdminCredential(deps);
  if (!state?.recoveryKeyHash) return { kind: "recovery-unavailable" };
  if (
    grant.id !== state.id ||
    canonicalAdminEmail(grant.email) !== state.email ||
    grant.credentialVersion !== state.credentialVersion
  ) {
    return { kind: "invalid-recovery" };
  }

  const passwordHash = await deps.crypto.hashPassword(newPassword);
  const updated = await deps.store.replacePassword(passwordHash);
  return {
    kind: "success",
    credentialVersion: updated.credentialVersion,
  };
}

export function credentialVersionMatches(
  token: { credentialVersion?: unknown; email?: unknown },
  state: AdminCredentialState | null,
): boolean {
  if (!state) return false;
  if (
    typeof token.credentialVersion !== "number" ||
    !Number.isInteger(token.credentialVersion) ||
    token.credentialVersion < 1
  ) {
    return false;
  }
  if (typeof token.email !== "string") return false;
  return (
    canonicalAdminEmail(token.email) === state.email &&
    token.credentialVersion === state.credentialVersion
  );
}
