// BNDR. — SSRF-safe URL validation and fetch (server-only)
// ----------------------------------------------------------------------------
// Shared URL validation used by every route that fetches a user-supplied URL.
//
// Rules:
//   * Allow only HTTP/HTTPS schemes.
//   * Reject URL credentials (user:pass@host).
//   * Reject localhost and IPv4/IPv6 loopback/private/link-local/multicast/
//     reserved/unspecified/cloud-metadata destinations.
//   * Resolve A/AAAA before each request and pin the validated IP at connect time.
//   * Use manual redirects, maximum five hops.
//   * Revalidate each target and resolved address on every hop.
//   * Bounded concurrency and abort timeouts.
//
// DNS rebinding is prevented for these requests by pinning the already-validated
// address in the transport lookup callback while preserving the original host
// for HTTP Host and TLS SNI/certificate validation.

// Node.js built-in modules for SSRF validation.
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { request as httpRequest, type RequestOptions as HttpRequestOptions } from "node:http";
import { request as httpsRequest } from "node:https";

export interface SsrfCheckResult {
  ok: boolean;
  reason?: string;
  resolvedHost?: string;
}

const BLOCKED_HOSTS = new Set([
  "localhost",
  "ip6-localhost",
  "ip6-loopback",
  "metadata.google.internal", // GCP metadata
  "metadata", // Azure metadata
]);

// Cloud metadata IPs
const CLOUD_METADATA_IPS = new Set([
  "169.254.169.254", // AWS/GCP/Azure metadata
  "fd00:ec2::254", // AWS metadata v6
  "100.100.100.200", // Alibaba metadata
]);

function isPrivateIp(ip: string): boolean {
  if (CLOUD_METADATA_IPS.has(ip)) return true;

  // IPv4
  const v4 = ip.includes(".") && isIP(ip) === 4;
  if (v4) {
    const parts = ip.split(".").map(Number);
    const [a, b] = parts;
    if (a === 10) return true; // private 10.0.0.0/8
    if (a === 127) return true; // loopback 127.0.0.0/8
    if (a === 0) return true; // 0.0.0.0/8 (this network)
    if (a === 169 && b === 254) return true; // link-local 169.254.0.0/16
    if (a === 172 && b >= 16 && b <= 31) return true; // private 172.16.0.0/12
    if (a === 192 && b === 168) return true; // private 192.168.0.0/16
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64.0.0/10
    if (a >= 224) return true; // multicast 224.0.0.0/4 + reserved 240.0.0.0/4
    return false;
  }

  // IPv6
  const v6 = isIP(ip) === 6;
  if (v6) {
    const lower = ip.toLowerCase();
    if (lower === "::1" || lower === "::") return true; // loopback / unspecified
    if (lower.startsWith("fe80")) return true; // link-local
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // unique local
    if (lower.startsWith("ff")) return true; // multicast
    if (lower.startsWith("::ffff:")) {
      // IPv4-mapped — check the embedded IPv4
      const embedded = lower.split("::ffff:")[1];
      if (embedded) return isPrivateIp(embedded);
    }
    return false;
  }

  return false;
}

/**
 * Validate a URL string for SSRF safety. Does NOT resolve DNS — use
 * `resolveAndCheck` for that. Returns ok=false with a reason if the URL
 * is structurally unsafe.
 */
export function validateUrlStructure(raw: string): SsrfCheckResult {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return { ok: false, reason: "invalid-url" };
  }

  if (u.protocol !== "http:" && u.protocol !== "https:") {
    return { ok: false, reason: "scheme-not-allowed" };
  }

  // Reject URL credentials.
  if (u.username || u.password) {
    return { ok: false, reason: "credentials-in-url" };
  }

  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");

  // Blocked hostnames.
  if (BLOCKED_HOSTS.has(host)) {
    return { ok: false, reason: "blocked-host" };
  }

  // If the host is already an IP literal, check it directly.
  if (isIP(host)) {
    if (isPrivateIp(host)) {
      return { ok: false, reason: "private-ip" };
    }
    return { ok: true, resolvedHost: host };
  }

  return { ok: true, resolvedHost: host };
}

