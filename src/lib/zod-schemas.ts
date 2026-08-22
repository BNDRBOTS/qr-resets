// BNDR. — Shared Zod request schemas (server/client-safe)
// ----------------------------------------------------------------------------
// Runtime-validate every route boundary. Remove unsafe response casts.
// Bounded body reading before JSON.parse to prevent memory exhaustion.

import { z } from "zod";

// ---- Category taxonomy (mirrors src/lib/types.ts CATEGORIES) ---------------
export const CATEGORY_SLUGS = [
  "child-abduction",
  "victim-rights-compensation",
  "domestic-violence-family-violence",
  "family-advocacy-trauma-recovery",
  "protective-parent-family-court",
  "gaslighting-darvo-institutional-betrayal",
  "parental-alienation-fathers-rights",
  "legal-aid-court-access",
  "attorneys-firms",
  "disability-medical-advocacy",
  "victim-linked-programs",
  "lyme-co-infections",
  "housing-financial-aid",
] as const;

export const categorySlugSchema = z.enum(CATEGORY_SLUGS);

// ---- Bounded primitives -----------------------------------------------------
const boundedString = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v.length === 0 ? null : v))
    .nullable();

// ---- Resource input (create) -----------------------------------------------
export const resourceInputSchema = z
  .object({
    name: z.string().trim().min(1).max(300),
    acronym: boundedString(50).optional().default(null),
    description: boundedString(20000).optional().default(null),
    category: categorySlugSchema,
    subcategory: boundedString(200).optional().default(null),
    phoneRaw: boundedString(200).optional().default(null),
    email: boundedString(300).optional().default(null),
    address: boundedString(1000).optional().default(null),
    website: boundedString(2000).optional().default(null),
    tags: z.string().trim().max(2000).default(""),
    priority: z.number().int().min(0).max(10).default(0),
    verified: z.boolean().default(false),
    published: z.boolean().default(false),
    sourceNote: boundedString(5000).optional().default(null),
  })
  .strict();
export type ResourceInputParsed = z.infer<typeof resourceInputSchema>;

// ---- Resource update (partial — omitted = unchanged, null = clear) ----------
export const resourceUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(300).optional(),
    acronym: boundedString(50).optional(),
    description: boundedString(20000).optional(),
    category: categorySlugSchema.optional(),
    subcategory: boundedString(200).optional(),
    phoneRaw: boundedString(200).optional(),
    email: boundedString(300).optional(),
    address: boundedString(1000).optional(),
    website: boundedString(2000).optional(),
    tags: z.string().trim().max(2000).optional(),
    priority: z.number().int().min(0).max(10).optional(),
    verified: z.boolean().optional(),
    published: z.boolean().optional(),
    sourceNote: boundedString(5000).optional(),
  })
  .strict();
export type ResourceUpdateParsed = z.infer<typeof resourceUpdateSchema>;

// ---- Search params (GET /api/resources) -------------------------------------
export const searchParamsSchema = z.object({
  q: z.string().trim().max(200).default(""),
  category: z.union([categorySlugSchema, z.literal("all")]).default("all"),
  priorityOnly: z.coerce.boolean().default(false),
  // The frontend currently bulk-fetches up to 1,000 rows and slices client-side.
  // The cap bounds response size while supporting the directory.
  limit: z.coerce.number().int().min(1).max(1000).default(24),
  offset: z.coerce.number().int().min(0).max(100000).default(0),
});
export type SearchParamsParsed = z.infer<typeof searchParamsSchema>;

