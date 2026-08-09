"use client";

// BNDR. — Admin login page
// ----------------------------------------------------------------------------
// Single Credentials provider. No fallback/default credentials.
// On success, redirects to /admin.

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BndrLogo } from "@/components/bndr/bndr-logo";
import { Loader2, Lock, Mail, ShieldCheck, AlertCircle } from "lucide-react";

export function AdminLoginForm({
  callbackUrl,
  hasError,
}: {
  callbackUrl: string;
  hasError: boolean;
}) {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(
    hasError ? "Sign-in failed. Check your credentials." : null,
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl,
    });
    setLoading(false);
    if (res?.error) {
      setErr("Invalid email or password.");
      return;
    }
    if (res?.ok) {
      router.push(callbackUrl);
      router.refresh();
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

        <form
          onSubmit={handleSubmit}
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
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-9"
                placeholder="admin@example.org"
                disabled={loading}
              />
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
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-9"
                placeholder="••••••••"
                disabled={loading}
              />
            </div>
          </div>

          {err && (
            <div className="bndr-glass-control flex items-start gap-2 rounded-xl border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{err}</span>
            </div>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={loading || !email || !password}
          >
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

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Access is restricted to authorized administrators. All sign-in
          attempts are rate-limited and logged.
        </p>
      </div>
    </div>
  );
}
