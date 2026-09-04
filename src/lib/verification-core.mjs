// Dependency-free verification ingestion core.
//
// Classifies verifier-v4 output records for staging, admin review, and the
// publication gate. This module performs no network I/O and never mutates
// canonical resources. The bundled verifier (verifier/resource_verifier_core.py,
// VERSION 4.0.0) remains the canonical real-world verification semantics; this
// layer implements only the adapter contract around it:
//
// - network_failure_is_dead = false (a DNS/transport failure never proves a
//   site is dead; it produces a reviewable issue instead)
// - reachable_page_is_identity_proof = false (reachability alone never
//   upgrades identity confidence)
// - silent_overwrite_existing_canonical_fact = false (suggested changes are
//   persisted as issues; canonical rows are only changed by explicit admin
//   action)
// - admission_policy.auto_publish = false (clean VERIFIED candidates become
//   publish-eligible; publication itself is an explicit admin gate)

import { createHash } from "node:crypto";

export const VERIFIER_MIN_VERSION = "4.0.0";
export const PENDING_VERIFICATION_STATUS = "PENDING_VERIFICATION";
export const ORG_VERIFIED = "VERIFIED";

export const PUBLISH_STATES = [
  "publish_eligible",
  "held",
  "excluded",
  "canonical_match",
  "published",
];
export const REVIEW_STATES = ["unreviewed", "reviewed"];
export const ISSUE_REVIEW_STATES = ["unresolved", "accepted", "dismissed"];
export const ISSUE_SEVERITIES = ["critical", "warning", "info", "suggestion"];

const DEAD_URL_STATUSES = new Set(["DEAD_CONFIRMED_DNS", "DEAD_CONFIRMED"]);
const REACHABLE_URL_STATUSES = new Set([
  "VERIFIED_REACHABLE",
  "VERIFIED_SERVER_EXISTS_ACCESS_RESTRICTED",
  "REACHABLE_PAGE_MISSING",
]);

