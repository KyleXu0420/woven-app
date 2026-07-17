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
