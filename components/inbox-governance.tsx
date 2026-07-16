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
  setRuleMode,
  toggleCapability,
  toggleDecisionPoint,
  trustTrajectory,
  type LedgerRollup,
  type PromotableRule,
  type TrustState,
  type WeeklyTrust,
} from "@/lib/api";
import { useGraphVersion } from "@/lib/use-graph-version";
import type { AgentCapabilityId, Collection, EdgeType, LearnedRule } from "@/lib/types";

// a capability = the "what" of a responsibility. Human label + glyph per relation type.
const CAP_LABEL: Record<EdgeType, string> = {
  links_to: "Connect related docs",
  in_collection: "File into this area",
  mentions: "Note who's mentioned",
  sourced_from: "Trace sources",
  authored_by: "Attribute authorship",
  decided: "Log decisions",
  supersedes: "Track supersessions",
};
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
// hairline-divide siblings, no rule above the first — lets a whole group live in ONE card without per-row borders
const DIVIDED = "[&>*]:border-t [&>*]:border-border/50 [&>*:first-child]:border-t-0";

// ── shared primitives ───────────────────────────────────────────────────────────────────────────────────────
function SectionHead({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-2.5">
      <h3 className="text-[15px] font-medium">{title}</h3>
      {sub ? <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">{sub}</p> : null}
    </div>
  );
}
function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("overflow-hidden rounded-xl border bg-card", className)}>{children}</div>;
}
function Caption({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("mb-1.5 text-[12px] font-medium text-muted-foreground", className)}>{children}</p>;
}
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
function RuleRow({ rule }: { rule: LearnedRule }) {
  const earned = rule.origin === "earned";
  const trust = ruleTrust(rule);
  const meta: string[] = [earned ? `Earned · from ${rule.confirmed} of your calls` : "Granted by you"];
  if (rule.autoConfirmed > 0) meta.push(`handled ${rule.autoConfirmed}`);
  if (rule.undone > 0) meta.push(`you undid ${rule.undone}`);
  meta.push(rule.createdAt);
  if (trust === "held_back" && rule.undone > 0) meta.push("held after a correction");
  return (
    <div className={ROW}>
      <Glyph icon={CAP_ICON[rule.edgeType]} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] font-medium">{CAP_LABEL[rule.edgeType]}</p>
        <p className="mt-0.5 truncate text-[12px] text-muted-foreground">{meta.join(" · ")}</p>
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
      <span className="text-[12.5px] font-medium">{collection.name}</span>
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

// the delegation panel — the state of the delegation as a small dataviz, and the ledger's control surface:
//   hero throughput + reliability · an earned-trust TRAJECTORY (handled climbs, corrections stay flat) · a
//   composition bar you CLICK to filter the ledger below (brush-and-link). Depth via hover/click, not more chrome.
const STATE_META: { k: TrustState; label: string; dot: string; seg: string }[] = [
  { k: "trusted", label: "Trusted", dot: "bg-primary", seg: "bg-primary" },
  { k: "watching", label: "Watching", dot: "bg-foreground/35", seg: "bg-foreground/25" },
  { k: "held_back", label: "Held back", dot: "bg-warn", seg: "bg-warn" },
];
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
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-11 w-full" onMouseLeave={() => onHover(null)}>
      <path d={area} className="fill-primary/10" />
      <path d={line} className="fill-none stroke-primary" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={7} className="cursor-pointer fill-transparent" onMouseEnter={() => onHover(p.t)} />
      ))}
      <circle cx={last.x} cy={last.y} r={2.5} className="pointer-events-none fill-primary" />
    </svg>
  );
}
function DelegationPanel({ roll }: { roll: LedgerRollup }) {
  const traj = trustTrajectory();
  const [hover, setHover] = React.useState<WeeklyTrust | null>(null);
  const handled = traj.reduce((s, t) => s + t.handled, 0);
  const corrected = traj.reduce((s, t) => s + t.corrected, 0);
  const stuck = handled > 0 ? Math.round((1 - corrected / handled) * 100) : 100;
  const total = roll.trusted + roll.watching + roll.held_back || 1;
  const count = (k: TrustState) => (k === "trusted" ? roll.trusted : k === "watching" ? roll.watching : roll.held_back);
  return (
    <div className="mb-3 rounded-xl border bg-card px-4 py-3.5">
      <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-3">
        {/* hero — throughput + reliability */}
        <div>
          <p className="flex items-baseline gap-1.5">
            <span className="text-[26px] font-semibold leading-none tabular-nums">{handled}</span>
            <span className="text-[13px] text-muted-foreground">handled for you</span>
          </p>
          <p className="mt-1.5 text-[12.5px] text-muted-foreground">
            {corrected} correction{corrected === 1 ? "" : "s"} · <span className="font-medium text-primary">~{stuck}% stuck</span> — trust is holding
          </p>
        </div>
        {/* trajectory — trust is earned over time */}
        <div className="min-w-[188px] flex-1">
          <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{hover ? hover.week : "Handled / week · last 8"}</span>
            <span className="font-medium text-primary">{hover ? `handled ${hover.handled}` : "▲ trending up"}</span>
          </div>
          <Sparkline traj={traj} onHover={setHover} />
        </div>
      </div>

      {/* composition — a static proportion glance. The LABELLED breakdown + filtering live in the ledger's tabs,
          because that selection acts on the list below and should take a tab's form, not a legend pill's. */}
      <div className="mt-3 flex h-2 gap-px overflow-hidden rounded-full bg-foreground/[0.06]">
        {STATE_META.map((s) =>
          count(s.k) > 0 ? (
            <span
              key={s.k}
              className={s.seg}
              style={{ width: `${(count(s.k) / total) * 100}%` }}
              title={`${s.label} · ${count(s.k)}`}
            />
          ) : null,
        )}
      </div>
    </div>
  );
}

