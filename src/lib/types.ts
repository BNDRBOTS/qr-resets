// Shared domain types for BNDR. resource directory.
// Used by both server (API) and client (UI) for a single source of truth.

export type CategorySlug =
  | "child-abduction"
  | "victim-rights-compensation"
  | "domestic-violence-family-violence"
  | "family-advocacy-trauma-recovery"
  | "protective-parent-family-court"
  | "gaslighting-darvo-institutional-betrayal"
  | "parental-alienation-fathers-rights"
  | "legal-aid-court-access"
  | "attorneys-firms"
  | "disability-medical-advocacy"
  | "victim-linked-programs"
  | "lyme-co-infections"
  | "housing-financial-aid";

export interface CategoryInfo {
  slug: CategorySlug;
  name: string;
  shortName: string;
  description: string;
}

export const CATEGORIES: CategoryInfo[] = [
  {
    slug: "child-abduction",
    name: "Child Abduction, Family Abduction & Interstate Custody",
    shortName: "Child & Family Abduction",
    description:
      "Resources for wrongful taking, retention, or concealment of a child, custodial interference, and interstate custody enforcement.",
  },
  {
    slug: "victim-rights-compensation",
    name: "Crime-Victim Rights, Representation & Compensation",
    shortName: "Victim Rights & Compensation",
    description:
      "Direct advocacy, legal representation, and crime-victim compensation programs.",
  },
  {
    slug: "domestic-violence-family-violence",
    name: "Domestic Violence, Child Abuse & Family-Violence Resources",
    shortName: "Domestic & Family Violence",
    description:
      "Shelters, legal projects, hotlines, and advocacy for domestic and family violence.",
  },
  {
    slug: "family-advocacy-trauma-recovery",
    name: "Family Advocacy & Trauma-Recovery Centers",
    shortName: "Advocacy & Trauma Recovery",
    description:
      "Multidisciplinary family advocacy centers and trauma-recovery programs.",
  },
  {
    slug: "protective-parent-family-court",
    name: "Protective-Parent & Family-Court-Abuse Organizations",
    shortName: "Protective Parents & Family Court",
    description:
      "Survivor-built, protective-parent, family-court-abuse documentation and advocacy organizations.",
  },
  {
    slug: "gaslighting-darvo-institutional-betrayal",
    name: "Gaslighting, DARVO & Institutional Betrayal",
    shortName: "DARVO & Institutional Betrayal",
    description:
      "Research and advocacy on institutional betrayal, DARVO, coercive control, and system distortion.",
  },
  {
    slug: "parental-alienation-fathers-rights",
    name: "Parental Alienation, Fathers & Equal-Parenting Resources",
    shortName: "Parental Alienation & Fathers' Rights",
    description:
      "Parental-alienation awareness, fathers' rights, and equal-parenting organizations and support.",
  },
  {
    slug: "legal-aid-court-access",
    name: "Legal-Aid & Court-Access Resources",
    shortName: "Legal Aid & Court Access",
    description:
      "Civil legal-aid providers, court-access projects, and free/low-cost legal help.",
  },
  {
    slug: "attorneys-firms",
    name: "Attorneys & Law Firms",
    shortName: "Attorneys & Firms",
    description:
      "Law firms and attorneys previously supplied as possible resources.",
  },
  {
    slug: "disability-medical-advocacy",
    name: "Disability, Medical-Gaslighting & Institutional Advocacy",
    shortName: "Disability & Medical Advocacy",
    description:
      "Disability rights, medical-gaslighting advocacy, trauma, and patient-advocacy resources.",
  },
  {
    slug: "victim-linked-programs",
    name: "Other Victim-Linked Programs & Funds",
    shortName: "Victim-Linked Programs",
    description:
      "Crime-victim funds, VOCA/VAWA grant programs, medical-legal partnerships, and related relief.",
  },
  {
    slug: "lyme-co-infections",
    name: "Lyme Disease & Co-Infections Resources",
    shortName: "Lyme & Co-Infections",
    description:
      "Lyme disease advocacy, treatment, patient-rights, and co-infection resources.",
  },
  {
    slug: "housing-financial-aid",
    name: "Housing, Grants & Financial Aid",
    shortName: "Housing & Financial Aid",
    description:
      "Emergency financial aid, grants, housing, rental assistance, food, and economic-support programs.",
  },
];

export interface Resource {
  id: string;
  name: string;
  acronym: string | null;
  description: string | null;
  category: CategorySlug;
  subcategory: string | null;
  phoneRaw: string | null;
  phoneNormalized: string | null;
  email: string | null;
  address: string | null;
  website: string | null;
  tags: string;
  priority: number;
  verified: boolean;
  published: boolean;
  sourceNote: string | null;
  piipassAt: string | null;
  piipassNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ResourceInput {
  name: string;
  acronym?: string | null;
  description?: string | null;
  category: CategorySlug;
  subcategory?: string | null;
  phoneRaw?: string | null;
  email?: string | null;
  address?: string | null;
  website?: string | null;
  tags?: string;
  priority?: number;
  verified?: boolean;
  published?: boolean;
  sourceNote?: string | null;
}

export interface SearchParams {
  q?: string;
  category?: CategorySlug | "all";
  priorityOnly?: boolean;
  limit?: number;
  offset?: number;
}

export interface SearchResult {
  resources: (Resource & { _score: number })[];
  total: number;
  query: string;
}

export interface PIIPassReport {
  resourceId: string;
  name: string;
  changed: boolean;
  changes: string[];
}

// ---- URL verification ------------------------------------------------------

export type UrlStatus = "live" | "dead" | "uncertain" | "off-topic" | "invalid";

export interface UrlVerificationResult {
  resourceId: string;
  name: string;
  website: string;
  status: UrlStatus;
  statusCode: number | null;
  finalUrl: string | null;
  note: string;
  offTopicReason: string | null;
  durationMs: number;
  checkedAt: string;
}

export interface UrlVerificationReport {
  total: number;
  verified: number;
  byStatus: Record<UrlStatus, number>;
  results: UrlVerificationResult[];
  ranAt: string | null;
  durationMs: number;
}

export interface PublicStats {
  totalResources: number;
  byCategory: { category: string; count: number }[];
  priorityCount: number;
  withPhone: number;
  withEmail: number;
  withWebsite: number;
  categoryContactCoverage: {
    category: string;
    withPhone: number;
    withEmail: number;
    withWebsite: number;
  }[];
}

export interface AdminStats extends PublicStats {
  recentAudit: AuditLogEntry[];
  lastPiipass: string | null;
  auditCount: number;
  publishedCount: number;
  unpublishedCount: number;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  resourceId: string | null;
  actor: string;
  summary: string;
  details: string | null;
  createdAt: string;
}

export const PRIORITY_LABEL = "Priority resources";
