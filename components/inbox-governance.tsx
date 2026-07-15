"use client";

// Inbox · Governance = the TRUST LEDGER. You don't set a global "how bold" dial — you delegate RESPONSIBILITIES
// to Woven, each scoped to an AREA (collection), each either EARNED (promoted from your consistent decisions) or
// GRANTED (you told it directly, the structured successor to free-text instructions). Trust is a state on ONE
// ladder — Watching → Trusted here → Held back — mostly a CONSEQUENCE of your decisions, not a switch you flip.
// Organized BY AREA so it scales: a health rollup on top, per-area panels of responsibility rows, then the quiet
// floor (what Woven may attempt at all · when it steps in · the confidence line it won't cross). Refero:
// delegation/permission ledgers; the Vercel "teaching agents product design" judgment-capture loop.

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
  Info,
  Plus,
  ChevronDown,
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
  resumeRule,
  revokeRule,
  ruleTrust,
  setRuleMode,
  toggleCapability,
  toggleDecisionPoint,
  type AreaResponsibilities,
  type LedgerRollup,
  type PromotableRule,
  type TrustState,
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
// the four capabilities you can hand-grant (the doc-action ones — draft/verify stay global floor gates)
const GRANTABLE: EdgeType[] = ["links_to", "in_collection", "mentions", "sourced_from"];

const TRUST_META: Record<TrustState, { label: string; chip: string; tone: Tone }> = {
  trusted: { label: "Trusted here", chip: "bg-primary/10 text-primary", tone: "primary" },
  watching: { label: "Watching", chip: "border border-border text-muted-foreground", tone: "muted" },
  held_back: { label: "Held back", chip: "bg-warn/15 text-warn", tone: "warn" },
};

const GATE_ICON: Record<AgentCapabilityId, LucideIcon> = { link: Link2, file: FolderInput, draft: PenLine, verify: ShieldCheck };
const POINT_ICON: Record<string, LucideIcon> = { on_capture: Download, on_source_change: RefreshCw, on_long_doc: FileText };

// ── shared grammar (one panel · one row model · one glyph column) ───────────────────────────────────────────
type Tone = "primary" | "muted" | "warn";

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
const rowCls = (first: boolean) => cn("flex items-center gap-3 px-4 py-3.5", !first && "border-t border-border/60");

