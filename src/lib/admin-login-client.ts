const RATE_LIMITED_ERROR = "RateLimited";

export type AdminLoginCredentials = {
  email: string;
  password: string;
};

export type AdminLoginResult =
  | { kind: "success"; url: string }
  | { kind: "missing-fields" }
  | { kind: "invalid-credentials" }
  | { kind: "rate-limited" }
  | { kind: "unavailable" };

export type AdminSignInResponse = {
  error?: string | null;
  status?: number;
  ok?: boolean;
  url?: string | null;
};

export type AdminSignInExecutor = (options: {
  email: string;
  password: string;
  redirect: false;
  callbackUrl: string;
}) => Promise<unknown>;

export function readAdminLoginCredentials(
  formData: FormData,
): AdminLoginCredentials | null {
  const emailValue = formData.get("email");
  const passwordValue = formData.get("password");

  const email = typeof emailValue === "string" ? emailValue.trim() : "";
  const password = typeof passwordValue === "string" ? passwordValue : "";

  if (!email || !password) return null;
  return { email, password };
}

export function classifyAdminSignInResponse(response: unknown): AdminLoginResult {
  if (!response || typeof response !== "object") {
    return { kind: "unavailable" };
  }

  const result = response as AdminSignInResponse;

  if (result.error === RATE_LIMITED_ERROR) {
    return { kind: "rate-limited" };
  }

  if (result.error === "CredentialsSignin") {
    return { kind: "invalid-credentials" };
  }

  if (result.error || result.ok !== true) {
    return { kind: "unavailable" };
  }

  if (typeof result.url !== "string" || !result.url) {
    return { kind: "unavailable" };
  }

  return { kind: "success", url: result.url };
}

export async function performAdminSignIn(
  credentials: AdminLoginCredentials,
  callbackUrl: string,
  signInExecutor: AdminSignInExecutor,
): Promise<AdminLoginResult> {
  try {
    const response = await signInExecutor({
      ...credentials,
      redirect: false,
      callbackUrl,
    });
    return classifyAdminSignInResponse(response);
  } catch {
    return { kind: "unavailable" };
  }
}
