import type { SVGProps } from "react";
import type { CategorySlug } from "@/lib/types";

type IconProps = SVGProps<SVGSVGElement> & { title?: string };

function IconFrame({ title, children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round" vectorEffect="non-scaling-stroke"
      strokeLinejoin="round"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      {...props}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

/**
 * BNDR-owned category glyph set. These are intentionally simple, monoline,
 * and geometrically consistent so every category receives equal visual weight.
 */
export function CategoryGlyph({ slug, ...props }: IconProps & { slug: CategorySlug }) {
  // Small reusable domain icon family: related categories intentionally share
  // a glyph so category growth never requires another bespoke SVG.
  if (
    slug === "child-abduction" ||
    slug === "domestic-violence-family-violence" ||
    slug === "protective-parent-family-court"
  ) {
    return (
      <IconFrame {...props}>
        <path d="M12 3.5 18 6v5.25c0 3.7-2.15 6.75-6 9.25-3.85-2.5-6-5.55-6-9.25V6l6-2.5Z" />
        <path d="m9.1 12.1 1.9 1.9 4-4.2" />
      </IconFrame>
    );
  }

  if (
    slug === "victim-rights-compensation" ||
    slug === "legal-aid-court-access" ||
    slug === "attorneys-firms" ||
    slug === "victim-linked-programs"
  ) {
    return (
      <IconFrame {...props}>
        <path d="M12 4v16M7 6h10M5 9l-2 4h4L5 9Zm14 0-2 4h4l-2-4Z" />
        <path d="M8.5 20h7" />
      </IconFrame>
    );
  }

  if (
    slug === "family-advocacy-trauma-recovery" ||
    slug === "gaslighting-darvo-institutional-betrayal" ||
    slug === "parental-alienation-fathers-rights"
  ) {
    return (
      <IconFrame {...props}>
        <circle cx="8.5" cy="8.5" r="2" />
        <circle cx="15.5" cy="8.5" r="2" />
        <path d="M4.5 18c.8-3.15 2.15-4.75 4-4.75 1.45 0 2.6.8 3.5 2.4.9-1.6 2.05-2.4 3.5-2.4 1.85 0 3.2 1.6 4 4.75" />
      </IconFrame>
    );
  }

  if (slug === "disability-medical-advocacy" || slug === "lyme-co-infections") {
    return (
      <IconFrame {...props}>
        <path d="M9 4h6v5h5v6h-5v5H9v-5H4V9h5V4Z" />
      </IconFrame>
    );
  }

  return (
    <IconFrame {...props}>
      <path d="m4 11 8-6 8 6v8H4v-8Z" />
      <path d="M9.5 19v-5h5v5" />
      <circle cx="17.2" cy="6.2" r="2.2" />
      <path d="M17.2 4.9v2.6M16.3 5.45h1.45M16.6 6.95h1.5" />
    </IconFrame>
  );
}

export function BndrCheckIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="m5 12.5 4.15 4.15L19 6.8" />
    </IconFrame>
  );
}

export function BndrCloseIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="m7 7 10 10M17 7 7 17" />
    </IconFrame>
  );
}

export function BndrWarningIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="M12 4.25 20 19H4L12 4.25Z" />
      <path d="M12 9v4.5M12 16.5h.01" />
    </IconFrame>
  );
}

export function BndrGoalIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <circle cx="12" cy="12" r="7" />
      <circle cx="12" cy="12" r="3.25" />
      <path d="M12 2.75v2M21.25 12h-2M12 21.25v-2M2.75 12h2" />
    </IconFrame>
  );
}

export function BndrStreakIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="M12.3 3.25c.9 3.2-.4 4.6-1.75 6.05-1.15 1.25-2.35 2.55-2.35 4.65 0 2.55 1.75 4.8 4.45 5.55-1.15-1.1-1.55-2.1-1.2-3.05.3-.85 1-1.45 1.65-2.05.9-.8 1.75-1.6 1.6-3.25 2.15 1.65 3.1 3.45 2.65 5.35-.45 1.9-2.15 3.35-4.25 3.75 4.25-.45 7-3.2 7-7.05 0-3.65-2.55-6.8-7.7-9.9Z" />
    </IconFrame>
  );
}
