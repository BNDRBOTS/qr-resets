"use client";

// BNDR. — Admin login page
// ----------------------------------------------------------------------------
// Single Credentials provider. No fallback/default credentials.
// Browser DOM values are authoritative so password-manager/autofill submissions
// cannot drift from duplicated React credential state.

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BndrLogo } from "@/components/bndr/bndr-logo";
import {
  performAdminSignIn,
  readAdminLoginCredentials,
  type AdminLoginResult,
} from "@/lib/admin-login-client";
import { Loader2, Lock, Mail, ShieldCheck, AlertCircle } from "lucide-react";
import { AdminForgotPasswordForm } from "@/components/bndr/admin-forgot-password-form";
import { AdminForgotEmailForm } from "@/components/bndr/admin-forgot-email-form";

function loginErrorMessage(result: AdminLoginResult): string | null {
  switch (result.kind) {
    case "missing-fields":
      return "Enter your email and password.";
    case "invalid-credentials":
      return "Invalid email or password.";
    case "rate-limited":
      return "Too many sign-in attempts. Try again in a few minutes.";
    case "unavailable":
      return "Sign-in is temporarily unavailable. Please try again.";
    case "success":
      return null;
  }
}

export function AdminLoginForm({
  callbackUrl,
  hasError,
}: {
  callbackUrl: string;
  hasError: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState<"password" | "email" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(
    hasError ? "Sign-in failed. Check your credentials." : null,
  );

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;

    setErr(null);
    setNotice(null);

    // Read the submitted DOM values directly. Browser/password-manager autofill
    // populates these fields even when no React change event has fired.
    const credentials = readAdminLoginCredentials(new FormData(e.currentTarget));
    if (!credentials) {
      setErr(loginErrorMessage({ kind: "missing-fields" }));
      return;
    }

    // From this point forward an authentication request is actually in flight.
    setLoading(true);
    try {
      const result = await performAdminSignIn(
        credentials,
        callbackUrl,
        (options) => signIn("credentials", options),
      );

      if (result.kind === "success") {
        router.push(result.url);
        router.refresh();
        return;
      }

      setErr(loginErrorMessage(result));
    } catch {
      // Defensive boundary: performAdminSignIn already normalizes request errors,
      // but the form must never remain stuck if an unexpected client error occurs.
      setErr("Sign-in is temporarily unavailable. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen min-h-[100svh] flex-col items-center justify-center overflow-hidden bg-background px-4 py-10 sm:px-6">
      <div className="bndr-hero-halo pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[68vmin] w-[68vmin] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl" />
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3">
          <BndrLogo size={48} />
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Admin Sign In
          </h1>
          <p className="text-center text-sm text-muted-foreground">
            Secure access to the BNDR. Resource Directory admin console.
          </p>
        </div>

        {recoveryMode === "password" ? (
          <AdminForgotPasswordForm
            onCancel={() => setRecoveryMode(null)}
            onComplete={() => {
              setRecoveryMode(null);
              setErr(null);
              setNotice("Password reset. Sign in with your new password.");
            }}
          />
        ) : recoveryMode === "email" ? (
          <AdminForgotEmailForm onCancel={() => setRecoveryMode(null)} />
        ) : (
        <form
          onSubmit={handleSubmit}
          aria-busy={loading}
          className="bndr-glass-panel space-y-4 rounded-2xl p-4 sm:p-6"
        >
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium">
              Email
            </Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="pl-9"
                placeholder="admin@example.org"
                disabled={loading}
              />
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  if (loading) return;
                  setErr(null);
                  setNotice(null);
                  setRecoveryMode("email");
                }}
                disabled={loading}
                className="text-sm font-medium text-primary transition-opacity hover:opacity-80 disabled:pointer-events-none disabled:opacity-50"
              >
                Forgot email / username?
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm font-medium">
              Password
            </Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="pl-9"
                placeholder="••••••••"
                disabled={loading}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => {
                if (loading) return;
                setErr(null);
                setNotice(null);
                setRecoveryMode("password");
              }}
              disabled={loading}
              className="text-sm font-medium text-primary transition-opacity hover:opacity-80 disabled:pointer-events-none disabled:opacity-50"
            >
              Forgot password?
            </button>
          </div>

          {notice && (
            <div
              role="status"
              aria-live="polite"
              className="bndr-glass-control rounded-xl border-primary/25 bg-primary/10 p-3 text-sm text-foreground"
            >
              {notice}
            </div>
          )}

          {err && (
            <div
              role="alert"
              aria-live="polite"
              className="bndr-glass-control flex items-start gap-2 rounded-xl border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{err}</span>
            </div>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing in…
              </>
            ) : (
              <>
                <ShieldCheck className="mr-2 h-4 w-4" />
                Sign In
              </>
            )}
          </Button>
        </form>

        )}
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Access is restricted to authorized administrators. All sign-in
          attempts are rate-limited and logged.
        </p>
      </div>
    </div>
  );
}
