"use client";

import * as React from "react";
import Link from "next/link";
import { PAGE_FRAME } from "@/lib/frame";
import { ArrowRight, X, Bell, Check, Network } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Valve } from "@/components/proposal";
import { ConfidenceWord } from "@/components/confidence";
import { SegToggle, DIVIDED } from "@/components/controls";
import { IconButton } from "@/components/ui/icon-button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { FOCUS_RING } from "@/components/classes";
import { ROW_REVEAL } from "@/components/today-ui";
import { cn } from "@/lib/utils";
import { PageHeading } from "@/components/page-heading";
import { LocalGraph, GraphLegend } from "@/components/local-graph";
import { EntityProfile, NodeMark } from "@/components/entity-profile";
import type { EdgeType, PendingEdge, RefKind } from "@/lib/types";
import { PersonAvatar } from "@/components/identity";
import { TypeBadge } from "@/components/artifact-ui";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { notify, toasts } from "@/lib/notifications";
import {
  getFreshness,
  listArtifacts,
  listCollections,
  listPeople,
  listPending,
  pendingGraph,
  restoreEdge,
  spaceById,
  teamGraph,
  verifyEdge,
  workspaceStats,
} from "@/lib/api";
import { bumpGraph } from "@/lib/store";

const SPACE_ID = "sp_product";

// the typed edge as a readable label — the KG's relationship categories, shown as a tag not an arrow
const VERB: Record<EdgeType, string> = {
  links_to: "links to",
  sourced_from: "sourced from",
  mentions: "mentions",
  in_collection: "in",
  authored_by: "by",
  decided: "decided",
  supersedes: "supersedes",
};

// An entity's name in running text, led by its mark: the mark and the first word are one unbreakable unit,
// the rest of the name wraps like prose. (A flex row of [mark][name] let a phone break between the two.)
function MarkedName({ node, className, children }: { node: { id: string; kind: RefKind }; className?: string; children: string }) {
  const sp = children.indexOf(" ");
  const head = sp < 0 ? children : children.slice(0, sp);
  const tail = sp < 0 ? "" : children.slice(sp);
  return (
    <span className={className}>
      <span className="whitespace-nowrap">
        <NodeMark node={node} className="mr-1.5 inline-block size-2.5 align-[-1px]" />
        {head}
      </span>
      {tail}
    </span>
  );
}

// each pulse figure is interactive — hover shows the very items it counts (its people, collections, artifacts),
// 1-to-1, so the number is a door to the thing, not a dead stat.
function StatPeek({
  value,
  label,
  align = "start",
  children,
}: {
  value: React.ReactNode;
  label: string;
  align?: "start" | "center" | "end";
  children: React.ReactNode;
}) {
  return (
    <Popover>
      <PopoverTrigger
        nativeButton={false}
        openOnHover
        delay={120}
        render={
          <span className="cursor-help underline decoration-muted-foreground/40 decoration-dotted underline-offset-2 transition-colors hover:decoration-foreground">
            <span className="font-medium tabular-nums text-foreground">{value}</span> {label}
          </span>
        }
      />
      <PopoverContent side="bottom" align={align} sideOffset={8} className="w-64 p-1.5">
        {children}
      </PopoverContent>
    </Popover>
  );
}