// the ledger's tab selector — the state selection, given its PROPER form: tabs that sit on and segment the list
// below them (All / by trust state, with counts). Replaces the legend-looking pills that acted like tabs.
function LedgerTabs({ roll, filter, onFilter }: { roll: LedgerRollup; filter: TrustState | null; onFilter: (s: TrustState | null) => void }) {
  const tabs: { k: TrustState | null; label: string; n?: number; dot?: string }[] = [
    { k: null, label: "All" },
    { k: "trusted", label: "Trusted", n: roll.trusted, dot: "bg-primary" },
    { k: "watching", label: "Watching", n: roll.watching, dot: "bg-foreground/35" },
    { k: "held_back", label: "Held back", n: roll.held_back, dot: "bg-warn" },
  ];
  return (
    <div className="flex items-center gap-1 border-b bg-foreground/[0.015] px-2 py-1.5">
      {tabs.map((t) => {
        const active = filter === t.k;
        const disabled = t.k !== null && t.n === 0;
        return (
          <button
            key={t.label}
            type="button"
            disabled={disabled}
            title={t.k ? LEVEL_MEANING[t.k] : undefined}
            onClick={() => onFilter(t.k)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12.5px] font-medium transition-colors disabled:opacity-40",
              active ? "bg-secondary text-foreground" : "text-muted-foreground enabled:hover:bg-foreground/[0.04] enabled:hover:text-foreground",
            )}
          >
            {t.dot ? <span className={cn("size-2 rounded-[3px]", t.dot)} /> : null}
            {t.label}
            {t.n !== undefined ? <span className="tabular-nums text-muted-foreground">{t.n}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

// ── the floor — the global gates + defaults BENEATH your per-area delegations ────────────────────────────────
function FloorSection() {
  const caps = listCapabilities();
  const points = listDecisionPoints();
  return (
    <section>
      <SectionHead title="The floor" sub="Below your delegations — the limits and defaults every area inherits." />

      <Caption>What Woven may attempt on its own</Caption>
      <Panel>
        <div className={DIVIDED}>
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
        </div>
      </Panel>
      <p className="mt-2 px-1 text-[12px] leading-relaxed text-muted-foreground">
        New areas start at <span className="font-medium text-foreground">Watching</span> — trust is earned, not assumed.
        And even where it's trusted, Woven never auto-confirms a call it's unsure about; those come to you.
      </p>

      <Caption className="mt-5">When it steps in</Caption>
      <Panel>
        <div className={DIVIDED}>
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
      </Panel>
    </section>
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
  const [filter, setFilter] = React.useState<TrustState | null>(null);
  const { areas, watching } = listResponsibilitiesByArea();
  const roll = ledgerRollup();
  const cols = listCollections();
  const promoByCol = new Map(listPromotable().map((p) => [p.collectionId, p]));
  const trulyWatching = watching.filter((c) => !promoByCol.has(c.id));
  const earningAreas = watching.filter((c) => promoByCol.has(c.id));

  // one packaged surface: area group-headers + hairline rows + the grant row, all inside a single card. When a
  // trust state is selected in the panel, the ledger filters to it (brush-and-link) — earning/watching/grant hide.
  const rows: React.ReactNode[] = [];
  for (const a of areas) {
    const rules = filter ? a.rules.filter((r) => ruleTrust(r) === filter) : a.rules;
    if (!rules.length) continue;
    rows.push(<GroupHeader key={`h-${a.collection.id}`} collection={a.collection} meta={healthLabel(a.health)} />);
    for (const r of rules) rows.push(<RuleRow key={r.id} rule={r} />);
    if (!filter) {
      const promo = promoByCol.get(a.collection.id);
      if (promo) rows.push(<EarningRow key={`e-${a.collection.id}`} p={promo} />);
    }
  }
  if (!filter) {
    for (const c of earningAreas) {
      rows.push(<GroupHeader key={`h-${c.id}`} collection={c} meta="watching · 1 about to earn" />);
      rows.push(<EarningRow key={`e-${c.id}`} p={promoByCol.get(c.id)!} />);
    }
    if (trulyWatching.length) rows.push(<WatchingRow key="watching-else" cols={trulyWatching} />);
    rows.push(<GrantRow key="grant" cols={cols} />);
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <SectionHead
          title="Trust ledger"
          sub="What you've delegated to Woven, by area — earned from your decisions or granted by you. Change any level, or pull it back."
        />
        <DelegationPanel roll={roll} />
        <Panel>
          <LedgerTabs roll={roll} filter={filter} onFilter={setFilter} />
          {filter ? (
            <div className="flex items-start gap-2 border-b bg-foreground/[0.015] px-3.5 py-2 text-[12px] text-muted-foreground">
              <Info className="mt-px size-3.5 shrink-0" />
              <span>{LEVEL_MEANING[filter]}</span>
            </div>
          ) : null}
          <div className={DIVIDED}>{rows}</div>
        </Panel>
      </div>

      <FloorSection />
    </div>
  );
}
