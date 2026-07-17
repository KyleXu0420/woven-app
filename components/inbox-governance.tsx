"use client";

// Inbox · Governance = the TRUST LEDGER. The agent is a colleague you delegate to; you delegate RESPONSIBILITIES
// (capability × area), each earned from your decisions or granted by you, each with a trust state on ONE ladder
// (Watching → Trusted → Held back) that is mostly a CONSEQUENCE of your decisions.
//
// Layout doctrine (this file's whole point): ONE packaged surface, not a stack of sprawling bars. The ledger is a
// single card of GROUPED rows (area group-header + hairline item rows); every row is one tight, vertically-centred
// line — glyph · name · one meta line · ONE control (a single state select that also carries Revoke). No floating
// headers, no ragged control stacks, no per-row cards. The quieter "floor" (global gates + defaults) sits below.
// Refero: Linear grouped lists · settings row-groups; the Vercel "teaching agents product design" judgment loop.

import * as React from "react";
import {
  Link2,
  FolderInput,
  AtSign,
  FileSearch,
  PenLine,
  ShieldCheck,
  RefreshCw,
  Download,
  FileText,
  Eye,
  Plus,
  ChevronDown,
  Info,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  grantResponsibility,
  ledgerRollup,
  listCapabilities,
  listCollections,
  listDecisionPoints,
  listPromotable,
  listResponsibilitiesByArea,
  pauseRule,
  resumeRule,
  revokeRule,
  ruleTrust,
  RULE_CAPABILITY,
  setRuleMode,
  sourceDecisionsForRule,
  toggleCapability,
  toggleDecisionPoint,
  trustTrajectory,
  type LedgerRollup,
  type PromotableRule,
  type TrustState,
  type WeeklyTrust,
} from "@/lib/api";
import { useGraphVersion } from "@/lib/use-graph-version";
import { AgentBand as AgentColleagueBand, DIVIDED, FeedHead } from "@/components/inbox-agent-band";
import { PeekTrigger } from "@/components/entity-peek";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import Link from "next/link";
import type { AgentCapabilityId, Collection, EdgeType, LearnedRule } from "@/lib/types";

// a capability = the "what" of a responsibility. Label shared with Activity's run ties (one loop, one vocabulary).
const CAP_LABEL = RULE_CAPABILITY;
const CAP_ICON: Record<EdgeType, LucideIcon> = {
  links_to: Link2,
  in_collection: FolderInput,
  mentions: AtSign,
  sourced_from: FileSearch,
  authored_by: PenLine,
  decided: ShieldCheck,
  supersedes: RefreshCw,
};
const GRANTABLE: EdgeType[] = ["links_to", "in_collection", "mentions", "sourced_from"];
const GATE_ICON: Record<AgentCapabilityId, LucideIcon> = { link: Link2, file: FolderInput, draft: PenLine, verify: ShieldCheck };
const POINT_ICON: Record<string, LucideIcon> = { on_capture: Download, on_source_change: RefreshCw, on_long_doc: FileText };

// one tight, vertically-centred row — the single grammar every list in this file uses
const ROW = "flex items-center gap-3 px-3.5 py-2.5";

// ── shared primitives ───────────────────────────────────────────────────────────────────────────────────────
// (SectionHead / Panel / Caption removed — the tab is a flat grouped feed now, no card chrome, matching Decisions.)
// the shared leading glyph column — neutral, so the ONE coloured thing per row is the state control
function Glyph({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-foreground/[0.05] text-muted-foreground">
      <Icon className="size-3.5" />
    </span>
  );
}
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
// a bare compact select (grant composer) — native, so no popover machinery
function MiniSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <div className="relative inline-flex items-center">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 appearance-none rounded-md border bg-transparent pl-2.5 pr-6 text-[13px] font-medium outline-none transition-colors hover:border-foreground/30 focus:border-primary"
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-1.5 size-3.5 text-muted-foreground" />
    </div>
  );
}

