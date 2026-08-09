"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface BndrLogoProps {
  /** Nominal logo size. The visible wordmark is cropped from the source PNG without distortion. */
  size?: number;
  /** Optional className for the wrapper. */
  className?: string;
  /** Whether to render the restrained cool-blue brand glow behind the logo. */
  glow?: boolean;
  /** Alt text for the image. */
  alt?: string;
  /** Click handler — makes the logo a button. */
  onClick?: () => void;
}

/**
 * The real local BNDR logo with transparent source padding removed at build time.
 *
 * `public/bndr-logo.png` remains untouched as the source-of-truth asset. The
 * cropped derivative preserves its exact aspect ratio and only removes empty
 * alpha margins so header/footer marks render at a human-readable size instead
 * of looking artificially tiny inside a square canvas.
 */
export function BndrLogo({
  size = 36,
  className,
  glow = true,
  alt = "BNDR. — Resource Directory",
  onClick,
}: BndrLogoProps) {
  const [failed, setFailed] = useState(false);
  const visibleHeight = Math.max(12, Math.round(size * 0.36));
  const visibleWidth = Math.round(visibleHeight * (762 / 200));

  const inner = failed ? (
    <span
      className="bndr-fallback-italic bndr-wordmark-sm inline-flex items-baseline"
      style={{ fontSize: `${Math.max(12, visibleHeight * 1.35)}px`, lineHeight: 1 }}
      aria-hidden
    >
      BNDR<span className="text-primary">.</span>
    </span>
  ) : (
    <img
      src="/bndr-logo-black.png"
      alt={alt}
      width={visibleWidth}
      height={visibleHeight}
      onError={() => setFailed(true)}
      className={cn("select-none", glow && "bndr-logo-glow")}
      style={{ height: visibleHeight, width: visibleWidth, objectFit: "contain" }}
      draggable={false}
    />
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "group inline-flex items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
          className,
        )}
        aria-label="BNDR. — back to top"
      >
        {inner}
      </button>
    );
  }

  return (
    <span
      className={cn("inline-flex items-center", className)}
      role="img"
      aria-label={alt}
    >
      {inner}
    </span>
  );
}

/**
 * Hero-sized logo — large local PNG mark centered with the circular halo behind it.
 * Falls back to the giant branded wordmark if the image fails.
 */
export function BndrLogoHero({ failed: forcedFailed }: { failed?: boolean }) {
  const [errored, setErrored] = useState(false);
  const failed = forcedFailed ?? errored;

  if (failed) {
    return (
      <span
        className="bndr-wordmark bndr-fallback-italic relative font-extrabold leading-none"
        style={{ fontSize: "clamp(3.5rem, 12vw, 9rem)" }}
        aria-label="BNDR."
      >
        BNDR<span className="bndr-dot">.</span>
      </span>
    );
  }

  return (
    <img
      src="/bndr-logo-black.png"
      alt="BNDR. — Resource Directory"
      onError={() => setErrored(true)}
      className="bndr-logo-glow relative select-none"
      style={{
        width: "clamp(11rem, 32vw, 25rem)",
        height: "auto",
        objectFit: "contain",
      }}
      draggable={false}
    />
  );
}
