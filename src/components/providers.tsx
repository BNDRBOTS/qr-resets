"use client";

// BNDR. — Client providers wrapper
// ----------------------------------------------------------------------------
// Wraps the app in NextAuth's SessionProvider so client-side auth functions
// (signIn, signOut, useSession) work correctly.

import { SessionProvider } from "next-auth/react";

export function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
