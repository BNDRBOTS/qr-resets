"use client";

import { BndrLogo } from "@/components/bndr/bndr-logo";

interface LogoProps {
  size?: number;
  className?: string;
  priority?: boolean;
  chip?: boolean;
}

/** Local production BNDR LLC mark shared by ResourceCite and QR Resets. */
export function Logo({
  size = 40,
  className = "",
  chip = false,
}: LogoProps) {
  return (
    <BndrLogo
      size={size}
      className={className}
      glow={!chip}
      alt="BNDR LLC"
    />
  );
}
