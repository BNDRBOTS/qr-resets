// BNDR. — Server-gated Admin page
// ----------------------------------------------------------------------------
// Renders the AdminDashboard only after successful NextAuth authorization.
// The middleware also gates this path, but we double-check on the server
// (defense in depth) and provide a clear redirect to /admin/login.

import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { isAdminSession } from "@/lib/admin-auth-core";
import { AdminDashboard } from "@/components/bndr/admin-dashboard";
import Link from "next/link";
import { AdminSignOut } from "@/components/bndr/admin-sign-out";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await getServerSession(authOptions);

  if (!isAdminSession(session)) {
    redirect("/admin/login");
  }

  const userEmail = session.user?.email ?? "admin";

  return (
    <div className="min-h-screen bg-background">
      <header className="bndr-glass-bar sticky top-0 z-30 border-b border-border/70 bg-card/70">
        <div className="mx-auto flex min-h-14 max-w-7xl flex-wrap items-center justify-between gap-2 px-3 py-2 sm:px-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-sm font-medium text-muted-foreground hover:text-foreground">
              ← Back to Directory
            </Link>
            <span className="h-4 w-px bg-border" />
            <span className="text-sm font-semibold text-foreground">
              Admin Console
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-muted-foreground sm:inline">
              {userEmail}
            </span>
            <AdminSignOut />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-3 py-5 sm:px-4 sm:py-6">
        <AdminDashboard />
      </main>
    </div>
  );
}
