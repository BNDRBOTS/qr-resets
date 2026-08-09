"use client";

import { motion } from "framer-motion";
import {
  Phone,
  Mail,
  Globe,
  MapPin,
  Info,
  Sparkles,
  ExternalLink,
  Bookmark,
  BookmarkCheck,
  ArrowLeftRight,
  Check,
  StickyNote,
  Star,
  AlertCircle,
  Inbox,
  History,
  User,
  Voicemail,
  MessageCircle,
  HelpCircle,
  Share2,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { CATEGORIES, type Resource, type CategorySlug } from "@/lib/types";
import { formatPhoneDisplay, decodeUrlForDisplay } from "@/lib/pii";
import { parseTags } from "@/lib/tags";
import type { ContactMethod } from "./use-contact-log";
import { Highlight } from "./highlight";
import { LinkStatusDot } from "./link-status-dot";
import { toast } from "sonner";

interface ResourceCardProps {
  resource: Resource;
  query?: string;
  index?: number;
  onOpen: (r: Resource) => void;
  isSaved?: boolean;
  onToggleSave?: (r: Resource) => void;
  isComparing?: boolean;
  onToggleCompare?: (r: Resource) => void;
  hasNote?: boolean;
  rating?: number;
  onTagClick?: (tag: string) => void;
  /** Saved + (never contacted OR contacted >7d ago) → amber dot */
  followUpNeeded?: boolean;
  /** Number of contact-log entries for this resource (shows a history badge). */
  contactLogCount?: number;
  /** The advocate's saved default contact method for this resource (shows an icon badge). */
  defaultContactMethod?: ContactMethod;
}

const CATEGORY_NAME: Record<CategorySlug, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.slug, c.shortName]),
) as Record<CategorySlug, string>;

/** Icon + label for the default-contact-method badge on cards. */
const DEFAULT_METHOD_ICONS: Record<ContactMethod, typeof Phone> = {
  phone: Phone,
  email: Mail,
  "in-person": User,
  voicemail: Voicemail,
  text: MessageCircle,
  other: HelpCircle,
};
const DEFAULT_METHOD_LABELS: Record<ContactMethod, string> = {
  phone: "Phone call",
  email: "Email",
  "in-person": "In person",
  voicemail: "Voicemail",
  text: "Text message",
  other: "Other",
};

function firstPhone(normalized: string | null): string | null {
  if (!normalized) return null;
  return normalized.split("|")[0].trim() || null;
}

/**
 * Glassmorphic resource card with consistent geometry for every resource.
 * Priority is preserved as metadata and an explicit filter, never as a larger
 * card footprint that could visually over-weight one resource or category.
 */
