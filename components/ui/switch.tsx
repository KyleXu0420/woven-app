"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

// The one on/off switch. Collapsed from two hand-rolled copies (share-collection-dialog and
// inbox-governance) that had drifted apart on every dimension: 20x36 vs 24x42 track, 16 vs 20
// thumb, translate vs absolute positioning, two different off-track fills, and a focus ring on
// one but not the other.
//
// Track-and-thumb, same grammar as SegToggle: a recessed track (bg-secondary) with a raised
// thumb (bg-card + shadow-sm) and NO border — the fill does the raising, not a hairline.
// That pairing is the only one that survives both themes. The two old off-track fills were
// alpha-on-ink (muted-foreground/30 and foreground/15), and in dark the ink is LIGHT, so the
// alpha lifted the track above the card-coloured thumb and the knob read as a hole. bg-secondary
// sits below --card in both ramps, so the thumb is raised in both.
//
// The thumb was bg-white in the governance copy — a literal that does not flip, rendering pure
// #ffffff on charcoal in dark. That is the bug this merge fixes.
//
// Geometry: track 42x24, thumb 20, inset 2 → on-position 20 (42 - 20 - 2). Both old copies were
// asymmetric (2/4 and 2/3 left/right gaps); the thumb now clears each end by the same 2px.
export function Switch({
  on,
  onChange,
  label,
  className,
}: {
  on: boolean;
  onChange: (next: boolean) => void;
  label: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={cn(
        "relative h-6 w-[42px] shrink-0 rounded-full transition-colors",
        "outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        on ? "bg-primary" : "bg-secondary",
        className,
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 size-5 rounded-full bg-card shadow-sm transition-all",
          on ? "left-5" : "left-0.5",
        )}
      />
    </button>
  );
}
