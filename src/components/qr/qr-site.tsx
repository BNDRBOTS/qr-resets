"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Check,
  Clock3,
  ExternalLink,
  HandHeart,
  Share2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Logo } from "@/components/shared/logo";
import { MissionConnection } from "@/components/shared/mission-connection";
import { Section } from "./qr-section";
import { QrNav } from "./qr-nav";
import { QrScrollProgress } from "./qr-scroll-progress";
import { QrTableOfContents } from "./qr-table-of-contents";
import { QrHeroParticles } from "./qr-hero-particles";
import { cn } from "@/lib/utils";
import {
  QR_BASIC_IDEA,
  QR_BRAND,
  QR_CONSENT_PROMISE,
  QR_DEFINITIONS,
  QR_EVIDENCE,
  QR_FAQ,
  QR_FOOTER,
  QR_GIVE,
  QR_HERO,
  QR_HOW_IT_WORKS,
  QR_IS_NOT,
  QR_LEVELS,
  QR_LOOSE_RULES,
  QR_PERSON_DIRECTED,
  QR_PROBLEM,
  QR_REQUEST,
  QR_RISK_DOCTRINE,
  QR_RULES_PAGE,
  QR_TRANSPARENCY,
  QR_WHAT_IS_RESET,
  QR_WHO_FOR,
} from "@/lib/qr-resets-content";

/* -------------------------------------------------------------------------- */
/*  Local types for union-typed content arrays                                 */
/* -------------------------------------------------------------------------- */

type HowStep = {
  n: number;
  title: string;
  body: string;
  list?: string[];
  note?: string;
};

type FaqItem = {
  q: string;
  a: string;
  list?: string[];
  closing?: string;
};

type RequestField = {
  label: string;
  help: string;
  type: "text" | "textarea" | "choice";
  options?: string[];
};

type EvidenceSection = {
  title: string;
  value: string;
  details: string[];
  source?: string | null;
  note?: string;
};

type ModeledSection = {
  title: string;
  value: string;
  details: string[];
};

/* -------------------------------------------------------------------------- */
/*  Shared presentational helpers                                             */
/* -------------------------------------------------------------------------- */

/** Splits a string on `\n\n` into stacked paragraphs. */
function Paragraphs({
  text,
  className,
  lead = false,
}: {
  text: string;
  className?: string;
  lead?: boolean;
}) {
  const paras = text.split("\n\n");
  return (
    <div className={cn("space-y-4", className)}>
      {paras.map((p, i) => (
        <p
          key={i}
          className={cn(
            "leading-relaxed",
            lead ? "text-base sm:text-lg text-foreground/90" : "text-muted-foreground",
          )}
        >
          {p}
        </p>
      ))}
    </div>
  );
}

/** Large cool-blue-glow number — the signature BNDR data treatment. */
function BigNumber({
  value,
  label,
  className,
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  return (
    <div className={cn("text-center", className)}>
      <div
        className="bndr-wordmark font-extrabold leading-none"
        style={{ fontSize: "clamp(2.5rem, 8vw, 5.5rem)" }}
      >
        {value}
      </div>
      {label && (
        <p className="mt-4 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </p>
      )}
    </div>
  );
}

/** Lightweight readable pill — used for short list items. */
function Pill({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <li
      className={cn(
        "rounded-lg border border-border/60 bg-card/40 p-3 text-sm leading-relaxed text-foreground/90",
        "transition-colors hover:border-primary/40 hover:bg-card/60",
        className,
      )}
    >
      {children}
    </li>
  );
}

/** Pill grid — responsive 1/2/3 columns. */
function PillGrid({
  items,
  columns = 2,
  className,
}: {
  items: readonly string[];
  columns?: 1 | 2 | 3;
  className?: string;
}) {
  const cols =
    columns === 1
      ? "sm:grid-cols-1"
      : columns === 3
        ? "sm:grid-cols-2 lg:grid-cols-3"
        : "sm:grid-cols-2";
  return (
    <ul className={cn("grid grid-cols-1 gap-2.5", cols, className)}>
      {items.map((item, i) => (
        <Pill key={i}>{item}</Pill>
      ))}
    </ul>
  );
}

/** Emphasized closing line — cool-blue-tinted callout. */
function Callout({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "bndr-card-priority bndr-card rounded-xl p-5 text-base font-medium leading-relaxed text-foreground sm:text-lg",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Smooth-scroll helper for CTA buttons. */
function scrollToId(id: string) {
  if (typeof document === "undefined") return;
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

/* -------------------------------------------------------------------------- */
/*  1. HERO                                                                    */
/* -------------------------------------------------------------------------- */

function QrHero() {
  const [points1, ...pointsRest] = QR_HERO.points;
  return (
    <section
      id="top"
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-20 text-center sm:px-6 lg:px-8"
    >
      {/* Cool-blue circular halo behind the logo */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-[38%] -z-0 h-[70vmin] w-[70vmin] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle_at_center,oklch(0.58_0.14_235/0.18),transparent_70%)] blur-3xl"
      />

      {/* Ambient floating particles */}
      <QrHeroParticles />

      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9, filter: "blur(8px)" }}
        animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
        className="relative"
      >
        <Logo size={128} priority className="drop-shadow-[0_0_28px_oklch(0.62_0.19_18/0.55)]" />
      </motion.div>

      {/* Brand label */}
      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.45 }}
        className="relative mt-6 text-[11px] font-medium uppercase tracking-[0.32em] text-primary/90"
      >
        {QR_BRAND.name}
      </motion.p>

      {/* Headline */}
      <motion.h1
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.6 }}
        className="bndr-wordmark relative mt-4 font-extrabold leading-[1.05]"
        style={{ fontSize: "clamp(2.25rem, 6.5vw, 4.75rem)" }}
      >
        {QR_HERO.headline}
      </motion.h1>

      {/* Subhead */}
      <motion.p
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.8 }}
        className="relative mt-6 max-w-2xl text-balance text-base text-muted-foreground sm:text-lg"
      >
        {QR_HERO.subhead}
      </motion.p>

      {/* Points */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.95 }}
        className="relative mt-10 w-full max-w-2xl space-y-3"
      >
        <div className="bndr-card rounded-xl border border-border/60 bg-card/40 p-4 text-sm leading-relaxed text-foreground/90">
          {points1}
        </div>
        <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          {pointsRest.map((p, i) => (
            <Pill key={i} className="text-center text-xs uppercase tracking-wide text-primary/90">
              {p}
            </Pill>
          ))}
        </ul>
      </motion.div>

      {/* Promise */}
      <motion.p
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 1.1 }}
        className="relative mt-8 max-w-xl text-balance text-lg font-semibold text-foreground sm:text-xl"
      >
        {QR_HERO.promise}
      </motion.p>

      {/* CTAs */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 1.25 }}
        className="relative mt-9 flex flex-col items-center gap-3 sm:flex-row"
      >
        <Button
          type="button"
          size="lg"
          onClick={() => scrollToId("give")}
          className="w-full animate-[bndr-pulse-soft_3s_ease-in-out_infinite] px-7 sm:w-auto"
        >
          <HandHeart className="size-4" />
          {QR_HERO.primaryCta}
        </Button>
        <Button
          type="button"
          size="lg"
          variant="outline"
          onClick={() => scrollToId("request")}
          className="w-full px-7 sm:w-auto"
        >
          {QR_HERO.secondaryCta}
          <ArrowRight className="size-4" />
        </Button>
      </motion.div>

      {/* Disclaimer */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.7, delay: 1.45 }}
        className="relative mt-8 max-w-md text-xs text-muted-foreground/80"
      >
        {QR_HERO.disclaimer}
      </motion.p>

      {/* Reading time estimate — source-faithful content is substantial */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.7, delay: 1.55 }}
        className="relative mt-4 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-primary/70"
      >
        <Clock3 className="size-3.5" aria-hidden />
        ~8 min read · 8 sections
      </motion.p>

      {/* Scroll cue */}
      <motion.button
        type="button"
        onClick={() => scrollToId("how-it-works")}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.7, delay: 1.7 }}
        aria-label="Scroll to how it works"
        className="absolute bottom-6 left-1/2 -translate-x-1/2 text-muted-foreground/60 transition-colors hover:text-primary"
      >
        <ArrowDown className="size-5 animate-bounce" />
      </motion.button>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  2. BASIC IDEA                                                              */