// ---- Admin search params (higher default limit) -----------------------------
export const adminSearchParamsSchema = searchParamsSchema.extend({
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export type AdminSearchParamsParsed = z.infer<typeof adminSearchParamsSchema>;

// ---- Admin mutation commands -----------------------------------------------
export const publishCommandSchema = z.object({
  id: z.string().min(1).max(100),
  published: z.boolean(),
});
export const spamCommandSchema = z.object({
  q: z.string().trim().max(200).default(""),
});
export const cleanupCommandSchema = z.object({
  mode: z.enum(["preview", "apply"]).default("preview"),
  ids: z.array(z.string().min(1).max(100)).max(500).optional(),
});
export const urlVerifyCommandSchema = z.object({
  ids: z.array(z.string().min(1).max(100)).max(50).optional(),
  limit: z.number().int().min(1).max(50).default(10),
});



// ---- Single-admin recovery --------------------------------------------------
export const adminRecoveryProofSchema = z.object({
  recoveryKey: z.string().min(24).max(512),
}).strict();
export type AdminRecoveryProofParsed = z.infer<typeof adminRecoveryProofSchema>;

export const adminPasswordResetSchema = z.object({
  resetToken: z.string().min(1).max(4096),
  newPassword: z.string().min(12).max(256),
}).strict();
export type AdminPasswordResetParsed = z.infer<typeof adminPasswordResetSchema>;

// Kept as a server-core compatibility schema for the Prompt 2 foundation. The
// browser flow does not submit the recovery key together with a new password.
export const adminPasswordRecoverySchema = z.object({
  recoveryKey: z.string().min(24).max(512),
  newPassword: z.string().min(12).max(256),
}).strict();
export type AdminPasswordRecoveryParsed = z.infer<typeof adminPasswordRecoverySchema>;

// ---- QR Resets public request -----------------------------------------------
const qrOptionalText = (max: number) => z.string().trim().max(max).optional().default("");

export const qrResetRequestSchema = z.object({
  displayName: qrOptionalText(200),
  contactMethod: z.enum(["Text", "Phone", "Email", "Another method"]).optional(),
  contactDetails: qrOptionalText(300),
  location: qrOptionalText(300),
  situation: qrOptionalText(5000),
  urgentProblem: qrOptionalText(5000),
  blockers: qrOptionalText(5000),
  proposedHelp: qrOptionalText(5000),
  unwantedSupport: qrOptionalText(5000),
  deadline: qrOptionalText(500),
  alreadyWorking: qrOptionalText(5000),
  currentHelp: qrOptionalText(2000),
  planPreference: z.enum(["Yes", "No", "Not sure", "I want to build it myself"]).optional(),
  documentsNote: qrOptionalText(2000),
  consentRequired: z.array(z.boolean()).length(2).refine((v) => v.every(Boolean), {
    message: "Required consent must be confirmed.",
  }),
  consentOptional: z.array(z.boolean()).max(2).optional().default([]),
}).strict();
export type QrResetRequestParsed = z.infer<typeof qrResetRequestSchema>;

export const qrRequestStatusSchema = z.enum([
  "received",
  "reviewing",
  "needs-info",
  "approved",
  "alternate-offered",
  "declined",
  "withdrawn",
  "closed",
]);

export const qrAdminReviewSchema = z.object({
  status: qrRequestStatusSchema,
  stage: z.union([z.literal(1), z.literal(2)]).default(1),
  decision: z.string().trim().min(1).max(100),
  reasonCode: z.string().trim().max(100).optional().default(""),
  notes: z.string().trim().max(5000).optional().default(""),
}).strict();
export type QrAdminReviewParsed = z.infer<typeof qrAdminReviewSchema>;

// ---- Bounded body reader ----------------------------------------------------
/**
 * Read at most `maxBytes` from the request body, then parse as JSON.
 * Throws a tagged error if the body is too large or invalid JSON.
 */
export async function readBoundedJson<T>(
  req: Request,
  maxBytes: number,
): Promise<T> {
  const contentLength = req.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > maxBytes) {
    throw new BoundedBodyError("PAYLOAD_TOO_LARGE", "Request body too large.");
  }
  const reader = req.body?.getReader();
  if (!reader) {
    // No body stream — try .text() for empty/edge cases.
    const text = await req.text();
    if (text.length > maxBytes) {
      throw new BoundedBodyError("PAYLOAD_TOO_LARGE", "Request body too large.");
    }
    if (!text) {
      throw new BoundedBodyError("INVALID_JSON", "Request body is required.");
    }
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new BoundedBodyError("INVALID_JSON", "Invalid JSON body.");
    }
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      try {
        await reader.cancel();
      } catch {
        /* ignore */
      }
      throw new BoundedBodyError("PAYLOAD_TOO_LARGE", "Request body too large.");
    }
    chunks.push(value);
  }
  const buf = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    buf.set(c, off);
    off += c.byteLength;
  }
  const text = new TextDecoder().decode(buf);
  if (!text) {
    throw new BoundedBodyError("INVALID_JSON", "Request body is required.");
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new BoundedBodyError("INVALID_JSON", "Invalid JSON body.");
  }
}

export class BoundedBodyError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "BoundedBodyError";
  }
}

// ---- Body size limits -------------------------------------------------------
export const BODY_LIMITS = {
  resourceMutation: 64 * 1024, // 64 KiB
  smartPaste: 256 * 1024, // 256 KiB
  command: 64 * 1024, // 64 KiB
  bulkImport: 8 * 1024 * 1024, // 8 MiB / up to 1,000 resources
  qrRequest: 32 * 1024, // 32 KiB
  qrAdminReview: 16 * 1024, // 16 KiB
  adminRecovery: 8 * 1024, // 8 KiB
} as const;

// ---- Resolve command (public bulk lookup by ID) -----------------------------
export const resolveCommandSchema = z.object({
  ids: z.array(z.string().min(1).max(100)).max(50),
});
export type ResolveCommandParsed = z.infer<typeof resolveCommandSchema>;
