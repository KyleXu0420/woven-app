"use client";

// The shared agent-colleague header — ONE band atop every Inbox lens (Decisions · Activity · Governance) so the
// three read as one system. AgentAvatar + "Woven agent · always on" + a lens-specific summary line, with an
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
    <div className={cn("flex items-center gap-3", className)}>
      <AgentAvatar size="default" state={state} />
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-medium">
          Woven agent <span className="font-normal text-muted-foreground">· always on</span>
        </p>
        <p className="mt-0.5 truncate text-[12.5px] text-muted-foreground">{summary}</p>
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}

// the SHARED feed grammar every Inbox tab groups with — a subtle group-header BAR (Governance areas, Decisions
// types, Activity statuses) + a divider that hairlines a flat feed's children (headers + rows), no rule above the
// first. This is the "categorization system" the three tabs share; only the grouping AXIS differs per lens.
// the pill that holds a count — a real badge, not "· 4" tacked onto the label. Shared so every group header
// (Decisions types, Activity statuses, Governance areas) shows its number the same way.
export const BADGE_CLS =
  "inline-flex shrink-0 items-center justify-center rounded-full bg-foreground/[0.07] px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground";
export function FeedHead({ children, count }: { children: React.ReactNode; count?: number }) {
  return (
    <div className="flex items-center gap-2 bg-foreground/[0.02] px-3.5 py-2 text-[12px] font-medium text-muted-foreground">
      <span>{children}</span>
      {count !== undefined ? <span className={BADGE_CLS}>{count}</span> : null}
    </div>
  );
}
export const DIVIDED = "[&>*]:border-t [&>*]:border-border/50 [&>*:first-child]:border-t-0";
