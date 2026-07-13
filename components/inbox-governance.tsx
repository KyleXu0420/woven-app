"use client";

// Inbox · Governance — set how much Woven does on its own, in plain language. Three friendly questions: how
// far it may go (two preset cards), what it should help with (icon cards + a simple on/off switch — the global
// preset decides auto-vs-ask-first, so each area is just yes/no), and when it may jump in. Risk is disclosed
// but CALM: folded into the plain blurb + a quiet note, never a red warning. (Refero: Clearful/Luma settings.)

import * as React from "react";
import {
  Hand,
  Zap,
  Link2,
  FolderInput,
  PenLine,
  ShieldCheck,
  Download,
  RefreshCw,
  FileText,
  Check,
  Info,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getAutonomy,
  listCapabilities,
  listDecisionPoints,
  setAutonomy,
  toggleCapability,
  toggleDecisionPoint,
} from "@/lib/api";
import { useGraphVersion } from "@/lib/use-graph-version";
import type { AgentCapabilityId, Autonomy } from "@/lib/types";

const CAP_ICON: Record<AgentCapabilityId, LucideIcon> = {
  link: Link2,
  file: FolderInput,
  draft: PenLine,
  verify: ShieldCheck,
};
const POINT_ICON: Record<string, LucideIcon> = {
  on_capture: Download,
  on_source_change: RefreshCw,
  on_long_doc: FileText,
};

// a soft pill switch — forest when on (the app's one accent, in its "yes, do this" sense), neutral when off
function Switch({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "relative h-6 w-[42px] shrink-0 rounded-full transition-colors",
        on ? "bg-primary" : "bg-foreground/15",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 size-5 rounded-full bg-white shadow-sm transition-all",
          on ? "left-[19px]" : "left-0.5",
        )}
      />
    </button>
  );
}

function Q({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="mb-3">
      <h3 className="text-[16px] font-medium">{title}</h3>
      <p className="mt-0.5 text-[13px] text-muted-foreground">{sub}</p>
    </div>
  );
}

const PRESETS: { id: Autonomy; icon: LucideIcon; name: string; blurb: string; rec?: boolean }[] = [
  {
    id: "suggest_only",
    icon: Hand,
    name: "Suggest first",
    blurb: "Woven proposes; nothing enters your space until you approve it.",
    rec: true,
  },
  {
    id: "auto_with_undo",
    icon: Zap,
    name: "Auto, with undo",
    blurb: "Woven handles the confident stuff and tells you — undo anytime.",
  },
];

export function InboxGovernance() {
  useGraphVersion();
  const caps = listCapabilities();
  const points = listDecisionPoints();
  const autonomy = getAutonomy();

  return (
    <div className="flex flex-col gap-8">
      {/* how far — two preset cards */}
      <section>
        <Q title="How much should Woven do on its own?" sub="This sets the floor for everything below." />
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {PRESETS.map((p) => {
            const on = autonomy === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setAutonomy(p.id)}
                className={cn(
                  "relative rounded-xl border p-3.5 text-left transition-colors",
                  on ? "border-primary bg-primary/[0.05]" : "border-border hover:bg-foreground/[0.02]",
                )}
              >
                {on ? (
                  <span className="absolute top-3 right-3 flex size-[18px] items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="size-3" />
                  </span>
                ) : null}
                <span
                  className={cn(
                    "flex size-8 items-center justify-center rounded-lg",
                    on ? "bg-primary/15 text-primary" : "bg-foreground/[0.06] text-muted-foreground",
                  )}
                >
                  <p.icon className="size-4" />
                </span>
                <p className="mt-2.5 flex flex-wrap items-center gap-2 text-[14px] font-medium">
                  {p.name}
                  {p.rec ? (
                    <span className="rounded-[5px] bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary">
                      Recommended
                    </span>
                  ) : null}
                </p>
                <p className="mt-1 text-[13px] leading-snug text-muted-foreground">{p.blurb}</p>
              </button>
            );
          })}
        </div>
      </section>

      {/* what — capability cards with a simple on/off switch */}
      <section>
        <Q title="What should Woven help with?" sub="Turn on the areas you want a hand with." />
        <div className="overflow-hidden rounded-xl border bg-card">
          {caps.map((c, i) => {
            const Icon = CAP_ICON[c.id];
            return (
              <div key={c.id} className={cn("flex items-center gap-3 px-4 py-3.5", i > 0 && "border-t border-border/60")}>
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-foreground/[0.06] text-muted-foreground">
                  <Icon className="size-[18px]" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-medium">{c.name}</p>
                  <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">{c.blurb}</p>
                  {c.note ? (
                    <p className="mt-1 flex items-center gap-1.5 text-[12px] text-muted-foreground/80">
                      <Info className="size-3 shrink-0" /> {c.note}
                    </p>
                  ) : null}
                </div>
                <Switch on={c.enabled} onClick={() => toggleCapability(c.id)} label={c.name} />
              </div>
            );
          })}
        </div>
      </section>

      {/* when — decision-point switches */}
      <section>
        <Q title="When should it jump in?" sub="The moments Woven gets to work." />
        <div className="overflow-hidden rounded-xl border bg-card">
          {points.map((p, i) => {
            const Icon = POINT_ICON[p.id] ?? Download;
            return (
              <div key={p.id} className={cn("flex items-center gap-3 px-4 py-3.5", i > 0 && "border-t border-border/60")}>
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-foreground/[0.06] text-muted-foreground">
                  <Icon className="size-[18px]" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-medium">{p.label}</p>
                  <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">{p.detail}</p>
                </div>
                <Switch on={p.enabled} onClick={() => toggleDecisionPoint(p.id)} label={p.label} />
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
