// BNDR. — typed client-side API wrappers.
// Public reads and authenticated admin operations use distinct routes.

import type {
  AdminStats,
  AuditLogEntry,
  PIIPassReport,
  PublicStats,
  Resource,
  ResourceInput,
  SearchResult,
  SearchParams,
  UrlVerificationReport,
} from "./types";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = (await res.json()) as {
        error?: string | { message?: string };
      };
      if (typeof body.error === "string") message = body.error;
      if (body.error && typeof body.error === "object" && body.error.message) {
        message = body.error.message;
      }
    } catch {
      // Keep the status-based message for non-JSON responses.
    }
    throw new ApiError(message, res.status);
  }
  return (await res.json()) as T;
}

function resourceSearchParams(params: SearchParams): URLSearchParams {
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  if (params.category) sp.set("category", params.category);
  if (params.priorityOnly) sp.set("priorityOnly", "1");
  if (params.limit != null) sp.set("limit", String(params.limit));
  if (params.offset != null) sp.set("offset", String(params.offset));
  return sp;
}

// ---- Public directory ------------------------------------------------------

export async function fetchResources(
  params: SearchParams,
): Promise<SearchResult> {
  const res = await fetch(`/api/resources?${resourceSearchParams(params)}`, {
    cache: "no-store",
  });
  return jsonOrThrow<SearchResult>(res);
}

export async function fetchResource(id: string): Promise<Resource> {
  const res = await fetch(`/api/resources/${id}`, { cache: "no-store" });
  return jsonOrThrow<Resource>(res);
}

export async function fetchStats(): Promise<PublicStats> {
  const res = await fetch("/api/stats", { cache: "no-store" });
  return jsonOrThrow<PublicStats>(res);
}

// ---- Admin resources -------------------------------------------------------

export async function fetchAdminResources(
  params: SearchParams & { published?: boolean },
): Promise<SearchResult> {
  const sp = resourceSearchParams(params);
  if (params.published != null) sp.set("published", String(params.published));
  const res = await fetch(`/api/admin/resources?${sp}`, { cache: "no-store" });
  return jsonOrThrow<SearchResult>(res);
}

