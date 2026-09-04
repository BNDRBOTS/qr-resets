"use client";

// BNDR. — Client providers wrapper
// ----------------------------------------------------------------------------
// Global SessionProvider + QueryProvider. React Query is available to public
// and admin routes instead of existing only under the public root page.

import { SessionProvider } from "next-auth/react";
import { QueryProvider } from "@/components/bndr/query-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <QueryProvider>{children}</QueryProvider>
    </SessionProvider>
  );
}
