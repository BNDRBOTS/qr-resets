"use client";

// BNDR. — Client providers wrapper
// ----------------------------------------------------------------------------
// Wraps the app in NextAuth's SessionProvider and the shared QueryProvider so
// client-side auth and React Query are available across every route.

import { SessionProvider } from "next-auth/react";
import { QueryProvider } from "@/components/bndr/query-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <QueryProvider>{children}</QueryProvider>
    </SessionProvider>
  );
}
