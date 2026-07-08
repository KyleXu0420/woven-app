"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, X, Bell, Check, Network } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Valve } from "@/components/proposal";
import { PageHeading } from "@/components/page-heading";
import { LocalGraph, GraphLegend } from "@/components/local-graph";
import { EntityProfile, NodeMark } from "@/components/entity-profile";
import type { EdgeType, PendingEdge } from "@/lib/types";
import { PersonAvatar } from "@/components/identity";
import { notify, toasts } from "@/lib/notifications";
import {
  getFreshness,
  listArtifacts,
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

function RailLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{children}</p>
  );
}

// Team — the space's SITUATION ROOM (not an entity explorer): the whole collective brain at a glance,
// and you TEND it in place. Its shape (pulse line), its field (the space graph — the hero), what needs a
// human (KB health you verify inline), and who's in it (a contributors strip that focuses the graph).
// The graph is the one in-page surface; the rest are lenses + actions on it, not links away.
export default function TeamPage() {
  const space = spaceById(SPACE_ID);
  const nb = React.useMemo(() => teamGraph(SPACE_ID), []);
  const stats = React.useMemo(() => workspaceStats(), []);
  const people = React.useMemo(() => listPeople(), []);
  const [selected, setSelected] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState<null | "verify" | "review">(null);
  const [reviewTab, setReviewTab] = React.useState<"links" | "stale">("links");
  const [, bump] = React.useReducer((x: number) => x + 1, 0); // re-read live counts after an inline verify
  // verify mode swaps the space graph to the pending-links map — the exact edges you're resolving, each
  // with an in-place ✓ / ✕. Resolving drops it from listPending, so the next render removes it from view.
  const graphData = open === "verify" ? pendingGraph() : nb;
  const node = selected && selected !== SPACE_ID ? graphData.nodes.find((n) => n.id === selected) : undefined;

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

  const pulse = [
    { v: stats.people, l: "people" },
    { v: stats.collections, l: "collections" },
    { v: stats.artifacts, l: "artifacts" },
    { v: stats.links, l: "connections" },
  ];

  return (
    <div className="mx-auto w-full max-w-5xl p-8 sm:p-10">
      <PageHeading
        title={space?.name ?? "Team"}
        hint="Your whole space at a glance — its shape, its field of collections and people, and what needs a human. Tend it here: verify links, focus the graph. One tier up from a single collection's map."
      />

      {/* one status bar — size at a glance (quiet, left) + what needs a human (actionable chips, right) */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
          {pulse.map((s, i) => (
            <React.Fragment key={s.l}>
              {i > 0 ? <span className="opacity-40">·</span> : null}
              <span>
                <span className="font-medium tabular-nums text-foreground">{s.v}</span> {s.l}
              </span>
            </React.Fragment>
          ))}
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
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold tabular-nums text-primary-foreground">
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
            <div className="flex gap-1.5">
              <button
                onClick={() => setReviewTab("links")}
                className={`rounded-full px-3 py-1 text-[12.5px] transition-colors ${
                  reviewTab === "links"
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Proposed links · {pending.length}
              </button>
              <button
                onClick={() => setReviewTab("stale")}
                className={`rounded-full px-3 py-1 text-[12.5px] transition-colors ${
                  reviewTab === "stale"
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Out of date · {stale.length}
              </button>
            </div>
            <div className="flex items-center gap-3">
              {reviewTab === "links" && pending.length ? (
                <button
                  onClick={() => setOpen("verify")}
                  className="inline-flex items-center gap-1.5 text-[12px] font-medium text-primary transition-colors hover:text-primary/80"
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
              <div className="flex flex-col gap-2.5">
                {pendingBySource.map((links) => (
                  <div key={links[0].fromId} className="rounded-xl border bg-background/40 p-3.5">
                    <div className="mb-2.5 flex items-center gap-2">
                      <NodeMark node={{ id: links[0].fromId, kind: links[0].fromKind }} className="size-3 shrink-0" />
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold">{links[0].fromLabel}</span>
                      <button
                        onClick={() => confirmAll(links)}
                        className="inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1.5 text-[11.5px] font-medium text-primary transition-colors hover:bg-primary/10"
                      >
                        <Check className="size-3.5" /> Confirm{links.length > 1 ? ` all ${links.length}` : ""}
                      </button>
                    </div>
                    <div className="flex flex-col [&>*+*]:border-t [&>*+*]:border-border/60">
                      {links.map((p) => (
                        <div key={p.edge_id} className="flex items-center gap-3 py-3 first:pt-1">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <span className="inline-flex shrink-0 items-center rounded bg-foreground/[0.06] px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                                {VERB[p.type]}
                              </span>
                              <NodeMark node={{ id: p.toId, kind: p.toKind }} className="size-2.5 shrink-0" />
                              <span className="truncate text-[13px] font-medium">{p.toLabel}</span>
                            </div>
                            {p.rationale ? (
                              <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">{p.rationale}</p>
                            ) : null}
                          </div>
                          <Valve
                            size="icon-xs"
                            className="shrink-0"
                            onConfirm={() => resolve(p.edge_id, "confirm", `${links[0].fromLabel} → ${p.toLabel}`)}
                            onDismiss={() => resolve(p.edge_id, "discard", `${links[0].fromLabel} → ${p.toLabel}`)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-8 text-center text-[13px] text-muted-foreground">All links verified — nothing pending.</p>
            )
          ) : stale.length ? (
            <div className="flex flex-col [&>*+*]:border-t">
              {stale.map((a) => {
                const f = getFreshness(a.id);
                return (
                  <Link
                    key={a.id}
                    href={`/artifact/${a.id}`}
                    className="group/ood flex items-center gap-3 py-2.5 transition-colors hover:bg-foreground/[0.02]"
                  >
                    <span className="size-1.5 shrink-0 rounded-full bg-amber-500" />
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{a.title}</span>
                    <span className="shrink-0 text-[12px] text-muted-foreground">
                      {f.state === "superseded" ? "superseded" : "review"}
                    </span>
                    <ArrowRight className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/ood:opacity-100" />
                  </Link>
                );
              })}
            </div>
          ) : (
            <p className="py-8 text-center text-[13px] text-muted-foreground">Everything's current.</p>
          )}
            </div>
          </div>
        </>
      ) : null}

      {/* verify mode — a quiet cue above the field, since verifying now happens ON the graph's edges */}
      {open === "verify" ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-card px-3.5 py-2.5 text-[13px]">
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
            spread={open === "verify"}
            onSelect={(id) => {
              if (id !== SPACE_ID) setSelected(id);
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
        <GraphLegend className="pointer-events-none absolute top-3 left-4 sm:left-6" />
      </div>

      {node ? (
        <div className="mt-3">
          <EntityProfile node={node} placement="inline" onSelect={setSelected} />
        </div>
      ) : null}

      {/* contributors — click to focus that person IN the graph above; the full roster lives on People */}
      <div className="mt-10">
        <div className="mb-3 flex items-center justify-between gap-2">
          <RailLabel>Contributors · {people.length}</RailLabel>
          <Link
            href="/people"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            See all <ArrowRight className="size-3.5" />
          </Link>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {people.map((p) => {
            const on = selected === p.id;
            return (
              <button
                key={p.id}
                onClick={() => {
                  setSelected(p.id);
                  document.getElementById("space-graph")?.scrollIntoView({ behavior: "smooth", block: "center" });
                }}
                className={`inline-flex items-center gap-1.5 rounded-full border py-1 pr-3 pl-1 text-[13px] transition-colors ${
                  on ? "border-primary/40 bg-primary/[0.06]" : "bg-card hover:bg-foreground/[0.04]"
                }`}
              >
                <PersonAvatar seed={p.id} name={p.name} size="xs" />
                <span className="truncate">{p.name}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

