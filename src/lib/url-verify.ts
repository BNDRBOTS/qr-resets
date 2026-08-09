// BNDR. — Safe Resource-URL Verification
// ----------------------------------------------------------------------------
// Verifies that resource `website` URLs are reachable, and flags URLs that
// point to off-topic / non-resource destinations (gig marketplaces, social
// login pages, community-chat invites, etc.).
//
// Design principles (data-integrity mandate):
//   * NEVER deletes or mutates a resource record.
//   * Classification is conservative: transient errors (timeout, 5xx, DNS) are
//     "uncertain", not "dead" — only hard 4xx (404/410/451) after a successful
//     connection count as "dead".
//   * HEAD first (cheap), GET fallback (some sites reject HEAD with 405).
//   * SSRF-safe: uses safeFetch() which validates URL structure, resolves DNS,
//     rejects private/loopback/cloud-metadata IPs, and follows redirects
//     manually (max 5 hops) with revalidation at each hop.
//   * Per-request timeout + a single retry for transient network blips.
//   * Bounded concurrency so we don't hammer the network or the event loop.
//
// Output is a serialisable report persisted to PostgreSQL by the API route,
// and an AuditLog entry is written.

import { normalizeUrl } from "./pii";
import { safeFetch } from "./ssrf";

export type UrlStatus = "live" | "dead" | "uncertain" | "off-topic" | "invalid";

export interface UrlVerificationResult {
  resourceId: string;
  name: string;
  website: string;
  status: UrlStatus;
  /** HTTP status code of the final response (null if no response received). */
  statusCode: number | null;
  /** Final URL after redirects (only set if it differs from `website`). */
  finalUrl: string | null;
  /** Human-readable note (e.g. "HEAD not allowed, GET ok", "timed out"). */
  note: string;
  /** Whether the URL matched an off-topic pattern. */
  offTopicReason: string | null;
  /** ms spent verifying this URL. */
  durationMs: number;
  /** ISO timestamp of the check. */
  checkedAt: string;
}

export interface UrlVerificationReport {
  total: number;
  verified: number;
  byStatus: Record<UrlStatus, number>;
  results: UrlVerificationResult[];
  ranAt: string;
  /** How long the whole batch took. */
  durationMs: number;
}

// ---- Off-topic URL detection ------------------------------------------------
// These hosts/patterns are NOT victim/advocacy resources. They are flagged
// (never auto-deleted) so an admin can review. Matches are based on the
// registered hostname + path so they're robust to http/https and www prefixes.
//
// Each entry: { hosts: exact hostnames to match, pathHint?: regex, reason }
interface OffTopicRule {
  hosts: string[];
  pathHint?: RegExp;
  reason: string;
}

const OFF_TOPIC_RULES: OffTopicRule[] = [
  // Freelance / gig marketplaces (the PII spam-check already catches these in
  // text, but a URL pointing to them is equally off-topic).
  {
    hosts: ["fiverr.com", "upwork.com", "freelancer.com", "peopleperhour.com", "guru.com", "toptal.com", "worksome.com", "codemap.io", "kolabtree.com", "aijobs.net", "flippa.com"],
    reason: "Freelance/gig marketplace — not a victim/advocacy resource",
  },
  // No-code / dev marketplaces.
  {
    hosts: ["nocodedevs.com", "makerpad.com"],
    reason: "No-code/dev marketplace — not a victim/advocacy resource",
  },
  // Housing/roommate/gig classifieds that aren't victim-services housing.
  {
    hosts: ["craigslist.org"],
    pathHint: /\/search\/.*(ggg|sss|ccc|bbb|hhh|roo|apa)/i,
    reason: "Craigslist classifieds search (gigs/sales/rooms) — not a victim-services housing program",
  },
  // Volunteer-exchange / farm-stay platforms (not housing aid).
  {
    hosts: ["helpx.net", "wwoof.net", "workaway.info"],
    reason: "Volunteer-exchange / farm-stay platform — not a victim-services resource",
  },
  // Job boards.
  {
    hosts: ["wellfound.com", "indeed.com", "linkedin.com", "glassdoor.com", "monster.com", "ziprecruiter.com", "simplyhired.com"],
    reason: "Job board — not a victim/advocacy resource",
  },
  // Generic social platforms pointed at community/chat invites or login walls
  // rather than an organisation page. An actual org Facebook PAGE is fine; a
  // login redirect or a community invite link is not.
  {
    hosts: ["facebook.com"],
    pathHint: /\/login/i,
    reason: "Facebook login redirect — not a reachable organisation page",
  },
  {
    hosts: ["discord.com", "discord.do", "discord.gg", "discordapp.com"],
    pathHint: /\/invite\//i,
    reason: "Discord community invite — not a victim/advocacy organisation website",
  },
  {
    hosts: ["reddit.com"],
    pathHint: /\/r\//i,
    reason: "Reddit community — not an organisation website",
  },
  {
    hosts: ["reddit.com"],
    pathHint: /^\/?$/i,
    reason: "Reddit homepage — not a specific organisation",
  },
  // Generic link aggregators / linktrees.
  {
    hosts: ["linktr.ee"],
    reason: "Link aggregator — review manually",
  },
];

