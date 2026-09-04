// Type declarations for the dependency-free verification core (.mjs so the
// contract tests can execute it directly with node, without node_modules).

export declare const VERIFIER_MIN_VERSION: string;
export declare const PENDING_VERIFICATION_STATUS: string;
export declare const ORG_VERIFIED: string;
export declare const PUBLISH_STATES: string[];
export declare const REVIEW_STATES: string[];
export declare const ISSUE_REVIEW_STATES: string[];
export declare const ISSUE_SEVERITIES: string[];

export type NormalizedUrlEntry = {
  requested: string;
  url: string;
  status: string;
  canonicalUrl: string | null;
  nameSimilarity: number | null;
  evidence: Record<string, unknown>;
};

export type NormalizedContactEntry = {
  value: string;
  status: string;
  corroboration: string | null;
  evidence: Record<string, unknown>;
};

export type NormalizedVerifierRecord = {
  recordId: string | null;
  name: string;
  suggestedName: string | null;
  category: string | null;
  organizationStatus: string;
  organizationReason: string | null;
  urls: NormalizedUrlEntry[];
  phones: NormalizedContactEntry[];
  emails: NormalizedContactEntry[];
  addresses: string[];
  contactNames: string[];
  viability: Record<string, unknown>;
  duplicateGroupId: string | null;
  duplicateConfidence: string | null;
  flags: string[];
  sourceFiles: string[];
  sourceIndexes: number[];
  sourceDocument: string | null;
  description: string | null;
  discoveryNotes: string[];
  errors: string[];
  raw: Record<string, unknown>;
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
  description: string | null;
  category: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  sourceNote: string | null;
};

export type AdmissionInput = {
  record: NormalizedVerifierRecord | { organizationStatus: string };
  issues: VerificationIssueDraft[];
  exclusion?: ExclusionResult | null;
  strongCanonicalMatch?: boolean;
  batchDuplicate?: boolean;
  ambiguous?: boolean;
  verifierRan?: boolean;
  mappingOk?: boolean;
  egressRestricted?: boolean;
};

export type AdmissionDecision = { publishState: string; reason: string };

export declare function normalizeVerifierRecord(raw: unknown): NormalizedVerifierRecord | null;
export declare function hasContactEvidence(record: NormalizedVerifierRecord): boolean;
export declare function looksNonOrganizationRecord(record: NormalizedVerifierRecord): ExclusionResult;
export declare function deriveRecordIssues(
  record: NormalizedVerifierRecord,
  options?: { egressRestricted?: boolean },
): VerificationIssueDraft[];
export declare function pickBestWebsite(record: NormalizedVerifierRecord): NormalizedUrlEntry | null;
export declare function buildCandidateSource(record: NormalizedVerifierRecord): CandidateSource;
export declare function admissionDecision(input: AdmissionInput): AdmissionDecision;
export declare function summarizeDecisions(decisions: AdmissionDecision[]): Record<string, number>;
