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

// Normalized url/contact entries preserve the raw verifier-v4 evidence
// objects (website_status, status_reason, dns_status, attempts, ...).
export type NormalizedUrlEntry = Record<string, unknown>;
export type NormalizedContactEntry = Record<string, unknown>;

export type NormalizedVerifierRecord = {
  recordId: string | null;
  name: string;
  suggestedName: string;
  category: string;
  organizationStatus: string;
  organizationReason: string;
  urls: NormalizedUrlEntry[];
  phones: NormalizedContactEntry[];
  emails: NormalizedContactEntry[];
  addresses: Array<Record<string, unknown>>;
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
  current: string | null;
  suggested: string | null;
  evidence: string | null;
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

export type AdmissionInput = {
  record: NormalizedVerifierRecord | { organizationStatus: string };
  issues: VerificationIssueDraft[];
  exclusion?: ExclusionResult | null;
  duplicateKind?: "strong" | "batch" | "ambiguous" | "none";
  verifierRan?: boolean;
  mappingOk?: boolean;
  egressRestricted?: boolean;
};

export type AdmissionDecision = { publishState: string; reason: string };

export type IdentityMatchEntry = {
  row: Record<string, unknown>;
  signals: string[];
  corroborated: boolean;
};

export type IdentityMatchResult = {
  kind: "strong" | "ambiguous" | "none";
  match: Record<string, unknown> | null;
  signals: string[];
  matches: IdentityMatchEntry[];
};

export type EffectiveOrganizationStatus = {
  status: string;
  demoted: boolean;
  rawStatus: string;
  note: string | null;
};

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
  provenance?: { extra?: string[] },
): CandidateSource;
export declare function deadEvidenceKind(record: unknown): "http_response" | "dns_transport";
export declare function effectiveOrganizationStatus(
  record: unknown,
  options?: { egressRestricted?: boolean },
): EffectiveOrganizationStatus;
export declare function classifyIdentityMatch(
  candidate: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    url?: string | null;
    website?: string | null;
  },
  existingRows: Array<Record<string, unknown>>,
  ignoreId?: string,
): IdentityMatchResult;
export declare function admissionDecision(input: AdmissionInput): AdmissionDecision;
export declare function summarizeDecisions(decisions: AdmissionDecision[]): Record<string, number>;
export declare function canonicalResourceRowForHash(
  row: Record<string, unknown>,
): Record<string, unknown>;
export declare function computeResourceDatasetHash(rows: unknown[]): string;
