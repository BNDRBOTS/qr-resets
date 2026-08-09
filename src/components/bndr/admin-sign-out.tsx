"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AdminSignOut() {
  return (
    <Button
      variant="ghost"
      size="sm"
      type="button"
      onClick={() => signOut({ callbackUrl: "/admin/login" })}
    >
      <LogOut className="mr-1.5 h-4 w-4" />
      Sign Out
    </Button>
  );
}
