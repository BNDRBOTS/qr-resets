"use client";

import { Fragment, type ReactNode } from "react";

/**
 * Highlight occurrences of `query` tokens inside `text` by wrapping matches
 * in <mark className="bndr-mark">. Tokens are split on whitespace and any
 * token ≥2 chars is matched case-insensitively as a whole word substring.
 *
 * If there is no query, just returns the text.
 */
export function Highlight({
  text,
  query,
}: {
  text: string;
  query?: string;
}): ReactNode {
  if (!query || !query.trim()) return <>{text}</>;

  const tokens = query
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((t) => t.length >= 2);
  if (tokens.length === 0) return <>{text}</>;

  // Build one alternation regex: (token1|token2|...) — escaped.
  const escaped = tokens
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .sort((a, b) => b.length - a.length); // longer first for greedy match
  const re = new RegExp(`(${escaped.join("|")})`, "gi");

  const parts = text.split(re);
  return (
    <>
      {parts.map((part, i) => {
        if (i % 2 === 1) {
          return (
            <mark key={i} className="bndr-mark">
              {part}
            </mark>
          );
        }
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </>
  );
}
