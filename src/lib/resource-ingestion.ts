import { checkSpam, normalizeResource } from "@/lib/pii";
import { validateUrlStructure } from "@/lib/ssrf";
import type { ResourceInput } from "@/lib/types";
import { resourceInputSchema, type ResourceInputParsed } from "@/lib/zod-schemas";
import {
  ResourceDocumentError,
  canonicalizeResourceCandidate,
  classifyResourceViability,
  detectResourceFormat,
  findBatchDuplicate,
  gateResourcePublication,
  parseResourceDocument,
  resourceIdentityKeys,
  validateContactCandidates,
} from "./resource-ingestion-core.mjs";

export type ResourceInputFormat = "txt" | "markdown" | "json" | "xml";
export type ResourceViability =
  | "viable"
  | "pending"
  | "invalid"
  | "off_topic"
  | "identity_mismatch";

type UnknownRecord = Record<string, unknown>;

interface CanonicalResult {
  canonical: ResourceInput;
  signals: {
    status: string;
    identityMismatch: boolean;
    offTopic: boolean;
    httpStatus: number | null;
  };
}

interface ContactResult {
  canonical: ResourceInput;
  phoneNormalized: string | null;
  issues: string[];
}

export interface PreparedResourceCandidate {
  input: ResourceInputParsed;
  phoneNormalized: string | null;
  changes: string[];
  issues: string[];
  viability: ResourceViability;
  identityKeys: string[];
  original: UnknownRecord;
}

export interface SmartPasteResult {
  parsed: Partial<ResourceInput>;
  format: ResourceInputFormat;
  viability: ResourceViability;
  issues: string[];
}

export class ResourceIngestionError extends Error {
  code: string;
  row: number | null;

  constructor(code: string, message: string, row: number | null = null) {
    super(message);
    this.name = "ResourceIngestionError";
    this.code = code;
    this.row = row;
  }
}

export function detectInputFormat(content: string, filename = ""): ResourceInputFormat {
  return detectResourceFormat(content, filename) as ResourceInputFormat;
}

export function parseSmartPaste(
  content: string,
  requestedFormat?: ResourceInputFormat,
): SmartPasteResult {
  const document = parseDocument(content, requestedFormat, false);
  const original = document.candidates[0];
  if (!original) {
    throw new ResourceIngestionError("NO_RESOURCE_CANDIDATES", "No resource record was found.");
  }
  const { canonical, signals } = canonicalizeResourceCandidate(original) as CanonicalResult;
  const contacts = validateContactCandidates(canonical) as ContactResult;
  const issues = [...contacts.issues];
  const parsed: Partial<ResourceInput> = {
    ...(contacts.canonical.name ? { name: contacts.canonical.name } : {}),
    ...(contacts.canonical.acronym ? { acronym: contacts.canonical.acronym } : {}),
    ...(contacts.canonical.description ? { description: contacts.canonical.description } : {}),
    ...(contacts.canonical.category ? { category: contacts.canonical.category } : {}),
    ...(contacts.canonical.subcategory ? { subcategory: contacts.canonical.subcategory } : {}),
    ...(contacts.canonical.phoneRaw && contacts.phoneNormalized
      ? { phoneRaw: contacts.canonical.phoneRaw }
      : {}),
    ...(contacts.canonical.email ? { email: contacts.canonical.email } : {}),
    ...(contacts.canonical.address ? { address: contacts.canonical.address } : {}),
    ...(contacts.canonical.website ? { website: contacts.canonical.website } : {}),
    ...(contacts.canonical.tags ? { tags: contacts.canonical.tags } : {}),
    ...(contacts.canonical.sourceNote ? { sourceNote: contacts.canonical.sourceNote } : {}),
    verified: false,
    published: false,
  };

  if (parsed.website) {
    const structure = validateUrlStructure(parsed.website);
    if (!structure.ok) {
      issues.push(`unsafe_url:${structure.reason ?? "blocked"}`);
      delete parsed.website;
    }
  }
  if (!parsed.name) {
    throw new ResourceIngestionError(
      "NAME_NOT_FOUND",
      "No resource name could be extracted. Enter the name manually.",
    );
  }

  return {
    parsed,
    format: document.format,
    viability: classifyViability(parsed, signals, issues),
    issues,
  };
}

export function prepareResourceDocument(
  content: string,
  requestedFormat?: ResourceInputFormat,
  filename = "",
): { format: ResourceInputFormat; resources: PreparedResourceCandidate[] } {
  const document = parseDocument(content, requestedFormat, true, filename);
  return {
    format: document.format,
    resources: prepareResourceBatch(document.candidates),
  };
}

