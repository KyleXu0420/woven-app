import * as React from "react";
import { cn } from "@/lib/utils";

// Woven's agent mark — TWO threads woven together (real over-under), bulging at the centre and meeting at
// the ends: the brand's "tall centre" logo-drop silhouette, but genuinely interlaced rather than the parallel
// equalizer bars it used to be. A slow breath keeps it alive (idle = gentle; thinking = livelier weave).
// Motion + prefers-reduced-motion live in globals.css (.woven-weave). Inline (not a mask) so it moves + picks
// up currentColor; the viewBox is framed to the strands so it fills the box like an avatar glyph.
const N = 48;
const X0 = 15,
  X1 = 85,
  CY = 50,
  AMP = 26,
  FREQ = 1.5, // 1.5 → two interior crossings: a legible two-ply braid, not a busy rope
  POW = 0.62, // envelope shoulder — fatter centre, softly pinched ends
  SW = 9;

function strand(sign: number): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    const x = X0 + (X1 - X0) * t;
    const env = AMP * Math.pow(Math.sin(Math.PI * t), POW);
    pts.push([x, CY + sign * env * Math.sin(2 * Math.PI * FREQ * t)]);
  }
  return pts;
}
const toPath = (pts: [number, number][]) =>
  pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");

const A = strand(1);
const B = strand(-1);
// over-under: draw B (under), then A (over everywhere), then re-draw B's middle third ON TOP of A — so the
// two threads alternate which is over at successive crossings, reading as a genuine weave rather than a twist.
const D_B = toPath(B);
const D_A = toPath(A);
const D_BMID = toPath(B.slice(Math.round(N / 3), Math.round((2 * N) / 3) + 1));
const PAD = SW / 2 + 2;
const VB = `${X0 - PAD} ${CY - AMP - PAD} ${X1 - X0 + PAD * 2} ${AMP * 2 + PAD * 2}`;

export function AgentMark({
  state = "idle",
  className,
  style,
}: {
  state?: "idle" | "thinking" | "still"; // "still" = static until something (e.g. hover) flips it to thinking
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg viewBox={VB} data-state={state} aria-hidden="true" className={cn("overflow-visible", className)} style={style}>
      <g
        className="woven-weave"
        fill="none"
        stroke="currentColor"
        strokeWidth={SW}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={D_B} />
        <path d={D_A} />
        <path d={D_BMID} />
      </g>
    </svg>
  );
}
