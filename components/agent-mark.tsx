import * as React from "react";
import { cn } from "@/lib/utils";

// Woven's agent mark — the brand's woven strands (logo-drop profile: tall centre, short edges),
// brought to life. A slow wave travels the strands (idle = a gentle breath; thinking = a livelier
// weave). Motion + prefers-reduced-motion live in globals.css (.woven-strand). Rendered inline (not a
// mask) so it can move and pick up currentColor. viewBox is cropped to the strands so it fills the box.
const STRANDS = [
  { x: 24.5, h: 14 },
  { x: 29.3, h: 22 },
  { x: 34.1, h: 32 },
  { x: 38.9, h: 44 },
  { x: 43.7, h: 54 },
  { x: 48.5, h: 62 },
  { x: 53.3, h: 54 },
  { x: 58.1, h: 44 },
  { x: 62.9, h: 32 },
  { x: 67.7, h: 22 },
  { x: 72.5, h: 14 },
];

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
    <svg
      viewBox="18 13 64 74"
      data-state={state}
      aria-hidden="true"
      className={cn("overflow-visible", className)}
      style={style}
    >
      {STRANDS.map((s, i) => (
        <rect
          key={i}
          className="woven-strand"
          x={s.x}
          y={50 - s.h / 2}
          width={3}
          height={s.h}
          rx={1.5}
          fill="currentColor"
          style={{ animationDelay: `${(-0.13 * i).toFixed(2)}s` }}
        />
      ))}
    </svg>
  );
}