/**
 * Returns the off-topic reason for a URL, or null if the URL is not off-topic.
 * Only the host + path are inspected; the URL is parsed defensively.
 */
export function detectOffTopic(website: string): string | null {
  let host = "";
  let path = "";
  try {
    const u = new URL(website);
    host = u.hostname.toLowerCase().replace(/^www\./, "");
    path = u.pathname + u.search;
  } catch {
    return null;
  }
  for (const rule of OFF_TOPIC_RULES) {
    if (rule.hosts.includes(host)) {
      if (rule.pathHint) {
        if (rule.pathHint.test(path)) return rule.reason;
        // host matched but path didn't → not this rule, keep checking
        continue;
      }
      // host match with no path constraint → off-topic
      return rule.reason;
    }
  }
  return null;
}

// ---- HTTP verification ------------------------------------------------------

const TIMEOUT_MS = 8000;
const MAX_REDIRECTS = 5;
// USER_AGENT is now defined in ssrf.ts and used by safeFetch.

/**
 * Verify a single URL. Strategy:
 *   1. Normalise the URL (ensure protocol).
 *   2. If it matches an off-topic rule, classify as "off-topic" (still note
 *      whether it's reachable — we don't fetch, to save bandwidth, but we do
 *      a lightweight HEAD to record reachability for the admin).
 *   3. Otherwise: HEAD with redirect follow + timeout. If HEAD returns 405/403
 *      (method not allowed) or no response, retry once with GET.
 *   4. Classify by final status code.
 *
 * Returns a UrlVerificationResult. Never throws.
 */
export async function verifyUrl(
  resourceId: string,
  name: string,
  rawWebsite: string,
): Promise<UrlVerificationResult> {
  const startedAt = Date.now();
  const checkedAt = new Date().toISOString();
  const base: Omit<UrlVerificationResult, "status" | "statusCode" | "finalUrl" | "note" | "offTopicReason"> = {
    resourceId,
    name,
    website: rawWebsite,
    durationMs: 0,
    checkedAt,
  };

  const website = normalizeUrl(rawWebsite);
  if (!website) {
    return {
      ...base,
      website: rawWebsite,
      status: "invalid",
      statusCode: null,
      finalUrl: null,
      note: "URL could not be normalised (invalid format)",
      offTopicReason: null,
      durationMs: Date.now() - startedAt,
    };
  }

  const offTopicReason = detectOffTopic(website);

  // Probe reachability with a single HEAD (don't double-fetch off-topic URLs).
  const probe = await probeOnce(website, "HEAD");

  // If HEAD was rejected with 405/403 (method not allowed), retry with GET.
  // SSRF-blocked URLs are NOT retried — the block is deterministic.
  let result = probe;
  if (probe.status === "ssrf-blocked") {
    // SSRF block: the URL resolves to a private/loopback/cloud-metadata
    // address. Classify as "invalid" so it's flagged for admin review.
    const durationMs = Date.now() - startedAt;
    return {
      ...base,
      website,
      status: "invalid",
      statusCode: null,
      finalUrl: null,
      note: `SSRF blocked: ${probe.note}`,
      offTopicReason: null,
      durationMs,
    };
  } else if (
    probe.status === "method-not-allowed" ||
    (probe.statusCode != null && (probe.statusCode === 405 || probe.statusCode === 403))
  ) {
    const getProbe = await probeOnce(website, "GET");
    // Prefer the GET result, but keep a note that HEAD was rejected.
    result = {
      ...getProbe,
      note:
        getProbe.note === "ok"
          ? "HEAD not allowed, GET ok"
          : `HEAD rejected (${probe.statusCode ?? "no response"}), GET: ${getProbe.note}`,
    };
  } else if (probe.status === "network-error" || probe.status === "timeout") {
    // One retry for transient network blips.
    const retry = await probeOnce(website, "GET");
    if (retry.status !== "network-error" && retry.status !== "timeout") {
      result = {
        ...retry,
        note: `first attempt ${probe.note}; retry ${retry.note}`,
      };
    } else {
      result = retry;
    }
  }

  const durationMs = Date.now() - startedAt;

  // Classify.
  let status: UrlStatus;
  if (result.status === "ok") {
    status = offTopicReason ? "off-topic" : "live";
  } else if (result.status === "dead") {
    // A hard 4xx after a successful connection = dead. Off-topic dead links
    // are still "off-topic" so they're grouped with the other off-topic URLs
    // for review, but we note the dead status.
    status = offTopicReason ? "off-topic" : "dead";
  } else {
    // timeout / network-error / unknown → uncertain (could be transient)
    status = offTopicReason ? "off-topic" : "uncertain";
  }

  return {
    ...base,
    website,
    status,
    statusCode: result.statusCode,
    finalUrl: result.finalUrl && result.finalUrl !== website ? result.finalUrl : null,
    note: result.note,
    offTopicReason,
    durationMs,
  };
}

