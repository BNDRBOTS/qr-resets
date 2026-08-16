// BNDR. — NextAuth request proxy for Next.js 16
// ----------------------------------------------------------------------------
// Protects /admin (except /admin/login) and all admin API routes at the edge.
// Client state is never authorization — only the NextAuth JWT session grants
// access.
//

import { withAuth } from "next-auth/middleware";
import { isAdminToken } from "@/lib/admin-auth-core";

export default withAuth({
  pages: {
    signIn: "/admin/login",
  },
  callbacks: {
    authorized({ req, token }) {
      // Allow the login page itself.
      const path = req.nextUrl.pathname;
      if (path === "/admin/login") return true;
      // All other protected paths require an admin token.
      return isAdminToken(token);
    },
  },
});

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
