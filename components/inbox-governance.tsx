"use client";

// Inbox, Governance = the TRUST LEDGER. The agent is a colleague you delegate to; you delegate RESPONSIBILITIES
// (capability × area), each earned from your decisions or granted by you, each with a trust state on ONE ladder
// (Watching → Trusted → Held back) that is mostly a CONSEQUENCE of your decisions.
//
// Layout doctrine (this file's whole point): ONE packaged surface, not a stack of sprawling bars. The ledger is a
// single card of GROUPED rows (area group-header + hairline item rows); every row is one tight, vertically-centred
// line — mark, name, one meta line, ONE control (a single state select that also carries Revoke). No floating
// headers, no ragged control stacks, no per-row cards. The quieter "floor" (global gates + defaults) sits below.
// Refero: Linear grouped lists, settings row-groups; the Vercel "teaching agents product design" judgment loop.

import * as React from "react";
import { Plus, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
import { AgentBand as AgentColleagueBand, DIVIDED, FeedHead, undot } from "@/components/inbox-agent-band";
import { NodeMark } from "@/components/entity-profile";
import { PeekTrigger } from "@/components/entity-peek";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import Link from "next/link";
import type { Collection, EdgeType, LearnedRule, RefKind } from "@/lib/types";
import { SegToggle } from "@/components/controls";
import { Switch } from "@/components/ui/switch";

// a capability = the "what" of a responsibility. Label shared with Activity's run ties (one loop, one vocabulary).
const CAP_LABEL = RULE_CAPABILITY;
const GRANTABLE: EdgeType[] = ["links_to", "in_collection", "mentions", "sourced_from"];

// the house focus ring — these two selects shipped with a bare outline-none and nothing to replace it
const FOCUS_RING = "outline-none focus-visible:ring-3 focus-visible:ring-focus";

// one tight row — the single grammar every list in this file uses
// items-start + a slot two lines tall (13/18 + 12/16 + mt-0.5): the trailing control centres on the
// title/meta pair however far the meta wraps on a phone (with items-center a three-line row floated it 23px).
const ROW = "flex items-start gap-3 px-3.5 py-2.5";
const SLOT = "flex h-9 shrink-0 items-center";

// ── the row's lead: the KIND of thing a responsibility is about ────────────────────────────────────────────
// A responsibility is a capability over an area, and every capability is about one kind of thing — the edge's
// far end: linking and superseding touch artifacts, filing touches the collection, "who's mentioned" and
// authorship touch people, tracing touches sources, logging touches decisions. The row leads with that kind's
// mark in the alphabet (shape = kind), where it used to lead with a lucide well per capability — a second
// vocabulary for the same rows, and the only place on the surface the alphabet was absent. Hue = identity, so
// it is the area's hue only where the thing IS the area's: an artifact in Growth wears Growth's hue (its
// primary collection), the area's own square is the area. A person, a source or a decision has its own
// identity, and a responsibility is about the kind, not one of them — so those marks take the hint ink, the
// shape and no one's colour (the collection rail's rest ink; muted-foreground squares were "too solid", Kyle
// 09-14, and measured the heaviest mark in this list). 12px, on the title line, in the 28px column the wells
// took, so the text edge holds.
const EDGE_KIND: Record<EdgeType, RefKind> = {
  links_to: "artifact",
  supersedes: "artifact",
  in_collection: "collection",
  mentions: "person",
  authored_by: "person",
  sourced_from: "source",
  decided: "decision",
};
function KindMark({ edgeType, collection }: { edgeType: EdgeType; collection?: Collection }) {
  const kind = EDGE_KIND[edgeType];
  const ofArea = collection && (kind === "artifact" || kind === "collection");
  return (
    <span className="flex h-(--text-sm--line-height) w-7 shrink-0 items-center justify-center">
      <NodeMark
        node={{ id: kind === "collection" && collection ? collection.id : `${edgeType}`, kind }}
        className="size-3"
        fill={ofArea ? collection.color : "var(--foreground-hint)"}
      />
    </span>
  );
}

// a bare compact select (grant composer) — native, so no popover machinery
function MiniSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <div className="relative inline-flex items-center">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 appearance-none rounded-md border bg-transparent pl-2.5 pr-6 text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-focus transition-colors hover:border-line-stroke focus:border-primary"
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
  // The word carries the state; the ink does not. "Trusted" used to be forest — the colour reserved for
  // chrome, the agent and confirms — so a select read as a confirm button beside a grey one of the same shape.
  // Held back keeps the warn hue: warn is a status colour, and the control is the status.
  const tone = trust === "held_back" ? "border-warn/30 bg-warn/[0.06] text-warn" : "border-border text-foreground";
  return (
    <div className={cn(SLOT, "relative")}>
      <select
        aria-label="Trust level"
        title={LEVEL_MEANING[trust]}
        value={trust}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "__revoke") revokeRule(rule.id);
          else setTrust(rule, v as TrustState);
        }}
        className={cn("h-7 appearance-none rounded-md border pl-2.5 pr-6 text-sm font-medium transition-colors", FOCUS_RING, tone)}
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
      <PopoverTrigger className="rounded-sm font-medium text-muted-foreground underline decoration-foreground-hint decoration-dotted underline-offset-2 outline-none transition-colors hover:text-foreground focus-visible:text-foreground">
        From your Decisions
      </PopoverTrigger>
      <PopoverContent side="top" align="start" sideOffset={8} className="w-80">
        {/* the peek is about YOUR decisions, so it opens on them, not on the agent's seal — the band above the
            ledger is the one place this surface credits the agent */}
        <p className="text-xs font-medium text-muted-foreground">Learned from {sources.length} of your decisions</p>
        <div className="mt-2 flex flex-col gap-0.5">
          {sources.map((s) => (
            <Link
              key={s.id}
              href={`/artifact/${s.artifactId}`}
              className="flex items-baseline gap-2 rounded-md px-1.5 py-1 text-sm transition-colors hover:bg-tint-1"
            >
              <span className="min-w-0 flex-1">
                <span className="font-medium text-foreground">{undot(s.artifactTitle)}</span> <span className="text-muted-foreground">{undot(s.line)}</span>
              </span>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{s.at}</span>
            </Link>
          ))}
        </div>
        <p className="mt-2 border-t pt-2 text-xs text-muted-foreground">
          You confirmed each of these, so Woven now handles this shape and just tells you.
        </p>
      </PopoverContent>
    </Popover>
  );
}
function RuleRow({ rule, collection }: { rule: LearnedRule; collection: Collection }) {
  const earned = rule.origin === "earned";
  return (
    <div className={ROW}>
      <KindMark edgeType={rule.edgeType} collection={collection} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{CAP_LABEL[rule.edgeType]}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {earned ? <SourceDecisionsPeek rule={rule} /> : "Granted by you"}, <RecordPeek rule={rule} />
        </p>
      </div>
      <StateSelect rule={rule} />
    </div>
  );
}
// a shape you're about to earn — a light row in its area group, no control (you take it in Decisions)
function EarningRow({ p, collection }: { p: PromotableRule; collection?: Collection }) {
  // A lit ROW, never a band: the tint is on the row's own box, radius sm. With the header now a label on a
  // hairline it is the one filled object in the ledger, and it is kept: it is a row STATE ("about to earn" — the
  // next responsibility, waiting on you in Decisions), and a state may light a row; nothing that labels sits on
  // a fill. The wash spans exactly what the hairlines span (mx-3 = the dividers' and the header rule's inset-x-3,
  // 372 to 1324 at 1440). At mx-1.5 it ran 6px past the rule above it on each side, so the one filled object in
  // the list was also the one object wider than the list. Its left padding gives the 12px back (pl-0.5 + the 12
  // = the rows' 14) so its mark (382) and title (414) stay on the ledger's edges. The divider above it, when a
  // rule row precedes it, is drawn on the wash's own edges, which are now the hairlines' (before:inset-x-0),
  // instead of 12px inside them. It needs the `!`: DIVIDED's [&>*+*]:before:inset-x-3 has the same specificity
  // and is emitted later, so a plain before:inset-x-0 measured 12px.
  return (
    <div className={cn(ROW, "mx-3 rounded-sm bg-tint-1 pl-0.5 pr-2 before:inset-x-0!")}>
      <KindMark edgeType={p.edgeType} collection={collection} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">
          {CAP_LABEL[p.edgeType]}<span className="font-normal text-muted-foreground">, about to earn</span>
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Confirmed {p.confirmed}× and never rejected. Take it in Decisions.
        </p>
      </div>
    </div>
  );
}
// an area group-header, INSIDE the card (packages the area + its rows into one unit — no floating header)
type AreaHealth = { trusted: number; watching: number; held_back: number };