function asString(value) {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

/**
 * Tolerantly normalize one verifier-v4 output record. Returns null when the
 * value is not record-shaped. Unknown fields are preserved by callers via the
 * original raw object; this normalized view is what classification uses.
 */
export function normalizeVerifierRecord(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const name = asString(raw.name).trim();
  const recordId = asString(raw.record_id).trim();
  if (!name && !recordId) return null;
  return {
    recordId: recordId || null,
    name,
    suggestedName: asString(raw.suggested_name).trim(),
    category: asString(raw.category).trim(),
    organizationStatus: asString(raw.organization_status).trim() || "INCONCLUSIVE",
    organizationReason: asString(raw.organization_reason).trim(),
    urls: asArray(raw.urls).filter((u) => u && typeof u === "object"),
    phones: asArray(raw.phones).filter((p) => p && typeof p === "object"),
    emails: asArray(raw.emails).filter((e) => e && typeof e === "object"),
    addresses: asArray(raw.addresses).filter((a) => a && typeof a === "object"),
    contactNames: asArray(raw.contact_names).filter((c) => c && typeof c === "object"),
    viability: raw.viability && typeof raw.viability === "object" ? raw.viability : null,
    duplicateGroupId: asString(raw.duplicate_group_id).trim() || null,
    duplicateConfidence: asString(raw.duplicate_confidence).trim() || null,
    flags: asArray(raw.flags).map(asString).filter(Boolean),
    sourceFiles: asArray(raw.source_files).map(asString).filter(Boolean),
    sourceIndexes: asArray(raw.source_indexes).filter((n) => Number.isInteger(n)),
    sourceDocument: asString(raw.source_document).trim(),
    description: asString(raw.description).trim(),
    discoveryNotes: asArray(raw.discovery_notes).map(asString).filter(Boolean),
    errors: asArray(raw.errors).map(asString).filter(Boolean),
  };
}

export function hasContactEvidence(record) {
  return record.urls.length > 0 || record.phones.length > 0 || record.emails.length > 0;
}

const INSTRUCTION_PATTERN =
  /\b(how to|step \d|note:|remember to|you should|be sure to|make sure|ask for|if you are|instructions?|template|checklist|do not send|write down)\b/i;
const PERSONAL_PATTERN =
  /\b(my (son|daughter|kids?|case|lawyer|attorney|ex|hearing|records)|our family|i was|i am|i have|i need|me and)\b/i;

/**
 * Detect records that are narrative/instructional/personal prose rather than
 * organizations. Exclusion is intentionally conservative: records with real
 * contact evidence are held for review instead of excluded, except when the
 * name itself is personal prose (privacy: personal/user-specific prose is
 * never published).
 */
export function looksNonOrganizationRecord(record) {
  const reasons = [];
  const name = record.name;
  const words = name.split(/\s+/).filter(Boolean);
  const contact = hasContactEvidence(record);
  if (name.length > 140 || words.length > 16) reasons.push("narrative_name");
  if (INSTRUCTION_PATTERN.test(name)) reasons.push("instruction_language_name");
  if (PERSONAL_PATTERN.test(name)) reasons.push("personal_prose_name");
  if (!contact) {
    if (PERSONAL_PATTERN.test(record.description)) reasons.push("personal_prose_description");
    if (INSTRUCTION_PATTERN.test(record.description) && record.description.length > 240) {
      reasons.push("instruction_language_description");
    }
    if (name.length > 25 && name === name.toUpperCase() && /[A-Z]/.test(name)) {
      reasons.push("heading_like_name");
    }
  }
  const excluded =
    reasons.length > 0 &&
    (reasons.includes("personal_prose_name") ||
      !contact ||
      (reasons.includes("narrative_name") && reasons.includes("instruction_language_name")));
  return { excluded, reasons };
}

/**
 * Derive field-level issues from a normalized verifier record.
 *
 * egressRestricted: when the run executed in an environment where control
 * domains also failed DNS, DNS-based death reports are demoted to
 * environment-caveated warnings. In either case a reported dead website is a
 * reviewable issue, never an automatic exclusion (network_failure_is_dead=false).
 */
export function deriveRecordIssues(record, options = {}) {
  const egressRestricted = options.egressRestricted === true;
  const issues = [];
  const push = (field, code, severity, currentValue, suggestedValue, evidence) => {
    issues.push({
      field,
      code,
      severity,
      currentValue: currentValue ?? null,
      suggestedValue: suggestedValue ?? null,
      evidence: evidence ?? null,
    });
  };

  if (record.suggestedName && record.suggestedName !== record.name) {
    push(
      "name",
      "SUGGESTED_NAME",
      record.flags.includes("name_looks_compound_or_malformed") ? "critical" : "suggestion",
      record.name,
      record.suggestedName,
      { flags: record.flags.filter((f) => f.startsWith("name")) },
    );
  } else if (record.flags.includes("name_looks_compound_or_malformed")) {
    push("name", "COMPOUND_OR_MALFORMED_NAME", "critical", record.name, null, {
      note: "Verifier flagged the name as compound or malformed and offered no safe split.",
    });
  }
  if (record.flags.includes("name_is_url_like")) {
    push("name", "NAME_IS_URL_LIKE", "critical", record.name, null, null);
  }
  if (record.flags.includes("contains_must_get_placeholders")) {
    push("record", "UNRESOLVED_PLACEHOLDER", "critical", null, null, {
      note: "Source text contains unresolved placeholder markers. Resolve before publication.",
    });
  }
  if (record.flags.includes("multiple_domains_compound_record")) {
    push("record", "COMPOUND_MULTI_DOMAIN_RECORD", "critical", null, null, {
      note: "Record references multiple unrelated domains; it may describe several organizations.",
    });
  }
  if (record.flags.includes("phone_matches_url_numeric_id_quarantined")) {
    push("phone", "FALSE_PHONE_FROM_URL_ID", "critical", null, null, {
      note: "Digit run matched a URL numeric id; the verifier quarantined it as a false phone.",
    });
  }

  for (const url of record.urls) {
    const status = asString(url.website_status);
    const requested = asString(url.requested_url);
    const canonical = asString(url.canonical_url);
    if (DEAD_URL_STATUSES.has(status)) {
      if (egressRestricted) {
        push("website", "UNREACHABLE_IN_RESTRICTED_ENVIRONMENT", "warning", requested, null, {
          status,
          reason: asString(url.status_reason),
          dnsStatus: asString(url.dns_status),
          environment:
            "Outbound DNS/network egress was restricted during this run; DNS failure here is not evidence the site is dead.",
        });
      } else {
        push("website", "WEBSITE_DEAD_REPORTED", "critical", requested, null, {
          status,
          reason: asString(url.status_reason),
          dnsStatus: asString(url.dns_status),
          note: "Verifier reports strong DNS-based death. Admin confirmation is required; canonical facts are never silently overwritten.",
        });
      }
    } else if (status === "REACHABLE_PAGE_MISSING") {
      push("website", "REACHABLE_PAGE_MISSING", "warning", requested, null, {
        status,
        reason: asString(url.status_reason),
      });
    } else if (status.startsWith("INCONCLUSIVE")) {
      push("website", "REACHABILITY_INCONCLUSIVE", "info", requested, null, {
        status,
        reason: asString(url.status_reason),
      });
    } else if (REACHABLE_URL_STATUSES.has(status)) {
      if (canonical && requested && canonical !== requested) {
        push("website", "CANONICAL_URL_SUGGESTED", "suggestion", requested, canonical, { status });
      }
      const similarity = typeof url.name_similarity === "number" ? url.name_similarity : null;
      if (similarity !== null && similarity < 0.3) {
        push("website", "IDENTITY_UNCONFIRMED", "warning", requested, null, {
          status,
          nameSimilarity: similarity,
          note: "Page reachable but identity signals are weak; reachability is not identity proof.",
        });
      }
    }
  }

  for (const phone of record.phones) {
    const status = asString(phone.status);
    const value = asString(phone.value);
    const formatStatus = asString(phone.format_status);
    if (status === "IMPLAUSIBLE_SOURCE_VALUE" || formatStatus.startsWith("IMPLAUSIBLE")) {
      push("phone", "IMPLAUSIBLE_PHONE", "critical", value, null, {
        status,
        formatStatus,
        note: asString(phone.plan_check_note),
      });
    } else if (status === "PLAUSIBLE_UNVERIFIED") {
      push("phone", "PHONE_UNCORROBORATED", "info", value, null, {
        status,
        planCheckNote: asString(phone.plan_check_note),
      });
    }
  }

  for (const email of record.emails) {
    const status = asString(email.status);
    const value = asString(email.value);
    if (asString(email.format_status) === "INVALID_SYNTAX") {
      push("email", "INVALID_EMAIL_SYNTAX", "critical", value, null, { status });
    } else if (status === "DOMAIN_DNS_FAILURE") {
      push(
        "email",
        egressRestricted ? "EMAIL_DOMAIN_UNCONFIRMED_RESTRICTED_ENV" : "EMAIL_DOMAIN_DNS_FAILURE",
        egressRestricted ? "info" : "warning",
        value,
        null,
        { status, error: asString(email.error) },
      );
    }
  }

  for (const err of record.errors.slice(0, 5)) {
    push("record", "RECORD_ERROR", "warning", null, null, { error: err });
  }

  return issues;
}

function rankUrl(url) {
  const status = asString(url.website_status);
  if (status === "VERIFIED_REACHABLE") return 5;
  if (status === "VERIFIED_SERVER_EXISTS_ACCESS_RESTRICTED") return 4;
  if (status === "REACHABLE_PAGE_MISSING") return 3;
  if (status.startsWith("INCONCLUSIVE")) return 2;
  if (DEAD_URL_STATUSES.has(status)) return 1;
  return 0;
}

export function pickBestWebsite(record) {
  const ranked = [...record.urls].sort((a, b) => rankUrl(b) - rankUrl(a));
  const best = ranked[0];
  if (!best) return "";
  return asString(best.canonical_url) || asString(best.requested_url);
}

/**
 * Map a normalized verifier record to an app-shaped source candidate object
 * (the same tolerant shape the resource ingestion pipeline accepts).
 */
export function buildCandidateSource(record, provenance = {}) {
  const phones = record.phones.map((p) => asString(p.value)).filter(Boolean);
  const emails = record.emails.map((e) => asString(e.value)).filter(Boolean);
  const addresses = record.addresses
    .map((a) => asString(a.value ?? a.text ?? ""))
    .filter(Boolean);
  const sourceParts = [record.sourceDocument, ...(provenance.extra ?? [])].filter(Boolean);
  return {
    name: record.suggestedName || record.name,
    category: record.category,
    phone: phones.join(" | "),
    email: emails[0] ?? "",
    url: pickBestWebsite(record),
    location: addresses[0] ?? "",
    description: record.description,
    source: sourceParts.join(" | "),
  };
}

/**
 * Evidence-gated admission policy (adapter contract admission_policy).
 * auto_publish is always false: the strongest automatic outcome is
 * "publish_eligible". Everything uncertain, conflicting, or ambiguous is held
 * for admin review; only clearly non-organization records and intra-batch
 * duplicate merges are excluded.
 */
// Safe effective status: conclusions that require network corroboration are
// never trusted from a restricted-egress environment. The raw verifier status
// is preserved as evidence; only the effective (decision/display) status is
// demoted to an explicitly environmental value.
export const RESTRICTED_EGRESS_SAFE_STATUS = "UNREACHABLE_IN_RESTRICTED_ENVIRONMENT";

// HTTP statuses that are genuine server-issued "gone/blocked" evidence: the
// origin answered, so transport demonstrably worked for that probe.
const HTTP_GONE_STATUSES = new Set([404, 410, 451]);
const HTTP_EVIDENCE_WEBSITE_STATUSES = new Set([
  "PAGE_MISSING_OR_MOVED",
  "REACHABLE_PAGE_MISSING",
]);

/**
 * Classify the evidence behind a dead/unreachable website verdict.
 * "http_response": at least one probe received an authentic HTTP 404/410/451
 * origin response (or the verifier classified a URL as reachable-but-missing).
 * "dns_transport": every failure is DNS/timeout/TLS/connection-level
 * uncertainty with no server response at all.
 */
export function deadEvidenceKind(record) {
  const urls = record && Array.isArray(record.urls) ? record.urls : [];
  for (const entry of urls) {
    if (!entry || typeof entry !== "object") continue;
    const websiteStatus = String(entry.website_status ?? entry.status ?? "");
    if (HTTP_EVIDENCE_WEBSITE_STATUSES.has(websiteStatus)) return "http_response";
    const attempts = Array.isArray(entry.attempts) ? entry.attempts : [];
    for (const attempt of attempts) {
      const status = attempt && typeof attempt.status === "number" ? attempt.status : null;
      if (status !== null && HTTP_GONE_STATUSES.has(status)) return "http_response";
    }
  }
  return "dns_transport";
}

export function effectiveOrganizationStatus(record, options = {}) {
  const egressRestricted = options.egressRestricted === true;
  const rawStatus = (record && record.organizationStatus) || "INCONCLUSIVE";
  if (
    egressRestricted &&
    (rawStatus === "WEBSITE_DEAD_CONFIRMED" || rawStatus === "WEBSITE_DEAD_REPORTED")
  ) {
    if (deadEvidenceKind(record) === "http_response") {
      // A server-issued 404/410/451 is authentic evidence even under
      // restricted egress: the response itself proves transport succeeded
      // for that probe. The dead verdict stands.
      return {
        status: rawStatus,
        demoted: false,
        rawStatus,
        note:
          "Dead status retained: evidence includes an authentic HTTP 404/410/451 origin response, which restricted egress cannot explain away.",
      };
    }
    return {
      status: RESTRICTED_EGRESS_SAFE_STATUS,
      demoted: true,
      rawStatus,
      note:
        "DNS/transport failure observed from a restricted-egress environment is not evidence the site is dead. Raw verifier status preserved as evidence; re-verify from an environment with network egress.",
    };
  }
  return { status: rawStatus, demoted: false, rawStatus, note: null };
}

function identityName(value) {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function identityEmail(value) {
  const email = String(value ?? "").trim().toLowerCase();
  return email.includes("@") ? email : "";
}

function identityPhone(value) {
  const first = String(value ?? "").split("|")[0];
  const digits = first.replace(/\D+/g, "");
  return digits.length >= 10 ? digits.slice(-10) : "";
}

function identityHost(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw.includes("://") ? raw : "https://" + raw);
    return url.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

// Corroborated identity matching. A canonical auto-match ("strong") requires
// the organization NAME to match PLUS at least one contact signal
// (email/phone/host) on the SAME canonical row. Contact signals alone -
// shared hostname, phone, or email, in any combination - NEVER auto-merge,
// because umbrella organizations legitimately share websites and front-desk
// numbers across distinct programs. Every plausible canonical row is
// collected; if more than one row is corroborated, or any row overlaps
// without corroboration, the result is "ambiguous" and held for admin
// review - never first-match.
export function classifyIdentityMatch(candidate, existingRows, ignoreId) {
  const candName = identityName(candidate && candidate.name);
  const candEmail = identityEmail(candidate && candidate.email);
  const candPhone = identityPhone(candidate && candidate.phone);
  const candHost = identityHost(candidate && (candidate.url ?? candidate.website));
  const matches = [];
  for (const row of existingRows ?? []) {
    if (!row) continue;
    if (ignoreId && row.id === ignoreId) continue;
    const signals = [];
    if (candName && identityName(row.name) === candName) signals.push("name");
    if (candEmail && row.email && identityEmail(row.email) === candEmail) signals.push("email");
    if (candPhone && identityPhone(row.phoneNormalized ?? row.phoneRaw) === candPhone) {
      signals.push("phone");
    }
    if (candHost && row.website && identityHost(row.website) === candHost) signals.push("host");
    if (!signals.length) continue;
    // Corroborated identity requires the organization NAME plus at least one
    // contact channel. Shared host/phone/email alone can NEVER auto-merge:
    // umbrella organizations legitimately share hosts, front-desk phones,
    // and intake mailboxes across genuinely different programs.
    const contactSignals = signals.filter((signal) => signal !== "name");
    const corroborated = signals.includes("name") && contactSignals.length >= 1;
    matches.push({ row, signals, corroborated });
  }
  const corroborated = matches.filter((entry) => entry.corroborated);
  if (corroborated.length === 1) {
    // Exactly one corroborated canonical candidate: safe strong match.
    return {
      kind: "strong",
      match: corroborated[0].row,
      signals: corroborated[0].signals,
      matches,
    };
  }
  if (matches.length > 0) {
    // Multiple corroborated candidates, or contact-only overlap: ambiguous.
    // A human resolves it in review. Never first-match, never auto-merge.
    return { kind: "ambiguous", match: null, signals: matches[0].signals, matches };
  }
  return { kind: "none", match: null, signals: [], matches: [] };
}

export function admissionDecision(input) {
  const {
    record,
    exclusion,
    duplicateKind,
    issues,
    mappingOk,
    egressRestricted,
    verifierRan,
  } = input;
  if (exclusion && exclusion.excluded) {
    return {
      publishState: "excluded",
      reason: `non_organization_record:${exclusion.reasons.join(",")}`,
    };
  }
  if (duplicateKind === "strong") {
    return { publishState: "canonical_match", reason: "strong_identity_match_existing_resource" };
  }
  if (duplicateKind === "batch") {
    return { publishState: "excluded", reason: "duplicate_within_batch" };
  }
  if (!verifierRan) {
    return { publishState: "held", reason: "verifier_did_not_run" };
  }
  const effective = effectiveOrganizationStatus(record, { egressRestricted });
  if (effective.status !== ORG_VERIFIED) {
    return {
      publishState: "held",
      reason: `organization_status_${effective.status.toLowerCase()}`,
    };
  }
  if (duplicateKind === "ambiguous") {
    return { publishState: "held", reason: "ambiguous_duplicate" };
  }
  const critical = issues.filter((issue) => issue.severity === "critical");
  if (critical.length > 0) {
    return {
      publishState: "held",
      reason: `critical_issues:${critical.map((issue) => issue.code).join(",")}`,
    };
  }
  if (!mappingOk) {
    return { publishState: "held", reason: "schema_mapping_failed" };
  }
  if (egressRestricted) {
    return {
      publishState: "held",
      reason: "restricted_network_environment_cannot_corroborate",
    };
  }
  return { publishState: "publish_eligible", reason: "verified_clean" };
}

export function summarizeDecisions(decisions) {
  const counts = {};
  for (const decision of decisions) {
    counts[decision.publishState] = (counts[decision.publishState] ?? 0) + 1;
  }
  return counts;
}

// ---- Canonical dataset hashing (snapshot integrity proof) -------------------
// A snapshot's datasetHash commits to the exact row contents, not just the
// row count. Restores must re-read what the database actually persisted and
// prove the recomputed hash (and count) match the snapshot before the
// transaction may commit.

const RESOURCE_HASH_FIELDS = [
  "id",
  "name",
  "acronym",
  "description",
  "category",
  "subcategory",
  "phoneRaw",
  "phoneNormalized",
  "email",
  "address",
  "website",
  "tags",
  "priority",
  "verified",
  "published",
  "sourceNote",
  "piipassAt",
  "piipassNotes",
  "createdAt",
  "updatedAt",
];

function hashableValue(value) {
  if (value === undefined || value === null) return null;
  if (value instanceof Date) return value.toISOString();
  return value;
}

export function canonicalResourceRowForHash(row) {
  const out = {};
  for (const field of RESOURCE_HASH_FIELDS) {
    out[field] = hashableValue(row ? row[field] : null);
  }
  return out;
}

export function computeResourceDatasetHash(rows) {
  const canonical = (Array.isArray(rows) ? rows : [])
    .map((row) => canonicalResourceRowForHash(row))
    .sort((a, b) => {
      const left = String(a.id ?? "");
      const right = String(b.id ?? "");
      return left < right ? -1 : left > right ? 1 : 0;
    });
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}
