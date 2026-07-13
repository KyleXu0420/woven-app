"use client";

// Inbox · Governance — where the user sets how far the agent may act. A global autonomy floor, then a
// per-capability level (auto / suggest / off) each with a plain-language "what it does" + its risk, then the
// decision-points where it may intervene. Intercom's AI-settings pattern: a control paired with a legible
// description of the behaviour and its risk — the user is never left guessing what the agent will do.

import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { SegToggle } from "@/components/controls";
import {
  getAutonomy,
  listCapabilities,
  listDecisionPoints,
  setAutonomy,
  setCapabilityLevel,
  toggleDecisionPoint,
} from "@/lib/api";
import { useGraphVersion } from "@/lib/use-graph-version";
import type { AgentCapabilityId, Autonomy, InterventionLevel } from "@/lib/types";

const LEVELS: { id: string; label: string }[] = [
  { id: "auto", label: "Auto" },
  { id: "suggest", label: "Suggest" },
  { id: "off", label: "Off" },
];

function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onClick}
      className={cn("relative h-5 w-9 shrink-0 rounded-full transition-colors", on ? "bg-primary" : "bg-foreground/15")}
    >
      <span
        className={cn("absolute top-0.5 size-4 rounded-full bg-white shadow-sm transition-all", on ? "left-[18px]" : "left-0.5")}
      />
    </button>
  );
}

function Head({ children }: { children: React.ReactNode }) {
  return <h3 className="text-[14px] font-semibold text-foreground">{children}</h3>;
}

export function InboxGovernance() {
  useGraphVersion();
  const caps = listCapabilities();
  const points = listDecisionPoints();
  const autonomy = getAutonomy();

  return (
    <div className="flex flex-col gap-9">
      {/* the global floor */}
      <section>
        <Head>How far the agent may act</Head>
        <p className="mt-1 text-[13px] leading-snug text-muted-foreground">
          The floor for everything below. In{" "}
          <span className="font-medium text-foreground">suggest only</span>, nothing enters the graph as fact until
          you confirm it.
        </p>
        <div className="mt-3">
          <SegToggle
            value={autonomy}
            onChange={(v) => setAutonomy(v as Autonomy)}
            options={[
              { id: "suggest_only", label: "Suggest only" },
              { id: "auto_with_undo", label: "Auto, with undo" },
            ]}
          />
        </div>
      </section>

      {/* per-capability level + its plain-language behaviour and risk */}
      <section>
        <Head>What it may do</Head>
        <div className="mt-2 flex flex-col">
          {caps.map((c) => (
            <div key={c.id} className="flex items-start justify-between gap-5 border-t border-border/60 py-4 first:border-t-0">
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-medium">{c.name}</p>
                <p className="mt-1 text-[13px] leading-snug text-muted-foreground">{c.does}</p>
                <p className="mt-1.5 flex items-start gap-1.5 text-[12px] leading-snug" style={{ color: "var(--warn)" }}>
                  <AlertTriangle className="mt-px size-3 shrink-0" /> {c.risk}
                </p>
              </div>
              <div className="shrink-0 pt-0.5">
                <SegToggle
                  value={c.level}
                  onChange={(v) => setCapabilityLevel(c.id as AgentCapabilityId, v as InterventionLevel)}
                  options={LEVELS}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* the moments it may intervene */}
      <section>
        <Head>When it may act</Head>
        <div className="mt-2 flex flex-col">
          {points.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-5 border-t border-border/60 py-3.5 first:border-t-0">
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-medium">{p.label}</p>
                <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">{p.detail}</p>
              </div>
              <Toggle on={p.enabled} onClick={() => toggleDecisionPoint(p.id)} label={p.label} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
