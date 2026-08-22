"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  performAdminPasswordReset,
  performAdminRecoveryProof,
} from "@/lib/admin-recovery-client";
import { AlertCircle, ArrowLeft, KeyRound, Loader2, LockKeyhole } from "lucide-react";

type Step = "proof" | "reset";

export function AdminForgotPasswordForm({
  onCancel,
  onComplete,
}: {
  onCancel: () => void;
  onComplete: () => void;
}) {
  const [step, setStep] = useState<Step>("proof");
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function startOver(message?: string) {
    setResetToken(null);
    setStep("proof");
    setErr(message ?? null);
  }

  async function handleProof(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;

    const data = new FormData(e.currentTarget);
    const recoveryKey = String(data.get("recoveryKey") ?? "").trim();
    if (!recoveryKey) {
      setErr("Enter your administrator recovery key.");
      return;
    }

    setErr(null);
    setLoading(true);
    try {
      const result = await performAdminRecoveryProof(recoveryKey);
      switch (result.kind) {
        case "success":
          setResetToken(result.resetToken);
          setStep("reset");
          return;
        case "denied":
          setErr("Recovery credentials were not accepted.");
          return;
        case "rate-limited":
          setErr("Too many recovery attempts. Try again later.");
          return;
        case "unavailable":
          setErr("Account recovery is temporarily unavailable. Try again.");
          return;
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleReset(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading || !resetToken) return;

    const data = new FormData(e.currentTarget);
    const newPassword = String(data.get("newPassword") ?? "");
    const confirmPassword = String(data.get("confirmPassword") ?? "");

    if (newPassword.length < 12 || newPassword.length > 256) {
      setErr("Use a password between 12 and 256 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setErr("Passwords do not match.");
      return;
    }

    setErr(null);
    setLoading(true);
    try {
      const result = await performAdminPasswordReset(resetToken, newPassword);
      switch (result.kind) {
        case "success":
          setResetToken(null);
          onComplete();
          return;
        case "expired":
          startOver("Recovery session expired. Enter your recovery key again.");
          return;
        case "denied":
          startOver("Recovery credentials were not accepted.");
          return;
        case "weak-password":
          setErr("Use a password between 12 and 256 characters.");
          return;
        case "rate-limited":
          setErr("Too many recovery attempts. Try again later.");
          return;
        case "unavailable":
          setErr("Account recovery is temporarily unavailable. Try again.");
          return;
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bndr-glass-panel space-y-4 rounded-2xl p-4 sm:p-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-foreground">Reset password</h2>
        <p className="text-sm text-muted-foreground">
          {step === "proof"
            ? "Enter the administrator recovery key to continue."
            : "Choose a new administrator password."}
        </p>
      </div>

      {step === "proof" ? (
        <form onSubmit={handleProof} aria-busy={loading} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="recoveryKey" className="text-sm font-medium">
              Recovery key
            </Label>
            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="recoveryKey"
                name="recoveryKey"
                type="password"
                autoComplete="off"
                required
                className="pl-9"
                disabled={loading}
              />
            </div>
          </div>

          {err && <RecoveryError message={err} />}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            {loading ? "Checking…" : "Continue"}
          </Button>
        </form>
      ) : (
        <form onSubmit={handleReset} aria-busy={loading} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="newPassword" className="text-sm font-medium">
              New password
            </Label>
            <div className="relative">
              <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="newPassword"
                name="newPassword"
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={256}
                required
                className="pl-9"
                disabled={loading}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword" className="text-sm font-medium">
              Confirm new password
            </Label>
            <div className="relative">
              <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={256}
                required
                className="pl-9"
                disabled={loading}
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Use 12–256 characters. Resetting the password signs out existing admin sessions.
          </p>

          {err && <RecoveryError message={err} />}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-4 w-4" />}
            {loading ? "Resetting…" : "Reset password"}
          </Button>
        </form>
      )}

      <button
        type="button"
        onClick={() => {
          if (loading) return;
          setResetToken(null);
          onCancel();
        }}
        disabled={loading}
        className="mx-auto flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to sign in
      </button>
    </div>
  );
}

function RecoveryError({ message }: { message: string }) {
  return (
    <div
      role="alert"
      aria-live="polite"
      className="bndr-glass-control flex items-start gap-2 rounded-xl border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}
