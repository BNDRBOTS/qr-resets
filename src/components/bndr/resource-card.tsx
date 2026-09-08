"use client";

import { motion } from "framer-motion";
import {
  Phone,
  Mail,
  Globe,
  MapPin,
  ExternalLink,
  Bookmark,
  BookmarkCheck,
  ArrowLeftRight,
  Check,
  StickyNote,
  Star,
  AlertCircle,
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
  followUpNeeded?: boolean;
  contactLogCount?: number;
  defaultContactMethod?: ContactMethod;
}

const CATEGORY_NAME: Record<CategorySlug, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.slug, c.shortName]),
) as Record<CategorySlug, string>;

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

function ActionButton({
  label,
  active = false,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  children: React.ReactNode;
}) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onClick}
            aria-label={label}
            aria-pressed={active || undefined}
            className={
              "flex size-8 items-center justify-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 " +
              (active
                ? "border-primary/35 bg-primary/15 text-primary"
                : "border-transparent text-foreground/75 hover:border-primary/25 hover:bg-primary/10 hover:text-primary")
            }
          >
            {children}
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

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
  followUpNeeded = false,
  contactLogCount = 0,
  defaultContactMethod,
}: ResourceCardProps) {
  const phone = firstPhone(resource.phoneNormalized);
  const phoneDisplay = formatPhoneDisplay(phone);
  const catName = CATEGORY_NAME[resource.category] ?? resource.category;
  const hasContact = Boolean(phoneDisplay || resource.email || resource.website || resource.address);
  const stop = (e: React.MouseEvent) => e.stopPropagation();
  const MethodIcon = defaultContactMethod ? DEFAULT_METHOD_ICONS[defaultContactMethod] : null;

  const share = (event: React.MouseEvent<HTMLButtonElement>) => {
    stop(event);
    const text = `${resource.name}\n${resource.description ?? ""}\n${phoneDisplay ? "Phone: " + phoneDisplay : ""}\n${resource.email ? "Email: " + resource.email : ""}\n${resource.website ? "Web: " + resource.website : ""}\n\nVia ResourceCite by BNDR LLC`;
    if (navigator.share) {
      navigator.share({ title: resource.name, text }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text).then(
        () => toast.success("Resource details copied to clipboard"),
        () => toast.error("Could not copy to clipboard"),
      );
    }
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.45, delay: Math.min(index * 0.04, 0.32) }}
      onClick={() => onOpen(resource)}
      className="bndr-card bndr-public-card group relative flex min-h-[310px] cursor-pointer flex-col rounded-2xl p-4 sm:p-5 lg:p-6"
    >
      {/* Stable header: identity on the left, primary actions on the right. */}
      <div className="flex min-h-9 items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          <Badge variant="outline" className="bndr-card-category border-primary/25 bg-primary/8 text-[10px] font-semibold text-foreground/85">
            {catName}
          </Badge>
          {resource.acronym ? (
            <Badge variant="secondary" className="bndr-card-acronym bg-secondary/30 font-mono text-[10px] uppercase tracking-wide text-foreground/85">
              {resource.acronym}
            </Badge>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-0.5" aria-label="Resource actions">
          {onToggleCompare ? (
            <ActionButton
              label={isComparing ? "Remove from comparison" : "Add to compare"}
              active={isComparing}
              onClick={(event) => {
                stop(event);
                onToggleCompare(resource);
              }}
            >
              {isComparing ? <Check className="size-3.5" aria-hidden /> : <ArrowLeftRight className="size-3.5" aria-hidden />}
            </ActionButton>
          ) : null}
          {onToggleSave ? (
            <ActionButton
              label={isSaved ? "Remove from saved" : "Save resource"}
              active={isSaved}
              onClick={(event) => {
                stop(event);
                onToggleSave(resource);
              }}
            >
              {isSaved ? <BookmarkCheck className="size-3.5" aria-hidden /> : <Bookmark className="size-3.5" aria-hidden />}
            </ActionButton>
          ) : null}
          <ActionButton label="Share resource" onClick={share}>
            <Share2 className="size-3.5" aria-hidden />
          </ActionButton>
        </div>
      </div>

      <h3 className="bndr-card-title mt-3 text-lg font-semibold leading-snug">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onOpen(resource);
          }}
          className="rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
        >
          <Highlight text={resource.name} query={query} />
        </button>
      </h3>

      {resource.description ? (
        <p className="bndr-card-copy mt-2 bndr-line-clamp-4 text-sm leading-relaxed">
          <Highlight text={resource.description} query={query} />
        </p>
      ) : null}

      {hasContact ? (
        <div className="bndr-card-contact mt-auto flex flex-col gap-1.5 border-t border-white/10 pt-3 text-sm">
          {phoneDisplay ? (
            <a href={`tel:${phone}`} onClick={stop} className="inline-flex items-center gap-2 transition-colors hover:text-primary focus-visible:underline">
              <Phone className="bndr-contact-icon size-3.5" aria-hidden />
              <span className="font-mono tabular-nums">{phoneDisplay}</span>
            </a>
          ) : null}
          {resource.email ? (
            <a href={`mailto:${resource.email}`} onClick={stop} className="inline-flex items-center gap-2 truncate transition-colors hover:text-primary focus-visible:underline">
              <Mail className="bndr-contact-icon size-3.5 shrink-0" aria-hidden />
              <span className="truncate">{resource.email}</span>
            </a>
          ) : null}
          {resource.website ? (
            <a href={resource.website} target="_blank" rel="noopener noreferrer" onClick={stop} className="inline-flex items-center gap-2 truncate transition-colors hover:text-primary focus-visible:underline">
              <Globe className="bndr-contact-icon size-3.5 shrink-0" aria-hidden />
              <span className="truncate">
                {decodeUrlForDisplay(resource.website).replace(/^https?:\/\//, "").replace(/\/$/, "")}
              </span>
              <span
                className="ml-auto flex items-center gap-1"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
              >
                <LinkStatusDot resourceId={resource.id} />
                <ExternalLink className="size-3 shrink-0 opacity-70" aria-hidden />
              </span>
            </a>
          ) : null}
          {resource.address ? (
            <span className="inline-flex items-start gap-2">
              <MapPin className="bndr-contact-icon mt-0.5 size-3.5 shrink-0" aria-hidden />
              <span>{resource.address}</span>
            </span>
          ) : null}
        </div>
      ) : null}

      {/* Private user-state indicators are separated from public resource facts. */}
      {followUpNeeded || contactLogCount > 0 || defaultContactMethod || rating > 0 || hasNote ? (
        <div className="mt-3 flex min-h-7 flex-wrap items-center gap-2 border-t border-white/10 pt-3 text-[10px] text-foreground/75">
          {followUpNeeded ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-1">
              <AlertCircle className="size-3" aria-hidden /> Follow-up
            </span>
          ) : null}
          {contactLogCount > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/10 px-2 py-1">
              <History className="size-3" aria-hidden /> {contactLogCount}
            </span>
          ) : null}
          {MethodIcon && defaultContactMethod ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/10 px-2 py-1" title={`Default contact method: ${DEFAULT_METHOD_LABELS[defaultContactMethod]}`}>
              <MethodIcon className="size-3" aria-hidden /> {DEFAULT_METHOD_LABELS[defaultContactMethod]}
            </span>
          ) : null}
          {rating > 0 ? (
            <span className="ml-auto inline-flex items-center gap-1" aria-label={`Your rating: ${rating} of 5`}>
              <Star className="size-3 fill-current text-primary" aria-hidden /> {rating}/5
            </span>
          ) : null}
          {hasNote ? <StickyNote className="size-3.5 text-primary" aria-label="Has a private note" /> : null}
        </div>
      ) : null}
    </motion.article>
  );
}
