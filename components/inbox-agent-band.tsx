"use client";

// The shared agent-colleague header — ONE band atop every Inbox lens (Decisions · Activity · Governance) so the
// three read as one system. AgentAvatar (its animation carries presence) + "Woven agent" — with a live "· working
// now" ONLY while it's actually weaving, never a constant "always on" — + a lens-specific summary line, with an
// optional right-side element (a status pill in Activity, a trust trajectory in Governance, nothing in Decisions).
// The three tabs group by their own natural axis (priority / colleague / area); this band + the row grammar +
// the cross-tab ties are what make them one surface.

import * as React from "react";
import { cn } from "@/lib/utils";
import { AgentAvatar } from "@/components/identity";

export function AgentBand({
  summary,
  right,
  state = "idle",
  className,
}: {
  summary: React.ReactNode;
  right?: React.ReactNode;
  state?: "idle" | "thinking";
  className?: string;
}) {
  return (
    <div className={cn("flex items-start gap-3", className)}>
      {/* items-start + a two-line-tall slot: the avatar centres on the name+summary pair, not on however tall
          the summary wraps to on a phone */}
      <span className="flex h-[calc(var(--text-sm--line-height)+var(--text-xs--line-height)+2px)] shrink-0 items-center"><AgentAvatar size="md" state={state} /></span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">
          Woven agent
          {state === "thinking" ? <span className="font-normal text-muted-foreground">, working now</span> : null}
        </p>
        {/* the summary exists only here ("Trusted in 2 areas, handled 23 for you…") — at 390 truncate hid 112px of it.
            A fact with no fuller form one click away wraps; truncation is for a row title that opens the thing. */}
        <p className="mt-0.5 text-xs text-muted-foreground">{summary}</p>
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}

// The grouped-list header every Inbox tab groups with (settled 2026-09-12 by a blind panel; do not re-argue).
// It draws NO fill — no band, no pill, no border: a band ran straight into the tinted "about to earn" row and
// the two fused into one slab, and a tint-2 count pill on a tinted band said nothing a bare number does not.
// It is the page Section header one step denser: 13/500 full ink instead of 15/500, the same anchor (the
// label's first glyph on the list's leading edge, where the row hairlines start), the same no-fill.
//   count — a bare tabular number after the label; its ink says what it is: a DEMAND (the group waits on this
//           person — Approval, Proposals, Needs you) is full ink 500, an INVENTORY (how many exist — Running,
//           Done, an area's rule count) is muted 400. The Inbox is a decision queue, so demand is the default
//           and the inventory groups say so.
//   note  — a state phrase in the count's slot ("watching, about to earn"), 12/400 muted, parted from the
//           label by a vertical hairline. A header holds a number OR a phrase, never both.
//   lead  — an identity mark before the label (a collection's swatch); it takes the anchor, the label follows
//           at one gap.
// Air is 3:1 — 24px above (from the previous group's closing hairline, which the divider draws on this box's
// top edge) and 8px below to the first row's own hairline — so the label clings to its rows and the wide gap is
// the group boundary. The header draws no line of its own.
export function FeedHead({
  children,
  count,
  kind = "demand",
  note,
  lead,
}: {
  children: React.ReactNode;
  count?: React.ReactNode;
  kind?: "demand" | "inventory";
  note?: React.ReactNode;
  lead?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 px-3.5 pt-6 pb-2 text-sm font-medium text-foreground first:pt-1">
      {lead}
      <span className="min-w-0">{children}</span>
      {count !== undefined ? (
        <span className={cn("shrink-0 tabular-nums", kind === "demand" ? "font-medium text-foreground" : "font-normal text-muted-foreground")}>
          {count}
        </span>
      ) : note != null ? (
        <>
          <span aria-hidden="true" className="h-3 w-px shrink-0 bg-border" />
          <span className="min-w-0 truncate text-xs font-normal text-muted-foreground">{note}</span>
        </>
      ) : null}
    </div>
  );
}
// the inset row-divider now lives in controls (shared app-wide); re-exported so Inbox imports stay put
export { DIVIDED } from "./controls";
