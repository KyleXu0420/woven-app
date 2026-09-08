import * as React from "react";
import { cn } from "@/lib/utils";

// Woven's agent mark is a SEAL: the logo's forest node grown to hold its wave. In this system an actor is a
// disc — people are tinted initial circles — and the agent is an actor, so it takes the disc; forest is
// already the agent's colour, so the disc is not a container added to the logo but the brand's two pieces
// (wave, node) collapsed into one object. Settled 2026-09-05 after five blind panels: every bare wave-and-node
// glyph pinned at ~7 because below 24px a node either fuses with its line or falls to a speck, and a 14×7 band
// cannot balance in a circle; the interlaced braid it replaced fused into a knot at 12px (4.9).
//
// One drawing at every size. The disc fills the box (r 11 on the 24-grid, lucide's circle footprint); the wave
// is ONE crest · valley · crest · run-out, 70% of the disc wide, cut out in the on-forest ink. Only the wave's
// stroke changes with size — heavier as the box shrinks, so at 12px it is still a wave and not a scratch:
//   ≥24: 2.4 (grid)   ·   16–23: 2.9 (1.9px at 16)   ·   ≤15: 3.4 (1.7px at 12)
// The seal is never placed inside another dish: as the avatar it IS the dish. On a forest ground use
// tone="paper" (paper disc, forest wave). Motion lives in globals.css: idle = the wave breathes inside the
// still disc; thinking = the wave's luminance pulses; still = nothing. The disc never moves.
const WAVE = "M4.5 10 C6.6 10 7.7 16.4 9.8 16.4 C11.9 16.4 12.9 8.2 15 8.2 C16.7 8.2 17.9 10.2 19.5 12.6";

function strokeFor(size: number) {
  if (size >= 24) return 2.4;
  if (size >= 16) return 2.9;
  return 3.4;
}

export function AgentMark({
  state = "idle",
  size = 16,
  tone = "forest",
  className,
  style,
}: {
  state?: "idle" | "thinking" | "still"; // "still" = static until something (e.g. hover) flips it to thinking
  /** rendered box in px — picks the wave's stroke; the box itself still comes from className (size-4 …) */
  size?: number;
  /** forest = forest disc, on-forest wave (the default, on paper or charcoal); paper = inverted, for forest grounds */
  tone?: "forest" | "paper";
  className?: string;
  style?: React.CSSProperties;
}) {
  // The disc is forest MUTED toward the ground, not forest at full strength: at full strength the seal
  // was the loudest object in a row of muted text (6.6:1 on paper, 7.3 on charcoal — louder than every
  // person's avatar beside it). Mixed 70% it reads 3.5 / 4.0, about half the shout, and the wave inside
  // still clears the 3.0 non-text floor (3.5 / 3.7). One rung paler (55%) drops the wave to 2.5 and the
  // mark stops being legible at 12px, so 70 is the floor, not a taste.
  const disc =
    tone === "forest" ? "color-mix(in oklab, currentColor 70%, var(--background))" : "var(--primary-foreground)";
  const wave = tone === "forest" ? "var(--primary-foreground)" : "currentColor";
  return (
    <svg viewBox="0 0 24 24" data-state={state} aria-hidden="true" className={cn("shrink-0", className)} style={style}>
      <circle className="woven-seal" cx="12" cy="12" r="11" fill={disc} />
      <path
        className="woven-strand"
        d={WAVE}
        fill="none"
        stroke={wave}
        strokeWidth={strokeFor(size)}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
