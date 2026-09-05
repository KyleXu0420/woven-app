import * as React from "react";
import { cn } from "@/lib/utils";

// Woven's agent mark — the logo's own terminal: one crest, one valley, one crest, a run-out that lands on the
// forest node. Drawn ONCE on lucide's 24-grid so it weighs what the icon set weighs and sits in the same slot;
// the earlier two-ply braid fused into a knot at 12–16px, the sizes the mark actually lives at, and had no
// stroke in common with the signal-wave logo. Settled by a blind five-lens panel (2026-09-05): the interlaced
// candidates all die at 12px — a crossing is the one thing a 12px glyph cannot keep open and the one thing the
// logo does not have.
//
// Size tiers change stroke width and node radius ONLY — nothing is redrawn — so the 12 and the 96 are the same
// drawing: forest on paper reads thin, so the small tiers run heavier than lucide's 1.33px.
//   ≥24: stroke 2 (grid), node r 2   ·   16: stroke 2.25 (1.5px), node r 2.25 (3px)   ·   12–14: 2.5 / 2.5
// Motion lives in globals.css: idle = the strand breathes (scaleY 1→1.06 about its own axis, the node holds);
// thinking = the node's luminance pulses (opacity), the strand holds; still = nothing. The node never travels
// and never grows — a dot moving along a wave is a tadpole, the one frame the mark must never show.
const STRAND = "M3.5 6 C5.3 6 6.7 18 8.5 18 C10.3 18 11.7 6 13.5 6 C15.1 6 16.4 9.8 17.6 13.4";
// the node is the stroke's own terminal (centred on the path end, outer diameter 2× stroke — lucide's dot
// grammar): below 24px a detached dot either fused with the line or fell to a speck, so the drawing is what
// the pixels do anyway. The ink centroid is re-centred on (12,12) by this offset.
const NODE = { cx: 17.6, cy: 13.4 };
const CENTRE = { x: 0.24, y: 0.74 };

function tier(size: number) {
  if (size >= 24) return { sw: 2, r: 2 }; // 2px stroke at 24, 4 at 48, 8 at 96 — lucide's 2/24
  if (size >= 16) return { sw: 2.25, r: 2.25 }; // 1.5px stroke, 3px node
  return { sw: 2.5, r: 2.5 }; // 1.25px stroke, 2.5px node — never thinner
}

export function AgentMark({
  state = "idle",
  size = 16,
  className,
  style,
}: {
  state?: "idle" | "thinking" | "still"; // "still" = static until something (e.g. hover) flips it to thinking
  /** rendered box in px — picks the stroke/node tier; the box itself still comes from className (size-4 …) */
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const t = tier(size);
  return (
    <svg viewBox="0 0 24 24" data-state={state} aria-hidden="true" className={cn("overflow-visible", className)} style={style}>
      <g transform={`translate(${CENTRE.x} ${CENTRE.y})`}>
        <path
          className="woven-strand"
          d={STRAND}
          fill="none"
          stroke="currentColor"
          strokeWidth={t.sw}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle className="woven-node" cx={NODE.cx} cy={NODE.cy} r={t.r} fill="currentColor" />
      </g>
    </svg>
  );
}
