"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Menu,
  Shield,
  BookmarkCheck,
  StickyNote,
  Clock,
  LayoutDashboard,
  FolderOpen,
  Flame,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import { LegalModal, type LegalKind } from "./legal-modals";
import { BndrLogo } from "./bndr-logo";
import { ThemeToggle } from "./theme-toggle";
import { SiteSwitcher } from "@/components/shared/site-switcher";

interface SiteHeaderProps {
  onJump: (id: string) => void;
  savedCount?: number;
  onOpenSaved?: () => void;
  annotatedCount?: number;
  recentlyViewedCount?: number;
  onOpenRecent?: () => void;
  followUpCount?: number;
  onOpenAdvocateDashboard?: () => void;
  collectionsCount?: number;
  onOpenCollections?: () => void;
  /** Contact streak (consecutive weeks with ≥1 contact). 0 = no streak. */
  streak?: number;
  /** Weekly goal progress (0–100). Used for the compact progress ring. */
  goalProgress?: number;
  /** Whether the weekly goal has been met. */
  goalMet?: boolean;
  /** Retained API input; resource totals remain available elsewhere in the directory. */
  totalResources?: number;
}

const NAV = [
  { label: "Resources", kind: "section", target: "resources" },
  { label: "Categories", kind: "section", target: "categories" },
  { label: "About", kind: "legal", target: "about" as LegalKind },
  { label: "Privacy", kind: "legal", target: "privacy" as LegalKind },
  { label: "Terms", kind: "legal", target: "terms" as LegalKind },
];

function WordmarkLogo({ onClick }: { onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex shrink-0 items-center gap-2 rounded-md text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/55"
      aria-label="BNDR Resource Site — back to top"
    >
      <BndrLogo size={46} />
      <span className="hidden whitespace-nowrap text-base font-semibold tracking-tight sm:inline">
        Resource Site
      </span>
    </button>
  );
}

function AdminLink() {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      asChild
      className="hover:border-primary/40 hover:text-primary"
    >
      <Link href="/admin">
        <Shield className="size-4" aria-hidden />
        Admin
      </Link>
    </Button>
  );
}

