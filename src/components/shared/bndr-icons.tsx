import type { SVGProps } from "react";
import type { CategorySlug } from "@/lib/types";

type IconProps = SVGProps<SVGSVGElement> & { title?: string };

function IconFrame({ title, children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
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
function CategoryIconFrame({ title, children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.55"
      strokeLinecap="round"
      strokeLinejoin="round"
      vectorEffect="non-scaling-stroke"
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
  switch (slug) {
    case "child-abduction":
      return (
        <CategoryIconFrame {...props}>
          <path d="M12 3.25 18 5.5v5.2c0 4.15-2.3 7.6-6 9.8-3.7-2.2-6-5.65-6-9.8V5.5L12 3.25Z" />
          <circle cx="10" cy="10" r="1.35" />
          <path d="M7.9 14.2c.8-1.35 1.85-2.05 3.1-2.05 1.15 0 2.1.5 2.85 1.5M15.4 8.5v4M13.4 10.5h4" />
        </CategoryIconFrame>
      );
    case "victim-rights-compensation":
      return (
        <CategoryIconFrame {...props}>
          <path d="M12 4v16M7 6h10M5 9l-2 4h4L5 9Zm14 0-2 4h4l-2-4Z" />
          <path d="M8.5 20h7" />
        </CategoryIconFrame>
      );
    case "domestic-violence-family-violence":
      return (
        <CategoryIconFrame {...props}>
          <path d="m4 11 8-6 8 6v8H4v-8Z" />
          <path d="M9 19v-5h6v5M12 8.5 16 10v3.1c0 2.15-1.25 3.95-4 5.4-2.75-1.45-4-3.25-4-5.4V10l4-1.5Z" />
        </CategoryIconFrame>
      );
    case "family-advocacy-trauma-recovery":
      return (
        <CategoryIconFrame {...props}>
          <path d="M6 14.5c1.4-2.15 3.35-3.25 5.85-3.25 2.55 0 4.55 1.1 6.15 3.25" />
          <circle cx="9" cy="8" r="2" />
          <circle cx="15.5" cy="8.5" r="1.6" />
          <path d="M4.25 17.5h15.5M12 14.25v5" />
        </CategoryIconFrame>
      );
    case "protective-parent-family-court":
      return (
        <CategoryIconFrame {...props}>
          <path d="M12 3.5 18 6v5.25c0 3.7-2.15 6.75-6 9.25-3.85-2.5-6-5.55-6-9.25V6l6-2.5Z" />
          <circle cx="12" cy="9.2" r="1.55" />
          <path d="M9.25 14.6c.65-1.55 1.55-2.35 2.75-2.35s2.1.8 2.75 2.35" />
        </CategoryIconFrame>
      );
    case "gaslighting-darvo-institutional-betrayal":
      return (
        <CategoryIconFrame {...props}>
          <circle cx="10.25" cy="10.25" r="5.25" />
          <path d="m14 14 5 5M7.8 9.4l2-2 2.15 2.15 2.3-2.3M7.75 12.1h5" />
        </CategoryIconFrame>
      );
    case "parental-alienation-fathers-rights":
      return (
        <CategoryIconFrame {...props}>
          <circle cx="7" cy="9" r="2" />
          <circle cx="17" cy="9" r="2" />
          <circle cx="12" cy="14.5" r="1.6" />
          <path d="M3.75 18c.65-2.35 1.75-3.5 3.25-3.5 1.2 0 2.15.7 2.8 2.1M20.25 18c-.65-2.35-1.75-3.5-3.25-3.5-1.2 0-2.15.7-2.8 2.1M9 6.25l3-2 3 2" />
        </CategoryIconFrame>
      );
    case "legal-aid-court-access":
      return (
        <CategoryIconFrame {...props}>
          <path d="m4 9 8-4 8 4H4ZM5.5 19h13M7 10.5v6M11 10.5v6M15 10.5v6M19 10.5v6" />
        </CategoryIconFrame>
      );
    case "attorneys-firms":
      return (
        <CategoryIconFrame {...props}>
          <rect x="4" y="8" width="16" height="11" rx="2" />
          <path d="M9 8V6.5A1.5 1.5 0 0 1 10.5 5h3A1.5 1.5 0 0 1 15 6.5V8M4 12.5h16M10 12.5v2h4v-2" />
        </CategoryIconFrame>
      );
    case "disability-medical-advocacy":
      return (
        <CategoryIconFrame {...props}>
          <circle cx="12" cy="5.5" r="1.5" />
          <path d="M10.5 8.5h3l1 4h3M11.2 9l-1.1 5.3 3.1 1.4 1.55 3.3" />
          <path d="M10 12.5a4.75 4.75 0 1 0 4.5 6.3" />
        </CategoryIconFrame>
      );
    case "victim-linked-programs":
      return (
        <CategoryIconFrame {...props}>
          <path d="M9.5 14.5 7 17a3 3 0 0 1-4.25-4.25l3-3A3 3 0 0 1 10 9" />
          <path d="m14.5 9.5 2.5-2.5a3 3 0 1 1 4.25 4.25l-3 3A3 3 0 0 1 14 15" />
          <path d="m8.5 15.5 7-7" />
        </CategoryIconFrame>
      );
    case "lyme-co-infections":
      return (
        <CategoryIconFrame {...props}>
          <circle cx="12" cy="12" r="4.25" />
          <path d="M12 5V3M12 21v-2M5 12H3M21 12h-2M7 7 5.5 5.5M18.5 18.5 17 17M17 7l1.5-1.5M5.5 18.5 7 17" />
          <path d="M10 12h4M12 10v4" />
        </CategoryIconFrame>
      );
    case "housing-financial-aid":
      return (
        <CategoryIconFrame {...props}>
          <path d="m4 11 8-6 8 6v8H4v-8Z" />
          <path d="M9.5 19v-5h5v5" />
          <circle cx="17.2" cy="6.2" r="2.2" />
          <path d="M17.2 4.9v2.6M16.3 5.45h1.45M16.6 6.95h1.5" />
        </CategoryIconFrame>
      );
  }
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
