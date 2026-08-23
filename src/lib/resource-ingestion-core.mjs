// Deterministic resource-document parsing and contact validation.
// Regexes locate candidates only; dedicated parsers/validators decide validity.

import { XMLParser } from "fast-xml-parser";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { remark } from "remark";
import validator from "validator";

export const RESOURCE_INPUT_FORMATS = ["txt", "markdown", "json", "xml"];

const CATEGORY_SLUGS = [
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
];

const CATEGORY_RULES = [
  ["child-abduction", /child abduction|missing child|custodial interference|kidnapp/i],
  ["victim-rights-compensation", /victim rights|victim compensation|crime victim/i],
  ["domestic-violence-family-violence", /domestic violence|family violence|child abuse|shelter/i],
  ["family-advocacy-trauma-recovery", /trauma recovery|family advocacy|advocacy cent(?:er|re)/i],
  ["protective-parent-family-court", /protective parent|family court abuse/i],
  ["gaslighting-darvo-institutional-betrayal", /darvo|gaslighting|institutional betrayal|coercive control/i],
  ["parental-alienation-fathers-rights", /parental alienation|father'?s rights|equal parenting/i],
  ["legal-aid-court-access", /legal aid|court access|pro bono/i],
  ["attorneys-firms", /law firm|attorney|lawyer/i],
  ["disability-medical-advocacy", /disability rights|patient advocacy|medical gaslighting/i],
  ["victim-linked-programs", /voca|vawa|victim-linked|victim fund/i],
  ["lyme-co-infections", /lyme|babesia|co-infection/i],
  ["housing-financial-aid", /housing|rental assistance|financial aid|grant|food assistance/i],
];

const ALIASES = {
  name: ["name", "organization", "organisation", "organizationname", "resourcename", "title"],
  acronym: ["acronym", "abbr", "abbreviation"],
  description: ["description", "summary", "about", "details", "mission"],
  category: ["category", "categoryslug", "type", "resourcecategory"],
  subcategory: ["subcategory", "subtype"],
  phoneRaw: ["phoneraw", "phone", "telephone", "tel", "hotline"],
  email: ["email", "emailaddress", "contactemail"],
  address: ["address", "streetaddress", "location", "mailingaddress"],
  website: ["website", "url", "site", "web", "link"],
  tags: ["tags", "tag", "keywords", "labels"],
  priority: ["priority", "prioritylevel"],
  verified: ["verified", "isverified", "sourceverified"],
  published: ["published", "ispublished", "public"],
  sourceNote: ["sourcenote", "source", "provenance", "citation", "notes"],
  status: ["status", "verificationstatus", "viability", "entitystatus"],
  identityMismatch: ["identitymismatch", "wrongentity", "entitymismatch"],
  offTopic: ["offtopic", "irrelevant", "nonresource"],
  httpStatus: ["httpstatus", "statuscode", "httpcode"],
};

const EMAIL_CANDIDATE_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const URL_CANDIDATE_RE = /\b(?:https?:\/\/|www\.)[^\s<>"']+/gi;
const PHONE_CANDIDATE_RE = /(?:\+?1[\s./-]*)?(?:\(?\d{3}\)?[\s./-]*)\d{3}[\s./-]*\d{4}(?:\s*(?:x|ext\.?|extension)\s*\d+)?|\b1[\s-]*800[\s-]*[A-Z0-9-]{7,}\b/gi;

export class ResourceDocumentError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "ResourceDocumentError";
    this.code = code;
  }
}

