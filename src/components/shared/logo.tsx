"use client";

import { BndrLogo } from "@/components/bndr/bndr-logo";

interface LogoProps {
  size?: number;
  className?: string;
  priority?: boolean;
  chip?: boolean;
}

/** Local production BNDR mark shared by the Directory and QR Resets views. */
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
      alt="BNDR."
    />
  );
}
