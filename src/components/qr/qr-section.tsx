"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Link2, Check } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SectionProps {
  id?: string;
  eyebrow?: string;
  heading?: string;
  children: ReactNode;
  className?: string;
  /**
   * When true, applies a subtle alternating background tint to help visually
   * separate this section from its neighbours. Use on every other section.
   */
  tinted?: boolean;
}

/**
 * Copy-link button that appears on heading hover. Copies a URL with the
 * section hash to the clipboard so users can deep-link to a specific section.
 */
function CopyLinkButton({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const url = `${window.location.origin}${window.location.pathname}#${id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard not available — no-op
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label="Copy link to this section"
      className="ml-3 inline-flex size-7 translate-y-0.5 items-center justify-center rounded-md text-muted-foreground/50 opacity-0 transition-all hover:bg-primary/10 hover:text-primary focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 group-hover:opacity-100"
    >
      {copied ? (
        <Check className="size-3.5 text-primary" aria-hidden />
      ) : (
        <Link2 className="size-3.5" aria-hidden />
      )}
    </button>
  );
}

/**
 * Reusable section wrapper for the QR Resets site.
 *
 * Design goals (revised per VLM readability audit):
 *  - Generous vertical rhythm (py-20 sm:py-32) so the long page breathes.
 *  - Optional alternating tint (`tinted`) for clear section separation.
 *  - A top border-divider on tinted sections for a stronger visual break.
 *  - Body text inside sections inherits `leading-relaxed` via the container.
 *  - `scroll-mt-28` ensures smooth-scroll targets clear the sticky nav.
 *  - When the section has an `id` and a `heading`, a copy-link icon appears
 *    on hover so users can deep-link to the section.
 */
export function Section({
  id,
  eyebrow,
  heading,
  children,
  className,
  tinted = false,
}: SectionProps) {
  return (
    <motion.section
      id={id}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={cn(
        "scroll-mt-28 py-20 sm:py-32",
        tinted && "border-y border-border/40 bg-card/20",
        className,
      )}
    >
      <div className="container mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        {(eyebrow || heading) && (
          <div className="mb-10 sm:mb-14">
            {eyebrow && (
              <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.22em] text-primary/80">
                {eyebrow}
              </p>
            )}
            {heading && (
              <h2 className="group flex items-start text-balance text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-3xl lg:text-4xl">
                <span>{heading}</span>
                {id ? <CopyLinkButton id={id} /> : null}
              </h2>
            )}
            <div className="bndr-gradient-line mt-6 h-px w-24" aria-hidden="true" />
          </div>
        )}
        <div className="leading-relaxed">{children}</div>
      </div>
    </motion.section>
  );
}