export function prepareResourceBatch(candidates: UnknownRecord[]): PreparedResourceCandidate[] {
  if (candidates.length === 0) {
    throw new ResourceIngestionError("NO_RESOURCE_CANDIDATES", "No resource records were provided.");
  }
  if (candidates.length > 1000) {
    throw new ResourceIngestionError("TOO_MANY_RESOURCES", "A maximum of 1,000 resource records is allowed.");
  }
  const prepared = candidates.map((candidate, index) => {
    try {
      return prepareResourceCandidate(candidate);
    } catch (error) {
      if (error instanceof ResourceIngestionError) {
        throw new ResourceIngestionError(error.code, `Row ${index + 1}: ${error.message}`, index + 1);
      }
      throw error;
    }
  });
  const duplicate = findBatchDuplicate(prepared) as
    | { key: string; firstIndex: number; secondIndex: number }
    | null;
  if (duplicate) {
    throw new ResourceIngestionError(
      "DUPLICATE_RESOURCE",
      `Rows ${duplicate.firstIndex + 1} and ${duplicate.secondIndex + 1} share an exact identity key; neither row was written.`,
      duplicate.secondIndex + 1,
    );
  }
  return prepared;
}

export function prepareResourceCandidate(original: UnknownRecord): PreparedResourceCandidate {
  const { canonical, signals } = canonicalizeResourceCandidate(original) as CanonicalResult;
  const contacts = validateContactCandidates(canonical) as ContactResult;
  const issues = [...contacts.issues];
  let safeCandidate: ResourceInput = {
    ...contacts.canonical,
    phoneRaw: contacts.phoneNormalized ? contacts.canonical.phoneRaw : null,
  };

  if (safeCandidate.website) {
    const structure = validateUrlStructure(safeCandidate.website);
    if (!structure.ok) {
      issues.push(`unsafe_url:${structure.reason ?? "blocked"}`);
      safeCandidate = { ...safeCandidate, website: null };
    }
  }

  const parsed = resourceInputSchema.safeParse(safeCandidate);
  if (!parsed.success) {
    throw new ResourceIngestionError(
      "MALFORMED_RESOURCE",
      parsed.error.issues[0]?.message ?? "The resource record is malformed.",
    );
  }

  const normalized = normalizeResource(parsed.data);
  const viability = classifyViability(parsed.data, signals, issues);
  const publication = gatePublication({
    viability,
    requestedVerified: parsed.data.verified,
    requestedPublished: parsed.data.published,
    httpStatus: signals.httpStatus,
  });
  const gatedInput: ResourceInputParsed = {
    ...parsed.data,
    email: normalized.email,
    website: normalized.website,
    verified: publication.verified,
    published: publication.published,
  };
  const identityKeys = makeIdentityKeys(
    gatedInput,
    contacts.phoneNormalized ?? normalized.phoneNormalized,
  );

  return {
    input: gatedInput,
    phoneNormalized: contacts.phoneNormalized ?? normalized.phoneNormalized,
    changes: normalized.changes,
    issues,
    viability,
    identityKeys,
    original,
  };
}

export function findExistingIdentityConflict(
  candidate: PreparedResourceCandidate,
  existing: Array<{
    id: string;
    name: string;
    email: string | null;
    website: string | null;
    phoneNormalized: string | null;
  }>,
  excludeId?: string,
) {
  const wanted = new Set(candidate.identityKeys);
  if (wanted.size === 0) return null;
  for (const resource of existing) {
    if (resource.id === excludeId) continue;
    const keys = makeIdentityKeys(resource, resource.phoneNormalized);
    if (keys.some((key) => wanted.has(key))) return resource;
  }
  return null;
}

function makeIdentityKeys(
  resource: { name?: string; email?: string | null; website?: string | null },
  phoneNormalized: string | null,
): string[] {
  const implementation = resourceIdentityKeys as unknown as (
    input: { name?: string; email?: string | null; website?: string | null },
    phone: string | null,
  ) => string[];
  return implementation(resource, phoneNormalized);
}

function gatePublication(input: {
  viability: ResourceViability;
  requestedVerified: boolean;
  requestedPublished: boolean;
  httpStatus: number | null;
}): { verified: boolean; published: boolean } {
  const implementation = gateResourcePublication as unknown as (
    value: typeof input,
  ) => { verified: boolean; published: boolean };
  return implementation(input);
}

function parseDocument(
  content: string,
  requestedFormat: ResourceInputFormat | undefined,
  multiple: boolean,
  filename = "",
): { format: ResourceInputFormat; candidates: UnknownRecord[] } {
  try {
    return parseResourceDocument(content, requestedFormat, {
      filename,
      multiple,
    }) as { format: ResourceInputFormat; candidates: UnknownRecord[] };
  } catch (error) {
    if (error instanceof ResourceDocumentError) {
      throw new ResourceIngestionError(error.code, error.message);
    }
    throw error;
  }
}

function classifyViability(
  resource: Partial<ResourceInput>,
  signals: CanonicalResult["signals"],
  issues: string[],
): ResourceViability {
  const spam = checkSpam(resource.name ?? "", resource.description ?? null, resource.tags ?? "");
  if (spam.isSpam) issues.push(...spam.patterns.map((pattern) => `off_topic:${pattern}`));
  return classifyResourceViability({
    signals,
    issues,
    hasContact: Boolean(resource.website || resource.email || resource.phoneRaw),
    offTopic: spam.isSpam,
  }) as ResourceViability;
}
