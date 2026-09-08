// Type declarations for the dependency-free verification core (.mjs so the
// contract tests can execute it directly with node, without node_modules).

export declare const VERIFIER_MIN_VERSION: string;
export declare const PENDING_VERIFICATION_STATUS: string;
export declare const ORG_VERIFIED: string;
export declare const PUBLISH_STATES: string[];
export declare const REVIEW_STATES: string[];
export declare const ISSUE_REVIEW_STATES: string[];
export declare const ISSUE_SEVERITIES: string[];
export declare const RESTRICTED_EGRESS_SAFE_STATUS: string;

export type VerifierUrlEntry = Record<string, unknown> & {
  requested_url?: unknown;
  canonical_url?: unknown;
  website_status?: unknown;
  status_reason?: unknown;
  dns_status?: unknown;
  name_similarity?: unknown;
  attempts?: unknown;
  http_status?: unknown;
  status_code?: unknown;
};

export type VerifierContactEntry = Record<string, unknown> & {
  value?: unknown;
  status?: unknown;
  format_status?: unknown;
  plan_check_note?: unknown;
  error?: unknown;
};

export type VerifierAddressEntry = Record<string, unknown> & {
  value?: unknown;
  text?: unknown;
};

export type NormalizedVerifierRecord = {
  recordId: string | null;
  name: string;
  suggestedName: string;
  category: string;
  organizationStatus: string;
  organizationReason: string;
  urls: VerifierUrlEntry[];
  phones: VerifierContactEntry[];
  emails: VerifierContactEntry[];
  addresses: VerifierAddressEntry[];
  contactNames: Array<Record<string, unknown>>;
  viability: Record<string, unknown> | null;
  duplicateGroupId: string | null;
  duplicateConfidence: string | null;
  flags: string[];
  sourceFiles: string[];
  sourceIndexes: number[];
  sourceDocument: string;
  description: string;
  discoveryNotes: string[];
  errors: string[];
};

export type VerificationIssueDraft = {
  code: string;
  severity: string;
  field: string | null;
  currentValue: string | null;
  suggestedValue: string | null;
  evidence: Record<string, unknown> | null;
};

export type ExclusionResult = { excluded: boolean; reasons: string[] };

export type CandidateSource = {
  name: string;
  category: string;
  phone: string;
  email: string;
  url: string;
  location: string;
  description: string;
  source: string;
};

export type ExistingIdentityRow = {
  id?: string;
  name?: string;
  email?: string | null;
  website?: string | null;
  phoneNormalized?: string | null;
  phoneRaw?: string | null;
  [key: string]: unknown;
};

export type IdentityMatch<T extends ExistingIdentityRow = ExistingIdentityRow> =
  | { kind: "strong"; match: T; signals: string[]; matches: Array<{ match: T; signals: string[] }> }
  | { kind: "ambiguous"; match: null; signals: string[]; matches: Array<{ match: T; signals: string[] }> }
  | { kind: "none"; match: null; signals: string[]; matches: [] };

export type EffectiveOrganizationStatus = {
  status: string;
  demoted: boolean;
  rawStatus: string;
  hardHttpStatus: number | null;
  note: string | null;
};

export type DuplicateKind = "strong" | "batch" | "ambiguous" | "none";

export type AdmissionInput = {
  record: NormalizedVerifierRecord | { organizationStatus: string; urls?: VerifierUrlEntry[] };
  issues: VerificationIssueDraft[];
  exclusion?: ExclusionResult | null;
  duplicateKind?: DuplicateKind;
  verifierRan?: boolean;
  mappingOk?: boolean;
  egressRestricted?: boolean;
};

export type AdmissionDecision = { publishState: string; reason: string };

export declare function evidencedHardDeadStatus(
  record: { urls?: VerifierUrlEntry[] } | null | undefined,
): number | null;
export declare function normalizeVerifierRecord(raw: unknown): NormalizedVerifierRecord | null;
export declare function hasContactEvidence(record: NormalizedVerifierRecord): boolean;
export declare function looksNonOrganizationRecord(record: NormalizedVerifierRecord): ExclusionResult;
export declare function deriveRecordIssues(
  record: NormalizedVerifierRecord,
  options?: { egressRestricted?: boolean },
): VerificationIssueDraft[];
export declare function pickBestWebsite(record: NormalizedVerifierRecord): string;
export declare function buildCandidateSource(
  record: NormalizedVerifierRecord,
  provenance?: { extra?: unknown[] },
): CandidateSource;
export declare function effectiveOrganizationStatus(
  record: { organizationStatus?: string; urls?: VerifierUrlEntry[] } | null | undefined,
  options?: { egressRestricted?: boolean },
): EffectiveOrganizationStatus;
export declare function classifyIdentityMatch<T extends ExistingIdentityRow>(
  candidate: {
    name?: unknown;
    email?: unknown;
    phone?: unknown;
    url?: unknown;
    website?: unknown;
  } | null | undefined,
  existingRows: T[] | null | undefined,
  ignoreId?: string,
): IdentityMatch<T>;
export declare function admissionDecision(input: AdmissionInput): AdmissionDecision;
export declare function summarizeDecisions(decisions: AdmissionDecision[]): Record<string, number>;
