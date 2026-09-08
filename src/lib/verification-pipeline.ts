// Durable verification pipeline.
//
// Primary (automatic) workflow:
//   resource staged/imported -> structural validation/normalization ->
//   persisted queued VerificationRun -> durable worker claims the run ->
//   verifier v4 (bundled, application-managed) -> progress and results
//   persisted per record -> strong/ambiguous dedupe classification ->
//   clean qualifying VERIFIED candidates marked publish-eligible ->
//   uncertain/conflicting/ambiguous candidates held for admin review ->
//   admin resolution where required -> publication gate.
//
// The queue is the database. Staged candidates are persisted as
// VerificationResult rows before any verification starts, so a deploy,
// crash, restart, scaling event, or process recycle never loses work: the
// run row survives, a worker re-claims it (stale-heartbeat takeover), and
// only still-unchecked records are re-verified. Retries are bounded with
// backoff. JSON/manifest upload exists only as recovery/debug/interchange -
// it is NOT the primary verification workflow.

import { join } from "node:path";
import { db } from "@/lib/db";
import { CATEGORIES } from "@/lib/types";
import {
  PENDING_VERIFICATION_STATUS,
  ORG_VERIFIED,
  VERIFIER_MIN_VERSION,
  admissionDecision,
  buildCandidateSource,
  classifyIdentityMatch,
  effectiveOrganizationStatus,
  deriveRecordIssues,
  looksNonOrganizationRecord,
  normalizeVerifierRecord,
  summarizeDecisions,
} from "@/lib/verification-core.mjs";
import { probeEgress, runVerifierBatch } from "@/lib/verifier-v4";

export const MAX_RUN_ATTEMPTS = 3;

type JsonRecord = Record<string, unknown>;

type StagedCandidate = {
  /** Tolerant app-shaped source record (import original or canonical row). */
  source: JsonRecord;
  /** Set when re-verifying an existing canonical resource (report-only). */
  resourceId?: string | null;
};

function dataRoot(): string {
  return process.env.BNDR_DATA_DIR ?? join(process.cwd(), ".data");
}