// a lozenge glyph — leads every row so all panels share one visual anchor column
function Glyph({ icon: Icon, tone = "muted" }: { icon: LucideIcon; tone?: Tone }) {
  const cls: Record<Tone, string> = {
    primary: "bg-primary/[0.1] text-primary",
    muted: "bg-foreground/[0.06] text-muted-foreground",
    warn: "bg-warn/10 text-warn",
  };
  return (
    <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", cls[tone])}>
      <Icon className="size-4" />
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
function TrustChip({ state }: { state: TrustState }) {
  const m = TRUST_META[state];
  return <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium", m.chip)}>{m.label}</span>;
}
// the trust ladder control — Watch (proposes, you decide) vs Trust (acts, tells you). Held-back rows hide it in
// favour of Resume, so you can't quietly re-arm something you just corrected without reviewing it.
function Ladder({ trust, onSet }: { trust: TrustState; onSet: (t: "watching" | "trusted") => void }) {
  return (
    <div className="inline-flex shrink-0 items-center rounded-lg border p-0.5 text-[12px]">
      {(
        [
          ["watching", "Watch"],
          ["trusted", "Trust"],
        ] as const
      ).map(([val, label]) => (
        <button
          key={val}
          type="button"
          onClick={() => onSet(val)}
          aria-pressed={trust === val}
          className={cn(
            "rounded-md px-2.5 py-1 font-medium transition-colors",
            trust === val ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// ── a responsibility, as a ROW inside its area's panel ──────────────────────────────────────────────────────
function ResponsibilityRow({ rule, first }: { rule: LearnedRule; first: boolean }) {
  const trust = ruleTrust(rule);
  const meta = TRUST_META[trust];
  const earned = rule.origin === "earned";
  return (
    <div className={cn("px-4 py-3.5", !first && "border-t border-border/60")}>
      <div className="flex items-start gap-3">
        <Glyph icon={CAP_ICON[rule.edgeType]} tone={meta.tone} />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] font-medium">
            {CAP_LABEL[rule.edgeType]}
            <TrustChip state={trust} />
            <span className="text-[11.5px] font-normal text-muted-foreground/80">{earned ? "Earned" : "Granted"}</span>
          </p>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">
            {earned ? (
              <>
                Learned from <span className="tabular-nums">{rule.confirmed}</span> of your calls
              </>
            ) : (
              <>You granted this</>
            )}
            {rule.autoConfirmed > 0 ? (
              <>
                {" "}· handled <b className="font-medium text-foreground tabular-nums">{rule.autoConfirmed}</b>
              </>
            ) : null}
            {rule.undone > 0 ? (
              <>
                {" "}· you undid <b className="font-medium text-foreground tabular-nums">{rule.undone}</b>
              </>
            ) : null}{" "}
            · {rule.createdAt}
          </p>
          {trust === "held_back" ? (
            <div className="mt-2 flex items-center gap-2 rounded-lg bg-warn/10 px-2.5 py-1.5 text-[12.5px]">
              <Info className="size-3.5 shrink-0 text-warn" />
              <span className="flex-1 text-muted-foreground">
                Held back — you corrected it{rule.undone > 0 ? ` ${rule.undone}×` : ""}. Review, then let it resume.
              </span>
              <button
                type="button"
                onClick={() => resumeRule(rule.id)}
                className="shrink-0 rounded-md px-2 py-0.5 font-medium text-foreground transition-colors hover:bg-foreground/[0.06]"
              >
                Resume
              </button>
            </div>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {trust === "held_back" ? (
            <span className="rounded-md bg-warn/15 px-2 py-1 text-[11px] font-medium text-warn">Paused</span>
          ) : (
            <Ladder trust={trust} onSet={(t) => setRuleMode(rule.id, t === "trusted" ? "auto" : "suggest")} />
          )}
          <button
            type="button"
            onClick={() => revokeRule(rule.id)}
            className="text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Revoke
          </button>
        </div>
      </div>
    </div>
  );
}

// a shape you're ABOUT to earn — surfaced in its area so the ledger shows the pipeline, not just the codified end
function EarningRow({ p, first }: { p: PromotableRule; first: boolean }) {
  return (
    <div className={cn("flex items-start gap-3 bg-primary/[0.02] px-4 py-3", !first && "border-t border-border/60")}>
      <Glyph icon={CAP_ICON[p.edgeType]} tone="muted" />
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-medium">
          {CAP_LABEL[p.edgeType]} <span className="font-normal text-muted-foreground">— about to earn trust</span>
        </p>
        <p className="mt-0.5 text-[12.5px] text-muted-foreground">
          You've confirmed this <span className="tabular-nums">{p.confirmed}×</span> and never rejected it — take it in{" "}
          <span className="font-medium text-foreground">Decisions</span>.
        </p>
      </div>
    </div>
  );
}

function healthLabel(h: AreaResponsibilities["health"]): string {
  const parts: string[] = [];
  if (h.trusted) parts.push(`${h.trusted} trusted`);
  if (h.watching) parts.push(`${h.watching} watching`);
  if (h.held_back) parts.push(`${h.held_back} held back`);
  return parts.join(" · ");
}
function AreaHeader({ collection, meta }: { collection: Collection; meta: string }) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <span className="size-2.5 rounded-[3px]" style={{ background: collection.color }} />
      <h3 className="text-[14px] font-medium">{collection.name}</h3>
      <span className="text-[12.5px] text-muted-foreground">· {meta}</span>
    </div>
  );
}
function AreaSection({ area, promotable }: { area: AreaResponsibilities; promotable?: PromotableRule }) {
  return (
    <section>
      <AreaHeader collection={area.collection} meta={healthLabel(area.health)} />
      <Panel>
        {area.rules.map((r, i) => (
          <ResponsibilityRow key={r.id} rule={r} first={i === 0} />
        ))}
        {promotable ? <EarningRow p={promotable} first={area.rules.length === 0} /> : null}
      </Panel>
    </section>
  );
}
// an area with no delegations yet but a ripe candidate — shows the "earning" story so the pipeline is visible
function EarningSection({ collection, p }: { collection: Collection; p: PromotableRule }) {
  return (
    <section>
      <AreaHeader collection={collection} meta="watching · 1 about to earn" />
      <Panel>
        <EarningRow p={p} first />
      </Panel>
    </section>
  );
}

// the state of the delegation at a glance — the scale header
function Rollup({ roll }: { roll: LedgerRollup }) {
  const total = roll.trusted + roll.watching + roll.held_back || 1;
  return (
    <div className="rounded-xl border bg-card px-4 py-3.5">
      <p className="text-[13px] leading-relaxed text-muted-foreground">
        Across <b className="font-medium text-foreground">{roll.areas}</b> areas — Woven is{" "}
        <b className="font-medium text-foreground">{roll.trusted} trusted</b>,{" "}
        <b className="font-medium text-foreground">{roll.watching} watching</b>
        {roll.held_back ? (
          <>
            , <b className="font-medium text-warn">{roll.held_back} held back</b>
          </>
        ) : null}
        . It's handled <b className="font-medium text-foreground tabular-nums">{roll.handled}</b> changes for you
        {roll.undone ? (
          <>
            , you've corrected <b className="font-medium text-foreground tabular-nums">{roll.undone}</b>
          </>
        ) : null}
        .
      </p>
      <div className="mt-2.5 flex h-1.5 gap-px overflow-hidden rounded-full bg-foreground/5">
        <span className="bg-primary" style={{ width: `${(roll.trusted / total) * 100}%` }} />
        <span className="bg-foreground/25" style={{ width: `${(roll.watching / total) * 100}%` }} />
        {roll.held_back ? <span className="bg-warn" style={{ width: `${(roll.held_back / total) * 100}%` }} /> : null}
      </div>
    </div>
  );
}

// collections with nothing delegated — folded into one calm line, not padded out as empty sections
function WatchingLine({ cols }: { cols: Collection[] }) {
  return (
    <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 px-1 text-[12.5px] text-muted-foreground">
      <Eye className="size-3.5" />
      <span>Watching everywhere else —</span>
      {cols.map((c, i) => (
        <span key={c.id} className="inline-flex items-center gap-1">
          <span className="size-2 rounded-[2px]" style={{ background: c.color }} />
          {c.name}
          {i < cols.length - 1 ? "," : ""}
        </span>
      ))}
      <span>— nothing delegated yet.</span>
    </p>
  );
}

// ── grant composer — the structured successor to the free-text box ──────────────────────────────────────────
function MiniSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <div className="relative inline-flex items-center">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none rounded-md border bg-transparent py-1 pl-2.5 pr-7 text-[13.5px] font-medium outline-none transition-colors hover:border-foreground/30 focus:border-primary"
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 size-3.5 text-muted-foreground" />
    </div>
  );
}
function GrantComposer({ cols }: { cols: Collection[] }) {
  const [open, setOpen] = React.useState(false);
  const [edgeType, setEdge] = React.useState<EdgeType>("links_to");
  const [colId, setColId] = React.useState(cols[0]?.id ?? "");
  const [posture, setPosture] = React.useState<"watching" | "trusted">("watching");

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2 rounded-xl border border-dashed px-4 py-3 text-[13.5px] font-medium text-muted-foreground transition-colors hover:bg-foreground/[0.02] hover:text-foreground"
      >
        <Plus className="size-4" /> Grant Woven a responsibility
      </button>
    );
  }
  return (
    <Panel>
      <div className="flex flex-wrap items-center gap-2 px-4 py-3.5 text-[13.5px]">
        <span className="text-muted-foreground">Let Woven</span>
        <MiniSelect value={edgeType} onChange={(v) => setEdge(v as EdgeType)} options={GRANTABLE.map((e) => [e, CAP_LABEL[e]])} />
        <span className="text-muted-foreground">in</span>
        <MiniSelect value={colId} onChange={setColId} options={cols.map((c) => [c.id, c.name])} />
        <div className="inline-flex items-center rounded-lg border p-0.5">
          {(["watching", "trusted"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPosture(p)}
              aria-pressed={posture === p}
              className={cn(
                "rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors",
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
            className="rounded-md px-2.5 py-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
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
            className="rounded-md bg-primary px-3 py-1.5 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Grant
          </button>
        </div>
      </div>
      <p className="border-t border-border/60 px-4 py-2 text-[12px] text-muted-foreground">
        A grant is a responsibility you set by hand — it lives in the ledger beside the ones Woven earned, and you
        can pull it back the same way.
      </p>
    </Panel>
  );
}

// ── the floor — the global gates BENEATH your per-area delegations ──────────────────────────────────────────
function FloorSection() {
  const caps = listCapabilities();
  const points = listDecisionPoints();
  return (
    <section>
      <SectionHead
        title="The floor"
        sub="Beneath your delegations: what Woven may attempt at all, when it steps in, and the line it won't cross on its own."
      />

      <Caption>New areas start at</Caption>
      <Panel>
        <div className={rowCls(true)}>
          <Glyph icon={Eye} />
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-medium">Watching</p>
            <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">
              Anywhere you haven't delegated, Woven proposes and waits — trust is earned, never assumed.
            </p>
          </div>
          <span className="shrink-0 rounded-md border px-2 py-1 text-[11px] font-medium text-muted-foreground">Default</span>
        </div>
      </Panel>

      <Caption className="mt-5">What it may attempt at all</Caption>
      <Panel>
        {caps.map((c, i) => (
          <div key={c.id} className={rowCls(i === 0)}>
            <Glyph icon={GATE_ICON[c.id]} />
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
        ))}
      </Panel>

      <Caption className="mt-5">When it steps in</Caption>
      <Panel>
        {points.map((p, i) => (
          <div key={p.id} className={rowCls(i === 0)}>
            <Glyph icon={POINT_ICON[p.id] ?? Download} />
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-medium">{p.label}</p>
              <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">{p.detail}</p>
            </div>
            <Switch on={p.enabled} onClick={() => toggleDecisionPoint(p.id)} label={p.label} />
          </div>
        ))}
      </Panel>

      <Caption className="mt-5">The confidence line</Caption>
      <Panel>
        <div className={rowCls(true)}>
          <Glyph icon={ShieldCheck} />
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-medium">Unsure calls always come to you</p>
            <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">
              Even where Woven is trusted, it won't auto-confirm something it's shaky about — those stay in your
              Decisions queue. Confidence can hold Woven back, never grant it more.
            </p>
          </div>
        </div>
      </Panel>
    </section>
  );
}

export function InboxGovernance() {
  useGraphVersion();
  const { areas, watching } = listResponsibilitiesByArea();
  const roll = ledgerRollup();
  const cols = listCollections();
  const promoByCol = new Map(listPromotable().map((p) => [p.collectionId, p]));
  const trulyWatching = watching.filter((c) => !promoByCol.has(c.id));
  const earningAreas = watching.filter((c) => promoByCol.has(c.id));

  return (
    <div className="flex flex-col gap-9">
      {/* ── the trust ledger, by area ───────────────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-6">
        <div>
          <SectionHead
            title="Trust ledger"
            sub="What you've delegated to Woven, by area. Each responsibility is earned from your decisions or granted by you — tune it or pull it back anytime."
          />
          <Rollup roll={roll} />
        </div>

        {areas.map((a) => (
          <AreaSection key={a.collection.id} area={a} promotable={promoByCol.get(a.collection.id)} />
        ))}
        {earningAreas.map((c) => (
          <EarningSection key={c.id} collection={c} p={promoByCol.get(c.id)!} />
        ))}

        {trulyWatching.length ? <WatchingLine cols={trulyWatching} /> : null}

        <GrantComposer cols={cols} />
      </div>

      {/* ── the floor ───────────────────────────────────────────────────────────────────────────────────── */}
      <FloorSection />
    </div>
  );
}
