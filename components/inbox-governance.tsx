"use client";

// Inbox · Governance = the agent's MEMORY of how you decide. ONE grammar throughout: a section is a header +
// one flat panel of hairline rows (no competing card idioms). Two groups: your MEMORY (written instructions +
// learned rules), then the quieter BASELINE floor (how far · what · when) your memory overrides. Risk stays
// CALM. Refero: ChatGPT memory + custom instructions; Wrike rule anatomy.

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
const POINT_ICON: Record<string, LucideIcon> = { on_capture: Download, on_source_change: RefreshCw, on_long_doc: FileText };

// ── shared grammar ────────────────────────────────────────────────────────────────────────────────────────
function SectionHead({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-2.5">
      <h3 className="text-[15px] font-medium">{title}</h3>
      {sub ? <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">{sub}</p> : null}
    </div>
  );
}
// one flat panel — every section's single container; rows inside are hairline-divided, never separate cards
function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("overflow-hidden rounded-xl border bg-card", className)}>{children}</div>;
}
function Caption({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("mb-1.5 text-[12px] font-medium text-muted-foreground", className)}>{children}</p>;
}
const rowCls = (first: boolean) => cn("flex items-center gap-3 px-4 py-3.5", !first && "border-t border-border/60");

// a lozenge glyph — leading every row so the panels share one visual anchor column
function Glyph({ icon: Icon, tint }: { icon: LucideIcon; tint?: boolean }) {
  return (
    <span
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-lg",
        tint ? "bg-primary/[0.1] text-primary" : "bg-foreground/[0.06] text-muted-foreground",
      )}
    >
      <Icon className="size-4" />
    </span>
  );
}

// a soft pill switch — forest when on
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

// the per-rule dial — Auto (auto-confirms matching arrivals) vs Suggest (pre-groups them but asks)
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

// ── memory · learned rules (one ROW per rule, inside one panel — not a stack of cards) ─────────────────────
function RuleRow({
  rule,
  collection,
  first,
  onMode,
  onRevoke,
  onResume,
}: {
  rule: LearnedRule;
  collection?: Collection;
  first: boolean;
  onMode: (m: "auto" | "suggest") => void;
  onRevoke: () => void;
  onResume: () => void;
}) {
  return (
    <div className={cn("px-4 py-3.5", !first && "border-t border-border/60")}>
      <div className="flex items-start gap-3">
        <Glyph icon={Sparkles} tint />
        <div className="min-w-0 flex-1">
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
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">
            Learned from {rule.confirmed} · handled{" "}
            <b className="font-medium text-foreground tabular-nums">{rule.autoConfirmed}</b>
            {rule.undone > 0 ? (
              <>
                {" "}· you undid <b className="font-medium text-foreground tabular-nums">{rule.undone}</b>
              </>
            ) : null}{" "}
            · {rule.createdAt}
          </p>
          {rule.paused ? (
            <div className="mt-2 flex items-center gap-2 rounded-lg bg-warn/10 px-2.5 py-1.5 text-[12.5px]">
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
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <ModeDial mode={rule.mode} onChange={onMode} />
          <button
            type="button"
            onClick={onRevoke}
            className="text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Revoke
          </button>
        </div>
      </div>
    </div>
  );
}

// ── memory · written instructions (rows + an add row, one panel) ───────────────────────────────────────────
function InstructionsPanel() {
  const instructions = listInstructions();
  const [draft, setDraft] = React.useState("");
  function add() {
    if (!draft.trim()) return;
    addInstruction(draft);
    setDraft("");
  }
  return (
    <Panel>
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
          onKeyDown={(e) => e.key === "Enter" && add()}
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
    </Panel>
  );
}

const PRESETS: { id: Autonomy; icon: LucideIcon; name: string; blurb: string; rec?: boolean }[] = [
  { id: "suggest_only", icon: Hand, name: "Suggest first", blurb: "Woven proposes; nothing enters your space until you approve it.", rec: true },
  { id: "auto_with_undo", icon: Zap, name: "Auto, with undo", blurb: "Woven handles the confident stuff and tells you — undo anytime." },
];

export function InboxGovernance() {
  useGraphVersion();
  const caps = listCapabilities();
  const points = listDecisionPoints();
  const autonomy = getAutonomy();
  const rules = listLearnedRules();
  const cols = listCollections();

  return (
    <div className="flex flex-col gap-9">
      {/* ── your memory ─────────────────────────────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-6">
        <section>
          <SectionHead title="What you've told Woven" sub="Standing rules you write — Woven follows these before anything it's learned." />
          <InstructionsPanel />
        </section>

        <section>
          <SectionHead title="What Woven has learned from you" sub="Shapes you've decided the same way enough times that Woven now handles them — tune the dial or revoke." />
          {rules.length ? (
            <Panel>
              {rules.map((r, i) => (
                <RuleRow
                  key={r.id}
                  rule={r}
                  collection={cols.find((c) => c.id === r.collectionId)}
                  first={i === 0}
                  onMode={(m) => setRuleMode(r.id, m)}
                  onRevoke={() => revokeRule(r.id)}
                  onResume={() => resumeRule(r.id)}
                />
              ))}
            </Panel>
          ) : (
            <div className="rounded-xl border border-dashed px-4 py-6 text-center">
              <p className="mx-auto max-w-sm text-[13px] leading-snug text-muted-foreground">
                Nothing yet. When you make the same call over and over in the Inbox, Woven offers to take it off
                your plate — the rules you accept show up here.
              </p>
            </div>
          )}
        </section>
      </div>

      {/* ── the baseline floor (one section · three sub-panels, same row grammar) ─────────────────────────── */}
      <section>
        <SectionHead title="The baseline" sub="How far Woven may go by default. Your instructions and learned rules above override this." />

        <Caption>How much it does on its own</Caption>
        <Panel>
          {PRESETS.map((p, i) => {
            const on = autonomy === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setAutonomy(p.id)}
                className={cn("flex w-full items-center gap-3 px-4 py-3 text-left transition-colors", i > 0 && "border-t border-border/60", on ? "bg-primary/[0.04]" : "hover:bg-foreground/[0.02]")}
              >
                <Glyph icon={p.icon} tint={on} />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-[14px] font-medium">
                    {p.name}
                    {p.rec ? (
                      <span className="rounded-[5px] bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">Recommended</span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 text-[12.5px] leading-snug text-muted-foreground">{p.blurb}</p>
                </div>
                <span
                  className={cn(
                    "flex size-[18px] shrink-0 items-center justify-center rounded-full border transition-colors",
                    on ? "border-primary bg-primary text-primary-foreground" : "border-foreground/25",
                  )}
                >
                  {on ? <Check className="size-3" /> : null}
                </span>
              </button>
            );
          })}
        </Panel>

        <Caption className="mt-5">What it may help with</Caption>
        <Panel>
          {caps.map((c, i) => {
            const Icon = CAP_ICON[c.id];
            return (
              <div key={c.id} className={rowCls(i === 0)}>
                <Glyph icon={Icon} />
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
        </Panel>

        <Caption className="mt-5">When it jumps in</Caption>
        <Panel>
          {points.map((p, i) => {
            const Icon = POINT_ICON[p.id] ?? Download;
            return (
              <div key={p.id} className={rowCls(i === 0)}>
                <Glyph icon={Icon} />
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-medium">{p.label}</p>
                  <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">{p.detail}</p>
                </div>
                <Switch on={p.enabled} onClick={() => toggleDecisionPoint(p.id)} label={p.label} />
              </div>
            );
          })}
        </Panel>
      </section>
    </div>
  );
}