// ── the one control per responsibility row: trust state + Revoke, packaged into a single coloured select ──────
function setTrust(rule: LearnedRule, next: TrustState) {
  if (next === "held_back") {
    pauseRule(rule.id, 0); // manual hold — no correction counted
    return;
  }
  resumeRule(rule.id); // no-op if not held
  setRuleMode(rule.id, next === "trusted" ? "auto" : "suggest");
}
function StateSelect({ rule }: { rule: LearnedRule }) {
  const trust = ruleTrust(rule);
  const tone =
    trust === "trusted"
      ? "border-primary/30 bg-primary/[0.06] text-primary"
      : trust === "held_back"
        ? "border-warn/30 bg-warn/[0.06] text-warn"
        : "border-border text-muted-foreground";
  return (
    <div className="relative inline-flex shrink-0 items-center">
      <select
        aria-label="Trust level"
        title={LEVEL_MEANING[trust]}
        value={trust}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "__revoke") revokeRule(rule.id);
          else setTrust(rule, v as TrustState);
        }}
        className={cn("h-7 appearance-none rounded-md border pl-2.5 pr-6 text-[12px] font-medium outline-none transition-colors", tone)}
      >
        <option value="watching">Watching</option>
        <option value="trusted">Trusted</option>
        <option value="held_back">Held back</option>
        <option value="__revoke">Revoke</option>
      </select>
      <ChevronDown className="pointer-events-none absolute right-1.5 size-3.5 opacity-60" />
    </div>
  );
}

// ── ledger rows ───────────────────────────────────────────────────────────────────────────────────────────--
// the loop, made clickable — "From your Decisions" opens the confirms that TAUGHT this rule, each linking to the
// artifact the call was made on. Turns the earned-trust claim into inspectable provenance (the show-your-work).
function SourceDecisionsPeek({ rule }: { rule: LearnedRule }) {
  const sources = sourceDecisionsForRule(rule.id);
  if (!sources.length) return <>From your Decisions</>;
  return (
    <Popover>
      <PopoverTrigger className="rounded-sm font-medium text-foreground/75 underline decoration-dotted decoration-muted-foreground/50 underline-offset-2 outline-none transition-colors hover:text-foreground focus-visible:text-foreground">
        From your Decisions
      </PopoverTrigger>
      <PopoverContent side="top" align="start" sideOffset={8} className="w-80">
        <div className="flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground">
          <Sparkles className="size-3.5 text-primary" /> Learned from {sources.length} of your decisions
        </div>
        <div className="mt-2 flex flex-col gap-0.5">
          {sources.map((s) => (
            <Link
              key={s.id}
              href={`/artifact/${s.artifactId}`}
              className="flex items-baseline gap-2 rounded-md px-1.5 py-1 text-[13px] leading-snug transition-colors hover:bg-foreground/[0.05]"
            >
              <span className="min-w-0 flex-1">
                <span className="font-medium text-foreground">{s.artifactTitle}</span> <span className="text-muted-foreground">{s.line}</span>
              </span>
              <span className="shrink-0 text-[12px] tabular-nums text-muted-foreground">{s.at}</span>
            </Link>
          ))}
        </div>
        <p className="mt-2 border-t pt-2 text-[12px] leading-snug text-muted-foreground">
          You confirmed each of these — so Woven now handles this shape and just tells you.
        </p>
      </PopoverContent>
    </Popover>
  );
}
function RuleRow({ rule }: { rule: LearnedRule }) {
  const earned = rule.origin === "earned";
  const trust = ruleTrust(rule);
  const tail: string[] = [];
  if (earned) tail.push(`learned from ${rule.confirmed}`);
  if (rule.autoConfirmed > 0) tail.push(`handled ${rule.autoConfirmed}`);
  if (rule.undone > 0) tail.push(`you undid ${rule.undone}`);
  tail.push(rule.createdAt);
  if (trust === "held_back" && rule.undone > 0) tail.push("held after a correction");
  return (
    <div className={ROW}>
      <Glyph icon={CAP_ICON[rule.edgeType]} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] font-medium">{CAP_LABEL[rule.edgeType]}</p>
        <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
          {earned ? <SourceDecisionsPeek rule={rule} /> : "Granted by you"} · {tail.join(" · ")}
        </p>
      </div>
      <StateSelect rule={rule} />
    </div>
  );
}
// a shape you're about to earn — a light row in its area group, no control (you take it in Decisions)
function EarningRow({ p }: { p: PromotableRule }) {
  return (
    <div className={cn(ROW, "bg-primary/[0.02]")}>
      <Glyph icon={CAP_ICON[p.edgeType]} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] font-medium">
          {CAP_LABEL[p.edgeType]} <span className="font-normal text-muted-foreground">· about to earn</span>
        </p>
        <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
          Confirmed {p.confirmed}× and never rejected — take it in Decisions.
        </p>
      </div>
    </div>
  );
}
// an area group-header, INSIDE the card (packages the area + its rows into one unit — no floating header)
function GroupHeader({ collection, meta }: { collection: Collection; meta?: string }) {
  return (
    <div className="flex items-center gap-2 bg-foreground/[0.02] px-3.5 py-2">
      <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: collection.color }} />
      <PeekTrigger refObj={{ id: collection.id, label: collection.name, kind: "collection" }} className="text-[12.5px] font-medium" />
      {meta ? <span className="truncate text-[11.5px] text-muted-foreground">· {meta}</span> : null}
    </div>
  );
}
function WatchingRow({ cols }: { cols: Collection[] }) {
  return (
    <div className="flex items-center gap-2 px-3.5 py-2.5 text-[12px] text-muted-foreground">
      <Eye className="size-3.5 shrink-0" />
      <span className="truncate">Watching everywhere else — {cols.map((c) => c.name).join(", ")} — nothing delegated yet.</span>
    </div>
  );
}
// the structured successor to the free-text box — grant a responsibility by hand, as the ledger's last row
function GrantRow({ cols }: { cols: Collection[] }) {
  const [open, setOpen] = React.useState(false);
  const [edgeType, setEdge] = React.useState<EdgeType>("links_to");
  const [colId, setColId] = React.useState(cols[0]?.id ?? "");
  const [posture, setPosture] = React.useState<"watching" | "trusted">("watching");
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(ROW, "w-full text-left text-[13px] font-medium text-muted-foreground transition-colors hover:bg-foreground/[0.02] hover:text-foreground")}
      >
        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-foreground/[0.04] text-muted-foreground">
          <Plus className="size-4" />
        </span>
        Grant a responsibility
      </button>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2 px-3.5 py-3 text-[13px]">
      <span className="text-muted-foreground">Let Woven</span>
      <MiniSelect value={edgeType} onChange={(v) => setEdge(v as EdgeType)} options={GRANTABLE.map((e) => [e, CAP_LABEL[e]])} />
      <span className="text-muted-foreground">in</span>
      <MiniSelect value={colId} onChange={setColId} options={cols.map((c) => [c.id, c.name])} />
      <div className="inline-flex items-center rounded-md border p-0.5">
        {(["watching", "trusted"] as const).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPosture(p)}
            aria-pressed={posture === p}
            className={cn(
              "rounded px-2 py-0.5 text-[12px] font-medium transition-colors",
              posture === p ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {p === "watching" ? "Watch first" : "Trust now"}
          </button>
        ))}
      </div>
      <div className="ml-auto flex items-center gap-1">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md px-2 py-1 text-[12.5px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => {
            if (!colId) return;
            grantResponsibility(edgeType, colId, posture);
            setOpen(false);
            setPosture("watching");
          }}
          className="rounded-md bg-primary px-2.5 py-1 text-[12.5px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          Grant
        </button>
      </div>
    </div>
  );
}

