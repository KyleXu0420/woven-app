"use client";

import * as React from "react";
import Link from "next/link";
import { PAGE_FRAME } from "@/lib/frame";
import { ArrowRight, X, Bell, Check, Network } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Valve, ConfidenceTag } from "@/components/proposal";
import { SegToggle } from "@/components/controls";
import { PageHeading } from "@/components/page-heading";
import { LocalGraph, GraphLegend } from "@/components/local-graph";
import { EntityProfile, NodeMark } from "@/components/entity-profile";
import type { EdgeType, PendingEdge } from "@/lib/types";
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

  // Esc closes the Review overlay
  React.useEffect(() => {
    if (open !== "review") return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className={PAGE_FRAME.browse}>
      <PageHeading
        title={space?.name ?? "Team"}
        hint="Your whole space at a glance — its shape, its field of collections and people, and what needs a human. Tend it here: verify links, focus the graph. One tier up from a single collection's map."
      />

      {/* one status bar — size at a glance (quiet, left) + what needs a human (actionable chips, right) */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px] text-muted-foreground">
          <StatPeek value={stats.people} label="people">
            <div className="scrollbar-subtle max-h-64 overflow-y-auto">
              {people.map((p) => (
                <div key={p.id} className="flex items-center gap-2 rounded-md px-1.5 py-1 text-[13px]">
                  <PersonAvatar seed={p.id} name={p.name} initials={p.initial} size="xs" />
                  <span className="min-w-0 flex-1 truncate">{p.name}</span>
                  <span className="shrink-0 text-[12px] text-muted-foreground">{p.role}</span>
                </div>
              ))}
            </div>
          </StatPeek>
          <span className="opacity-40">·</span>
          <StatPeek value={stats.collections} label="collections">
            {collections.map((c) => (
              <div key={c.id} className="flex items-center gap-2 rounded-md px-1.5 py-1 text-[13px]">
                <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: c.color }} />
                <span className="min-w-0 flex-1 truncate">{c.name}</span>
              </div>
            ))}
          </StatPeek>
          <span className="opacity-40">·</span>
          <StatPeek value={stats.artifacts} label="artifacts">
            <div className="scrollbar-subtle max-h-64 overflow-y-auto">
              {artifacts.map((a) => (
                <div key={a.id} className="flex items-center gap-2 rounded-md px-1.5 py-1 text-[13px]">
                  <TypeBadge type={a.type} />
                  <span className="min-w-0 flex-1 truncate">{a.title}</span>
                </div>
              ))}
            </div>
          </StatPeek>
          <span className="opacity-40">·</span>
          <StatPeek value={stats.links} label="connections" align="end">
            <p className="px-1.5 py-1 text-[13px] leading-snug text-muted-foreground">
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
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-semibold tabular-nums text-primary-foreground">
              {pending.length + stale.length}
            </span>
          ) : null}
        </Button>
      </div>

      {/* Review — the roomy verification queue (replaces the cramped bell popover). Two jobs on two tabs;
          proposed links grouped by source with a Confirm-all batch; verify-on-the-map is one click away. */}
      {open === "review" ? (
        <>
          <div
            className="fixed inset-0 z-40 bg-foreground/15 duration-150 animate-in fade-in-0 supports-backdrop-filter:backdrop-blur-[1px]"
            onClick={() => setOpen(null)}
            aria-hidden
          />
          <div
            role="dialog"
            aria-modal="true"
            className="fixed top-1/2 left-1/2 z-50 flex max-h-[82vh] w-[min(92vw,560px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border bg-card shadow-xl ring-1 ring-foreground/5 duration-150 animate-in fade-in-0 zoom-in-95"
          >
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
            {/* two views of the queue — a neutral segmented switch, so the brand green is reserved for the
                ACTIONS (confirm, verify-on-the-map), not the selection state */}
            <SegToggle
              options={[
                { id: "links", label: `Proposed links · ${pending.length}` },
                { id: "stale", label: `Out of date · ${stale.length}` },
              ]}
              value={reviewTab}
              onChange={(v) => setReviewTab(v as "links" | "stale")}
            />
            <div className="flex items-center gap-3">
              {reviewTab === "links" && pending.length ? (
                <button
                  onClick={() => setOpen("verify")}
                  className="inline-flex items-center gap-1.5 text-[13px] font-medium text-primary transition-colors hover:text-primary/80"
                >
                  <Network className="size-3.5" /> Verify on the map
                </button>
              ) : null}
              <button
                onClick={() => setOpen(null)}
                aria-label="Close"
                className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/[0.04] hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>
            </div>

            <div className="scrollbar-subtle min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
              {reviewTab === "links" ? (
            pending.length ? (
              <div className="flex flex-col gap-5">
                {pendingBySource.map((links) => (
                  <div key={links[0].fromId}>
                    {/* the source these proposals hang off — Woven drew them; the rows below are the calls.
                        De-boxed (no card) so the queue reads as one field, not a stack of outlined boxes */}
                    <div className="mb-1 flex items-center gap-2">
                      <NodeMark node={{ id: links[0].fromId, kind: links[0].fromKind }} className="size-3 shrink-0" />
                      <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{links[0].fromLabel}</span>
                      {/* the batch confirm only earns its place for a real batch (2+); a single proposal is
                          confirmed by its own row valve below — no duplicate control stacked above it */}
                      {links.length > 1 ? (
                        <button
                          onClick={() => confirmAll(links)}
                          className="inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1.5 text-[11.5px] font-medium text-primary transition-colors hover:bg-primary/10"
                        >
                          <Check className="size-3.5" /> Confirm all {links.length}
                        </button>
                      ) : null}
                    </div>
                    {/* borderless, divided rows — the Inbox's decision grammar: relation → target reads as a
                        phrase, the calm 3-bar meter says how sure Woven is, the valve is the call */}
                    <div className="flex flex-col [&>*+*]:border-t [&>*+*]:border-border/60">
                      {links.map((p) => (
                        <div key={p.edge_id} className="flex items-start gap-3 py-2.5">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[14px]">
                              <span className="shrink-0 text-muted-foreground">{VERB[p.type]}</span>
                              <NodeMark node={{ id: p.toId, kind: p.toKind }} className="size-2.5 shrink-0" />
                              <span className="truncate font-medium">{p.toLabel}</span>
                            </div>
                            {p.rationale ? (
                              <p className="mt-1 text-[13px] leading-snug text-muted-foreground">{p.rationale}</p>
                            ) : null}
                          </div>
                          <div className="mt-0.5 flex shrink-0 items-center gap-2.5">
                            <ConfidenceTag value={p.confidence} />
                            <Valve
                              size="icon-xs"
                              onConfirm={() => resolve(p.edge_id, "confirm", `${links[0].fromLabel} → ${p.toLabel}`)}
                              onDismiss={() => resolve(p.edge_id, "discard", `${links[0].fromLabel} → ${p.toLabel}`)}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-8 text-center text-[14px] text-muted-foreground">All links verified — nothing pending.</p>
            )
          ) : stale.length ? (
            <div className="flex flex-col [&>*+*]:border-t">
              {stale.map((a) => {
                // honest state: superseded = just an older version exists (historical, not urgent → neutral);
                // review = the artifact's freshness has actually gone stale and wants a look (→ warn)
                const superseded = getFreshness(a.id).state === "superseded";
                return (
                  <Link
                    key={a.id}
                    href={`/artifact/${a.id}`}
                    className="group/ood flex items-center gap-3 py-2.5 transition-colors hover:bg-foreground/[0.02]"
                  >
                    <span className={`size-1.5 shrink-0 rounded-full ${superseded ? "bg-muted-foreground/40" : "bg-warn"}`} />
                    <span className="min-w-0 flex-1 truncate text-[14px] font-medium">{a.title}</span>
                    <span className={`shrink-0 text-[13px] ${superseded ? "text-muted-foreground" : "text-warn"}`}>
                      {superseded ? "superseded" : "review"}
                    </span>
                    <ArrowRight className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/ood:opacity-100" />
                  </Link>
                );
              })}
            </div>
          ) : (
            <p className="py-8 text-center text-[14px] text-muted-foreground">Everything's current.</p>
          )}
            </div>
          </div>
        </>
      ) : null}

      {/* verify mode — a quiet cue above the field, since verifying now happens ON the graph's edges */}
      {open === "verify" ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-card px-3.5 py-2.5 text-[14px]">
          <span className="text-muted-foreground">
            Hover a proposed link on the map to confirm or dismiss it.
          </span>
          <button
            onClick={() => setOpen(null)}
            className="shrink-0 font-medium text-primary transition-colors hover:text-primary/80"
          >
            Done
          </button>
        </div>
      ) : null}

      {/* the space's field — the hero + the page's one navigable surface (click a node to inspect) */}
      <div id="space-graph" className={`relative overflow-hidden rounded-2xl border bg-card ${open === "verify" ? "mt-3" : "mt-6"}`}>
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
        <GraphLegend colorLabel="Colour = team" colorDot={false} className="pointer-events-none absolute top-3 left-4 sm:left-6" />
      </div>

    </div>
  );
}

