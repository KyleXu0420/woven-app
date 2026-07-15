"use client";

// Inbox · Governance = the agent's MEMORY of how you decide. Memory leads, settings follow:
//   1. What you've told Woven — standing instructions you WRITE (ChatGPT custom-instructions half).
//   2. What Woven has learned from you — rich rule cards promoted from your Decisions: shape · a Suggest↔Auto
//      dial · a track record (handled N · you undid M) · the evidence · auto-pause-on-correction · revoke.
//   3. The baseline — how far / what / when: the quiet floor your learned rules layer on top of.
// Risk stays CALM (plain blurbs + a quiet Info note, never a red warning). Refero: ChatGPT memory · Wrike rules.

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
  Sparkles,
  Plus,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  addInstruction,
  getAutonomy,
  listCapabilities,
  listCollections,
  listDecisionPoints,
  listInstructions,
  listLearnedRules,
  removeInstruction,
  resumeRule,
  revokeRule,
  setAutonomy,
  setRuleMode,
  toggleCapability,
  toggleDecisionPoint,
} from "@/lib/api";
import { useGraphVersion } from "@/lib/use-graph-version";
import type { AgentCapabilityId, Autonomy, Collection, EdgeType, LearnedRule } from "@/lib/types";

// the rule sentence's verb — "Auto-confirms {links} in Q4 Roadmap"
const RULE_VERB: Record<EdgeType, string> = {
  links_to: "links",
  sourced_from: "sourcing",
  mentions: "mentions",
  in_collection: "filings",
  authored_by: "authorship",
  decided: "decisions",
  supersedes: "supersessions",
};

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
      className={cn("relative h-6 w-[42px] shrink-0 rounded-full transition-colors", on ? "bg-primary" : "bg-foreground/15")}
    >
      <span className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow-sm transition-all", on ? "left-[19px]" : "left-0.5")} />
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

// the per-rule dial: how hard the rule acts. Auto = auto-confirms matching arrivals; Suggest = pre-groups them
// for you but still asks. (The confidence floor stays internal — a shaky arrival is never auto-confirmed.)
function ModeDial({ mode, onChange }: { mode: "auto" | "suggest"; onChange: (m: "auto" | "suggest") => void }) {
  return (
    <div className="inline-flex shrink-0 items-center rounded-lg border p-0.5 text-[12px]">
      {(["suggest", "auto"] as const).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onChange(m)}
          aria-pressed={mode === m}
          className={cn(
            "rounded-md px-2.5 py-1 font-medium capitalize transition-colors",
            mode === m ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {m}
        </button>
      ))}
    </div>
  );
}

