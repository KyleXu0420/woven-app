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

// The grouped-list header every Inbox tab groups with. A blind panel (2026-09-12) picked the bare form — no
// band, 13/500 full ink — and Kyle put the band back the same day: on the Decisions tab, under the learn-prompt
// card, a bare label floated between the card and its rows. So the header is a BAND again, at one value
// everywhere (tint-2; Governance used to run tint-1 and the Inbox tint-2 — one grammar, one fill). What the
// panel settled and stays: the count is a bare tabular number, never a pill (a tint-2 pill on a tint-2 band
// measured 1.05:1 — it was invisible and only left a 24px indent), its weight by kind (demand 500, inventory
// 400); a state phrase may sit in the count's slot instead, parted by a vertical hairline; an identity swatch
// may lead the label; and a washed row keeps its own inset box so it can never fuse with the band above it.
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
    <div className="flex items-center gap-2 bg-tint-2 px-3.5 py-2 text-xs font-medium text-muted-foreground">
      {lead}
      <span className="min-w-0">{children}</span>
      {count !== undefined ? (
        <span className={cn("shrink-0 tabular-nums", kind === "demand" ? "font-medium text-foreground" : "font-normal")}>{count}</span>
      ) : note != null ? (
        <>
          <span aria-hidden="true" className="h-3 w-px shrink-0 bg-border" />
          <span className="min-w-0 truncate font-normal">{note}</span>
        </>
      ) : null}
    </div>
  );
}
// the inset row-divider now lives in controls (shared app-wide); re-exported so Inbox imports stay put
export { DIVIDED } from "./controls";