export function detectResourceFormat(content, filename = "") {
  const ext = filename.trim().toLowerCase().split(".").pop();
  if (ext === "json") return "json";
  if (ext === "xml") return "xml";
  if (ext === "md" || ext === "markdown") return "markdown";
  if (ext === "txt") return "txt";
  const trimmed = String(content ?? "").trimStart();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return "json";
  if (trimmed.startsWith("<")) return "xml";
  if (/^(?:#{1,6}\s|[-*+]\s|>\s)/m.test(trimmed)) return "markdown";
  return "txt";
}

export function parseResourceDocument(content, requestedFormat, options = {}) {
  const text = String(content ?? "");
  if (!text.trim()) {
    throw new ResourceDocumentError("EMPTY_INPUT", "Resource input is empty.");
  }
  const format = requestedFormat || detectResourceFormat(text, options.filename);
  if (!RESOURCE_INPUT_FORMATS.includes(format)) {
    throw new ResourceDocumentError("UNSUPPORTED_FORMAT", `Unsupported resource input format: ${format}`);
  }

  let candidates;
  try {
    if (format === "json") candidates = parseJsonDocument(text);
    else if (format === "xml") candidates = parseXmlDocument(text);
    else if (format === "markdown") candidates = parseMarkdownDocument(text, options.multiple !== false);
    else candidates = parseTextDocument(text, options.multiple !== false);
  } catch (error) {
    if (error instanceof ResourceDocumentError) throw error;
    throw new ResourceDocumentError(
      "MALFORMED_INPUT",
      error instanceof Error ? error.message : "The resource document is malformed.",
    );
  }

  const mapped = candidates.map(tolerantResourceMapping).filter((candidate) => Object.keys(candidate).length > 0);
  if (mapped.length === 0) {
    throw new ResourceDocumentError("NO_RESOURCE_CANDIDATES", "No resource records were found in the input.");
  }
  return { format, candidates: options.multiple === false ? mapped.slice(0, 1) : mapped };
}

export function tolerantResourceMapping(source) {
  if (!source || typeof source !== "object" || Array.isArray(source)) return {};
  const entries = flattenPrimitiveEntries(source);
  const mapped = {};
  for (const [target, aliases] of Object.entries(ALIASES)) {
    const found = entries.find(([key]) => aliases.includes(key));
    if (found) mapped[target] = found[1];
  }

  const direct = source;
  for (const key of ["id", "sourceCategory", "phoneNormalized", "phoneDisplay", "piipassAt", "piipassNotes", "sourceDatasetHash", "sourceRow", "createdAt", "updatedAt"]) {
    if (Object.prototype.hasOwnProperty.call(direct, key)) mapped[key] = direct[key];
  }
  return mapped;
}

export function canonicalizeResourceCandidate(candidate) {
  const value = candidate && typeof candidate === "object" ? candidate : {};
  const category = canonicalCategory(value.category, `${toText(value.name)} ${toText(value.description)}`);
  const canonical = {
    name: cleanString(value.name),
    acronym: cleanNullable(value.acronym),
    description: cleanNullable(value.description),
    category,
    subcategory: cleanNullable(value.subcategory),
    phoneRaw: cleanNullable(value.phoneRaw),
    email: cleanNullable(value.email)?.toLowerCase() ?? null,
    address: cleanNullable(value.address),
    website: normalizeWebsiteCandidate(value.website),
    tags: normalizeTags(value.tags),
    priority: normalizePriority(value.priority),
    verified: toBoolean(value.verified),
    published: toBoolean(value.published),
    sourceNote: cleanNullable(value.sourceNote),
  };

  return {
    canonical,
    signals: {
      status: cleanString(value.status).toLowerCase().replace(/[\s-]+/g, "_"),
      identityMismatch: toBoolean(value.identityMismatch),
      offTopic: toBoolean(value.offTopic),
      httpStatus: value.httpStatus == null ? null : Number(value.httpStatus),
    },
  };
}

export function validateContactCandidates(canonical) {
  const issues = [];
  let email = canonical.email;
  let website = canonical.website;
  let phoneNormalized = null;

  if (email && !validator.isEmail(email, { allow_utf8_local_part: false, require_tld: true })) {
    issues.push("invalid_email");
    email = null;
  }

  if (website) {
    try {
      const parsed = new URL(website);
      if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) {
        throw new Error("unsafe URL structure");
      }
      website = parsed.toString();
      if (website.endsWith("/") && parsed.pathname === "/" && !parsed.search && !parsed.hash) {
        website = website.slice(0, -1);
      }
    } catch {
      issues.push("invalid_url");
      website = null;
    }
  }

  if (canonical.phoneRaw) {
    const phoneText = canonical.phoneRaw.replace(/[‐‑‒–—−]/g, "-");
    const candidates = phoneText.match(PHONE_CANDIDATE_RE) ?? [];
    const valid = [];
    for (const raw of candidates) {
      const phone = parsePhoneCandidate(raw);
      if (phone && !valid.includes(phone)) valid.push(phone);
    }
    if (valid.length === 0) issues.push("invalid_phone");
    else phoneNormalized = valid.join(" | ");
  }

  return {
    canonical: { ...canonical, email, website },
    phoneNormalized,
    issues,
  };
}

export function resourceIdentityKeys(resource, phoneNormalized = null) {
  const name = identityToken(resource.name);
  if (!name) return [];
  const keys = [];
  if (resource.website) {
    try {
      const url = new URL(resource.website);
      const host = url.hostname.toLowerCase().replace(/^www\./, "");
      const path = url.pathname.replace(/\/+$/, "") || "/";
      keys.push(`name+url:${name}|${host}${path}`);
    } catch {
      // Invalid URLs never become identity keys.
    }
  }
  if (resource.email) keys.push(`name+email:${name}|${resource.email.toLowerCase()}`);
  for (const phone of String(phoneNormalized ?? "").split("|").map((part) => part.trim()).filter(Boolean)) {
    keys.push(`name+phone:${name}|${phone}`);
  }
  return [...new Set(keys)];
}

export function findBatchDuplicate(prepared) {
  const owners = new Map();
  for (let index = 0; index < prepared.length; index += 1) {
    for (const key of prepared[index].identityKeys ?? []) {
      const prior = owners.get(key);
      if (prior !== undefined) return { key, firstIndex: prior, secondIndex: index };
      owners.set(key, index);
    }
  }
  return null;
}

export function classifyResourceViability({ signals, issues, hasContact, offTopic = false }) {
  const status = String(signals?.status ?? "");
  if (signals?.identityMismatch || status === "identity_mismatch") return "identity_mismatch";
  if (signals?.offTopic || status === "off_topic" || offTopic) return "off_topic";
  if (status === "invalid" || issues.length > 0) return "invalid";
  if (!hasContact) return "pending";
  // Deliberately ignore signals.httpStatus. Network reachability never proves
  // that the page belongs to the claimed resource entity.
  return "viable";
}

export function gateResourcePublication({
  viability,
  requestedVerified,
  requestedPublished,
  httpStatus = null,
}) {
  const eligible = viability === "viable" && httpStatus == null;
  return {
    verified: eligible && requestedVerified === true,
    published: eligible && requestedPublished === true,
  };
}

function parseJsonDocument(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ResourceDocumentError("MALFORMED_JSON", "The JSON input is malformed.");
  }
  return extractCandidateObjects(parsed);
}

