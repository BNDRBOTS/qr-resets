import { z } from "zod";

export const SITE_COPY_DEFAULTS = {
  heroIntro:
    "Find legal, advocacy, housing, medical, and practical support resources in one place.",
  categoryIntro:
    "Choose a category to narrow the directory, or browse everything available.",
  footerIntro:
    "ResourceCite helps people find practical support and service information in one searchable directory.",
  provenanceNote:
    "Listings are maintained from source records and reviewed over time. Contact details can change, so confirm time-sensitive information directly with the organization.",
  aboutText:
    "ResourceCite is a resource directory operated by BNDR LLC.",
} as const;

export type SiteCopyContent = {
  [K in keyof typeof SITE_COPY_DEFAULTS]: string;
};

export const siteCopyContentSchema = z.object({
  heroIntro: z.string().trim().min(1).max(500),
  categoryIntro: z.string().trim().min(1).max(500),
  footerIntro: z.string().trim().min(1).max(500),
  provenanceNote: z.string().trim().min(1).max(1000),
  aboutText: z.string().trim().min(1).max(500),
});

export function normalizeSiteCopy(value: unknown): SiteCopyContent {
  const parsed = siteCopyContentSchema.safeParse(value);
  return parsed.success ? parsed.data : { ...SITE_COPY_DEFAULTS };
}