// one learned rule, as memory you can trust and tune: what it does + the dial + its track record + the evidence
// that formed it + an auto-pause if you've corrected it. This is the rich end of the Decisions→Governance loop.
function RuleCard({
  rule,
  collection,
  onMode,
  onRevoke,
  onResume,
}: {
  rule: LearnedRule;
  collection?: Collection;
  onMode: (m: "auto" | "suggest") => void;
  onRevoke: () => void;
  onResume: () => void;
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/[0.1] text-primary">
          <Sparkles className="size-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[14px] font-medium">
              <span>{rule.mode === "auto" ? "Auto-confirms" : "Pre-groups"} {RULE_VERB[rule.edgeType]} in</span>
              {collection ? (
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2.5 rounded-[3px]" style={{ background: collection.color }} />
                  {collection.name}
                </span>
              ) : (
                <span>a collection</span>
              )}
            </p>
            <ModeDial mode={rule.mode} onChange={onMode} />
          </div>

          <p className="mt-1 text-[13px] text-muted-foreground">
            Learned from {rule.confirmed} of your decisions · {rule.createdAt}
          </p>

          {/* track record — the feedback that lets you trust (or distrust) the rule */}
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Check className="size-3.5 text-primary" /> Handled{" "}
              <b className="font-medium text-foreground tabular-nums">{rule.autoConfirmed}</b>
            </span>
            {rule.undone > 0 ? (
              <span>
                You undid <b className="font-medium text-foreground tabular-nums">{rule.undone}</b>
              </span>
            ) : null}
          </div>

          {/* auto-pause after a correction — the rule stops until you review */}
          {rule.paused ? (
            <div className="mt-2.5 flex items-center gap-2 rounded-lg bg-warn/10 px-2.5 py-1.5 text-[12.5px]">
              <Info className="size-3.5 shrink-0 text-warn" />
              <span className="flex-1 text-muted-foreground">Paused — you corrected one; review before it resumes.</span>
              <button
                type="button"
                onClick={onResume}
                className="shrink-0 rounded-md px-2 py-0.5 font-medium text-foreground transition-colors hover:bg-foreground/[0.06]"
              >
                Resume
              </button>
            </div>
          ) : null}

          <div className="mt-2.5">
            <button
              type="button"
              onClick={onRevoke}
              className="text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Revoke
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// the WRITTEN half of the memory — standing rules you author. Add on Enter; each row removable.
function InstructionsSection() {
  const instructions = listInstructions();
  const [draft, setDraft] = React.useState("");
  function add() {
    if (!draft.trim()) return;
    addInstruction(draft);
    setDraft("");
  }
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      {instructions.map((ins, i) => (
        <div key={ins.id} className={cn("group/ins flex items-start gap-3 px-4 py-3", i > 0 && "border-t border-border/60")}>
          <PenLine className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <p className="min-w-0 flex-1 text-[13.5px] leading-snug">{ins.text}</p>
          <button
            type="button"
            onClick={() => removeInstruction(ins.id)}
            aria-label="Remove instruction"
            className="shrink-0 rounded-md p-1 text-muted-foreground/50 opacity-0 transition-opacity hover:bg-foreground/[0.06] hover:text-foreground group-hover/ins:opacity-100"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ))}
      <div className={cn("flex items-center gap-1.5 px-3 py-2", instructions.length && "border-t border-border/60")}>
        <PenLine className="size-4 shrink-0 text-muted-foreground/50" />
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") add();
          }}
          placeholder="Tell Woven a standing rule — e.g. “Always keep Growth links as proposals”"
          className="min-w-0 flex-1 bg-transparent px-1 py-1.5 text-[13.5px] outline-none placeholder:text-muted-foreground/70"
        />
        <button
          type="button"
          onClick={add}
          disabled={!draft.trim()}
          className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[13px] font-medium text-primary transition-colors hover:bg-primary/10 disabled:opacity-40"
        >
          <Plus className="size-3.5" /> Add
        </button>
      </div>
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
  const rules = listLearnedRules();
  const cols = listCollections();

  return (
    <div className="flex flex-col gap-8">
      {/* 1 — written memory: standing instructions you author */}
      <section>
        <Q title="What you've told Woven" sub="Standing rules you write — Woven follows these before anything it's learned." />
        <InstructionsSection />
      </section>

      {/* 2 — learned memory: rich rule cards promoted from your Decisions (the loop's other end) */}
      <section>
        <Q
          title="What Woven has learned from you"
          sub="Shapes you've decided the same way enough times that Woven now handles them — tune the dial or revoke anytime."
        />
        {rules.length ? (
          <div className="flex flex-col gap-2.5">
            {rules.map((r) => (
              <RuleCard
                key={r.id}
                rule={r}
                collection={cols.find((c) => c.id === r.collectionId)}
                onMode={(m) => setRuleMode(r.id, m)}
                onRevoke={() => revokeRule(r.id)}
                onResume={() => resumeRule(r.id)}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed px-4 py-6 text-center">
            <p className="mx-auto max-w-sm text-[13px] leading-snug text-muted-foreground">
              Nothing yet. When you make the same call over and over in the Inbox, Woven offers to take it off
              your plate — the rules you accept show up here.
            </p>
          </div>
        )}
      </section>

      {/* 3 — the baseline / floor: how far · what · when. Quieter; your memory above layers on top. */}
      <section>
        <Q title="The baseline" sub="How far Woven may go by default. Your instructions and learned rules above override this." />

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

        {/* what — capabilities */}
        <p className="mt-5 mb-2 text-[13px] font-medium text-muted-foreground">What should Woven help with?</p>
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

        {/* when — decision points */}
        <p className="mt-5 mb-2 text-[13px] font-medium text-muted-foreground">When should it jump in?</p>
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