// Team — the space's SITUATION ROOM (not an entity explorer): the whole collective brain at a glance,
// and you TEND it in place. Its shape (pulse line), its field (the space graph — the hero, where the people
// live as nodes), and what needs a human (KB health you verify inline). The graph is the one in-page surface;
// the rest are lenses + actions on it, not duplicate lists (a contributors strip that just re-listed the
// graph's people + opened the same peek was removed — the People page + the nodes' own hover-labels cover it).
export default function TeamPage() {
  const space = spaceById(SPACE_ID);
  const nb = React.useMemo(() => teamGraph(SPACE_ID), []);
  const stats = React.useMemo(() => workspaceStats(), []);
  const people = React.useMemo(() => listPeople(), []);
  const collections = React.useMemo(() => listCollections(), []);
  const artifacts = React.useMemo(() => listArtifacts().filter((a) => a.state !== "archived"), []);
  const [open, setOpen] = React.useState<null | "verify" | "review">(null);
  const [reviewTab, setReviewTab] = React.useState<"links" | "stale">("links");
  const [, bump] = React.useReducer((x: number) => x + 1, 0); // re-read live counts after an inline verify
  // verify mode swaps the space graph to the pending-links map — the exact edges you're resolving, each
  // with an in-place ✓ / ✕. Resolving drops it from listPending, so the next render removes it from view.
  const graphData = open === "verify" ? pendingGraph() : nb;

  // KB health — computed each render (not memoised) so verifying inline updates the counts immediately.
  const pending = listPending();
  const stale = listArtifacts().filter((a) => getFreshness(a.id).state !== "fresh");
  // group proposed links by their source artifact, so a doc with several proposals reads as one block
  const pendingBySource = Object.values(
    pending.reduce<Record<string, typeof pending>>((acc, p) => {
      (acc[p.fromId] ??= []).push(p);
      return acc;
    }, {}),
  );

  function resolve(edgeId: string, action: "confirm" | "discard", label: string) {
    const prev = verifyEdge(edgeId, action);
    bumpGraph(); // the sidebar badge + any subscriber
    bump(); // this page's counts + list
    const undo = prev
      ? { label: "Undo", onClick: () => { restoreEdge(prev); bumpGraph(); bump(); } }
      : undefined;
    if (action === "confirm") toasts.linkConfirmed(label, undo);
    else toasts.proposalDismissed(label, undo);
  }

  // batch a source's proposals into one confirm — one toast, one undo (not N)
  function confirmAll(links: PendingEdge[]) {
    const prevs = links
      .map((p) => verifyEdge(p.edge_id, "confirm"))
      .filter((x): x is NonNullable<typeof x> => Boolean(x));
    bumpGraph();
    bump();
    const undo = prevs.length
      ? {
          label: "Undo",
          onClick: () => {
            prevs.forEach((pr) => restoreEdge(pr));
            bumpGraph();
            bump();
          },
        }
      : undefined;
    toasts.linksConfirmed(links.length, undo);
  }

  return (
    <div className={PAGE_FRAME.browse}>
      <PageHeading
        title={space?.name ?? "Team"}
        hint="Your whole space at a glance — its shape, its field of collections and people, and what needs a human. Tend it here: verify links, focus the graph. One tier up from a single collection's map."
      />

      {/* one status bar — size at a glance (quiet, left) + what needs a human (actionable chips, right) */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
          <StatPeek value={stats.people} label="people">
            <div className="scrollbar-subtle max-h-64 overflow-y-auto">
              {people.map((p) => (
                <div key={p.id} className="flex items-center gap-2 rounded-md px-1.5 py-1 text-sm">
                  <PersonAvatar seed={p.id} name={p.name} initials={p.initial} size="xs" />
                  <span className="min-w-0 flex-1 truncate">{p.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{p.role}</span>
                </div>
              ))}
            </div>
          </StatPeek>
          <span aria-hidden="true" className="h-3 w-px shrink-0 bg-border" />
          <StatPeek value={stats.collections} label="collections">
            {collections.map((c) => (
              <div key={c.id} className="flex items-center gap-2 rounded-md px-1.5 py-1 text-sm">
                <span className="size-2.5 shrink-0 rounded-sm" style={{ background: c.color }} />
                <span className="min-w-0 flex-1 truncate">{c.name}</span>
              </div>
            ))}
          </StatPeek>
          <span aria-hidden="true" className="h-3 w-px shrink-0 bg-border" />
          <StatPeek value={stats.artifacts} label="artifacts">
            <div className="scrollbar-subtle max-h-64 overflow-y-auto">
              {artifacts.map((a) => (
                <div key={a.id} className="flex items-center gap-2 rounded-md px-1.5 py-1 text-sm">
                  <TypeBadge type={a.type} />
                  <span className="min-w-0 flex-1 truncate">{a.title}</span>
                </div>
              ))}
            </div>
          </StatPeek>
          <span aria-hidden="true" className="h-3 w-px shrink-0 bg-border" />
          <StatPeek value={stats.links} label="connections" align="end">
            <p className="px-1.5 py-1 text-xs text-muted-foreground">
              Every verified + proposed link across the space — between artifacts, people, sources, and topics. Trace them in the graph below.
            </p>
          </StatPeek>
        </p>
        {/* one text-less control for everything that needs a human — a count badge + a small menu */}
        <Button
          size="icon"
          variant="outline"
          aria-label="What needs attention"
          className="relative rounded-full"
          onClick={() => setOpen(open === "review" ? null : "review")}
        >
          <Bell className="size-4" />
          {pending.length + stale.length > 0 ? (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-xs font-medium tabular-nums text-primary-foreground">
              {pending.length + stale.length}
            </span>
          ) : null}
        </Button>
      </div>

      {/* Review — the roomy verification queue (replaces the cramped bell popover). Two jobs on two tabs;
          proposed links grouped by source with a Confirm-all batch; verify-on-the-map is one click away.
          The house Dialog, not a hand-rolled fixed div (2026-09-12): the old one drew its own scrim in
          foreground/15, which LIGHTENS charcoal, trapped no focus and named nothing to a screen reader.
          Anchored at the top, not centred: the two tabs are 730px and 180px tall, and a centred box
          re-centres on every tab switch — the header jumped 276px on a click that should move nothing. */}
      <Dialog open={open === "review"} onOpenChange={(o) => (o ? setOpen("review") : setOpen(null))}>
        <DialogContent
          showCloseButton={false}
          className="top-[10vh] flex max-h-[80vh] w-[min(92vw,560px)] max-w-none translate-y-0 flex-col gap-0 overflow-hidden p-0"
        >
          <DialogTitle className="sr-only">What needs attention</DialogTitle>
          <DialogDescription className="sr-only">Proposed links to confirm, and artifacts that are out of date.</DialogDescription>
          {/* On a phone the switch takes the whole first line and the two controls wrap to a second, kept at
              the right edge by ml-auto — the close never lands mid-row. */}
          <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b px-4 py-3 sm:px-5">
            {/* two views of the queue — a neutral segmented switch, so the brand green is reserved for the
                ACTIONS (confirm, verify-on-the-map), not the selection state */}
            <SegToggle
              ariaLabel="Review queue"
              options={[
                { id: "links", label: "Proposed links", count: pending.length },
                { id: "stale", label: "Out of date", count: stale.length },
              ]}
              value={reviewTab}
              onChange={(v) => setReviewTab(v as "links" | "stale")}
            />
            <div className="ml-auto flex items-center gap-1">
              {reviewTab === "links" && pending.length ? (
                // a quiet WORD on the shadcn sm size (28px, the close button's height) — it was a bare 18px
                // text button with no padding, no hover ground and a 127×18 target
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => setOpen("verify")}
                >
                  <Network /> Verify on the map
                </Button>
              ) : null}
              <IconButton label="Close" size="icon-sm" onClick={() => setOpen(null)}>
                <X className="size-4" />
              </IconButton>
            </div>
          </div>

          <div className="scrollbar-subtle min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
            {reviewTab === "links" ? (
              pending.length ? (
                <div className="flex flex-col gap-6">
                  {pendingBySource.map((links) => (
                    <div key={links[0].fromId}>
                      {/* the source these proposals hang off — Woven drew them; the rows below are the calls.
                          De-boxed (no card) so the queue reads as one field, not a stack of outlined boxes.
                          The mark and the batch each sit in a slot one title-line tall, so a title that wraps
                          on a phone keeps both on its first line; the title itself never truncates — there is
                          no fuller form of the name one click away in here. */}
                      <div className="flex items-start gap-2">
                        <span className="flex h-(--text-base--line-height) shrink-0 items-center">
                          <NodeMark node={{ id: links[0].fromId, kind: links[0].fromKind }} className="size-3" />
                        </span>
                        <span className="min-w-0 flex-1 text-base font-medium">{links[0].fromLabel}</span>
                        {/* the batch confirm only earns its place for a real batch (2+); a single proposal is
                            confirmed by its own row valve below — no duplicate control stacked above it */}
                        {links.length > 1 ? (
                          <span className="flex h-(--text-base--line-height) shrink-0 items-center">
                            <Button size="sm" variant="confirm" onClick={() => confirmAll(links)}>
                              <Check /> Confirm all {links.length}
                            </Button>
                          </span>
                        ) : null}
                      </div>
                      {/* borderless, divided rows — the Inbox's decision grammar: relation → target reads as a
                          phrase, the confidence word says how sure Woven is, the valve is the call. The rows
                          hang under the source's TEXT (pl-5 = its mark + gap), not under its mark: the source
                          is the subject of every phrase below it, and a predicate indents under its subject. */}
                      <div className={`mt-1 flex flex-col pl-5 ${DIVIDED}`}>
                        {/* each row is a two-column grid, not a flex row: the call (word + valve) belongs to
                            the phrase's line, the rationale to the whole row. As a flex row the cluster
                            reserved its column for the row's full height, and on a phone the rationale
                            wrapped at half the width beside an empty 125px column. */}
                        {links.map((p) => (
                          <div key={p.edge_id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 py-2.5">
                            {/* the phrase is PROSE, not a flex row of chips: the target's mark is an inline
                                block welded to the first word of its name (a line may break on either side of
                                an atomic inline, so the weld is a nowrap span around mark + first word), and
                                the rest of the name flows. On a phone the mark can never end one line with the
                                name starting the next. */}
                            <p className="min-w-0 text-sm">
                              <span className="text-muted-foreground">{VERB[p.type]}</span>{" "}
                              <MarkedName node={{ id: p.toId, kind: p.toKind }} className="font-medium">
                                {p.toLabel}
                              </MarkedName>
                            </p>
                            {/* the cluster sits on the phrase's FIRST line: a slot one text-sm line tall, the
                                24px valve centred in it (it was mt-0.5 + 24px, 5.5px below the line's centre).
                                gap-4, one gutter: the word must break from the ✓ ✕ cluster, or "Unsure" reads
                                as a caption on the tick */}
                            <div className="flex h-(--text-sm--line-height) items-center gap-4">
                              <ConfidenceWord value={p.confidence} />
                              <Valve
                                size="icon-xs"
                                onConfirm={() => resolve(p.edge_id, "confirm", `${links[0].fromLabel} → ${p.toLabel}`)}
                                onDismiss={() => resolve(p.edge_id, "discard", `${links[0].fromLabel} → ${p.toLabel}`)}
                              />
                            </div>
                            {/* the WHY — the one line the reader decides on. text-sm, the rung the Inbox's
                                rationale line already wears; it was text-xs, a caption's rung */}
                            {p.rationale ? <p className="col-span-2 mt-1 text-sm text-muted-foreground">{p.rationale}</p> : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">All links verified — nothing pending.</p>
              )
            ) : stale.length ? (
              <div className={`flex flex-col ${DIVIDED}`}>
                {stale.map((a) => {
                  // honest state: superseded = just an older version exists (historical, not urgent → neutral);
                  // review = the artifact's freshness has actually gone stale and wants a look (→ warn).
                  // The state is the WORD in the trailing slot; the row's mark is the artifact's own identity
                  // mark, the same one it wears on the other tab. It was a 6px dot coloured by state — a
                  // node-shaped mark whose hue meant something other than identity, and a hand-written alpha.
                  const superseded = getFreshness(a.id).state === "superseded";
                  return (
                    <Link
                      key={a.id}
                      href={`/artifact/${a.id}`}
                      className={cn(
                        "group/row -mx-2 flex items-center gap-2 rounded-md px-2 py-2.5 transition-colors hover:bg-tint-1 active:bg-tint-2",
                        FOCUS_RING,
                      )}
                    >
                      <NodeMark node={{ id: a.id, kind: "artifact" }} className="size-3 shrink-0" />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{a.title}</span>
                      <span className={cn("shrink-0 text-sm", superseded ? "text-muted-foreground" : "text-warn")}>
                        {superseded ? "superseded" : "review"}
                      </span>
                      <ArrowRight className={cn("size-3.5 shrink-0 text-muted-foreground", ROW_REVEAL)} aria-hidden="true" />
                    </Link>
                  );
                })}
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">Everything's current.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* verify mode — a quiet cue above the field, since verifying now happens ON the graph's edges */}
      {open === "verify" ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card px-3.5 py-2.5 text-sm">
          <span className="text-muted-foreground">
            Hover a proposed link on the map to confirm or dismiss it.
          </span>
          <button
            onClick={() => setOpen(null)}
            className="shrink-0 font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Done
          </button>
        </div>
      ) : null}

      {/* the space's field — the hero + the page's one navigable surface (click a node to inspect) */}
      <div id="space-graph" className={`relative overflow-hidden rounded-lg bg-card ${open === "verify" ? "mt-3" : "mt-6"}`}>
        <div className="px-4 pt-8 pb-8 sm:px-6">
          <LocalGraph
            data={graphData}
            layout={open === "verify" ? "force" : "orbit"}
            spread={open === "verify"}
            onSelect={() => {}}
            renderPopover={(id, api) => {
              if (id === SPACE_ID) return null; // the space center isn't an inspectable entity
              const n = graphData.nodes.find((x) => x.id === id);
              return n ? <EntityProfile node={n} placement="popover" onSelect={api.select} /> : null;
            }}
            onVerifyEdge={
              open === "verify"
                ? (edgeId, action) => {
                    const p = pending.find((x) => x.edge_id === edgeId);
                    resolve(edgeId, action, p ? `${p.fromLabel} → ${p.toLabel}` : "link");
                  }
                : undefined
            }
          />
        </div>
        <GraphLegend colorLabel="By team" colorDot={false} className="absolute top-3 left-4 sm:left-6" />
      </div>

    </div>
  );
}

