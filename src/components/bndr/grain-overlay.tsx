"use client";

/**
 * Premium grain overlay. Fixed, pointer-events-none, very low opacity.
 * The actual noise SVG + blend mode live in globals.css (.bndr-grain).
 */
export function GrainOverlay() {
  return <div className="bndr-grain" aria-hidden="true" />;
}