/* -------------------------------------------------------------------------- */

function QrBasicIdea() {
  return (
    <Section eyebrow="The basic idea" heading={QR_BASIC_IDEA.heading}>
      <div className="space-y-8">
        <p className="text-base leading-relaxed text-muted-foreground sm:text-lg">
          {QR_BASIC_IDEA.body}
        </p>
        <p className="text-base leading-relaxed text-foreground/90">
          {QR_BASIC_IDEA.bridge}
        </p>

        <div className="bndr-card-priority bndr-card rounded-2xl p-8 sm:p-12">
          <BigNumber value={QR_BASIC_IDEA.bigNumber} label="Potential annual fund" />
        </div>

        <Paragraphs text={QR_BASIC_IDEA.explanation} lead />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="bndr-card rounded-xl border border-border/60 bg-card/40 p-5 text-center text-sm text-muted-foreground">
            {QR_BASIC_IDEA.small1}
          </div>
          <div className="bndr-card rounded-xl border border-primary/40 bg-primary/5 p-5 text-center text-base font-semibold text-foreground">
            {QR_BASIC_IDEA.small2}
          </div>
        </div>

        <div className="text-center">
          <Button type="button" size="lg" onClick={() => scrollToId("give")}>
            {QR_BASIC_IDEA.cta}
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </div>
    </Section>
  );
}

/* -------------------------------------------------------------------------- */
/*  3. PROBLEM                                                                 */
/* -------------------------------------------------------------------------- */

function QrProblem() {
  return (
    <Section eyebrow="The problem" heading={QR_PROBLEM.heading} tinted>
      <div className="space-y-8">
        <p className="text-base leading-relaxed text-foreground/90">
          {QR_PROBLEM.intro}
        </p>

        <PillGrid items={QR_PROBLEM.lacks} columns={3} />

        <Paragraphs text={QR_PROBLEM.problem} />

        <Callout>{QR_PROBLEM.conclusion}</Callout>
      </div>
    </Section>
  );
}

/* -------------------------------------------------------------------------- */
/*  4. WHAT IS A RESET                                                         */
/* -------------------------------------------------------------------------- */

function QrWhatIsReset() {
  return (
    <Section eyebrow="What a Reset is" heading={QR_WHAT_IS_RESET.heading}>
      <div className="space-y-8">
        <p className="text-base leading-relaxed text-foreground/90">
          {QR_WHAT_IS_RESET.intro}
        </p>

        <div>
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.16em] text-primary/90">
            {QR_WHAT_IS_RESET.paysForTitle}
          </h3>
          <PillGrid items={QR_WHAT_IS_RESET.paysFor} columns={3} />
        </div>

        <Paragraphs text={QR_WHAT_IS_RESET.closing} lead />
      </div>
    </Section>
  );
}

/* -------------------------------------------------------------------------- */
/*  5. IS NOT                                                                  */
/* -------------------------------------------------------------------------- */

function QrIsNot() {
  return (
    <Section eyebrow="What we are not" heading={QR_IS_NOT.heading} tinted>
      <div className="space-y-8">
        <p className="text-base leading-relaxed text-foreground/90">{QR_IS_NOT.intro}</p>

        <PillGrid items={QR_IS_NOT.notList} columns={3} />

        <div>
          <h3 className="mb-5 text-center text-sm font-semibold uppercase tracking-[0.16em] text-primary/90">
            {QR_IS_NOT.fillsTitle}
          </h3>
          <div className="mx-auto grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="bndr-card rounded-xl border border-border/60 bg-card/40 p-6 text-center text-base italic leading-relaxed text-muted-foreground">
              {QR_IS_NOT.between1}
            </div>
            <div className="bndr-card rounded-xl border border-border/60 bg-card/40 p-6 text-center text-base italic leading-relaxed text-muted-foreground">
              {QR_IS_NOT.between2}
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}

/* -------------------------------------------------------------------------- */
/*  6. WHO FOR                                                                 */
/* -------------------------------------------------------------------------- */

function QrWhoFor() {
  return (
    <Section eyebrow="Who it's for" heading="Who QR Resets is for">
      <div className="space-y-8">
        <p className="text-base leading-relaxed text-foreground/90">{QR_WHO_FOR.intro}</p>

        <div>
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.16em] text-primary/90">
            {QR_WHO_FOR.mayBeTitle}
          </h3>
          <PillGrid items={QR_WHO_FOR.mayBe} columns={3} />
        </div>

        <Paragraphs text={QR_WHO_FOR.diagnosisNote} />

        <Callout>{QR_WHO_FOR.question}</Callout>
      </div>
    </Section>
  );
}

/* -------------------------------------------------------------------------- */
/*  7. PERSON-DIRECTED                                                         */
/* -------------------------------------------------------------------------- */