export async function createResource(
  input: ResourceInput,
): Promise<Resource> {
  const res = await fetch("/api/admin/resources", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return jsonOrThrow<Resource>(res);
}

export async function updateResource(
  id: string,
  patch: Partial<ResourceInput>,
): Promise<Resource> {
  const res = await fetch(`/api/admin/resources/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  return jsonOrThrow<Resource>(res);
}

export interface DeleteResourceResult {
  ok: boolean;
  id: string;
  snapshotId: string;
  snapshotHash: string;
  snapshotRowCount: number;
}

export async function deleteResource(id: string): Promise<DeleteResourceResult> {
  const res = await fetch(`/api/admin/resources/${id}`, { method: "DELETE" });
  return jsonOrThrow<DeleteResourceResult>(res);
}

export interface UndoDeleteResult {
  ok: boolean;
  id: string;
  snapshotId: string;
  expectedRowHash: string;
  restoredRowHash: string;
  exactRecoveryVerified: boolean;
  resource: Resource;
}

export async function undoResourceDelete(id: string, snapshotId: string): Promise<UndoDeleteResult> {
  const res = await fetch(`/api/admin/resources/${id}/restore-deleted`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ snapshotId }),
  });
  return jsonOrThrow<UndoDeleteResult>(res);
}

export async function fetchAdminStats(): Promise<AdminStats> {
  const res = await fetch("/api/admin/stats", { cache: "no-store" });
  return jsonOrThrow<AdminStats>(res);
}

export interface ResourceImportResult {
  ok: true;
  mode: "append" | "replace";
  removed: number;
  inserted: number;
  /** Append mode: number of candidates staged for automatic verification. */
  staged?: number;
  /** Append mode: durable verification run that will process the batch. */
  runId?: string;
  runStatus?: string;
  dryRun?: boolean;
  currentRows?: number;
  wouldRemove?: number;
  wouldInsert?: number;
  wouldStage?: number;
}

export async function importResources(payload: unknown): Promise<ResourceImportResult> {
  const res = await fetch("/api/admin/resources/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return jsonOrThrow<ResourceImportResult>(res);
}

// ---- Durable snapshots / audited restore -------------------------------------

export interface ResourceSnapshotDto {
  id: string;
  actor: string;
  reason: string;
  trigger: string;
  rowCount: number;
  datasetHash: string | null;
  createdAt: string;
}

export async function fetchSnapshots(): Promise<{
  ok: boolean;
  total: number;
  snapshots: ResourceSnapshotDto[];
}> {
  const res = await fetch("/api/admin/snapshots");
  return jsonOrThrow(res);
}

export async function createSnapshot(reason?: string): Promise<{
  ok: boolean;
  id: string;
  rowCount: number;
}> {
  const res = await fetch("/api/admin/snapshots", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(reason ? { reason } : {}),
  });
  return jsonOrThrow(res);
}

export interface SnapshotRestoreResult {
  ok: boolean;
  snapshotId: string;
  dryRun?: boolean;
  wouldRemove?: number;
  wouldRestore?: number;
  removed?: number;
  restored?: number;
  restoredHash?: string;
  expectedHash?: string;
  exactRecoveryVerified?: boolean;
  snapshotHash?: string;
  currentHash?: string;
  preRestoreSnapshotId?: string;
}

export async function restoreSnapshot(id: string, dryRun: boolean): Promise<SnapshotRestoreResult> {
  const res = await fetch(`/api/admin/snapshots/${id}/restore`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dryRun }),
  });
  return jsonOrThrow<SnapshotRestoreResult>(res);
}

// ---- Verification pipeline (admin) ------------------------------------------

export interface VerificationIssueDto {
  id: string;
  resultId: string;
  field: string;
  code: string;
  severity: string;
  currentValue: string | null;
  suggestedValue: string | null;
  evidenceJson: unknown;
  reviewState: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
  createdAt: string;
}

export interface VerificationResultDto {
  id: string;
  runId: string;
  recordId: string;
  resourceId: string | null;
  name: string;
  sourceName: string;
  suggestedName: string | null;
  category: string | null;
  organizationStatus: string;
  organizationReason: string | null;
  duplicateGroupId: string | null;
  duplicateConfidence: string | null;
  duplicateKind: string;
  publishState: string;
  reviewState: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
  candidateJson: unknown;
  evidenceJson: unknown;
  flagsJson: unknown;
  viabilityJson: unknown;
  sourceJson: unknown;
  errorsJson: unknown;
  checkedAt: string | null;
  createdAt: string;
  updatedAt: string;
  issues: VerificationIssueDto[];
  run?: { id: string; origin: string; status: string; createdAt: string };
}

export interface VerificationRunDto {
  id: string;
  origin: string;
  status: string;
  actor: string;
  attempts: number;
  claimedBy: string | null;
  verifierVersion: string | null;
  startedAt: string;
  completedAt: string | null;
  heartbeatAt: string | null;
  nextAttemptAt: string | null;
  summary: unknown;
  error: string | null;
  createdAt: string;
  resultCount: number;
}

export async function fetchVerificationRuns(): Promise<{
  runs: VerificationRunDto[];
  publishStateCounts: Record<string, number>;
}> {
  const res = await fetch("/api/admin/verification/runs", { cache: "no-store" });
  return jsonOrThrow(res);
}

export async function fetchVerificationResults(params: {
  runId?: string;
  publishState?: string;
  q?: string;
  take?: number;
  skip?: number;
}): Promise<{ total: number; results: VerificationResultDto[] }> {
  const sp = new URLSearchParams();
  if (params.runId) sp.set("runId", params.runId);
  if (params.publishState) sp.set("publishState", params.publishState);
  if (params.q) sp.set("q", params.q);
  if (params.take) sp.set("take", String(params.take));
  if (params.skip) sp.set("skip", String(params.skip));
  const res = await fetch(`/api/admin/verification/results?${sp}`, { cache: "no-store" });
  const payload = await jsonOrThrow<{
    total: number;
    results: Array<Omit<VerificationResultDto, "sourceName">>;
  }>(res);
  return {
    ...payload,
    results: payload.results.map((result) => ({ ...result, sourceName: result.name })),
  };
}

export async function reviewVerificationResult(
  id: string,
  payload: {
    publishState?: "held" | "excluded";
    reviewState?: "unreviewed" | "reviewed";
    sourceJson?: Record<string, unknown>;
  },
): Promise<{ ok: true; id: string; publishState: string; reviewState: string }> {
  const res = await fetch(`/api/admin/verification/results/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return jsonOrThrow(res);
}

export async function publishVerificationResult(id: string): Promise<{
  ok: true;
  resourceId: string;
  name: string;
  verified: boolean;
  published: boolean;
}> {
  const res = await fetch(`/api/admin/verification/results/${id}/publish`, {
    method: "POST",
  });
  return jsonOrThrow(res);
}

export async function reviewVerificationIssue(
  id: string,
  reviewState: "unresolved" | "accepted" | "dismissed",
): Promise<{ ok: true; id: string; reviewState: string }> {
  const res = await fetch(`/api/admin/verification/issues/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reviewState }),
  });
  return jsonOrThrow(res);
}

export async function importVerifierArtifacts(payload: {
  verifiedResources: Array<Record<string, unknown>>;
  runManifest?: Record<string, unknown>;
  filename?: string;
  environmentEgressRestricted?: boolean;
}): Promise<{ ok: true; recovery: true; runId: string; imported: number; note: string }> {
  const res = await fetch("/api/admin/verification/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return jsonOrThrow(res);
}

export async function requestReverification(
  resourceIds?: string[],
): Promise<{ ok: true; runId: string; runStatus: string }> {
  const res = await fetch("/api/admin/verification/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(resourceIds?.length ? { resourceIds } : {}),
  });
  return jsonOrThrow(res);
}

export async function fetchAudit(
  limit = 50,
  offset = 0,
): Promise<{ entries: AuditLogEntry[]; total: number }> {
  const sp = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  const res = await fetch(`/api/admin/audit?${sp}`, { cache: "no-store" });
  return jsonOrThrow<{ entries: AuditLogEntry[]; total: number }>(res);
}

// ---- Admin actions ---------------------------------------------------------

export async function parseText(
  text: string,
  format?: "txt" | "markdown" | "json" | "xml",
): Promise<{
  parsed: Partial<ResourceInput>;
  format: "txt" | "markdown" | "json" | "xml";
  viability: "viable" | "pending" | "invalid" | "off_topic" | "identity_mismatch";
  issues: string[];
}> {
  const res = await fetch("/api/admin/parse", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, ...(format ? { format } : {}) }),
  });
  return jsonOrThrow<{
    parsed: Partial<ResourceInput>;
    format: "txt" | "markdown" | "json" | "xml";
    viability: "viable" | "pending" | "invalid" | "off_topic" | "identity_mismatch";
    issues: string[];
  }>(res);
}

export async function runCleanup(mode: "preview" | "apply" = "preview"): Promise<{
  dryRun: boolean;
  mode: "preview" | "apply";
  reports: PIIPassReport[];
  changedCount: number;
  total: number;
  snapshotId?: string | null;
  snapshotHash?: string | null;
}> {
  const res = await fetch("/api/admin/cleanup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode }),
  });
  return jsonOrThrow(res);
}

// ---- URL verification ------------------------------------------------------

export async function fetchUrlVerification(): Promise<UrlVerificationReport> {
  const res = await fetch("/api/admin/verify-urls", { cache: "no-store" });
  return jsonOrThrow<UrlVerificationReport>(res);
}

export async function runUrlVerification(
  ids?: string[],
): Promise<UrlVerificationReport> {
  const res = await fetch("/api/admin/verify-urls", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(ids ? { ids } : {}),
  });
  return jsonOrThrow<UrlVerificationReport>(res);
}