function parseXmlDocument(text) {
  let parsed;
  try {
    parsed = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "",
      trimValues: true,
      parseTagValue: false,
      allowBooleanAttributes: true,
    }).parse(text);
  } catch {
    throw new ResourceDocumentError("MALFORMED_XML", "The XML input is malformed.");
  }
  return extractCandidateObjects(parsed);
}

function parseMarkdownDocument(text, multiple) {
  let tree;
  try {
    tree = remark().parse(text);
  } catch {
    throw new ResourceDocumentError("MALFORMED_MARKDOWN", "The Markdown input is malformed.");
  }
  if (!multiple) return [parseTextBlock(markdownNodeText(tree))];

  const sections = [];
  let current = null;
  for (const node of tree.children ?? []) {
    if (node.type === "heading") {
      if (current) sections.push(current);
      current = { name: markdownNodeText(node), body: [] };
    } else if (current) {
      current.body.push(markdownNodeText(node));
    }
  }
  if (current) sections.push(current);
  if (sections.length === 0) return parseTextDocument(markdownNodeText(tree), multiple);
  return sections.map((section) => ({
    ...parseTextBlock(section.body.filter(Boolean).join("\n")),
    name: section.name,
  }));
}

function parseTextDocument(text, multiple) {
  if (!multiple) return [parseTextBlock(text)];
  const blocks = text
    .split(/(?:\r?\n){2,}|(?:^|\n)\s*---+\s*(?:\n|$)/)
    .map((block) => block.trim())
    .filter(Boolean);
  return (blocks.length > 0 ? blocks : [text]).map(parseTextBlock);
}

function parseTextBlock(text) {
  const lines = String(text).split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const labels = {};
  const unlabeled = [];
  for (const line of lines) {
    const match = line.match(/^([A-Za-z][A-Za-z0-9 _-]{1,32}):\s*(.+)$/);
    if (match) labels[normalizeKey(match[1])] = match[2].trim();
    else unlabeled.push(line);
  }
  const source = { ...labels };
  const email = text.match(EMAIL_CANDIDATE_RE)?.[0];
  const website = text.match(URL_CANDIDATE_RE)?.[0]?.replace(/[),.;]+$/g, "");
  const phoneRaw = text.match(PHONE_CANDIDATE_RE)?.[0];
  if (email && source.email == null) source.email = email;
  if (website && source.website == null && source.url == null) source.website = website;
  if (phoneRaw && source.phone == null && source.phoneraw == null) source.phoneRaw = phoneRaw;

  const contactValues = [email, website, phoneRaw].filter(Boolean);
  const content = unlabeled.filter((line) => !contactValues.some((value) => line.includes(value)));
  if (source.name == null && source.organization == null && content[0]) source.name = content[0];
  if (source.description == null && content.length > 1) source.description = content.slice(1).join("\n");
  if (source.category == null) source.category = inferCategory(text);
  return source;
}