function QrPersonDirected() {
  return (
    <Section eyebrow="Person-directed" heading={QR_PERSON_DIRECTED.heading} tinted>
      <div className="space-y-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="bndr-card rounded-xl border border-border/60 bg-card/40 p-6">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.16em] text-primary/90">
              {QR_PERSON_DIRECTED.everyResetTitle}
            </h3>
            <ul className="space-y-2.5">
              {QR_PERSON_DIRECTED.everyReset.map((item, i) => (
                <Pill key={i}>{item}</Pill>
              ))}
            </ul>
          </div>
          <div className="bndr-card rounded-xl border border-primary/40 bg-primary/5 p-6">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.16em] text-primary/90">
              {QR_PERSON_DIRECTED.personDecidesTitle}
            </h3>
            <ul className="space-y-2.5">
              {QR_PERSON_DIRECTED.personDecides.map((item, i) => (
                <Pill key={i}>{item}</Pill>
              ))}
            </ul>
          </div>
        </div>

        <Callout>{QR_PERSON_DIRECTED.closing}</Callout>
      </div>
    </Section>
  );
}

/* -------------------------------------------------------------------------- */
/*  8. CONSENT PROMISE                                                         */
/* -------------------------------------------------------------------------- */

function QrConsentPromise() {
  return (
    <Section eyebrow="Consent" heading={QR_CONSENT_PROMISE.heading}>
      <div className="space-y-8">
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {QR_CONSENT_PROMISE.willNot.map((item, i) => (
            <div
              key={i}
              className="flex items-start gap-3 rounded-lg border border-border/60 bg-card/40 p-3.5 text-sm leading-relaxed text-foreground/90"
            >
              <span
                aria-hidden="true"
                className="mt-0.5 shrink-0 text-xs font-bold text-primary"
              >
                ✕
              </span>
              <span>{item}</span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Callout>{QR_CONSENT_PROMISE.closing}</Callout>
          <Callout>{QR_CONSENT_PROMISE.closing2}</Callout>
        </div>
      </div>
    </Section>
  );
}

/* -------------------------------------------------------------------------- */
/*  9. LOOSE RULES                                                             */
/* -------------------------------------------------------------------------- */

function QrLooseRules() {
  return (
    <Section eyebrow="Loose rules" heading={QR_LOOSE_RULES.heading} tinted>
      <div className="space-y-8">
        <p className="text-base leading-relaxed text-foreground/90">
          {QR_LOOSE_RULES.intro}
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {QR_LOOSE_RULES.rules.map((rule) => (
            <div
              key={rule.n}
              className="bndr-card rounded-xl border border-border/60 bg-card/40 p-6"
            >
              <div className="mb-3 flex items-center gap-3">
                <span className="bndr-wordmark-sm flex size-9 items-center justify-center rounded-full border border-primary/40 bg-primary/10 text-base font-extrabold text-foreground">
                  {rule.n}
                </span>
                <h3 className="text-base font-semibold text-foreground">{rule.name}</h3>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">{rule.desc}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Callout>{QR_LOOSE_RULES.closing}</Callout>
          <Callout>{QR_LOOSE_RULES.closing2}</Callout>
        </div>
      </div>
    </Section>
  );
}

/* -------------------------------------------------------------------------- */
/*  10. RISK DOCTRINE                                                          */
/* -------------------------------------------------------------------------- */

function QrRiskDoctrine() {
  return (
    <Section eyebrow="Risk doctrine" heading={QR_RISK_DOCTRINE.heading}>
      <div className="space-y-8">
        <p className="text-base leading-relaxed text-muted-foreground">
          {QR_RISK_DOCTRINE.costOfWrong}
        </p>

        <div>
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.16em] text-primary/90">
            {QR_RISK_DOCTRINE.costOfDenyTitle}
          </h3>
          <PillGrid items={QR_RISK_DOCTRINE.costOfDeny} columns={3} />
        </div>

        <Callout>{QR_RISK_DOCTRINE.operatesOn}</Callout>

        <div>
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.16em] text-primary/90">
            {QR_RISK_DOCTRINE.verifyTitle}
          </h3>
          <PillGrid items={QR_RISK_DOCTRINE.verify} columns={2} />
        </div>

        <p className="text-base font-semibold leading-relaxed text-foreground">
          {QR_RISK_DOCTRINE.noMoral}
        </p>

        <Callout>{QR_RISK_DOCTRINE.closing}</Callout>
      </div>
    </Section>
  );
}

/* -------------------------------------------------------------------------- */
/*  11. HOW IT WORKS — vertical timeline                                       */
/* -------------------------------------------------------------------------- */

function QrHowItWorks() {
  const steps = QR_HOW_IT_WORKS.steps as readonly HowStep[];
  return (
    <Section id="how-it-works" eyebrow="Process" heading={QR_HOW_IT_WORKS.heading} tinted>
      <ol className="relative space-y-8">
        {/* cool-blue connector line — sits behind the step badges */}
        <span
          aria-hidden="true"
          className="absolute left-[19px] top-3 bottom-3 w-px bg-gradient-to-b from-primary/60 via-primary/30 to-transparent sm:left-[23px]"
        />
        {steps.map((step) => (
          <li key={step.n} className="relative pl-14 sm:pl-20">
            {/* Number badge */}
            <span
              className="bndr-card-priority bndr-card absolute left-0 top-0 flex size-10 items-center justify-center rounded-full border border-primary/50 text-base font-extrabold text-foreground sm:size-12 sm:text-lg"
            >
              {step.n}
            </span>

            <div className="bndr-card rounded-xl border border-border/60 bg-card/40 p-6 sm:p-8">
              <h3 className="mb-3 text-lg font-semibold text-foreground sm:text-xl">{step.title}</h3>
              <Paragraphs text={step.body} />

              {step.list && (
                <ul className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {step.list.map((item, i) => (
                    <Pill key={i}>{item}</Pill>
                  ))}
                </ul>
              )}

              {step.note && (
                <div className="mt-5 rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm italic leading-relaxed text-foreground/90">
                  {step.note}
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>
    </Section>
  );
}

/* -------------------------------------------------------------------------- */
/*  12. REQUEST A RESET — interactive form                                     */
/* -------------------------------------------------------------------------- */

function ChoiceField({
  options,
  value,
  onChange,
  label,
}: {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  return (
    <div className="flex flex-wrap gap-2 pt-1" role="radiogroup" aria-label={label}>
      {options.map((opt) => {
        const active = value === opt;
        return (
          <button
            key={opt}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt)}
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm transition-all",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
              active
                ? "border-primary bg-primary/15 text-foreground shadow-[0_0_18px_-6px_oklch(0.62_0.19_18/0.4)]"
                : "border-border/60 text-muted-foreground hover:border-primary/50 hover:text-foreground",
            )}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

const REQUEST_KEYS = [
  "displayName",
  "contactMethod",
  "location",
  "situation",
  "urgentProblem",
  "blockers",
  "proposedHelp",
  "unwantedSupport",
  "deadline",
  "alreadyWorking",
  "currentHelp",
  "planPreference",
  "documentsNote",
] as const;

type RequestKey = (typeof REQUEST_KEYS)[number];
type RequestValues = Partial<Record<RequestKey | "contactDetails", string>>;

function QrRequest() {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [values, setValues] = useState<RequestValues>({});
  const [requiredChecked, setRequiredChecked] = useState<boolean[]>(() =>
    QR_REQUEST.consentRequired.map(() => false),
  );
  const [optionalChecked, setOptionalChecked] = useState<boolean[]>(() =>
    QR_REQUEST.consentOptional.map(() => false),
  );
  const allRequiredChecked = requiredChecked.every(Boolean);

  const fields = QR_REQUEST.fields as readonly RequestField[];
  const setValue = (key: RequestKey | "contactDetails", value: string) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!allRequiredChecked || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/qr/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          consentRequired: requiredChecked,
          consentOptional: optionalChecked,
        }),
      });
      const body = (await res.json()) as { ok?: boolean; requestId?: string; error?: string };
      if (!res.ok || !body.ok) throw new Error(body.error || "Request could not be saved.");
      setRequestId(body.requestId ?? null);
      setSubmitted(true);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Request could not be saved.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <Section id="request" eyebrow="Request a Reset">
        <div className="bndr-card-priority bndr-card mx-auto max-w-2xl rounded-2xl p-8 text-center sm:p-12">
          <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-full border border-primary/50 bg-primary/10">
            <ShieldCheck className="size-7 text-primary" />
          </div>
          <h3 className="text-2xl font-bold text-foreground sm:text-3xl">
            {QR_REQUEST.confirmation.heading}
          </h3>
          <p className="mt-4 text-lg leading-relaxed text-foreground/90">
            {QR_REQUEST.confirmation.body}
          </p>
          <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
            {QR_REQUEST.confirmation.note}
          </p>
          {requestId ? (
            <p className="mt-4 text-xs font-mono text-muted-foreground" aria-label="Request reference">
              Reference: {requestId}
            </p>
          ) : null}
          <Button
            type="button"
            variant="outline"
            className="mt-8"
            onClick={() => {
              setSubmitted(false);
              setRequestId(null);
              setValues({});
              setRequiredChecked(QR_REQUEST.consentRequired.map(() => false));
              setOptionalChecked(QR_REQUEST.consentOptional.map(() => false));
            }}
          >
            Submit another request
          </Button>
        </div>
      </Section>
    );
  }

  return (
    <Section id="request" eyebrow="Request a Reset" heading={QR_REQUEST.heading}>
      <div className="mx-auto max-w-2xl space-y-8">
        <ul className="space-y-2">
          {QR_REQUEST.reassurance.map((r, i) => (
            <li
              key={i}
              className="flex items-start gap-3 rounded-lg border border-border/60 bg-card/40 p-3 text-sm leading-relaxed text-foreground/90"
            >
              <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>{r}</span>
            </li>
          ))}
        </ul>

        <p className="text-base font-medium leading-relaxed text-foreground">
          {QR_REQUEST.prompt}
        </p>

        <form onSubmit={handleSubmit} className="space-y-6" noValidate>
          {fields.map((field, idx) => {
            const fieldId = `qr-field-${idx}`;
            const key = REQUEST_KEYS[idx];
            const value = values[key] ?? "";
            return (
              <div key={idx} className="space-y-2">
                <Label htmlFor={fieldId} className="text-sm font-medium text-foreground">
                  {field.label}
                </Label>
                {field.help && <p className="text-xs leading-relaxed text-muted-foreground">{field.help}</p>}
                {field.type === "text" && (
                  <Input id={fieldId} className="bndr-search" autoComplete="off" value={value} onChange={(e) => setValue(key, e.target.value)} />
                )}
                {field.type === "textarea" && (
                  <Textarea id={fieldId} className="bndr-search min-h-24" value={value} onChange={(e) => setValue(key, e.target.value)} />
                )}
                {field.type === "choice" && field.options && (
                  <ChoiceField options={field.options} value={value} onChange={(v) => setValue(key, v)} label={field.label} />
                )}
                {key === "contactMethod" ? (
                  <Input
                    aria-label="Contact details"
                    placeholder="Phone, email, handle, or another way to reach you"
                    className="bndr-search mt-2"
                    autoComplete="off"
                    value={values.contactDetails ?? ""}
                    onChange={(e) => setValue("contactDetails", e.target.value)}
                  />
                ) : null}
              </div>
            );
          })}

          <div className="space-y-3 rounded-xl border border-border/60 bg-card/30 p-5">
            <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-primary/90">Required consent</h3>
            {QR_REQUEST.consentRequired.map((c, i) => (
              <label key={i} htmlFor={`qr-consent-req-${i}`} className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-foreground/90">
                <Checkbox id={`qr-consent-req-${i}`} checked={requiredChecked[i]} onCheckedChange={(v) => setRequiredChecked((prev) => prev.map((p, j) => (j === i ? v === true : p)))} className="mt-0.5" />
                <span>{c}</span>
              </label>
            ))}
          </div>

          <div className="space-y-3 rounded-xl border border-border/60 bg-card/30 p-5">
            <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Optional</h3>
            {QR_REQUEST.consentOptional.map((c, i) => (
              <label key={i} htmlFor={`qr-consent-opt-${i}`} className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-muted-foreground">
                <Checkbox id={`qr-consent-opt-${i}`} checked={optionalChecked[i]} onCheckedChange={(v) => setOptionalChecked((prev) => prev.map((p, j) => (j === i ? v === true : p)))} className="mt-0.5" />
                <span>{c}</span>
              </label>
            ))}
          </div>

          {submitError ? (
            <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-foreground">
              {submitError}
            </div>
          ) : null}

          <Button type="submit" size="lg" disabled={!allRequiredChecked || submitting} className="w-full sm:w-auto">
            {submitting ? "SAVING REQUEST…" : QR_REQUEST.submit}
            {!submitting ? <ArrowRight className="size-4" /> : null}
          </Button>
          {!allRequiredChecked && <p className="text-xs text-muted-foreground">Please confirm both required consent statements to continue.</p>}
        </form>
      </div>
    </Section>
  );
}

/* -------------------------------------------------------------------------- */
/*  13. GIVE                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Interactive participation calculator.
 *
 * Visualizes the source-faithful Phoenix math: residents × $1/month × 12 =
 * annual fund; 85% → Resets; ÷ $15,000 average = modeled capacity.
 *
 * The user can adjust the monthly contribution and participant count to see
 * how the fund scales. Default values match the source document exactly
 * (1,665,481 residents, $1/month). All labels use source-faithful language.
 */
function QrGiveCalculator() {
  const PHOENIX_POP = 1665481;
  const [monthly, setMonthly] = useState(1);
  const [participants, setParticipants] = useState(PHOENIX_POP);

  const annualFund = participants * monthly * 12;
  const directAllocation = Math.round(annualFund * 0.85);
  const resetsModeled = Math.round(directAllocation / 15000);

  const fmt = (n: number) =>
    n.toLocaleString("en-US", { maximumFractionDigits: 0 });

  // Compute the filled portion of each slider as a percentage, used for the
  // dynamic cool-blue gradient that shows progress.
  const monthlyPct = ((monthly - 1) / (20 - 1)) * 100;
  const participantsPct =
    ((participants - 1000) / (PHOENIX_POP - 1000)) * 100;

  // Shared inline style for the slider track: a linear-gradient that fills
  // the active portion with cool-blue and leaves the rest muted.
  const sliderStyle = (pct: number): React.CSSProperties => ({
    background: `linear-gradient(to right, oklch(0.58 0.14 235) 0%, oklch(0.58 0.14 235) ${pct}%, oklch(0.22 0.014 320) ${pct}%, oklch(0.22 0.014 320) 100%)`,
  });

  return (
    <div className="bndr-card rounded-2xl border border-border/60 bg-card/40 p-6 sm:p-8">
      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-primary/90">
        <Sparkles className="size-4" />
        Participation calculator
      </h3>
      <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
        Adjust the monthly contribution and participant count to see how the
        fund scales. Defaults match the Phoenix model.
      </p>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {/* Monthly contribution slider */}
        <div>
          <label className="mb-2 flex items-baseline justify-between text-sm">
            <span className="font-medium text-foreground">Monthly contribution</span>
            <span className="font-mono text-lg font-bold tabular-nums text-primary">
              ${monthly.toFixed(2)}
            </span>
          </label>
          <input
            type="range"
            min={1}
            max={20}
            step={1}
            value={monthly}
            onChange={(e) => setMonthly(Number(e.target.value))}
            style={sliderStyle(monthlyPct)}
            className="qr-slider h-2.5 w-full cursor-pointer appearance-none rounded-full"
            aria-label="Monthly contribution in dollars"
          />
          <div className="mt-1 flex justify-between text-[10px] text-muted-foreground/60">
            <span>$1</span>
            <span>$20</span>
          </div>
        </div>

        {/* Participants slider */}
        <div>
          <label className="mb-2 flex items-baseline justify-between text-sm">
            <span className="font-medium text-foreground">Participants</span>
            <span className="font-mono text-lg font-bold tabular-nums text-primary">
              {fmt(participants)}
            </span>
          </label>
          <input
            type="range"
            min={1000}
            max={PHOENIX_POP}
            step={1000}
            value={participants}
            onChange={(e) => setParticipants(Number(e.target.value))}
            style={sliderStyle(participantsPct)}
            className="qr-slider h-2.5 w-full cursor-pointer appearance-none rounded-full"
            aria-label="Number of monthly contributors"
          />
          <div className="mt-1 flex justify-between text-[10px] text-muted-foreground/60">
            <span>1,000</span>
            <span>1,665,481 (Phoenix)</span>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border/60 bg-background/40 p-5 text-center">
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Annual fund
          </p>
          <p className="bndr-wordmark-sm mt-2 font-extrabold leading-none text-foreground" style={{ fontSize: "clamp(1.25rem, 3.5vw, 2rem)" }}>
            ${fmt(annualFund)}
          </p>
        </div>
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-5 text-center">
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-primary/80">
            85% for Resets
          </p>
          <p className="bndr-wordmark-sm mt-2 font-extrabold leading-none text-primary" style={{ fontSize: "clamp(1.25rem, 3.5vw, 2rem)" }}>
            ${fmt(directAllocation)}
          </p>
        </div>
        <div className="rounded-xl border border-border/60 bg-background/40 p-5 text-center">
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Resets / year
          </p>
          <p className="bndr-wordmark-sm mt-2 font-extrabold leading-none text-foreground" style={{ fontSize: "clamp(1.25rem, 3.5vw, 2rem)" }}>
            ~{fmt(resetsModeled)}
          </p>
        </div>
      </div>

      <p className="mt-5 text-center text-xs italic text-muted-foreground">
        Planning estimate based on ${monthly.toFixed(2)}/month × {fmt(participants)}{" "}
        participants × 12 months. 15% operations, $15,000 average per Reset.
        This is a planning model, not a guaranteed outcome.
      </p>
    </div>
  );
}

function QrGive() {
  return (
    <Section id="give" eyebrow="Give" heading={QR_GIVE.heading} tinted>
      <div className="space-y-10">
        <Paragraphs text={QR_GIVE.intro} lead />

        {/* CTA buttons */}
        <div className="flex flex-wrap gap-3">
          {QR_GIVE.ctas.map((cta, index) => {
            const links = [
              process.env.NEXT_PUBLIC_QR_DONATE_MONTHLY_URL,
              process.env.NEXT_PUBLIC_QR_DONATE_ANNUAL_URL,
              process.env.NEXT_PUBLIC_QR_DONATE_CUSTOM_URL,
              process.env.NEXT_PUBLIC_QR_DONATE_SPONSOR_URL,
            ];
            const href = links[index];
            return href ? (
              <Button key={cta} size="lg" variant={cta.startsWith("$1") ? "default" : "outline"} asChild>
                <a href={href} rel="noopener noreferrer">{cta}</a>
              </Button>
            ) : (
              <Button
                key={cta}
                type="button"
                size="lg"
                variant={cta.startsWith("$1") ? "default" : "outline"}
                disabled
                title="Payment link not configured yet"
              >
                {cta}
              </Button>
            );
          })}
        </div>

        {/* Fund supports */}
        <div>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-[0.16em] text-primary/90">
            {QR_GIVE.explanationTitle}
          </h3>
          <p className="mb-4 text-base font-medium text-foreground">{QR_GIVE.fundSupportsTitle}</p>
          <PillGrid items={QR_GIVE.fundSupports} columns={3} />
        </div>

        {/* Donor rules */}
        <div className="bndr-card rounded-xl border border-border/60 bg-card/40 p-6">
          <ul className="space-y-2.5">
            {QR_GIVE.donorRules.map((r, i) => (
              <li
                key={i}
                className="flex items-start gap-3 text-sm leading-relaxed text-foreground/90"
              >
                <span aria-hidden="true" className="mt-0.5 text-xs font-bold text-primary">
                  ✕
                </span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Phoenix model */}
        <div className="bndr-card-priority bndr-card rounded-2xl p-6 sm:p-8">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-primary/90">
            <Sparkles className="size-4" />
            {QR_GIVE.phoenixModelTitle}
          </h3>
          <p className="text-base leading-relaxed text-foreground/90">
            {QR_GIVE.phoenixModel}
          </p>
          <div
            className="bndr-wordmark mt-5 text-center font-extrabold leading-none"
            style={{ fontSize: "clamp(1.5rem, 4.5vw, 2.75rem)" }}
          >
            {QR_GIVE.phoenixFormula}
          </div>
          <p className="mt-4 text-center text-xs italic text-muted-foreground">
            {QR_GIVE.phoenixNote}
          </p>
        </div>

        {/* Interactive participation calculator — source-faithful math */}
        <QrGiveCalculator />

        {/* Planning capacity */}
        <div>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-[0.16em] text-primary/90">
            {QR_GIVE.planningTitle}
          </h3>
          <p className="mb-4 text-base text-foreground/90">{QR_GIVE.planningIntro}</p>
          <PillGrid items={QR_GIVE.planning} columns={3} />

          <h4 className="mt-6 mb-3 text-sm font-semibold text-foreground">
            {QR_GIVE.planningUnderTitle}
          </h4>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {QR_GIVE.planningUnder.map((line, i) => {
              const [label, num] = line.split(": ");
              return (
                <div
                  key={i}
                  className="bndr-card rounded-xl border border-border/60 bg-card/40 p-5 text-center"
                >
                  <div
                    className="bndr-wordmark-sm font-extrabold leading-none"
                    style={{ fontSize: "clamp(1.25rem, 3vw, 1.75rem)" }}
                  >
                    {num}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{label}</p>
                </div>
              );
            })}
          </div>

          <Paragraphs text={QR_GIVE.planningNote} className="mt-6" />
        </div>

        {/* Cost growth */}
        <div className="bndr-card rounded-xl border border-border/60 bg-card/40 p-6">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-primary/90">
            {QR_GIVE.costGrowthTitle}
          </h3>
          <p className="text-base leading-relaxed text-muted-foreground">
            {QR_GIVE.costGrowthBody}
          </p>
          <p className="mt-4 text-sm leading-relaxed text-foreground/90">
            {QR_GIVE.costGrowthScenario}
          </p>
          <ul className="mt-4 space-y-2.5">
            {QR_GIVE.costGrowthResults.map((r, i) => (
              <Pill key={i}>{r}</Pill>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-primary/90">
            {QR_GIVE.costGrowthForThatReasonTitle}
          </h3>
          <PillGrid items={QR_GIVE.costGrowthForThatReason} columns={2} />
        </div>
      </div>
    </Section>
  );
}

/* -------------------------------------------------------------------------- */
/*  14. LEVELS                                                                 */
/* -------------------------------------------------------------------------- */

function QrLevels() {
  const intensities = [
    "border-primary/30",
    "border-primary/50",
    "border-primary/70",
  ];
  // Min/max for the progress bar scale (0 → $25,000 = full width).
  const MAX_RANGE = 25000;
  // Each level's numeric range for the bar: [min, max] in dollars.
  const levelRanges: Array<[number, number]> = [
    [0, 3000],
    [3000, 10000],
    [10000, 25000],
  ];
  return (
    <Section id="levels" eyebrow="Reset levels" heading={QR_LEVELS.heading}>
      <div className="space-y-10">
        <Paragraphs text={QR_LEVELS.intro} lead />

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {QR_LEVELS.levels.map((level, i) => {
            const [min, max] = levelRanges[i];
            const fillPct = (max / MAX_RANGE) * 100;
            const startPct = (min / MAX_RANGE) * 100;
            return (
              <div
                key={level.code}
                className={cn(
                  "bndr-card relative flex flex-col rounded-2xl border bg-card/40 p-6",
                  intensities[i],
                  i === 2 && "bndr-card-priority",
                )}
              >
                <span className="inline-flex w-fit items-center rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-primary">
                  {level.code}
                </span>
                <h3 className="mt-4 text-lg font-semibold leading-snug text-foreground">
                  {level.title}
                </h3>

                {/* Visual progress bar showing the $ range */}
                <div className="mt-4">
                  <div className="mb-1.5 flex items-center justify-between text-[10px] font-medium tabular-nums text-muted-foreground">
                    <span>$0</span>
                    <span>$25K</span>
                  </div>
                  <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-muted/60" role="presentation">
                    <motion.div
                      initial={{ width: 0 }}
                      whileInView={{ width: `${fillPct}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.8, delay: 0.2 + i * 0.15, ease: [0.16, 1, 0.3, 1] }}
                      className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-primary/70 to-primary"
                      style={{ marginLeft: `${startPct}%` }}
                    />
                  </div>
                  <p className="mt-2 text-center text-xs font-medium text-primary">
                    {level.range.replace("Working planning range: ", "")}
                  </p>
                </div>

                <ul className="mt-4 space-y-2">
                  {level.uses.map((u, j) => (
                    <li
                      key={j}
                      className="flex items-start gap-2 text-sm leading-relaxed text-foreground/90"
                    >
                      <span aria-hidden="true" className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" />
                      <span>{u}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        <div className="bndr-card rounded-xl border border-border/60 bg-card/40 p-6">
          <h3 className="text-base font-semibold text-foreground">
            {QR_LEVELS.noteTitle}
          </h3>
          <p className="mt-1 text-sm font-medium text-primary">{QR_LEVELS.note}</p>
          <p className="mt-3 text-sm text-muted-foreground">{QR_LEVELS.noteBody}</p>
          <PillGrid items={QR_LEVELS.noteFactors} columns={2} className="mt-4" />
        </div>
      </div>
    </Section>
  );
}

/* -------------------------------------------------------------------------- */
/*  15. RULES PAGE                                                             */
/* -------------------------------------------------------------------------- */

function QrRules() {
  return (
    <Section id="rules" eyebrow="Our rules" heading={QR_RULES_PAGE.heading} tinted>
      <div className="space-y-10">
        <Paragraphs text={QR_RULES_PAGE.intro} lead />

        {/* Person's rights */}
        <div>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-[0.16em] text-primary/90">
            {QR_RULES_PAGE.rightsTitle}
          </h3>
          <p className="mb-4 text-base text-foreground/90">{QR_RULES_PAGE.rightsIntro}</p>
          <PillGrid items={QR_RULES_PAGE.rights} columns={3} />
        </div>

        {/* Navigator boundaries — two columns */}
        <div>
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.16em] text-primary/90">
            {QR_RULES_PAGE.navBoundariesTitle}
          </h3>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <div className="bndr-card rounded-xl border border-primary/40 bg-primary/5 p-6">
              <h4 className="mb-4 text-sm font-semibold text-foreground">
                {QR_RULES_PAGE.navMayTitle}
              </h4>
              <ul className="space-y-2.5">
                {QR_RULES_PAGE.navMay.map((m, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-3 text-sm leading-relaxed text-foreground/90"
                  >
                    <span aria-hidden="true" className="mt-0.5 text-xs font-bold text-primary">
                      ✓
                    </span>
                    <span>{m}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bndr-card rounded-xl border border-border/60 bg-card/40 p-6">
              <h4 className="mb-4 text-sm font-semibold text-foreground">
                {QR_RULES_PAGE.navMayNotTitle}
              </h4>
              <ul className="space-y-2.5">
                {QR_RULES_PAGE.navMayNot.map((m, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-3 text-sm leading-relaxed text-foreground/90"
                  >
                    <span aria-hidden="true" className="mt-0.5 text-xs font-bold text-destructive">
                      ✕
                    </span>
                    <span>{m}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Misuse policy */}
        <div>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-[0.16em] text-primary/90">
            {QR_RULES_PAGE.misuseTitle}
          </h3>
          <p className="mb-4 text-base text-foreground/90">{QR_RULES_PAGE.misuseIntro}</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {QR_RULES_PAGE.misuseCategories.map((cat, i) => (
              <div
                key={i}
                className="bndr-card rounded-xl border border-border/60 bg-card/40 p-5"
              >
                <h4 className="text-base font-semibold text-foreground">{cat.name}</h4>
                <Paragraphs text={cat.desc} className="mt-2" />
              </div>
            ))}
          </div>
        </div>

        {/* Fraud */}
        <div className="bndr-card-priority bndr-card rounded-xl p-6">
          <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-primary/90">
            {QR_RULES_PAGE.fraudTitle}
          </h3>
          <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {QR_RULES_PAGE.fraudResults.map((r, i) => (
              <Pill key={i}>{r}</Pill>
            ))}
          </ul>
          <Paragraphs text={QR_RULES_PAGE.fraudClosing} className="mt-5" />
        </div>
      </div>
    </Section>
  );
}

/* -------------------------------------------------------------------------- */
/*  16. TRANSPARENCY                                                           */
/* -------------------------------------------------------------------------- */

function QrTransparency() {
  return (
    <Section id="transparency" eyebrow="Transparency" heading={QR_TRANSPARENCY.heading}>
      <div className="space-y-10">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className="bndr-card rounded-xl border border-primary/40 bg-primary/5 p-6">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.16em] text-primary/90">
              {QR_TRANSPARENCY.willPublishTitle}
            </h3>
            <ul className="space-y-2.5">
              {QR_TRANSPARENCY.willPublish.map((w, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 text-sm leading-relaxed text-foreground/90"
                >
                  <span aria-hidden="true" className="mt-0.5 text-xs font-bold text-primary">
                    ✓
                  </span>
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="bndr-card rounded-xl border border-border/60 bg-card/40 p-6">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {QR_TRANSPARENCY.willNotTitle}
            </h3>
            <ul className="space-y-2.5">
              {QR_TRANSPARENCY.willNot.map((w, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 text-sm leading-relaxed text-foreground/90"
                >
                  <span aria-hidden="true" className="mt-0.5 text-xs font-bold text-destructive">
                    ✕
                  </span>
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <Callout>{QR_TRANSPARENCY.closing}</Callout>

        <div>
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.16em] text-primary/90">
            {QR_TRANSPARENCY.outcomesTitle}
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {QR_TRANSPARENCY.outcomes.map((o, i) => (
              <div
                key={i}
                className="bndr-card rounded-lg border border-border/60 bg-card/40 p-4"
              >
                <p className="text-sm font-semibold text-primary">{o.name}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{o.desc}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm italic text-muted-foreground">
            {QR_TRANSPARENCY.outcomesNote}
          </p>
        </div>
      </div>
    </Section>
  );
}

/* -------------------------------------------------------------------------- */
/*  17. DEFINITIONS — accordion                                                */
/* -------------------------------------------------------------------------- */

function QrDefinitions() {
  return (
    <Section id="definitions" eyebrow="Definitions" heading={QR_DEFINITIONS.heading} tinted>
      <div className="bndr-card overflow-hidden rounded-2xl border border-border/60 bg-card/40">
        <Accordion type="single" collapsible className="w-full">
          {QR_DEFINITIONS.terms.map((t, i) => (
            <AccordionItem
              key={i}
              value={`term-${i}`}
              className={cn(
                "border-border/60 px-5 py-1 sm:px-6",
                i % 2 === 1 && "bg-primary/5",
              )}
            >
              <AccordionTrigger className="text-base font-semibold text-foreground hover:no-underline hover:text-primary sm:text-lg">
                {t.term}
              </AccordionTrigger>
              <AccordionContent className="pb-5">
                <Paragraphs text={t.def} className="pt-3 text-sm leading-relaxed text-foreground/90 sm:text-base" />
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </Section>
  );
}

/* -------------------------------------------------------------------------- */
/*  18. EVIDENCE                                                               */
/* -------------------------------------------------------------------------- */

function QrEvidence() {
  const verified = QR_EVIDENCE.verifiedSections as readonly EvidenceSection[];
  const modeled = QR_EVIDENCE.modeledSections as readonly ModeledSection[];
  return (
    <Section id="evidence" eyebrow="Evidence & methodology" heading={QR_EVIDENCE.heading}>
      <div className="space-y-12">
        {/* Verified */}
        <div>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-primary/90">
            <ShieldCheck className="size-4" />
            {QR_EVIDENCE.verifiedTitle}
          </h3>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {verified.map((s, i) => (
              <div
                key={i}
                className="bndr-card rounded-xl border border-border/60 bg-card/40 p-6"
              >
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  {s.title}
                </p>
                <div
                  className="bndr-wordmark-sm mt-2 font-extrabold leading-tight text-foreground"
                  style={{ fontSize: "clamp(1.5rem, 4vw, 2.25rem)" }}
                >
                  {s.value}
                </div>
                <ul className="mt-4 space-y-1.5">
                  {s.details.map((d, j) => (
                    <li
                      key={j}
                      className="text-sm leading-relaxed text-muted-foreground"
                    >
                      • {d}
                    </li>
                  ))}
                </ul>
                {s.source && (
                  <a
                    href={s.source}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                  >
                    <ExternalLink className="size-3.5" />
                    Source
                  </a>
                )}
                {s.note && (
                  <p className="mt-4 rounded-lg border border-border/60 bg-card/60 p-3 text-xs italic leading-relaxed text-muted-foreground">
                    {s.note}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Modeled */}
        <div>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-primary/90">
            <Sparkles className="size-4" />
            {QR_EVIDENCE.modeledTitle}
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {modeled.map((s, i) => (
              <div
                key={i}
                className="bndr-card rounded-xl border border-border/60 bg-card/40 p-5"
              >
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  {s.title}
                </p>
                <div
                  className="bndr-wordmark-sm mt-2 font-extrabold leading-tight text-foreground"
                  style={{ fontSize: "clamp(1.25rem, 3vw, 1.75rem)" }}
                >
                  {s.value}
                </div>
                <ul className="mt-3 space-y-1.5">
                  {s.details.map((d, j) => (
                    <li key={j} className="text-xs leading-relaxed text-muted-foreground">
                      • {d}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Not claims */}
        <div className="bndr-card-priority bndr-card rounded-2xl p-6 sm:p-8">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.16em] text-primary/90">
            {QR_EVIDENCE.notClaimTitle}
          </h3>
          <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {QR_EVIDENCE.notClaims.map((c, i) => (
              <li
                key={i}
                className="flex items-start gap-3 rounded-lg border border-border/60 bg-card/40 p-3 text-sm leading-relaxed text-foreground/90"
              >
                <span aria-hidden="true" className="mt-0.5 text-xs font-bold text-destructive">
                  ✕
                </span>
                <span>{c}</span>
              </li>
            ))}
          </ul>
          <Paragraphs text={QR_EVIDENCE.notClaimClosing} className="mt-6" />
        </div>
      </div>
    </Section>
  );
}

/* -------------------------------------------------------------------------- */
/*  19. FAQ — accordion                                                        */
/* -------------------------------------------------------------------------- */

function QrFaq() {
  const items = QR_FAQ.items as readonly FaqItem[];
  return (
    <Section id="faq" eyebrow="FAQ" heading={QR_FAQ.heading} tinted>
      <div className="bndr-card overflow-hidden rounded-2xl border border-border/60 bg-card/40">
        <Accordion type="single" collapsible className="w-full">
          {items.map((item, i) => (
            <AccordionItem
              key={i}
              value={`faq-${i}`}
              className={cn(
                "border-border/60 px-5 py-1 sm:px-6",
                i % 2 === 1 && "bg-primary/5",
              )}
            >
              <AccordionTrigger className="text-left text-base font-semibold text-foreground hover:no-underline hover:text-primary sm:text-lg">
                {item.q}
              </AccordionTrigger>
              <AccordionContent className="pb-5">
                <Paragraphs text={item.a} className="pt-3 text-sm leading-relaxed text-foreground/90 sm:text-base" />
                {item.list && (
                  <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {item.list.map((li, j) => (
                      <Pill key={j}>{li}</Pill>
                    ))}
                  </ul>
                )}
                {item.closing && (
                  <p className="mt-4 text-sm font-medium italic text-primary">
                    {item.closing}
                  </p>
                )}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </Section>
  );
}

/* -------------------------------------------------------------------------- */
/*  20. FOOTER                                                                 */
/* -------------------------------------------------------------------------- */

function QrShareButton() {
  const [copied, setCopied] = useState(false);
  const handleShare = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      if (navigator.share) {
        await navigator.share({ title: QR_BRAND.name, text: QR_BRAND.shortBio, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // user dismissed the share sheet — no-op
    }
  };
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleShare}
      className="gap-1.5 rounded-full border-primary/30 hover:border-primary/60 hover:text-primary"
      aria-label="Share this page"
    >
      {copied ? <Check className="size-4 text-primary" aria-hidden /> : <Share2 className="size-4" aria-hidden />}
      <span className="hidden sm:inline">{copied ? "Link copied" : "Share"}</span>
    </Button>
  );
}

function QrFooter() {
  return (
    <footer className="mt-auto border-t border-border/60 bg-card/30">
      <div className="bndr-gradient-line h-px w-full" aria-hidden="true" />
      <div className="container mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-3">
          {/* Brand */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Logo size={36} />
              <span className="bndr-wordmark-sm font-extrabold text-2xl tracking-tight">
                {QR_FOOTER.brand}
              </span>
            </div>
            <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
              {QR_FOOTER.tagline}
            </p>
            <div className="flex items-center gap-2">
              <QrShareButton />
            </div>
          </div>

          {/* Links */}
          <div className="space-y-3 md:col-span-2">
            <h3 className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Quick links
            </h3>
            <ul className="grid grid-cols-2 gap-1.5 text-sm sm:grid-cols-3">
              {QR_FOOTER.links.map((link, i) => (
                <li key={i}>
                  <button
                    type="button"
                    className="text-left text-muted-foreground transition-colors hover:text-primary"
                  >
                    {link}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="mt-10 border-t border-border/60 pt-6">
          <p className="max-w-4xl text-xs leading-relaxed text-muted-foreground/80">
            {QR_FOOTER.disclaimer}
          </p>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <p className="text-xs text-muted-foreground/60">
                © {new Date().getFullYear()} {QR_BRAND.name} · {QR_BRAND.domain}
              </p>
              <span className="text-xs text-muted-foreground/40" aria-hidden>·</span>
              <p className="text-xs text-muted-foreground/60">
                Content reviewed {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
              </p>
            </div>
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary/70 transition-colors hover:text-primary"
            >
              <ArrowUp className="size-3" aria-hidden />
              Back to top
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* -------------------------------------------------------------------------- */
/*  MAIN COMPOSITION                                                           */
/* -------------------------------------------------------------------------- */

/**
 * QR Resets™ — full single-page site.
 *
 * Composes the sticky secondary nav, 20 source-faithful sections, and a
 * sticky footer. The whole component is a client component because the
 * request form holds local state.
 */
export function QrSite() {
  return (
    <div className="flex min-h-screen flex-col">
      <QrScrollProgress />
      <QrNav />
      <main id="main-content" tabIndex={-1} className="flex-1">
        <QrHero />
        <QrTableOfContents />
        <QrBasicIdea />
        <QrProblem />
        <QrWhatIsReset />
        <QrIsNot />
        <QrWhoFor />
        <QrPersonDirected />
        <QrConsentPromise />
        <QrLooseRules />
        <QrRiskDoctrine />
        <QrHowItWorks />
        <QrRequest />
        <QrGive />
        <QrLevels />
        <QrRules />
        <QrTransparency />
        <QrDefinitions />
        <QrEvidence />
        <QrFaq />
      </main>
      <MissionConnection from="qr" />
      <QrFooter />
    </div>
  );
}

export default QrSite;