// what each trust level concretely GRANTS. The settings-design convention (Kitchen.co role read-out, Doppler
// permission cells): a level control must SAY, in plain language, what it lets the agent do. Uniform across areas,
// so stated once — as the active tab's caption, and as a tooltip on the control + tabs.
const LEVEL_MEANING: Record<TrustState, string> = {
  trusted: "Woven does these itself and tells you — undo anytime.",
  watching: "Woven proposes these; you approve each. It's still earning your trust here.",
  held_back: "Paused after a correction. Woven won't act on these until you resume it.",
};
function Sparkline({ traj, onHover }: { traj: WeeklyTrust[]; onHover: (w: WeeklyTrust | null) => void }) {
  const W = 200;
  const H = 44;
  const pad = 6;
  const maxV = Math.max(...traj.map((t) => t.handled), 1);
  const pts = traj.map((t, i) => ({
    x: pad + (i * (W - 2 * pad)) / Math.max(traj.length - 1, 1),
    y: H - 4 - (t.handled / maxV) * (H - 12),
    t,
  }));
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1];
  const area = `${line} L${last.x.toFixed(1)},${H} L${pts[0].x.toFixed(1)},${H} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-9 w-full" onMouseLeave={() => onHover(null)}>
      <path d={area} className="fill-primary/10" />
      <path d={line} className="fill-none stroke-primary" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={7} className="cursor-pointer fill-transparent" onMouseEnter={() => onHover(p.t)} />
      ))}
      <circle cx={last.x} cy={last.y} r={2.5} className="pointer-events-none fill-primary" />
    </svg>
  );
}
// the tab's agent header = the SHARED AgentBand (identical to Decisions / Activity). Summary = the standing
// delegation (trusted in N areas · handled X · corrected Y); the earned-trust trajectory rides on the right and
// swaps the summary to the hovered week.
function AgentBand({ roll }: { roll: LedgerRollup }) {
  const traj = trustTrajectory();
  const [hover, setHover] = React.useState<WeeklyTrust | null>(null);
  const handled = traj.reduce((s, t) => s + t.handled, 0);
  const corrected = traj.reduce((s, t) => s + t.corrected, 0);
  const summary = [
    `Trusted in ${roll.areas} ${roll.areas === 1 ? "area" : "areas"}`,
    `handled ${handled} for you`,
    corrected ? `you corrected ${corrected}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <AgentColleagueBand
      className="pb-4"
      summary={hover ? `${hover.week} · handled ${hover.handled}` : summary}
      right={
        <div className="flex w-[116px] items-center">
          <Sparkline traj={traj} onHover={setHover} />
        </div>
      }
    />
  );
}