type ProbeStatus =
  | "ok"
  | "restricted"
  | "dead"
  | "server-error"
  | "timeout"
  | "network-error"
  | "method-not-allowed"
  | "ssrf-blocked";

interface ProbeResult {
  status: ProbeStatus;
  statusCode: number | null;
  finalUrl: string | null;
  note: string;
}

/**
 * Probe a URL using the SSRF-safe fetch (validates URL structure, resolves
 * DNS, rejects private/loopback/cloud-metadata IPs, follows redirects
 * manually with revalidation at each hop).
 */
async function probeOnce(
  url: string,
  method: "HEAD" | "GET",
): Promise<ProbeResult> {
  // safeFetch returns { ok, status, finalUrl, statusText, note, ... }
  // ok=false means the request never reached a valid HTTP response (SSRF
  // blocked, timeout, network error, too many redirects).
  const result = await safeFetch(url, {
    method,
    timeoutMs: TIMEOUT_MS,
    maxRedirects: MAX_REDIRECTS,
    readBody: false,
  });

  // SSRF-blocked or network/timeout errors.
  if (!result.ok) {
    // Check if it was an SSRF block vs a network error.
    if (result.note.startsWith("ssrf-blocked:")) {
      return {
        status: "ssrf-blocked",
        statusCode: 0,
        finalUrl: result.finalUrl || null,
        note: result.note,
      };
    }
    if (result.note === "timeout") {
      return { status: "timeout", statusCode: null, finalUrl: result.finalUrl || null, note: "timed out" };
    }
    if (result.note.startsWith("network:") || result.note === "dns-resolution-failed" || result.note === "no-dns-records") {
      return { status: "network-error", statusCode: null, finalUrl: result.finalUrl || null, note: result.note };
    }
    if (result.note.startsWith("too-many-redirects") || result.note === "max-redirects-exceeded") {
      return { status: "network-error", statusCode: null, finalUrl: result.finalUrl || null, note: result.note };
    }
    // Default: treat as network error for safety.
    return { status: "network-error", statusCode: null, finalUrl: result.finalUrl || null, note: result.note };
  }

  // We got an HTTP response. Classify by status code.
  const code = result.status;
  const finalUrl = result.finalUrl || null;

  // 2xx and 3xx (after manual redirect follow) = reachable.
  if (code >= 200 && code < 400) {
    return {
      status: "ok",
      statusCode: code,
      finalUrl,
      note: "ok",
    };
  }
  // Hard "gone" / "not found" / "legal-removed" = dead.
  if (code === 404 || code === 410 || code === 451) {
    return { status: "dead", statusCode: code, finalUrl, note: `HTTP ${code}` };
  }
  // 405/403 → signal method-not-allowed so the caller can retry with GET.
  if (method === "HEAD" && (code === 405 || code === 403)) {
    return { status: "method-not-allowed", statusCode: code, finalUrl, note: `HTTP ${code} (method not allowed)` };
  }
  // Other 4xx (401/402/409/429…) prove that an HTTP endpoint answered, but
  // they do not prove that the resource page is usable. Keep them out of the
  // "live" bucket and surface them for review as uncertain/restricted.
  if (code >= 400 && code < 500) {
    return {
      status: "restricted",
      statusCode: code,
      finalUrl,
      note: `HTTP ${code} (reachable but restricted)`,
    };
  }
  // 5xx is a server-side response, not a timeout. Preserve that distinction;
  // the public report still maps it to "uncertain" because it may be transient.
  return {
    status: "server-error",
    statusCode: code,
    finalUrl,
    note: `HTTP ${code} (server error)`,
  };
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

// ---- Batch runner -----------------------------------------------------------

/**
 * Run URL verification across a list of resources with bounded concurrency.
 * `onProgress` is called after each URL completes (for streaming progress).
 */
export async function verifyUrls(
  resources: { id: string; name: string; website: string }[],
  concurrency = 12,
  onProgress?: (done: number, total: number, latest: UrlVerificationResult) => void,
): Promise<UrlVerificationReport> {
  const startedAt = Date.now();
  const total = resources.length;
  const results: UrlVerificationResult[] = new Array(total);
  let done = 0;

  // Simple bounded-concurrency pool.
  let cursor = 0;
  async function worker() {
    while (cursor < total) {
      const i = cursor++;
      const r = resources[i];
      const res = await verifyUrl(r.id, r.name, r.website);
      results[i] = res;
      done++;
      if (onProgress) onProgress(done, total, res);
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, total) }, () => worker());
  await Promise.all(workers);

  const byStatus: Record<UrlStatus, number> = {
    live: 0,
    dead: 0,
    uncertain: 0,
    "off-topic": 0,
    invalid: 0,
  };
  for (const r of results) byStatus[r.status]++;

  return {
    total,
    verified: byStatus.live,
    byStatus,
    results,
    ranAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
  };
}