// a compact COUNT badge (total responsibilities in the area) — hover for the trust breakdown. Replaces the inline
// "2 trusted, 1 watching" so the header stays name + badge; the overview is one hover away.
function AreaHealthBadge({ health }: { health: AreaHealth }) {
  const total = health.trusted + health.watching + health.held_back;
  const rows = (
    [
      health.trusted ? { c: "bg-primary", label: `${health.trusted} trusted` } : null,
      health.watching ? { c: "bg-foreground/40", label: `${health.watching} watching` } : null,
      health.held_back ? { c: "bg-warn", label: `${health.held_back} held back` } : null,
    ] as ({ c: string; label: string } | null)[]
  ).filter(Boolean) as { c: string; label: string }[];
  return (
    <Popover>
      <PopoverTrigger
        nativeButton={false}
        openOnHover
        delay={120}
        render={<span className="cursor-help tabular-nums">{total}</span>}
      />
      <PopoverContent side="top" align="start" sideOffset={6} className="w-auto p-2.5">
        <div className="flex flex-col gap-1.5">
          {rows.map((r, i) => (
            <span key={i} className="flex items-center gap-2 whitespace-nowrap text-xs text-muted-foreground">
              <span className={cn("size-2 shrink-0 rounded-sm", r.c)} /> {r.label}
            </span>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// the rule's track record, condensed. The visible chip is the headline ("handled 12"); hover reveals the rest
// (undos, age). "learned from N" already lives in the SourceDecisions peek, so it's dropped from the inline line.
function RecordPeek({ rule }: { rule: LearnedRule }) {
  const detail = [
    `handled ${rule.autoConfirmed}`,
    rule.undone > 0 ? `you undid ${rule.undone}` : null,
    `since ${rule.createdAt}`,
    ruleTrust(rule) === "held_back" && rule.undone > 0 ? "held after a correction" : null,
  ].filter(Boolean);
  return (
    <Popover>
      <PopoverTrigger
        nativeButton={false}
        openOnHover
        delay={120}
        render={
          <span className="cursor-help underline decoration-foreground-hint decoration-dotted underline-offset-2">
            {rule.autoConfirmed > 0 ? `handled ${rule.autoConfirmed}` : rule.createdAt}
          </span>
        }
      />
      <PopoverContent side="top" align="start" sideOffset={6} className="w-auto max-w-xs p-2.5">
        <p className="text-xs text-muted-foreground">{detail.join(", ")}</p>
      </PopoverContent>
    </Popover>
  );
}

function GroupHeader({ collection, health, note }: { collection: Collection; health?: AreaHealth; note?: string }) {
  // The area's swatch is the header's anchor (hue = identity, the one colour a header may carry) and it is the
  // collection's own mark — the near-square the sidebar, the field and the Team list draw — where it was an 8px
  // disc, a person's shape. The name is a peek trigger with no decoration at rest — a header label wears nothing
  // a row title does not — and takes tint-1 on hover now that it sits on the ground (tint-3 was one rung above
  // the band it no longer has). The area's rule count is INVENTORY (how many responsibilities live here), so it
  // is a muted bare number; hovering it still opens the trust breakdown. "watching, about to earn" is the
  // header's state phrase in the count's slot. FeedHead sets the swatch in the rows' lead column, centred on their
  // kind marks (388), so the area's name starts on the titles' edge (414), not 22px left of it.
  return (
    <FeedHead
      lead={<NodeMark node={{ id: collection.id, kind: "collection" }} className="size-2.5" />}
      kind="inventory"
      count={health ? <AreaHealthBadge health={health} /> : undefined}
      note={note}
    >
      <PeekTrigger refObj={{ id: collection.id, label: undot(collection.name), kind: "collection" }} className="-mx-1 rounded-sm px-1 no-underline hover:bg-tint-1 hover:no-underline" />
    </FeedHead>
  );
}
// the areas with nothing delegated, as one sentence on the rows' text edge: each area named by its own mark
// (welded to its name, prose that wraps) where an Eye well stood for all of them. It is a fact that exists only
// here, so it wraps rather than truncates.
function WatchingRow({ cols }: { cols: Collection[] }) {
  return (
    <p className="py-2.5 pl-13.5 pr-3.5 text-xs text-muted-foreground">
      Watching everywhere else, nothing delegated yet:{" "}
      {cols.map((c, i) => (
        <React.Fragment key={c.id}>
          {i ? ", " : null}
          <span className="whitespace-nowrap">
            <NodeMark node={{ id: c.id, kind: "collection" }} className="mr-1 inline-block size-2.5 align-[-1px]" />
            {undot(c.name)}
          </span>
        </React.Fragment>
      ))}
      .
    </p>
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
      // the ledger's verb, in the rows' lead column as a bare glyph on the label's line: it was a 28px tint-1 well,
      // and beside 12px kind marks a filled well was the heaviest lead in the list for its quietest row
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(ROW, "w-full text-left text-sm font-medium text-muted-foreground outline-none transition-colors hover:bg-tint-1 hover:text-foreground focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus")}
      >
        <span className="flex h-(--text-sm--line-height) w-7 shrink-0 items-center justify-center">
          <Plus className="size-4" />
        </span>
        Grant a responsibility
      </button>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2 px-3.5 py-3 text-sm">
      <span className="text-muted-foreground">Let Woven</span>
      <MiniSelect value={edgeType} onChange={(v) => setEdge(v as EdgeType)} options={GRANTABLE.map((e) => [e, CAP_LABEL[e]])} />
      <span className="text-muted-foreground">in</span>
      <MiniSelect value={colId} onChange={setColId} options={cols.map((c) => [c.id, undot(c.name)])} />
      <SegToggle
        size="sm"
        options={[{ id: "watching", label: "Watch first" }, { id: "trusted", label: "Trust now" }]}
        value={posture}
        onChange={(v) => setPosture(v as "watching" | "trusted")}
      />
      <div className="ml-auto flex items-center gap-1">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Cancel
        </button>
        <Button
          size="sm"
          onClick={() => {
            if (!colId) return;
            grantResponsibility(edgeType, colId, posture);
            setOpen(false);
            setPosture("watching");
          }}
        >
          Grant
        </Button>
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
// The earned-trust trajectory, on the house dataviz rule. It was a 200×44 drawing squashed into 116×36 with
// preserveAspectRatio="none" (the stroke and the end dot scaled unevenly), a grey-to-nothing area fill, a 40%
// alpha line and no number: a sparkline that summarised nothing a reader could read off it. Now it is drawn at
// its own pixel size: a 1.5px neutral ink line, no fill, a hairline baseline at zero, and the value it ends on
// written beside it — tabular, muted — so the line's last point has a number. Hovering a week moves the dot and
// the number to that week, and the band's summary names the week (the swap it always did).
const SPARK_W = 64;
const SPARK_H = 24;
function Sparkline({ traj, hover, onHover }: { traj: WeeklyTrust[]; hover: WeeklyTrust | null; onHover: (w: WeeklyTrust | null) => void }) {
  const base = SPARK_H - 0.5; // the zero line, on the half pixel so 1px fills one device row at DPR 1
  const top = 2.5; // room for the dot's radius above the highest week
  const maxV = Math.max(...traj.map((t) => t.handled), 1);
  const step = (SPARK_W - 5) / Math.max(traj.length - 1, 1);
  const pts = traj.map((t, i) => ({ x: 2.5 + i * step, y: base - (t.handled / maxV) * (base - top), t }));
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const shown = pts.find((p) => p.t === hover) ?? pts[pts.length - 1];
  const label = `Handled per week, last ${traj.length} weeks`;
  return (
    <span className="flex items-center gap-2">
      <svg width={SPARK_W} height={SPARK_H} viewBox={`0 0 ${SPARK_W} ${SPARK_H}`} className="shrink-0 overflow-visible" role="img" aria-label={label} onMouseLeave={() => onHover(null)}>
        <title>{label}</title>
        <line x1={0} x2={SPARK_W} y1={base} y2={base} className="stroke-border" strokeWidth={1} />
        <path d={line} className="fill-none stroke-muted-foreground" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={shown.x} cy={shown.y} r={2} className="pointer-events-none fill-foreground" />
        {/* one hit strip per week, the full height — a 7px circle per point overlapped its neighbours */}
        {pts.map((p, i) => (
          <rect key={i} x={p.x - step / 2} y={0} width={step} height={SPARK_H} className="cursor-pointer fill-transparent" onMouseEnter={() => onHover(p.t)} />
        ))}
      </svg>
      <span className="min-w-3 text-xs tabular-nums text-muted-foreground" aria-hidden="true">
        {shown.t.handled}
      </span>
    </span>
  );
}
// the tab's agent header = the SHARED AgentBand (identical to Decisions / Activity). Summary = the standing
// delegation (trusted in N areas, handled X, corrected Y); the earned-trust trajectory rides on the right and
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
    .join(", ");
  return (
    <AgentColleagueBand
      className="pb-4"
      summary={hover ? `${hover.week}, handled ${hover.handled}` : summary}
      right={<Sparkline traj={traj} hover={hover} onHover={setHover} />}
    />
  );
}


// ── the floor — global gates + defaults BENEATH your per-area delegations. Flat feed rows (no card), same grammar
// as the ledger above, so the whole tab reads as ONE surface rather than a settings page bolted under a feed. ─────
function FloorSection() {
  const caps = listCapabilities();
  const points = listDecisionPoints();
  // The floor's rows are switches over behaviours, not rows about things: there is no kind for "when a source
  // changes", and drawing one would spend the alphabet on a settings icon. They lost their lucide wells with the
  // ledger above (one vocabulary per surface) and sit on their section label's edge, 14px, like any settings list.
  return (
    <div className={cn(DIVIDED, "mt-8 border-t border-border")}>
      <p className="mt-10 px-3.5 pb-2 text-base font-medium text-foreground">The floor, what Woven may attempt on its own</p>
      {caps.map((c) => (
        <div key={c.id} className={ROW}>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{undot(c.name)}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {undot(c.blurb)}
              {c.note ? ` ${undot(c.note)}` : ""}
            </p>
          </div>
          <Switch on={c.enabled} onChange={() => toggleCapability(c.id)} label={c.name} />
        </div>
      ))}
      <p className="px-3.5 py-2.5 text-xs text-muted-foreground">
        New areas start at <span className="font-medium text-foreground">Watching</span>: trust is earned, not assumed.
        Even where it's trusted, Woven never auto-confirms a call it's unsure about; those come to you.
      </p>
      <p className="mt-10 px-3.5 pb-2 text-base font-medium text-foreground">When it steps in</p>
      {points.map((p) => (
        <div key={p.id} className={ROW}>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{undot(p.label)}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{undot(p.detail)}</p>
          </div>
          <Switch on={p.enabled} onChange={() => toggleDecisionPoint(p.id)} label={p.label} />
        </div>
      ))}
    </div>
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

  // ONE flat grouped feed (no card) — the same shape as the Decisions/Activity tabs: area group-headers + hairline
  // rows. State shows per row (self-explaining control); there are no sub-tabs. Earning shapes + grant close it out.
  const rows: React.ReactNode[] = [];
  for (const a of areas) {
    rows.push(<GroupHeader key={`h-${a.collection.id}`} collection={a.collection} health={a.health} />);
    for (const r of a.rules) rows.push(<RuleRow key={r.id} rule={r} collection={a.collection} />);
    const promo = promoByCol.get(a.collection.id);
    if (promo) rows.push(<EarningRow key={`e-${a.collection.id}`} p={promo} collection={a.collection} />);
  }
  for (const c of earningAreas) {
    rows.push(<GroupHeader key={`h-${c.id}`} collection={c} note="watching, about to earn" />);
    rows.push(<EarningRow key={`e-${c.id}`} p={promoByCol.get(c.id)!} collection={c} />);
  }
  if (trulyWatching.length) rows.push(<WatchingRow key="watching-else" cols={trulyWatching} />);
  rows.push(<GrantRow key="grant" cols={cols} />);

  // agent-colleague header (same as Activity), then the flat grouped feed, then the floor — one continuous surface.
  return (
    <div className="flex flex-col">
      <AgentBand roll={roll} />
      <div className={cn(DIVIDED, "border-t border-border")}>{rows}</div>
      <FloorSection />
    </div>
  );
}