/**
 * Resolve a hostname to A/AAAA records and verify NONE of the resolved
 * addresses are private/blocked. Returns ok=false if any address is unsafe
 * or if DNS resolution fails.
 */
export async function resolveAndCheck(host: string): Promise<SsrfCheckResult> {
  // If it's already an IP literal, check directly.
  if (isIP(host)) {
    if (isPrivateIp(host)) {
      return { ok: false, reason: "private-ip" };
    }
    return { ok: true, resolvedHost: host };
  }

  let addresses: { address: string }[];
  try {
    addresses = await lookup(host, { all: true });
  } catch {
    return { ok: false, reason: "dns-resolution-failed" };
  }

  if (addresses.length === 0) {
    return { ok: false, reason: "no-dns-records" };
  }

  for (const { address } of addresses) {
    if (isPrivateIp(address)) {
      return { ok: false, reason: "private-ip" };
    }
  }

  return { ok: true, resolvedHost: addresses[0].address };
}

export interface SafeFetchResult {
  ok: boolean;
  status: number;
  finalUrl: string;
  statusText: string;
  headers: Headers;
  /** The body as text (bounded). null if not read. */
  bodyText: string | null;
  note: string;
  redirectChain: string[];
}

const DEFAULT_TIMEOUT_MS = 8000;
const MAX_REDIRECTS = 5;
const MAX_BODY_BYTES = 64 * 1024; // only read 64 KiB for off-topic checks
const USER_AGENT =
  "Mozilla/5.0 (compatible; BNDR-Directory-LinkCheck/1.0; +https://bndr.directory)";

/**
 * SSRF-safe fetch with manual redirect following (max 5 hops). Each hop is
 * revalidated: the redirect target URL is structurally validated AND its
 * hostname is re-resolved and checked.
 *
 * DNS is resolved and checked before each hop, then the selected validated
 * address is pinned into the HTTP(S) transport lookup callback. The original
 * hostname is still used for Host and TLS SNI/certificate validation.
 */
export async function safeFetch(
  rawUrl: string,
  opts: {
    method?: "HEAD" | "GET";
    timeoutMs?: number;
    maxRedirects?: number;
    readBody?: boolean;
  } = {},
): Promise<SafeFetchResult> {
  const method = opts.method ?? "HEAD";
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRedirects = opts.maxRedirects ?? MAX_REDIRECTS;
  const readBody = opts.readBody ?? false;
  const redirectChain: string[] = [];

  let currentUrl = rawUrl;

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const struct = validateUrlStructure(currentUrl);
    if (!struct.ok) {
      return failedFetch(currentUrl, `ssrf-blocked: ${struct.reason}`, redirectChain);
    }

    const resolved = await resolveAndCheck(struct.resolvedHost!);
    if (!resolved.ok || !resolved.resolvedHost) {
      return failedFetch(currentUrl, `ssrf-blocked: ${resolved.reason}`, redirectChain);
    }

    const response = await requestPinned(
      currentUrl,
      resolved.resolvedHost,
      method,
      timeoutMs,
      readBody,
    );
    if (!response.ok && response.status === 0) {
      return { ...response, redirectChain: [...redirectChain] };
    }

    const code = response.status;
    if (code >= 300 && code < 400) {
      const loc = response.headers.get("location");
      if (!loc) {
        return {
          ...response,
          ok: false,
          note: `redirect-without-location: HTTP ${code}`,
          redirectChain: [...redirectChain],
        };
      }

      let nextUrl: string;
      try {
        nextUrl = new URL(loc, currentUrl).toString();
      } catch {
        return {
          ...response,
          ok: false,
          note: "invalid-redirect-location",
          redirectChain: [...redirectChain],
        };
      }

      redirectChain.push(nextUrl);
      if (hop >= maxRedirects) {
        return {
          ...response,
          ok: false,
          finalUrl: nextUrl,
          note: `too-many-redirects (${maxRedirects})`,
          redirectChain: [...redirectChain],
        };
      }
      currentUrl = nextUrl;
      continue;
    }

    return { ...response, redirectChain: [...redirectChain] };
  }

  return failedFetch(currentUrl, "max-redirects-exceeded", redirectChain);
}

