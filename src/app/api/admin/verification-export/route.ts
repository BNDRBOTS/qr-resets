// BNDR. API — Production-grade verification JSON export
// ----------------------------------------------------------------------------
// GET /api/admin/verification-export
//   Returns a JSON document containing ALL resources, with a production-grade
//   double-source verification prompt appended to the top. The prompt instructs
//   an LLM/agent to verify each resource against TWO independent live web
//   sources — if either source cannot be found via LIVE WEB SEARCH, the
//   verification FAILS for that resource.
//
//   The prompt also instructs the agent to GATHER any missing data (phone,
//   email, address, website, hours, eligibility) and list it in full within
//   the JSON output.
//
//   This export is designed for offline batch verification by an external
//   LLM agent with web-search capabilities. It does NOT perform the search
//   itself (no live web search from this endpoint) — it provides the
//   structured data + the prompt for the agent to execute.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cleanArtifacts, decodeUrlForDisplay } from "@/lib/pii";
import { CATEGORIES } from "@/lib/types";
import type { CategorySlug } from "@/lib/types";
import { requireAdminRateLimited } from "@/lib/require-admin";
import { RATE_LIMITS } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const VERIFICATION_PROMPT = `# BNDR. Resource Directory — Production-Grade Double-Source Verification

## MISSION
You are a verification agent for the BNDR. Resource Directory. Your task is to
verify EVERY resource listed below against TWO independent live web sources.
You MUST use LIVE WEB SEARCH to find corroborating sources — do NOT rely on
your training data alone. If you cannot perform a live web search, STOP and
report FAILURE.

## VERIFICATION RULES (STRICT)
1. For each resource, perform a LIVE WEB SEARCH for the organization's name
   + location/phone to find TWO independent sources that confirm:
   - The organization exists and is operational
   - The phone number is correct and current
   - The website URL is valid and reachable
   - The address is accurate (if listed)

2. SOURCE INDEPENDENCE: The two sources must be from DIFFERENT domains
   (e.g., the org's own website + a government directory, NOT two pages on
   the same site). Acceptable second sources include:
   - .gov domains (justice.gov, usa.gov, state .gov sites)
   - Established directories (Guidestar, Charity Navigator, 211.org)
   - News articles from recognized outlets
   - Professional association listings (ABA, AARP, etc.)

3. FAILURE CONDITIONS — a resource FAILS verification if:
   - LIVE WEB SEARCH is unavailable (you cannot search)
   - Fewer than 2 independent sources can be found
   - The phone number cannot be confirmed by either source
   - The website returns 404/410 or is confirmed defunct
   - The organization is confirmed closed/defunct

4. MISSING DATA GATHERING — for each resource, if any of these fields are
   missing or empty, USE LIVE WEB SEARCH to gather them and fill them in:
   - phone (main contact number, prefer toll-free)
   - email (general intake/info email)
   - address (street address, city, state, ZIP)
   - website (canonical URL, no redirects)
   - hours (operation hours, especially for crisis lines: 24/7?)
   - eligibility (who qualifies for services)
   - services (specific services offered)
   - languages (languages spoken beyond English)

## OUTPUT FORMAT
For each resource, output a verification record:
{
  "resourceId": "<id>",
  "name": "<name>",
  "verificationStatus": "verified" | "failed" | "partial",
  "sources": [
    { "url": "<source1-url>", "domain": "<domain>", "confidence": "high|medium|low", "notes": "<what it confirms>" },
    { "url": "<source2-url>", "domain": "<domain>", "confidence": "high|medium|low", "notes": "<what it confirms>" }
  ],
  "gatheredData": {
    "phone": "<confirmed phone or null>",
    "email": "<confirmed email or null>",
    "address": "<confirmed address or null>",
    "website": "<confirmed URL or null>",
    "hours": "<hours or null>",
    "eligibility": "<eligibility or null>",
    "services": "<services or null>",
    "languages": "<languages or null>"
  },
  "discrepancies": ["<list of any conflicts between stored data and sources>"],
  "failureReason": "<null if verified, else the reason>"
}

## CRITICAL CONSTRAINTS
- LIVE WEB SEARCH ONLY. No training-data recall for verification.
- If you cannot web-search, output { "status": "SEARCH_UNAVAILABLE", "error": "Live web search required" } and STOP.
- Do NOT invent or fabricate sources. If a source cannot be found, mark the resource as "failed".
- Prefer official organization websites and government directories over aggregators.
- For every hotline or emergency resource, verify the number is still active using its current official source.`;

export async function GET(req: Request) {
  const blocked = await requireAdminRateLimited(req, RATE_LIMITS.resourceMutation);
  if (blocked) return blocked;

  try {
    const rows = await db.resource.findMany({
      orderBy: [{ priority: "desc" }, { name: "asc" }],
    });

    const resources = rows.map((r) => ({
      id: r.id,
      name: r.name,
      acronym: r.acronym,
      description: cleanArtifacts(r.description),
      category: r.category as CategorySlug,
      categoryLabel: CATEGORIES.find((c) => c.slug === r.category)?.shortName ?? r.category,
      subcategory: r.subcategory,
      phoneRaw: r.phoneRaw,
      phoneNormalized: r.phoneNormalized,
      email: r.email,
      address: r.address,
      website: r.website,
      websiteDisplay: r.website ? decodeUrlForDisplay(r.website).replace(/^https?:\/\//, "").replace(/\/$/, "") : null,
      tags: r.tags,
      priority: r.priority,
      verified: r.verified,
      sourceNote: r.sourceNote,
      // Fields the verification agent should gather/fill:
      gatheredFields: {
        phone: null,
        email: null,
        address: null,
        website: null,
        hours: null,
        eligibility: null,
        services: null,
        languages: null,
      },
    }));

    const byStatus = {
      total: resources.length,
      priority: resources.filter((r) => r.priority >= 1).length,
      withWebsite: resources.filter((r) => !!r.website).length,
      withPhone: resources.filter((r) => !!r.phoneNormalized).length,
      withEmail: resources.filter((r) => !!r.email).length,
      missingPhone: resources.filter((r) => !r.phoneNormalized).length,
      missingEmail: resources.filter((r) => !r.email).length,
      missingAddress: resources.filter((r) => !r.address).length,
      missingWebsite: resources.filter((r) => !r.website).length,
    };

    const exportDoc = {
      _meta: {
        exportType: "bndr-verification-export",
        version: "1.0",
        exportedAt: new Date().toISOString(),
        totalResources: resources.length,
        stats: byStatus,
        instructions: "Append verification results for each resource as a 'verificationRecord' object. See the prompt above.",
      },
      _verificationPrompt: VERIFICATION_PROMPT,
      resources,
    };

    return NextResponse.json(exportDoc, {
      headers: {
        "Content-Disposition": `attachment; filename="bndr-verification-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    });
  } catch (err) {
    console.error("[api/admin/verification-export GET]", err);
    return NextResponse.json(
      { error: "Failed to generate verification export" },
      { status: 500 },
    );
  }
}
