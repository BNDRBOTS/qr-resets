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

export async function deleteResource(id: string): Promise<{ ok: boolean }> {
  const res = await fetch(`/api/admin/resources/${id}`, { method: "DELETE" });
  return jsonOrThrow<{ ok: boolean }>(res);
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
}

export async function importResources(payload: unknown): Promise<ResourceImportResult> {
  const res = await fetch("/api/admin/resources/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return jsonOrThrow<ResourceImportResult>(res);
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
): Promise<{ parsed: Partial<ResourceInput> }> {
  const res = await fetch("/api/admin/parse", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  return jsonOrThrow<{ parsed: Partial<ResourceInput> }>(res);
}

export async function runCleanup(): Promise<{
  reports: PIIPassReport[];
  changedCount: number;
  total: number;
}> {
  const res = await fetch("/api/admin/cleanup", { method: "POST" });
  return jsonOrThrow<{
    reports: PIIPassReport[];
    changedCount: number;
    total: number;
  }>(res);
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
