"use client";

import * as React from "react";

// One control vocabulary, shared across pages — each role has a distinct look so they
// never blend on the same page:
//   ① ViewTabs    — page-level view switch (underline, forest accent) = PRIMARY
//   ② SegToggle   — in-view secondary switch (segmented pill, neutral)  = SECONDARY
//   ③ FilterChips — facet filter (free rounded-full pills, neutral)

// count: a number, or a string when the figure needs a sign — "+24" for an option that ADDS to the
// current one — so a switch can say "4" and "+24" and the reader sees what the second costs, not two
// totals to subtract. (A figure that belongs in the phrase, "+24 more", goes in the label instead.)
// No `hint`: an option carried a tooltip for one round (the explorer's "All" needed a sentence to say what
// it included), and a control whose label needs a sentence has the wrong label — the label says it now
// ("Within 2 hops"), and the quietest control on a page does not hang the heaviest material.
type Opt = { id: string; label: string; count?: number | string };

// State + focus, shared by all three roles so a selection never depends on colour alone and a
// keyboard user can always see where they are. `aria-pressed` rather than role="radio"/"tab":
// those patterns promise arrow-key navigation via a roving tabindex, and announcing a contract
// we do not implement is worse than plain toggles. Tab moves between options natively.
// Lifted from the hand-rolled copies in library/page and artifact-graph-overlay, which already
// did this correctly — the canonical was the one missing it.
const FOCUS = "outline-none focus-visible:ring-3 focus-visible:ring-focus";

// ① page-level view tabs — underline indicator, the brand accent marks the primary level
export function ViewTabs({
  options,
  value,
  onChange,
  ariaLabel,
  trailing,
}: {
  options: Opt[];
  value: string;
  onChange: (v: string) => void;
  ariaLabel?: string;
  // trailing — a PAGE SETTING that rides the tab row's trailing end, on the tabs' baseline, inside the one
  // row that carries the hairline (the explorer's depth switch: it governs every view, so it belongs to the
  // row that chooses the view, not to a band of its own under it). Optional; with nothing here the row is
  // the tabs alone, exactly as Inbox and the collection page draw it.
  trailing?: React.ReactNode;
}) {
  return (
    // the hairline is the ROW's, not the tab group's, so a trailing setting sits inside the same rule — and
    // items-baseline, not items-center: a 24px switch centred in a 38px tab row sat 2px under the tabs'
    // baseline, and two controls on one row that miss each other's baseline by a hair read as a mistake
    <div className="flex items-baseline border-b">
      <div role="group" aria-label={ariaLabel} className="flex items-center gap-7">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            aria-pressed={value === o.id}
            className={`relative py-2.5 text-sm font-medium transition-colors ${FOCUS} ${
              value === o.id ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {/* label and count are ONE label — "Contents 6" — so the underline runs under both. A bare
                numeral, the sidebar's grammar for the same datum; it was a filled pill, and the
                underline stopping short of a pill read as the pill falling off the tab. The count wears
                the TAB's ink, not a rung of its own (settled 2026-09-12): inside a selection control the
                ink says "selected", and a demand-rung count in full ink on a muted, unselected tab would
                outrank its own label. One rung smaller, the label's weight — a Section's count. */}
            <span className="relative">
              {o.label}
              {o.count != null && (typeof o.count === "string" || o.count > 0) ? (
                <span className="ml-1.5 text-xs tabular-nums">{o.count}</span>
              ) : null}
              {value === o.id ? (
                <span className="absolute inset-x-0 -bottom-[11px] h-0.5 rounded-full bg-primary" />
              ) : null}
            </span>
          </button>
        ))}
      </div>
      {trailing ? <div className="ml-auto flex items-baseline">{trailing}</div> : null}
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
  onHover,
  size = "default",
  fullWidth = false,
  className,
  ariaLabel,
}: {
  options: Opt[];
  value: string;
  onChange: (v: string) => void;
  // the option the pointer (or focus) rests on, null when it leaves — so a caller can PREVIEW a setting
  // before the click commits it (the explorer ghosts the wider reach while you hover "+24 more"). A
  // hover that renders nothing is a hover the reader cannot tell from rest.
  onHover?: (id: string | null) => void;
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
          onPointerEnter={onHover ? () => onHover(o.id) : undefined}
          onPointerLeave={onHover ? () => onHover(null) : undefined}
          onFocus={onHover ? () => onHover(o.id) : undefined}
          onBlur={onHover ? () => onHover(null) : undefined}
          aria-pressed={value === o.id}
          // tabular-nums on the segment itself, not only on its count: a label that carries its figure in the
          // phrase ("+24 more", the explorer's wider reach) keeps the same digit width as a bare count would,
          // so the thumb does not change size by a hair when the figure changes
          className={`${seg} font-medium tabular-nums transition-colors ${FOCUS} ${fullWidth ? "flex-1" : ""} ${
            value === o.id
              ? "bg-card text-foreground shadow-sm"
              // hover = the ink AND one rung of fill on the track. Ink alone (muted to full) was the whole
              // hover state, and on a switch whose hover PREVIEWS something (the explorer ghosts a wider
              // reach while the pointer rests on "Within 2 hops") a still of it could not show what caused the ghost.
              // tint-2, not tint-1: the track is the sunk well (the ladder's tint-1 rung), and a hover on
              // an OBJECT is one rung above what it rests on — tint-1 over the track measured 1.12:1 against
              // it, a step a still at 1x could not show, so the hovered segment read as a second rest state
              // beside the thumb. tint-2 is 1.22:1. The thumb stays the only opaque fill.
              : "text-muted-foreground hover:bg-tint-2 hover:text-foreground"
          }`}
        >
          {o.label}
          {/* the same bare numeral ViewTabs uses, in the segment's own ink (selected = ink, else muted).
              A caller that interpolates its count into the label reaches for a separator, and the
              separator it reaches for is a middle dot. On an UNSELECTED segment the count keeps its muted
              ink through the hover: the label lifts to full ink to say "pressable", the figure stays what
              it is — a preview, not yet chosen — and only the click turns it full. Both lifted together
              before, so the hover and the selection were told apart by the thumb alone, and on a switch
              whose hover previews something (the explorer ghosts the wider reach) a still of the hover
              could not be told from a still of the choice. */}
          {o.count != null ? (
            <span className={`ml-1.5 text-xs tabular-nums ${value === o.id ? "" : "text-muted-foreground"}`}>{o.count}</span>
          ) : null}
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
          className={`h-7 rounded-full px-3 text-sm font-medium transition-colors ${FOCUS} ${
            value === x
              // one rung up its OWN hover ladder (0.04 -> 0.08), not a surface token. Alpha-on-ink
              // flips with the theme by construction: a darker fill on paper, a LIGHTER one on
              // charcoal. bg-secondary sits BELOW --background in the dark ramp, so selection used
              // to read as a hole — the one control of the three that sank instead of rising.
              ? "bg-tint-2 text-foreground"
              : "text-muted-foreground hover:bg-tint-1"
          }`}
        >
          {x}
        </button>
      ))}
    </div>
  );
}

// DIVIDED, DIVIDED_FLUSH and FOCUS_RING live in components/classes.ts (a module with no "use client") and are
// re-exported here for the existing importers. See that file for why.
export { DIVIDED, DIVIDED_FLUSH, FOCUS_RING } from "./classes";
