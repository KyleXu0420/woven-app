"use client";

import * as React from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// How sure the agent is about a proposal, AT REST — settled 2026-09-12 by a blind panel (8/10 against 3.7 for
// the 3-bar meter it replaces). It is a WORD, and only when the word earns its ink:
//   high   (≥ 0.8)  nothing rendered — a silent row is the default, so the exception is the only marked thing;
//                   assistive tech still gets "High confidence"
//   likely (≥ 0.6)  "Likely" — 13 / 400 / muted
//   unsure (< 0.6)  "Unsure" — 13 / 500 / full ink: a demand on the reviewer's attention, so it wears demand ink
// Never a meter: the three bars were a phone's signal glyph (a borrowed symbol), 15×10px with the lit bars at
// 2.79:1 and the unlit at 1.35:1 — the one distinction triage needs was the one it could not show. Never a
// circled mark (status, by the house alphabet) and never a hue (identity). The exact percentage stays in the
// hover (house rule P-4: no loud number at rest), in the same words as the rest state — one vocabulary.
// Position is the caller's: the title line's trailing cluster, one gutter (16px) left of the identity chip, and
// never inside the Confirm / Dismiss cluster, where a confidence word reads as an instruction.
export type ConfidenceLevel = "high" | "likely" | "unsure";
export function confidenceLevel(value: number): ConfidenceLevel {
  return value >= 0.8 ? "high" : value >= 0.6 ? "likely" : "unsure";
}
const COPY: Record<ConfidenceLevel, { word: string; guidance: string }> = {
  high: { word: "High confidence", guidance: "safe to confirm at a glance" },
  likely: { word: "Likely", guidance: "a quick look is worth it" },
  unsure: { word: "Unsure", guidance: "worth a closer read before you confirm" },
};

export function ConfidenceWord({ value }: { value: number }) {
  const level = confidenceLevel(value);
  const { word, guidance } = COPY[level];
  if (level === "high") return <span className="sr-only">{word}</span>;
  return (
    <Popover>
      <PopoverTrigger
        nativeButton={false}
        openOnHover
        delay={120}
        render={
          <span
            className={
              level === "unsure"
                ? "shrink-0 cursor-help text-sm font-medium text-foreground outline-none"
                : "shrink-0 cursor-help text-sm text-muted-foreground outline-none"
            }
          />
        }
      >
        {word}
      </PopoverTrigger>
      <PopoverContent side="top" align="end" sideOffset={8} className="w-64 p-3">
        <p className="flex items-baseline gap-2 text-sm">
          <span className="font-medium">{word}</span>
          <span className="text-muted-foreground">{guidance}</span>
          <span className="ml-auto text-xs tabular-nums text-muted-foreground">{Math.round(value * 100)}%</span>
        </p>
      </PopoverContent>
    </Popover>
  );
}