export function SiteHeader({
  onJump,
  savedCount = 0,
  onOpenSaved,
  annotatedCount = 0,
  recentlyViewedCount = 0,
  onOpenRecent,
  followUpCount = 0,
  onOpenAdvocateDashboard,
  collectionsCount = 0,
  onOpenCollections,
  streak = 0,
  goalProgress = 0,
  goalMet = false,
}: SiteHeaderProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [legal, setLegal] = useState<LegalKind | null>(null);

  const handleNav = (item: (typeof NAV)[number]) => {
    setMobileOpen(false);
    if (item.kind === "section") {
      onJump(item.target);
    } else {
      setLegal(item.target as LegalKind);
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="bndr-gradient-line absolute inset-x-0 bottom-0 h-px" />
      <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center">
          <WordmarkLogo onClick={() => onJump("top")} />
        </div>

        {/* Desktop primary navigation and global controls. */}
        <nav aria-label="Primary" className="hidden items-center gap-1 lg:flex">
          {NAV.map((item) => (
            <Button
              key={item.label}
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleNav(item)}
              className="text-muted-foreground hover:bg-transparent hover:text-primary"
            >
              {item.label}
            </Button>
          ))}
          <div className="mx-1 h-5 w-px bg-border" aria-hidden />
          {recentlyViewedCount > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => (onOpenRecent ? onOpenRecent() : onJump("resources"))}
              className="gap-1.5 text-muted-foreground hover:bg-transparent hover:text-primary"
              aria-label={`Recently viewed (${recentlyViewedCount})`}
              title={`${recentlyViewedCount} recently viewed resources`}
            >
              <Clock className="size-4" aria-hidden />
              <span className="hidden xl:inline">Recent</span>
              <span className="rounded-full bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium tabular-nums">
                {recentlyViewedCount}
              </span>
            </Button>
          ) : null}
          {onOpenSaved ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onOpenSaved}
              className="relative gap-1.5 hover:border-primary/40 hover:text-primary"
              aria-label={`Saved resources (${savedCount})`}
            >
              <BookmarkCheck className="size-4" aria-hidden />
              Saved
              {savedCount > 0 ? (
                <span className="ml-0.5 rounded-full bg-primary/20 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                  {savedCount}
                </span>
              ) : null}
              {annotatedCount > 0 ? (
                <span
                  className="ml-0.5 inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium text-primary/70"
                  title={`${annotatedCount} with notes or ratings`}
                  aria-label={`${annotatedCount} resources have notes or ratings`}
                >
                  <StickyNote className="size-2.5" aria-hidden />
                  {annotatedCount}
                </span>
              ) : null}
            </Button>
          ) : null}
          {onOpenCollections ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onOpenCollections}
              className="relative gap-1.5 text-muted-foreground hover:bg-transparent hover:text-primary"
              aria-label={`Collections (${collectionsCount})`}
              title="Named groups of saved resources"
            >
              <FolderOpen className="size-4" aria-hidden />
              <span className="hidden 2xl:inline">Collections</span>
              {collectionsCount > 0 ? (
                <span className="ml-0.5 rounded-full bg-primary/20 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                  {collectionsCount}
                </span>
              ) : null}
            </Button>
          ) : null}
          {onOpenAdvocateDashboard ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onOpenAdvocateDashboard}
              className="relative gap-1.5 text-muted-foreground hover:bg-transparent hover:text-primary"
              aria-label={`Advocate dashboard${followUpCount > 0 ? ` — ${followUpCount} follow-up needed` : ""}${streak > 0 ? ` — ${streak}-week streak` : ""}${goalMet ? " — goal met" : goalProgress > 0 ? ` — goal ${goalProgress}%` : ""}`}
              title={
                [
                  followUpCount > 0
                    ? `${followUpCount} resource${followUpCount === 1 ? "" : "s"} need follow-up`
                    : null,
                  streak > 0 ? `${streak}-week contact streak` : null,
                  goalProgress > 0 ? `Weekly goal: ${goalProgress}%` : null,
                ].filter(Boolean).join(" · ") || "Your personal outreach overview"
              }
            >
              <LayoutDashboard className="size-4" aria-hidden />
              <span className="hidden 2xl:inline">Dashboard</span>
              {streak >= 2 ? (
                <span
                  className="bndr-flame-glow ml-0.5 inline-flex items-center gap-0.5 rounded-full bg-orange-500/15 px-1.5 py-0.5 text-[10px] font-medium text-orange-600 dark:text-orange-400"
                  title={`${streak}-week contact streak — keep it going!`}
                  aria-label={`${streak} week streak`}
                >
                  <Flame className="size-2.5" aria-hidden />
                  {streak}
                </span>
              ) : null}
              {goalProgress > 0 && !goalMet ? (
                <span
                  className="relative ml-0.5 inline-flex size-4 items-center justify-center"
                  title={`Weekly goal: ${goalProgress}%`}
                  aria-label={`Goal ${goalProgress}% complete`}
                >
                  <svg viewBox="0 0 20 20" className="size-4 -rotate-90" aria-hidden>
                    <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-muted/40" />
                    <circle
                      cx="10"
                      cy="10"
                      r="8"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      className={cn(goalProgress >= 80 ? "text-primary" : "text-primary/70")}
                      strokeDasharray={`${2 * Math.PI * 8}`}
                      strokeDashoffset={`${2 * Math.PI * 8 * (1 - goalProgress / 100)}`}
                    />
                  </svg>
                </span>
              ) : null}
              {goalMet ? (
                <span
                  className="ml-0.5 inline-flex items-center rounded-full bg-emerald-500/15 px-1 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400"
                  title="Weekly goal achieved!"
                  aria-label="Goal met"
                >
                  <CheckCircle2 className="size-3" aria-hidden />
                </span>
              ) : null}
              {followUpCount > 0 ? (
                <span
                  className="ml-0.5 inline-flex items-center gap-0.5 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400"
                  title={`${followUpCount} resource${followUpCount === 1 ? "" : "s"} need follow-up`}
                  aria-label={`${followUpCount} follow-up needed`}
                >
                  {followUpCount}
                </span>
              ) : null}
            </Button>
          ) : null}
          <SiteSwitcher compact />
          <AdminLink />
          <ThemeToggle />
        </nav>

        {/* Mobile/tablet controls preserve the same identity → switcher → utility order. */}
        <div className="flex shrink-0 items-center gap-1.5 lg:hidden">
          {onOpenSaved ? (
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={onOpenSaved}
              className="relative hidden hover:border-primary/40 hover:text-primary min-[400px]:inline-flex"
              aria-label={`Saved resources (${savedCount})`}
            >
              <BookmarkCheck className="size-4" aria-hidden />
              {savedCount > 0 ? (
                <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                  {savedCount > 9 ? "9+" : savedCount}
                </span>
              ) : null}
            </Button>
          ) : null}
          <SiteSwitcher compact />
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                aria-label="Open menu"
                className="hover:border-primary/40"
              >
                <Menu className="size-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 bg-background/95">
              <SheetHeader>
                <SheetTitle asChild>
                  <div className="flex items-center gap-2 pt-2">
                    <BndrLogo size={46} />
                    <span className="whitespace-nowrap text-base font-semibold tracking-tight">Resource Site</span>
                  </div>
                </SheetTitle>
              </SheetHeader>
              <nav aria-label="Mobile primary" className="flex flex-col gap-1 px-4">
                {NAV.map((item) => (
                  <SheetClose asChild key={item.label}>
                    <Button
                      variant="ghost"
                      className="justify-start text-base text-muted-foreground hover:text-primary"
                      onClick={() => handleNav(item)}
                    >
                      {item.label}
                    </Button>
                  </SheetClose>
                ))}
                {onOpenSaved ? (
                  <SheetClose asChild>
                    <Button
                      variant="ghost"
                      className="justify-start text-base text-muted-foreground hover:text-primary"
                      onClick={onOpenSaved}
                    >
                      <BookmarkCheck className="size-4" aria-hidden />
                      Saved resources
                      {savedCount > 0 ? (
                        <span className="ml-auto rounded-full bg-primary/20 px-2 py-0.5 text-xs font-medium text-primary">
                          {savedCount}
                        </span>
                      ) : null}
                    </Button>
                  </SheetClose>
                ) : null}
                {onOpenCollections ? (
                  <SheetClose asChild>
                    <Button
                      variant="ghost"
                      className="justify-start text-base text-muted-foreground hover:text-primary"
                      onClick={onOpenCollections}
                    >
                      <FolderOpen className="size-4" aria-hidden />
                      Collections
                      {collectionsCount > 0 ? (
                        <span className="ml-auto rounded-full bg-primary/20 px-2 py-0.5 text-xs font-medium text-primary">
                          {collectionsCount}
                        </span>
                      ) : null}
                    </Button>
                  </SheetClose>
                ) : null}
                {onOpenAdvocateDashboard ? (
                  <SheetClose asChild>
                    <Button
                      variant="ghost"
                      className="justify-start text-base text-muted-foreground hover:text-primary"
                      onClick={onOpenAdvocateDashboard}
                    >
                      <LayoutDashboard className="size-4" aria-hidden />
                      Dashboard
                      <span className="ml-auto flex items-center gap-1.5">
                        {streak >= 2 ? (
                          <span
                            className="inline-flex items-center gap-0.5 rounded-full bg-orange-500/15 px-1.5 py-0.5 text-[10px] font-medium text-orange-600 dark:text-orange-400"
                            title={`${streak}-week contact streak`}
                          >
                            <Flame className="size-2.5" aria-hidden />
                            {streak}
                          </span>
                        ) : null}
                        {goalMet ? (
                          <span
                            className="inline-flex items-center rounded-full bg-emerald-500/15 px-1 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400"
                            title="Weekly goal achieved!"
                          >
                            <CheckCircle2 className="size-3" aria-hidden />
                          </span>
                        ) : null}
                        {followUpCount > 0 ? (
                          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                            {followUpCount}
                          </span>
                        ) : null}
                      </span>
                    </Button>
                  </SheetClose>
                ) : null}
                <div className="my-2 h-px bg-border/70" aria-hidden="true" />
                <div className="flex items-center justify-end gap-2 px-1">
                  <AdminLink />
                  <ThemeToggle />
                </div>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      <LegalModal
        kind={(legal ?? "about") as LegalKind}
        open={legal !== null}
        onOpenChange={(o) => !o && setLegal(null)}
      />
    </header>
  );
}