function asTrimmed(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function firstNonEmpty(source: JsonRecord, keys: string[]): string {
  for (const key of keys) {
    const value = asTrimmed(source[key]);
    if (value) return value;
  }
  return "";
}

function candidateName(source: JsonRecord): string {
  return (
    firstNonEmpty(source, ["name", "Resource_Name", "resource_name", "title"]) || "(unnamed record)"
  );
}

function candidateCategory(source: JsonRecord): string {
  return firstNonEmpty(source, ["category", "Category"]);
}

/** Conservative mapping of free-text categories onto canonical category slugs. */
export function mapCategorySlug(raw: string | null | undefined): string | null {
  const value = (raw ?? "").trim().toLowerCase();
  if (!value) return null;
  for (const category of CATEGORIES) {
    if (category.slug === value) return category.slug;
  }
  for (const category of CATEGORIES) {
    if (
      category.name.toLowerCase() === value ||
      category.shortName.toLowerCase() === value
    ) {
      return category.slug;
    }
  }
  const tokens = value.split(/[^a-z0-9]+/).filter((token) => token.length > 3);
  if (!tokens.length) return null;
  let bestSlug: string | null = null;
  let bestScore = 0;
  for (const category of CATEGORIES) {
    const haystack = `${category.slug} ${category.name} ${category.shortName}`.toLowerCase();
    const score = tokens.filter((token) => haystack.includes(token)).length;
    if (score > bestScore) {
      bestScore = score;
      bestSlug = category.slug;
    }
  }
  // Require a confident hit; otherwise leave unmapped for admin review.
  return bestScore >= 2 || (bestScore === 1 && tokens.length === 1) ? bestSlug : null;
}

function normalizeIdentity(value: unknown): string {
  return asTrimmed(value).toLowerCase().replace(/\s+/g, " ");
}

function phoneDigits(value: unknown): string {
  const digits = asTrimmed(value).replace(/[^0-9]/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}

function urlHost(value: unknown): string {
  const raw = asTrimmed(value);
  if (!raw) return "";
  try {
    const url = new URL(raw.includes("://") ? raw : "https://" + raw);
    return url.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

type ExistingResourceRow = {
  id: string;
  name: string;
  email: string | null;
  website: string | null;
  phoneNormalized: string | null;
};

/**
 * Corroborated identity match against existing canonical rows. "Strong"
 * requires a name match plus a contact signal, or two independent contact
 * signals. Hostname, phone, email, or name ALONE never auto-merges - single
 * signal overlaps are classified ambiguous and held for admin review.
 * Never mutates the canonical row - a match only classifies the candidate.
 */
export function findStrongIdentityMatch(
  candidate: { name?: string; email?: string; phone?: string; url?: string },
  existing: ExistingResourceRow[],
  ignoreResourceId?: string | null,
): ExistingResourceRow | null {
  const identity = classifyIdentityMatch(candidate, existing, ignoreResourceId ?? undefined);
  return identity.kind === "strong" ? (identity.match as ExistingResourceRow) : null;
}

/**
 * Persist a queued verification run plus one pending result row per staged
 * candidate. This is the durable handoff point: once this transaction
 * commits, the batch survives any process death and a worker will claim it.
 */
export async function stageVerificationRun(args: {
  actor: string;
  origin: string;
  candidates: StagedCandidate[];
}): Promise<{ id: string; status: string }> {
  const { actor, origin, candidates } = args;
  if (!candidates.length) {
    throw new Error("stageVerificationRun requires at least one candidate");
  }

  const run = await db.$transaction(async (tx) => {
    const created = await tx.verificationRun.create({
      data: {
        origin,
        status: "queued",
        actor,
        settings: { network: true, staged: candidates.length },
      },
    });
    await tx.verificationResult.createMany({
      data: candidates.map((candidate, index) => ({
        runId: created.id,
        recordId: `staged-${String(index + 1).padStart(4, "0")}`,
        resourceId: candidate.resourceId ?? null,
        name: candidateName(candidate.source),
        category: candidateCategory(candidate.source) || null,
        organizationStatus: PENDING_VERIFICATION_STATUS,
        publishState: "held",
        candidateJson: candidate.source as object,
      })),
    });
    await tx.auditLog.create({
      data: {
        action: "verification-stage",
        actor,
        summary: `Staged ${candidates.length} candidate(s) for automatic verification (${origin})`,
        details: JSON.stringify({ runId: created.id, origin, staged: candidates.length }),
      },
    });
    return created;
  });

  return { id: run.id, status: run.status };
}

/** Stage a report-only re-verification pass over existing canonical resources. */
export async function verifyExistingResources(args: {
  actor: string;
  resourceIds: string[];
  origin: string;
}): Promise<{ id: string; status: string }> {
  const rows = await db.resource.findMany({
    where: args.resourceIds.length ? { id: { in: args.resourceIds } } : undefined,
  });
  if (!rows.length) throw new Error("no resources found to verify");
  return stageVerificationRun({
    actor: args.actor,
    origin: args.origin,
    candidates: rows.map((row) => ({
      resourceId: row.id,
      source: {
        name: row.name,
        category: row.category,
        phone: row.phoneRaw ?? row.phoneNormalized ?? "",
        email: row.email ?? "",
        url: row.website ?? "",
        location: row.address ?? "",
        description: row.description ?? "",
        source: `canonical:${row.id}`,
      },
    })),
  });
}

type ApplyContext = {
  runId: string;
  egressRestricted: boolean;
  reviewPairs: JsonRecord[];
};

function ambiguousIdSet(reviewPairs: JsonRecord[]): Set<string> {
  const ids = new Set<string>();
  for (const pair of reviewPairs) {
    for (const key of ["record_a", "record_b"]) {
      const value = asTrimmed(pair[key]);
      if (value) ids.add(value);
    }
  }
  return ids;
}

/**
 * Persist verifier output records. Called repeatedly with checkpoint partials
 * while the verifier runs and once with the final output; per-record upserts
 * keep it idempotent and restart-safe. Individual record failures are
 * quarantined and never abort the batch.
 */
export async function applyVerifierRecords(
  rawRecords: JsonRecord[],
  context: ApplyContext,
): Promise<{ applied: number; failed: number; decisions: Array<{ publishState: string; reason: string }> }> {
  const decisions: Array<{ publishState: string; reason: string }> = [];
  if (!rawRecords.length) return { applied: 0, failed: 0, decisions };

  const existing: ExistingResourceRow[] = await db.resource.findMany({
    select: { id: true, name: true, email: true, website: true, phoneNormalized: true },
  });
  const stagedRows = await db.verificationResult.findMany({
    where: { runId: context.runId },
    select: {
      id: true,
      recordId: true,
      name: true,
      resourceId: true,
      publishState: true,
      candidateJson: true,
    },
  });
  const byRecordId = new Map(stagedRows.map((row) => [row.recordId, row]));
  const byName = new Map(stagedRows.map((row) => [normalizeIdentity(row.name), row]));
  const ambiguousIds = ambiguousIdSet(context.reviewPairs);
  const seenStrongGroups = new Set<string>();
  let applied = 0;
  let failed = 0;

  for (const raw of rawRecords) {
    const fallbackId = asTrimmed(raw?.record_id) || asTrimmed(raw?.name) || `unknown-${applied + failed}`;
    try {
      const record = normalizeVerifierRecord(raw);
      if (!record) continue;

      const stagedRow =
        (record.recordId ? byRecordId.get(record.recordId) : undefined) ??
        byName.get(normalizeIdentity(record.name));
      if (stagedRow?.publishState === "published") continue; // published rows are immutable

      const reverification = Boolean(stagedRow?.resourceId);
      const exclusion = looksNonOrganizationRecord(record);
      const issues = deriveRecordIssues(record, { egressRestricted: context.egressRestricted });
      const candidate = buildCandidateSource(record);
      const stagedCategory = stagedRow
        ? candidateCategory((stagedRow.candidateJson ?? {}) as JsonRecord)
        : "";
      const mappedCategory = mapCategorySlug(candidate.category || stagedCategory);

      const identity = classifyIdentityMatch(candidate, existing, stagedRow?.resourceId ?? undefined);
      const strongMatch = identity.kind === "strong" ? (identity.match as ExistingResourceRow) : null;

      const groupId = record.duplicateGroupId;
      const isStrongMerge = record.duplicateConfidence === "STRONG_IDENTITY_MERGE";
      const batchRepeat = isStrongMerge && groupId ? seenStrongGroups.has(groupId) : false;
      if (isStrongMerge && groupId) seenStrongGroups.add(groupId);

      const ambiguous =
        identity.kind === "ambiguous" ||
        (record.recordId ? ambiguousIds.has(record.recordId) : false) ||
        record.duplicateConfidence === "POSSIBLE_DUPLICATE";

      const duplicateKind = strongMatch
        ? "strong"
        : batchRepeat
          ? "batch"
          : ambiguous
            ? "ambiguous"
            : "none";

      const mappingOk =
        Boolean(candidate.name) &&
        Boolean(candidate.phone || candidate.email || candidate.url || candidate.location) &&
        Boolean(mappedCategory);

      // Safe effective status: restricted-egress runs can never conclude
      // "confirmed dead". Raw verifier status is preserved in evidenceJson
      // and errorsJson below.
      const effectiveStatus = effectiveOrganizationStatus(record, {
        egressRestricted: context.egressRestricted,
      });

      const decision = admissionDecision({
        record,
        exclusion,
        duplicateKind,
        issues,
        mappingOk,
        egressRestricted: context.egressRestricted,
        verifierRan: true,
      });
      // Re-verification of canonical rows is report-only: results always stay
      // held for review; canonical facts are never silently overwritten.
      const publishState = reverification ? "held" : decision.publishState;
      decisions.push(reverification ? { publishState, reason: "reverification_report_only" } : decision);

      const resultData = {
        name: record.name,
        suggestedName: record.suggestedName || null,
        category: mappedCategory ?? (candidate.category || stagedCategory || null),
        organizationStatus: effectiveStatus.status,
        organizationReason: record.organizationReason || null,
        duplicateGroupId: groupId,
        duplicateConfidence: record.duplicateConfidence,
        duplicateKind,
        publishState,
        resourceId: stagedRow?.resourceId ?? strongMatch?.id ?? null,
        candidateJson: (stagedRow?.candidateJson ?? (candidate as unknown)) as object,
        evidenceJson: raw as object,
        flagsJson: record.flags as unknown as object,
        viabilityJson: (record.viability ?? undefined) as object | undefined,
        errorsJson: {
          admissionReason: reverification ? "reverification_report_only" : decision.reason,
          verifierErrors: record.errors,
          ...(effectiveStatus.demoted
            ? {
                rawOrganizationStatus: effectiveStatus.rawStatus,
                statusNote: effectiveStatus.note,
              }
            : {}),
        } as object,
        checkedAt: new Date(),
      };

      const resultRow = stagedRow
        ? await db.verificationResult.update({ where: { id: stagedRow.id }, data: resultData })
        : await db.verificationResult.upsert({
            where: {
              runId_recordId: { runId: context.runId, recordId: record.recordId ?? fallbackId },
            },
            create: {
              runId: context.runId,
              recordId: record.recordId ?? fallbackId,
              ...resultData,
            },
            update: resultData,
          });

      await db.verificationIssue.deleteMany({ where: { resultId: resultRow.id } });
      if (issues.length) {
        await db.verificationIssue.createMany({
          data: issues.map((issue) => ({
            resultId: resultRow.id,
            field: issue.field || "record",
            code: issue.code,
            severity: issue.severity,
            currentValue: issue.currentValue,
            suggestedValue: issue.suggestedValue,
            evidenceJson: (issue.evidence ?? undefined) as object | undefined,
          })),
        });
      }
      applied += 1;
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message.slice(0, 200) : "unknown error";
      // Per-record quarantine: persist the failure and continue the batch.
      try {
        await db.verificationResult.upsert({
          where: { runId_recordId: { runId: context.runId, recordId: fallbackId } },
          create: {
            runId: context.runId,
            recordId: fallbackId,
            name: fallbackId,
            organizationStatus: "INCONCLUSIVE_INTERNAL_ERROR",
            publishState: "held",
            errorsJson: { admissionReason: "record_processing_error", error: message } as object,
            checkedAt: new Date(),
          },
          update: {
            publishState: "held",
            errorsJson: { admissionReason: "record_processing_error", error: message } as object,
            checkedAt: new Date(),
          },
        });
      } catch {
        // Even quarantine persistence failures must not abort the batch.
      }
    }
  }

  return { applied, failed, decisions };
}

function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map((part) => Number.parseInt(part, 10) || 0);
  const pb = b.split(".").map((part) => Number.parseInt(part, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/**
 * Process one claimed (status=running) run: probe egress, invoke the bundled
 * verifier v4 with live network, persist per-record progress from checkpoint
 * files while it runs, classify leftovers, finalize. Throwing hands control
 * to scheduleRetryOrFail; already-checked records are not re-verified on the
 * next attempt (resume semantics).
 */
export async function processVerificationRun(runId: string, workerId: string): Promise<void> {
  const run = await db.verificationRun.findUnique({ where: { id: runId } });
  if (!run || run.status !== "running") return;

  const egress = await probeEgress();
  const egressRestricted = egress.egressRestricted;

  const pending = await db.verificationResult.findMany({
    where: { runId, checkedAt: null },
  });

  let decisions: Array<{ publishState: string; reason: string }> = [];
  let verifierVersion: string | null = run.verifierVersion;

  if (pending.length) {
    const inputRecords = pending.map((row) => ({
      ...((row.candidateJson ?? {}) as JsonRecord),
      record_id: row.recordId,
    }));

    const outDir = join(dataRoot(), "verifier-runs", runId, `attempt-${run.attempts}`);
    const batch = await runVerifierBatch({
      records: inputRecords,
      outDir,
      network: true,
      onCheckpoint: async (records) => {
        await applyVerifierRecords(records, { runId, egressRestricted, reviewPairs: [] });
      },
    });

    if (!batch.records.length) {
      throw new Error(
        `verifier produced no output (exit ${batch.exitCode ?? "killed"}): ${batch.stderrTail.slice(-400)}`,
      );
    }

    const outcome = await applyVerifierRecords(batch.records, {
      runId,
      egressRestricted,
      reviewPairs: batch.reviewPairs,
    });
    decisions = outcome.decisions;
    verifierVersion = asTrimmed(batch.manifest?.verifier_version) || verifierVersion;
  }

  // Anything the verifier did not return stays held - never guessed.
  const leftovers = await db.verificationResult.findMany({
    where: { runId, checkedAt: null },
    select: { id: true },
  });
  for (const row of leftovers) {
    await db.verificationResult.update({
      where: { id: row.id },
      data: {
        publishState: "held",
        errorsJson: { admissionReason: "verifier_did_not_run" } as object,
      },
    });
    await db.verificationIssue.create({
      data: {
        resultId: row.id,
        field: "record",
        code: "VERIFIER_DID_NOT_RUN",
        severity: "warning",
        evidenceJson: {
          note: "The verifier returned no result for this record in any attempt.",
        } as object,
      },
    });
  }

  const versionBelowMin =
    verifierVersion !== null &&
    verifierVersion !== "" &&
    compareVersions(verifierVersion, VERIFIER_MIN_VERSION) < 0;

  await db.verificationRun.update({
    where: { id: runId },
    data: {
      status: "completed",
      completedAt: new Date(),
      claimedBy: workerId,
      verifierVersion,
      summary: {
        decisions: summarizeDecisions(decisions),
        egressRestricted,
        leftovers: leftovers.length,
      } as object,
      error: versionBelowMin ? `verifier_version_below_minimum_${VERIFIER_MIN_VERSION}` : null,
    },
  });
  await db.auditLog.create({
    data: {
      action: "verification-run",
      actor: run.actor,
      summary: `Verification run completed (${originLabel(run.origin)})`,
      details: JSON.stringify({
        runId,
        workerId,
        egressRestricted,
        decisions: summarizeDecisions(decisions),
        leftovers: leftovers.length,
      }),
    },
  });
}

function originLabel(origin: string): string {
  return origin || "unknown-origin";
}

/** Bounded retry with quadratic backoff; permanent failure keeps the audit trail. */
export async function scheduleRetryOrFail(runId: string, message: string): Promise<void> {
  const run = await db.verificationRun.findUnique({ where: { id: runId } });
  if (!run) return;
  if (run.attempts >= MAX_RUN_ATTEMPTS) {
    await db.verificationRun.update({
      where: { id: runId },
      data: { status: "failed", error: message.slice(0, 1000), completedAt: new Date() },
    });
    await db.auditLog.create({
      data: {
        action: "verification-run",
        actor: run.actor,
        summary: `Verification run failed permanently after ${run.attempts} attempt(s)`,
        details: JSON.stringify({ runId, error: message.slice(0, 1000) }),
      },
    });
    return;
  }
  const delayMs = run.attempts * run.attempts * 60_000;
  await db.verificationRun.update({
    where: { id: runId },
    data: {
      status: "queued",
      nextAttemptAt: new Date(Date.now() + delayMs),
      error: message.slice(0, 1000),
    },
  });
}

/**
 * Recovery/debug/interchange path only - NOT the primary workflow. Ingests
 * externally produced verifier v4 artifacts (verified_resources.json plus
 * optional run_manifest.json) into the same review pipeline and audit trail.
 */
export async function persistExternalVerifierRun(args: {
  actor: string;
  records: JsonRecord[];
  manifest: JsonRecord | null;
  reviewPairs: JsonRecord[];
  egressRestricted: boolean;
  filename?: string | null;
}): Promise<{ runId: string; imported: number; failed: number }> {
  const manifestVersion = asTrimmed(args.manifest?.verifier_version) || null;
  const versionBelowMin =
    manifestVersion !== null && compareVersions(manifestVersion, VERIFIER_MIN_VERSION) < 0;

  const run = await db.verificationRun.create({
    data: {
      origin: "external-import",
      status: "running",
      actor: args.actor,
      attempts: 1,
      claimedBy: "external-import",
      heartbeatAt: new Date(),
      verifierVersion: manifestVersion,
      settings: {
        recovery: true,
        filename: args.filename ?? null,
        egressRestricted: args.egressRestricted,
      } as object,
      error: versionBelowMin ? `verifier_version_below_minimum_${VERIFIER_MIN_VERSION}` : null,
    },
  });

  const outcome = await applyVerifierRecords(args.records, {
    runId: run.id,
    egressRestricted: args.egressRestricted,
    reviewPairs: args.reviewPairs,
  });

  await db.verificationRun.update({
    where: { id: run.id },
    data: {
      status: "completed",
      completedAt: new Date(),
      summary: {
        decisions: summarizeDecisions(outcome.decisions),
        recovery: true,
        applied: outcome.applied,
        failed: outcome.failed,
      } as object,
    },
  });
  await db.auditLog.create({
    data: {
      action: "verification-import",
      actor: args.actor,
      summary: `Recovery import persisted ${outcome.applied} verifier record(s) (${outcome.failed} failed)`,
      details: JSON.stringify({
        runId: run.id,
        applied: outcome.applied,
        failed: outcome.failed,
        egressRestricted: args.egressRestricted,
        filename: args.filename ?? null,
      }),
    },
  });

  return { runId: run.id, imported: outcome.applied, failed: outcome.failed };
}