function extractCandidateObjects(value) {
  if (Array.isArray(value)) return value.filter(isObject);
  if (!isObject(value)) return [];
  for (const key of ["resources", "resource", "organizations", "organisations", "items", "records", "entries"]) {
    const matched = Object.entries(value).find(([name]) => normalizeKey(name) === key);
    if (!matched) continue;
    if (Array.isArray(matched[1])) return matched[1].filter(isObject);
    if (isObject(matched[1])) return [matched[1]];
  }
  if (looksLikeResource(value)) return [value];
  const found = [];
  for (const nested of Object.values(value)) {
    if (Array.isArray(nested)) found.push(...nested.filter((item) => isObject(item) && looksLikeResource(item)));
    else if (isObject(nested)) found.push(...extractCandidateObjects(nested));
  }
  return found;
}

function looksLikeResource(value) {
  const keys = new Set(Object.keys(value).map(normalizeKey));
  return ALIASES.name.some((key) => keys.has(key)) &&
    Object.values(ALIASES).flat().some((key) => key !== "name" && keys.has(key));
}

function flattenPrimitiveEntries(value, depth = 0) {
  if (!isObject(value) || depth > 4) return [];
  const entries = [];
  for (const [rawKey, rawValue] of Object.entries(value)) {
    const key = normalizeKey(rawKey);
    if (rawValue == null || ["string", "number", "boolean"].includes(typeof rawValue) || Array.isArray(rawValue)) {
      entries.push([key, rawValue]);
    } else if (isObject(rawValue)) {
      entries.push(...flattenPrimitiveEntries(rawValue, depth + 1));
    }
  }
  return entries;
}

function markdownNodeText(node) {
  if (!node || typeof node !== "object") return "";
  if (typeof node.value === "string") return node.value;
  const childText = Array.isArray(node.children)
    ? node.children.map(markdownNodeText).filter(Boolean).join(node.type === "root" ? "\n" : " ")
    : "";
  if (node.type === "link" && typeof node.url === "string") return `${childText} ${node.url}`.trim();
  return childText;
}

function canonicalCategory(value, fallbackText) {
  const raw = cleanString(value).toLowerCase();
  if (CATEGORY_SLUGS.includes(raw)) return raw;
  const normalized = raw.replace(/[^a-z0-9]+/g, " ").trim();
  const source = `${normalized} ${fallbackText}`;
  return inferCategory(source) || "";
}

function inferCategory(text) {
  return CATEGORY_RULES.find(([, pattern]) => pattern.test(String(text)))?.[0] ?? "";
}

function normalizeWebsiteCandidate(value) {
  const raw = cleanNullable(value);
  if (!raw || raw.toLowerCase().startsWith("mailto:")) return null;
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

function parsePhoneCandidate(raw) {
  const ordinary = parsePhoneNumberFromString(String(raw), "US");
  if (ordinary?.isValid()) {
    return ordinary.country === "US" ? ordinary.nationalNumber : ordinary.number.replace(/^\+/, "");
  }
  const mnemonic = String(raw).toUpperCase().replace(/[A-Z]/g, (letter) => {
    const index = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".indexOf(letter);
    return index < 0 ? letter : "22233344455566677778889999"[index];
  });
  const digits = mnemonic.replace(/\D/g, "");
  const candidate = digits.length === 10 ? `+1${digits}` : digits.length === 11 && digits.startsWith("1") ? `+${digits}` : mnemonic;
  const parsed = parsePhoneNumberFromString(candidate, "US");
  if (!parsed?.isValid()) return null;
  return parsed.country === "US" ? parsed.nationalNumber : parsed.number.replace(/^\+/, "");
}

function normalizeTags(value) {
  if (Array.isArray(value)) return value.map(cleanString).filter(Boolean).join(", ");
  return cleanString(value);
}

function normalizePriority(value) {
  const number = Number(value ?? 0);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(10, Math.trunc(number)));
}

function toBoolean(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  return ["true", "yes", "1", "verified", "published"].includes(cleanString(value).toLowerCase());
}

function toText(value) {
  if (Array.isArray(value)) return value.map(toText).filter(Boolean).join(", ");
  if (value == null || typeof value === "object") return "";
  return String(value);
}

function cleanString(value) {
  return toText(value).replace(/\s+/g, " ").trim();
}

function cleanNullable(value) {
  const cleaned = cleanString(value);
  return cleaned || null;
}

function identityToken(value) {
  return cleanString(value).toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

function normalizeKey(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