function failedFetch(
  finalUrl: string,
  note: string,
  redirectChain: string[],
): SafeFetchResult {
  return {
    ok: false,
    status: 0,
    finalUrl,
    statusText: "",
    headers: new Headers(),
    bodyText: null,
    note,
    redirectChain: [...redirectChain],
  };
}

function requestPinned(
  rawUrl: string,
  address: string,
  method: "HEAD" | "GET",
  timeoutMs: number,
  readBody: boolean,
): Promise<SafeFetchResult> {
  return new Promise((resolve) => {
    const url = new URL(rawUrl);
    const family = isIP(address);
    const headers = {
      "User-Agent": USER_AGENT,
      Accept: method === "GET" ? "text/html,*/*;q=0.8" : "*/*",
    };

    const options: HttpRequestOptions = {
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port || undefined,
      path: `${url.pathname}${url.search}`,
      method,
      headers,
      // Pin the exact address already validated by resolveAndCheck. Node still
      // uses url.hostname for Host and, for HTTPS, certificate/SNI validation.
      lookup: (_hostname, _options, callback) => {
        callback(null, address, family as 4 | 6);
      },
    };

    const makeRequest = url.protocol === "https:" ? httpsRequest : httpRequest;
    const req = makeRequest(options, (res) => {
      const responseHeaders = new Headers();
      for (const [name, value] of Object.entries(res.headers)) {
        if (Array.isArray(value)) {
          for (const item of value) responseHeaders.append(name, item);
        } else if (value !== undefined) {
          responseHeaders.set(name, String(value));
        }
      }

      const status = res.statusCode ?? 0;
      const statusText = res.statusMessage ?? "";

      if (!readBody || method !== "GET") {
        res.resume();
        resolve({
          ok: true,
          status,
          finalUrl: rawUrl,
          statusText,
          headers: responseHeaders,
          bodyText: null,
          note: `HTTP ${status}`,
          redirectChain: [],
        });
        return;
      }

      const chunks: Buffer[] = [];
      let total = 0;
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        resolve({
          ok: true,
          status,
          finalUrl: rawUrl,
          statusText,
          headers: responseHeaders,
          bodyText: Buffer.concat(chunks).toString("utf8"),
          note: `HTTP ${status}`,
          redirectChain: [],
        });
      };

      res.on("data", (chunk: Buffer | string) => {
        if (settled) return;
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        const remaining = MAX_BODY_BYTES - total;
        if (remaining <= 0) {
          res.destroy();
          finish();
          return;
        }
        if (buffer.length > remaining) {
          chunks.push(buffer.subarray(0, remaining));
          total += remaining;
          res.destroy();
          finish();
          return;
        }
        chunks.push(buffer);
        total += buffer.length;
      });
      res.on("end", finish);
      res.on("close", finish);
      res.on("error", finish);
    });

    let timedOut = false;
    req.setTimeout(timeoutMs, () => {
      timedOut = true;
      req.destroy(new Error("timeout"));
    });
    req.on("error", (error) => {
      resolve({
        ok: false,
        status: 0,
        finalUrl: rawUrl,
        statusText: "",
        headers: new Headers(),
        bodyText: null,
        note: timedOut ? "timeout" : `network: ${truncate(error.message, 120)}`,
        redirectChain: [],
      });
    });
    req.end();
  });
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