// ── the floor — global gates + defaults BENEATH your per-area delegations. Flat feed rows (no card), same grammar
// as the ledger above, so the whole tab reads as ONE surface rather than a settings page bolted under a feed. ─────
function FloorSection() {
  const caps = listCapabilities();
  const points = listDecisionPoints();
  return (
    <div className={cn(DIVIDED, "mt-8 border-t border-border/60")}>
      <FeedHead>The floor · what Woven may attempt on its own</FeedHead>
      {caps.map((c) => (
        <div key={c.id} className={ROW}>
          <Glyph icon={GATE_ICON[c.id]} />
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] font-medium">{c.name}</p>
            <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">
              {c.blurb}
              {c.note ? ` · ${c.note}` : ""}
            </p>
          </div>
          <Switch on={c.enabled} onClick={() => toggleCapability(c.id)} label={c.name} />
        </div>
      ))}
      <div className="flex items-start gap-3 px-3.5 py-2.5">
        <Glyph icon={Info} />
        <p className="flex-1 text-[12px] leading-snug text-muted-foreground">
          New areas start at <span className="font-medium text-foreground">Watching</span> — trust is earned, not assumed.
          Even where it's trusted, Woven never auto-confirms a call it's unsure about; those come to you.
        </p>
      </div>
      <FeedHead>When it steps in</FeedHead>
      {points.map((p) => (
        <div key={p.id} className={ROW}>
          <Glyph icon={POINT_ICON[p.id] ?? Download} />
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] font-medium">{p.label}</p>
            <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">{p.detail}</p>
          </div>
          <Switch on={p.enabled} onClick={() => toggleDecisionPoint(p.id)} label={p.label} />
        </div>
      ))}
    </div>
  );
}

function healthLabel(h: { trusted: number; watching: number; held_back: number }): string {
  const parts: string[] = [];
  if (h.trusted) parts.push(`${h.trusted} trusted`);
  if (h.watching) parts.push(`${h.watching} watching`);
  if (h.held_back) parts.push(`${h.held_back} held back`);
  return parts.join(" · ");
}

export function InboxGovernance() {
  useGraphVersion();
  const { areas, watching } = listResponsibilitiesByArea();
  const roll = ledgerRollup();
  const cols = listCollections();
  const promoByCol = new Map(listPromotable().map((p) => [p.collectionId, p]));
  const trulyWatching = watching.filter((c) => !promoByCol.has(c.id));
  const earningAreas = watching.filter((c) => promoByCol.has(c.id));

  // ONE flat grouped feed (no card) — the same shape as the Decisions/Activity tabs: area group-headers + hairline
  // rows. State shows per row (self-explaining control); there are no sub-tabs. Earning shapes + grant close it out.
  const rows: React.ReactNode[] = [];
  for (const a of areas) {
    rows.push(<GroupHeader key={`h-${a.collection.id}`} collection={a.collection} meta={healthLabel(a.health)} />);
    for (const r of a.rules) rows.push(<RuleRow key={r.id} rule={r} />);
    const promo = promoByCol.get(a.collection.id);
    if (promo) rows.push(<EarningRow key={`e-${a.collection.id}`} p={promo} />);
  }
  for (const c of earningAreas) {
    rows.push(<GroupHeader key={`h-${c.id}`} collection={c} meta="watching · 1 about to earn" />);
    rows.push(<EarningRow key={`e-${c.id}`} p={promoByCol.get(c.id)!} />);
  }
  if (trulyWatching.length) rows.push(<WatchingRow key="watching-else" cols={trulyWatching} />);
  rows.push(<GrantRow key="grant" cols={cols} />);

  // agent-colleague header (same as Activity), then the flat grouped feed, then the floor — one continuous surface.
  return (
    <div className="flex flex-col">
      <AgentBand roll={roll} />
      <div className={cn(DIVIDED, "border-t border-border/60")}>{rows}</div>
      <FloorSection />
    </div>
  );
}
