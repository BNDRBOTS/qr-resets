"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { performAdminEmailRecovery } from "@/lib/admin-recovery-client";
import {
  AlertCircle,
  ArrowLeft,
  AtSign,
  KeyRound,
  Loader2,
} from "lucide-react";

export function AdminForgotEmailForm({ onCancel }: { onCancel: () => void }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [recoveredEmail, setRecoveredEmail] = useState<string | null>(null);

  async function handleProof(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading || recoveredEmail) return;

    const data = new FormData(e.currentTarget);
    const recoveryKey = String(data.get("recoveryKey") ?? "").trim();
    if (!recoveryKey) {
      setErr("Enter your administrator recovery key.");
      return;
    }

    setErr(null);
    setLoading(true);
    try {
      const result = await performAdminEmailRecovery(recoveryKey);
      switch (result.kind) {
        case "success":
          setRecoveredEmail(result.email);
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

  return (
    <div className="bndr-glass-panel space-y-4 rounded-2xl p-4 sm:p-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-foreground">
          Recover admin email
        </h2>
        <p className="text-sm text-muted-foreground">
          Your username is the admin email used to sign in.
        </p>
      </div>

      {recoveredEmail ? (
        <div className="space-y-4">
          <div
            role="status"
            aria-live="polite"
            className="bndr-glass-control space-y-2 rounded-xl border-primary/25 bg-primary/10 p-4"
          >
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <AtSign className="h-4 w-4 shrink-0" />
              Admin email (username)
            </div>
            <p className="break-all text-base font-semibold text-foreground">
              {recoveredEmail}
            </p>
          </div>

          <Button type="button" className="w-full" onClick={onCancel}>
            Back to sign in
          </Button>
        </div>
      ) : (
        <form onSubmit={handleProof} aria-busy={loading} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="emailRecoveryKey" className="text-sm font-medium">
              Recovery key
            </Label>
            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="emailRecoveryKey"
                name="recoveryKey"
                type="password"
                autoComplete="off"
                required
                className="pl-9"
                disabled={loading}
              />
            </div>
          </div>

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
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <AtSign className="h-4 w-4" />
            )}
            {loading ? "Checking…" : "Recover admin email"}
          </Button>
        </form>
      )}

      {!recoveredEmail && (
        <button
          type="button"
          onClick={() => {
            if (loading) return;
            onCancel();
          }}
          disabled={loading}
          className="mx-auto flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to sign in
        </button>
      )}
    </div>
  );
}
