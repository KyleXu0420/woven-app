"use client";

// The shared agent-colleague header — ONE band atop every Inbox lens (Decisions, Activity, Governance) so the
// three read as one system. AgentAvatar (its animation carries presence) + "Woven agent" — with a live ", working
// now" ONLY while it's actually weaving, never a constant "always on" — + a lens-specific summary line, with an
// optional right-side element (a status pill in Activity, a trust trajectory in Governance, nothing in Decisions).
// The three tabs group by their own natural axis (priority / colleague / area); this band + the row grammar +
// the cross-tab ties are what make them one surface.
//
// This byline is the ONE place a surface credits the agent (2026-10-02, the Granola borrow). The rows below
// carry the proposal, not the author: they lead with the mark of the KIND of thing they are about, never with
// the agent's seal. A seal on every row was a signature used as a bullet — four in one viewport on Decisions,
// one per autonomous run on Activity — and at 12px a forest coin reads as a confirm dot.

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

// The grouped-list header every Inbox tab (and the Team list) groups with: a LABEL ON A HAIRLINE. It was a
// tint-2 band (Kyle, 2026-09-12, after a bare label floated under the learn-prompt card), and at that value the
// band was the heaviest object on Inbox and Governance — five of seven blind judges (2026-10-02) read a stack
// of grey slabs, not a list, and fork 3 went to the label. So: no fill; 12/500 muted label; 24px of air above
// it (from the previous group's closing hairline), 8 below, then ONE hairline under it in line-edge. The rule
// under the label is what keeps it from floating — the old bare form's failure — and it is the first row's
// top line, so that row's own divider is switched off ([&+*]:before:hidden) rather than drawn a second time
// 1px lower. What the 09-12 panel settled and stays: the count is a bare tabular number, never a pill, its
// weight by kind (demand 500 full ink, inventory 400 muted); a state phrase may sit in the count's slot
// instead, parted by a vertical hairline; an identity swatch may lead the label.
// `flush`: a list whose rows sit on the column's own edges (the Team list) — the rule starts at 0, not at the
// inset row grammar's 12.
//
// The label starts where the rows' MARKS start. It sat on the rows' padding edge instead (374 on Inbox, 360 on
// the Team list) while every row under it hangs its 12px mark centred in a lead column (382 / 366), so the
// header and the marks it labels stood 6 to 8px apart on every surface: two edges where the list has one. The
// rows' lead column is 28px after the 14px inset (Activity, Governance, Decisions) and 24px on the column edge
// (Team list); a 12px mark centred in it starts 8px / 6px in, so a bare label is padded to exactly that. A
// label with a swatch puts the swatch IN that column, centred on the rows' marks, and the words then start on
// the rows' text edge (the dialog rule: a group's rows hang under its text, so its text is their edge).
export function FeedHead({
  children,
  count,
  kind = "demand",
  note,
  lead,
  flush = false,
}: {
  children: React.ReactNode;
  count?: React.ReactNode;
  kind?: "demand" | "inventory";
  note?: React.ReactNode;
  lead?: React.ReactNode;
  flush?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative flex items-center gap-2 pb-2 pt-6 text-xs font-medium text-muted-foreground",
        "after:pointer-events-none after:absolute after:bottom-0 after:h-px after:bg-line-edge [&+*]:before:hidden",
        flush ? "after:inset-x-0" : "pr-3.5 after:inset-x-3",
        lead != null ? (flush ? "" : "pl-3.5") : flush ? "pl-1.5" : "pl-5.5",
      )}
    >
      {/* the lead column, as wide as the rows' (w-7 inset, w-6 flush); mr-1 makes its gap the rows' 12 */}
      {lead != null ? <span className={cn("mr-1 flex shrink-0 justify-center", flush ? "w-6" : "w-7")}>{lead}</span> : null}
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

// A record's own words keep their words but never the middle dot: seed copy and names carry a spaced U+00B7
// ("Acme", dot, "Product"; "Parsed into 4 sections", dot, "proposed 3 links"; a role; an artifact title) and the
// house writes a comma. The data is line A's and stays as it is; the surfaces that print it say it this way.
export function undot(s: string): string {
  return s.replace(/\s\u00b7\s/g, ", ");
}
