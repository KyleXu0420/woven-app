"use client";

import * as React from "react";

// One control vocabulary, shared across pages — each role has a distinct look so they
// never blend on the same page:
//   ① ViewTabs    — page-level view switch (underline, forest accent) = PRIMARY
//   ② SegToggle   — in-view secondary switch (segmented pill, neutral)  = SECONDARY
//   ③ FilterChips — facet filter (free rounded-full pills, neutral)

type Opt = { id: string; label: string; count?: number };

// State + focus, shared by all three roles so a selection never depends on colour alone and a
// keyboard user can always see where they are. `aria-pressed` rather than role="radio"/"tab":
// those patterns promise arrow-key navigation via a roving tabindex, and announcing a contract
// we do not implement is worse than plain toggles. Tab moves between options natively.
// Lifted from the hand-rolled copies in library/page and artifact-graph-overlay, which already
// did this correctly — the canonical was the one missing it.
const FOCUS = "outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

// ① page-level view tabs — underline indicator, the brand accent marks the primary level
export function ViewTabs({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: Opt[];
  value: string;
  onChange: (v: string) => void;
  ariaLabel?: string;
}) {
  return (
    <div role="group" aria-label={ariaLabel} className="flex items-center gap-5 border-b">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          aria-pressed={value === o.id}
          className={`relative py-2.5 text-base font-medium transition-colors ${FOCUS} ${
            value === o.id ? "text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {o.label}
          {o.count != null && o.count > 0 ? (
            <span
              className={`ml-1.5 rounded-full px-1.5 py-0.5 text-xs font-medium tabular-nums ${
                value === o.id ? "bg-foreground/[0.08] text-foreground" : "bg-foreground/[0.05] text-muted-foreground"
              }`}
            >
              {o.count}
            </span>
          ) : null}
          {value === o.id ? (
            <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-primary" />
          ) : null}
        </button>
      ))}
    </div>
  );
}

// ② in-view secondary toggle — segmented pill, neutral active (subordinate to the tabs).
// Track-and-thumb: recessed gray track (bg-secondary), raised near-white active thumb
// (bg-card + shadow-sm) with NO border/ring — the fill does the raising, not a hairline.
// See woven-control-surfaces. size="sm" for tight inline switches; fullWidth to stretch.
export function SegToggle({
  options,
  value,
  onChange,
  size = "default",
  fullWidth = false,
  className,
  ariaLabel,
}: {
  options: Opt[];
  value: string;
  onChange: (v: string) => void;
  size?: "sm" | "default";
  fullWidth?: boolean;
  className?: string;
  ariaLabel?: string;
}) {
  const seg = size === "sm" ? "rounded-md px-2 py-0.5 text-xs" : "rounded-md px-3 py-1.5 text-sm";
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={`inline-flex items-center gap-0.5 rounded-md bg-secondary p-0.5 ${fullWidth ? "flex w-full" : ""} ${className ?? ""}`}
    >
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          aria-pressed={value === o.id}
          className={`${seg} font-medium transition-colors ${FOCUS} ${fullWidth ? "flex-1" : ""} ${
            value === o.id
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ③ facet filter — free rounded-full chips, neutral active
export function FilterChips({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
  ariaLabel?: string;
}) {
  return (
    <div role="group" aria-label={ariaLabel} className="flex flex-wrap gap-1.5">
      {options.map((x) => (
        <button
          key={x}
          type="button"
          onClick={() => onChange(x)}
          aria-pressed={value === x}
          className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${FOCUS} ${
            value === x
              // one rung up its OWN hover ladder (0.04 -> 0.08), not a surface token. Alpha-on-ink
              // flips with the theme by construction: a darker fill on paper, a LIGHTER one on
              // charcoal. bg-secondary sits BELOW --background in the dark ramp, so selection used
              // to read as a hole — the one control of the three that sank instead of rising.
              ? "bg-foreground/[0.08] text-foreground"
              : "text-muted-foreground hover:bg-foreground/[0.04]"
          }`}
        >
          {x}
        </button>
      ))}
    </div>
  );
}

// The one INSET row-divider (divider-no-horizontal-flush). Put it on the ROWS' CONTAINER: it draws a hairline
// above every child except the first, inset L/R via a pseudo-element so the line floats inside the content
// column instead of reaching the panel edge. Rows carry no border-t of their own. Shared so Today, Library,
// Collection, Explorer, Inbox and Capture all part their rows the same way.
export const DIVIDED =
  "[&>*+*]:relative [&>*+*]:before:pointer-events-none [&>*+*]:before:absolute [&>*+*]:before:inset-x-3 [&>*+*]:before:top-0 [&>*+*]:before:h-px [&>*+*]:before:bg-border/60";