export function ResourceCard({
  resource,
  query,
  index = 0,
  onOpen,
  isSaved = false,
  onToggleSave,
  isComparing = false,
  onToggleCompare,
  hasNote = false,
  rating = 0,
  onTagClick,
  followUpNeeded = false,
  contactLogCount = 0,
  defaultContactMethod,
}: ResourceCardProps) {
  const isPriority = resource.priority >= 1;
  const tags = parseTags(resource.tags);
  const phone = firstPhone(resource.phoneNormalized);
  const phoneDisplay = formatPhoneDisplay(phone);
  const catName = CATEGORY_NAME[resource.category] ?? resource.category;
  const hasContact = Boolean(phoneDisplay || resource.email || resource.website || resource.address);

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  // ---- Compare toggle button (shared) --------------------------------------
  const CompareButton = onToggleCompare ? (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={(e) => {
              stop(e);
              onToggleCompare(resource);
            }}
            aria-label={isComparing ? `Remove ${resource.name} from comparison` : `Add ${resource.name} to comparison`}
            aria-pressed={isComparing}
            className={
              "flex size-8 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 " +
              (isComparing
                ? "text-primary hover:bg-primary/15"
                : "text-muted-foreground/60 hover:text-primary hover:bg-primary/10")
            }
          >
            {isComparing ? (
              <Check className="size-3.5" aria-hidden />
            ) : (
              <ArrowLeftRight className="size-3.5" aria-hidden />
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {isComparing ? "Remove from comparison" : "Add to compare"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ) : null;

  // ---- Save toggle button (shared) -----------------------------------------
  const SaveButton = onToggleSave ? (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={(e) => {
              stop(e);
              onToggleSave(resource);
            }}
            aria-label={isSaved ? `Remove ${resource.name} from saved` : `Save ${resource.name}`}
            aria-pressed={isSaved}
            className={
              "flex size-8 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 " +
              (isSaved
                ? "text-primary hover:bg-primary/15"
                : "text-muted-foreground/60 hover:text-primary hover:bg-primary/10")
            }
          >
            {isSaved ? (
              <BookmarkCheck className="size-3.5" aria-hidden />
            ) : (
              <Bookmark className="size-3.5" aria-hidden />
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {isSaved ? "Remove from saved" : "Save to my list"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ) : null;

  // ---- Share button (shared) -----------------------------------------------
  const ShareButton = (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={(e) => {
              stop(e);
              const text = `${resource.name}\n${resource.description ?? ""}\n${resource.phoneNormalized ? "Phone: " + resource.phoneNormalized : ""}\n${resource.website ? "Web: " + resource.website : ""}\n\nVia BNDR. Resource Directory`;
              if (navigator.share) {
                navigator.share({ title: resource.name, text }).catch(() => {});
              } else {
                navigator.clipboard.writeText(text).then(
                  () => toast.success("Resource details copied to clipboard"),
                  () => toast.error("Could not copy to clipboard"),
                );
              }
            }}
            aria-label={`Share ${resource.name}`}
            className="flex size-8 items-center justify-center rounded-full text-muted-foreground/60 transition-colors hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          >
            <Share2 className="size-3.5" aria-hidden />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Share resource</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );

  // ---- Shared sub-elements --------------------------------------------------

  const Badges = (
    <div className="flex flex-wrap items-center gap-2">
      {isPriority ? (
        <Badge className="border border-primary/40 bg-primary/20 text-primary">
          <Sparkles className="size-3" aria-hidden /> Priority
        </Badge>
      ) : null}
      {resource.acronym ? (
        <Badge
          variant="secondary"
          className="bg-secondary/70 font-mono text-xs uppercase tracking-wide"
        >
          {resource.acronym}
        </Badge>
      ) : null}
      <Badge
        variant="outline"
        className="border-border/80 text-muted-foreground"
      >
        {catName}
      </Badge>
      {followUpNeeded ? (
        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className="bndr-status-pill inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                aria-label="Follow-up needed: saved but not contacted recently"
              >
                <AlertCircle className="size-3" aria-hidden />
                Follow-up
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Saved but never contacted, or last contacted over 7 days ago.
              Open to log a new contact date.
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : null}
      {contactLogCount > 0 ? (
        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary"
                aria-label={`${contactLogCount} contact log ${contactLogCount === 1 ? "entry" : "entries"}`}
              >
                <History className="size-3" aria-hidden />
                {contactLogCount}
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {contactLogCount} contact {contactLogCount === 1 ? "log entry" : "log entries"} recorded. Open to view the full timeline.
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : null}
      {defaultContactMethod ? (
        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary"
                aria-label={`Default contact method: ${DEFAULT_METHOD_LABELS[defaultContactMethod] ?? defaultContactMethod}`}
              >
                {(() => {
                  const Icon = DEFAULT_METHOD_ICONS[defaultContactMethod] ?? HelpCircle;
                  return <Icon className="size-3" aria-hidden />;
                })()}
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Default method: {DEFAULT_METHOD_LABELS[defaultContactMethod] ?? defaultContactMethod}. Auto-selected when logging a new contact.
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : null}
      {/* Right-aligned action icons */}
      <div className="ml-auto flex shrink-0 items-center gap-1">
        {rating > 0 ? (
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex items-center gap-0.5 rounded-full p-1 text-primary" aria-label={`Your rating: ${rating} of 5 stars`}>
                  <Star className="size-3.5 fill-current" aria-hidden />
                  <span className="text-[10px] font-medium tabular-nums">{rating}</span>
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom">Your rating: {rating}/5</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : null}
        {hasNote ? (
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="rounded-full p-1 text-primary" aria-label="Has a private note">
                  <StickyNote className="size-3.5" aria-hidden />
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom">Has a private note</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : null}
        {CompareButton}
        {SaveButton}
        {ShareButton}
        {resource.sourceNote ? (
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={stop}
                  aria-label="Source note"
                  className="flex size-8 items-center justify-center rounded-full text-muted-foreground/70 hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                >
                  <Info className="size-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent
                side="bottom"
                className="max-w-xs border-border bg-popover/95 text-xs text-popover-foreground"
              >
                {resource.sourceNote}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : null}
      </div>
    </div>
  );

  const Tags = tags.length > 0 ? (
    <div className="flex flex-wrap gap-1.5 pt-1">
      {tags.slice(0, 4).map((t) =>
        onTagClick ? (
          <button
            key={t}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onTagClick(t);
            }}
            className="rounded-lg border border-border/50 bg-muted/40 px-2.5 py-1 text-xs font-medium text-foreground/70 transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/60"
          >
            {t}
          </button>
        ) : (
          <span
            key={t}
            className="rounded-lg border border-border/50 bg-muted/40 px-2.5 py-1 text-xs font-medium text-foreground/70"
          >
            {t}
          </span>
        ),
      )}
      {tags.length > 4 ? (
        <span className="rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary/80">
          +{tags.length - 4}
        </span>
      ) : null}
    </div>
  ) : null;

  // ---- Unified resource card -------------------------------------------------
  // Priority remains a badge/filter only; all resources keep equal card geometry.

  // ---- NORMAL: vertical compact card ---------------------------------------

  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.45, delay: Math.min(index * 0.04, 0.32) }}
      onClick={() => onOpen(resource)}
      className="bndr-card group relative flex cursor-pointer flex-col gap-3 rounded-2xl p-4 sm:p-5 lg:p-6"
    >
      {Badges}

      <h3 className="text-lg font-semibold leading-snug text-foreground">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onOpen(resource); }}
          className="rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
        >
          <Highlight text={resource.name} query={query} />
        </button>
      </h3>

      {/* Contact method quick-badges — at-a-glance availability indicators */}
      {hasContact ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {phoneDisplay ? (
            <span className="bndr-contact-chip" title="Phone available">
              <Phone className="size-2.5" aria-hidden />
              Phone
            </span>
          ) : null}
          {resource.email ? (
            <span className="bndr-contact-chip" title="Email available">
              <Mail className="size-2.5" aria-hidden />
              Email
            </span>
          ) : null}
          {resource.website ? (
            <span className="bndr-contact-chip" title="Website available">
              <Globe className="size-2.5" aria-hidden />
              Web
            </span>
          ) : null}
          {resource.address ? (
            <span className="bndr-contact-chip" title="Address available">
              <MapPin className="size-2.5" aria-hidden />
              Address
            </span>
          ) : null}
        </div>
      ) : null}

      {resource.description ? (
        <p className="bndr-line-clamp-3 text-sm leading-relaxed text-foreground/90">
          <Highlight text={resource.description} query={query} />
        </p>
      ) : null}

      {/* Contact row — brighter text for readability, hover lifts to primary.
           When a card has no contact info at all, show a subtle "no direct
           contact on file" note so the row never collapses to empty space. */}
      <div className="mt-auto flex flex-col gap-1.5 border-t border-border/50 pt-3 text-sm">
        {phoneDisplay ? (
          <a
            href={`tel:${phone}`}
            onClick={stop}
            className="inline-flex items-center gap-2 text-foreground/90 transition-colors hover:text-primary focus-visible:outline-none focus-visible:underline"
          >
            <Phone className="size-3.5 text-primary/80" aria-hidden />
            <span className="font-mono tabular-nums">{phoneDisplay}</span>
          </a>
        ) : null}
        {resource.email ? (
          <a
            href={`mailto:${resource.email}`}
            onClick={stop}
            className="inline-flex items-center gap-2 truncate text-foreground/90 transition-colors hover:text-primary focus-visible:outline-none focus-visible:underline"
          >
            <Mail className="size-3.5 shrink-0 text-primary/80" aria-hidden />
            <span className="truncate">{resource.email}</span>
          </a>
        ) : null}
        {resource.website ? (
          <a
            href={resource.website}
            target="_blank"
            rel="noopener noreferrer"
            onClick={stop}
            className="inline-flex items-center gap-2 truncate text-foreground/90 transition-colors hover:text-primary focus-visible:outline-none focus-visible:underline"
          >
            <Globe className="size-3.5 shrink-0 text-primary/80" aria-hidden />
            <span className="truncate">
              {decodeUrlForDisplay(resource.website)
                .replace(/^https?:\/\//, "")
                .replace(/\/$/, "")}
            </span>
            <span
              className="ml-auto flex items-center gap-1"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
            >
              <LinkStatusDot resourceId={resource.id} />
              <ExternalLink className="size-3 shrink-0 opacity-60" aria-hidden />
            </span>
          </a>
        ) : null}
        {resource.address ? (
          <span className="inline-flex items-center gap-2 text-foreground/70">
            <MapPin className="size-3.5 shrink-0 text-primary/70" aria-hidden />
            <span className="truncate">{resource.address}</span>
          </span>
        ) : null}
        {!hasContact ? (
          <span className="inline-flex items-center gap-2 text-muted-foreground/70">
            <Inbox className="size-3.5 shrink-0 text-muted-foreground/60" aria-hidden />
            <span className="italic">No direct contact on file — open for full details</span>
          </span>
        ) : null}
      </div>

      {Tags}
    </motion.article>
  );
}
