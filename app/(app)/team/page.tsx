"use client";

import * as React from "react";
import Link from "next/link";
import { Clock, ArrowRight, X, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Valve } from "@/components/proposal";
import { PageHeading } from "@/components/page-heading";
import { LocalGraph, GraphLegend } from "@/components/local-graph";
import { EntityProfile, NodeMark } from "@/components/entity-profile";
import type { EdgeType } from "@/lib/types";
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
  const [open, setOpen] = React.useState<null | "verify" | "stale">(null);
  const [menuOpen, setMenuOpen] = React.useState(false);
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
        <Popover open={menuOpen} onOpenChange={setMenuOpen}>
          <PopoverTrigger
            render={<Button size="icon" variant="outline" aria-label="What needs attention" className="relative rounded-full" />}
          >
            <Bell className="size-4" />
            {pending.length + stale.length > 0 ? (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold tabular-nums text-primary-foreground">
                {pending.length + stale.length}
              </span>
            ) : null}
          </PopoverTrigger>
          <PopoverContent align="end" className="max-h-[72vh] w-80 overflow-y-auto p-1.5">
            {pending.length === 0 && stale.length === 0 ? (
              <p className="px-1.5 py-6 text-center text-[13px] text-muted-foreground">All clear — nothing needs you.</p>
            ) : null}

            {pending.length ? (
              <div>
                <div className="flex items-center justify-between px-1.5 pt-1 pb-1">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Proposed links
                  </span>
                  <button
                    onClick={() => {
                      setOpen("verify");
                      setMenuOpen(false);
                    }}
                    className="text-[11px] font-medium text-primary transition-colors hover:text-primary/80"
                  >
                    On the map
                  </button>
                </div>
                <div className="flex flex-col gap-4">
                  {pendingBySource.map((links) => (
                    <div key={links[0].fromId}>
                      <div className="flex items-center gap-2 px-1.5">
                        <NodeMark node={{ id: links[0].fromId, kind: links[0].fromKind }} className="size-3.5 shrink-0" />
                        <span className="truncate text-sm font-medium">{links[0].fromLabel}</span>
                      </div>
                      <div className="mt-1.5 flex flex-col gap-2">
                        {links.map((p) => (
                          <div
                            key={p.edge_id}
                            className="flex items-start gap-2 rounded-md py-1 pr-1.5 pl-3 hover:bg-foreground/[0.03]"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className="inline-flex shrink-0 items-center rounded bg-foreground/[0.05] px-1.5 py-px text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                  {VERB[p.type]}
                                </span>
                                <NodeMark node={{ id: p.toId, kind: p.toKind }} className="size-2.5 shrink-0" />
                                <span className="truncate text-[13px] font-medium">{p.toLabel}</span>
                              </div>
                              {p.rationale ? (
                                <p className="mt-0.5 pr-1 text-[12px] leading-snug text-muted-foreground">
                                  {p.rationale}
                                </p>
                              ) : null}
                            </div>
                            <Valve
                              size="icon-xs"
                              className="mt-0.5"
                              onConfirm={() => resolve(p.edge_id, "confirm", `${links[0].fromLabel} → ${p.toLabel}`)}
                              onDismiss={() => resolve(p.edge_id, "discard", `${links[0].fromLabel} → ${p.toLabel}`)}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {stale.length ? (
              <div className={pending.length ? "mt-3 border-t pt-2.5" : ""}>
                <span className="block px-1.5 pt-1 pb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Out of date
                </span>
                {stale.map((a) => (
                  <Link
                    key={a.id}
                    href={`/artifact/${a.id}`}
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 rounded-md px-1.5 py-1.5 text-[13px] transition-colors hover:bg-foreground/[0.03]"
                  >
                    <span className="size-1.5 shrink-0 rounded-full bg-amber-500" />
                    <span className="min-w-0 flex-1 truncate font-medium">{a.title}</span>
                  </Link>
                ))}
              </div>
            ) : null}
          </PopoverContent>
        </Popover>
      </div>

      {/* the stale drawer — a short list of out-of-date artifacts, each a link to the one to fix. (Verify
          no longer uses a drawer: proposed links are resolved on the graph above.) */}
      {open === "stale" ? (
        <>
          {/* transparent catcher — click-away closes, but the space graph stays fully lit beside the drawer */}
          <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setOpen(null)} aria-hidden />
          <aside className="fixed right-0 top-0 z-50 flex h-full w-[88vw] max-w-[380px] flex-col border-l bg-background shadow-xl duration-300 ease-out animate-in slide-in-from-right">
            <div className="flex h-14 shrink-0 items-center justify-between border-b px-4">
              <span className="inline-flex items-center gap-2 text-sm font-medium">
                <Clock className="size-4 text-amber-500" /> Out of date
              </span>
              <button
                onClick={() => setOpen(null)}
                aria-label="Close"
                className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/[0.04] hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="scrollbar-subtle flex-1 overflow-y-auto p-3">
              {stale.length ? (
                <div className="flex flex-col [&>*+*]:border-t">
                  {stale.map((a) => {
                    const f = getFreshness(a.id);
                    return (
                      <Link
                        key={a.id}
                        href={`/artifact/${a.id}`}
                        className="flex items-center gap-3 py-3 transition-colors hover:bg-foreground/[0.02]"
                      >
                        <span className="size-1.5 shrink-0 rounded-full bg-amber-500" />
                        <span className="min-w-0 flex-1 text-[13px] font-medium">{a.title}</span>
                        <span className="shrink-0 text-[12px] text-muted-foreground">
                          {f.state === "superseded" ? "superseded" : "review"}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <p className="py-6 text-center text-[13px] text-muted-foreground">Everything's current.</p>
              )}
            </div>
          </aside>
        </>
      ) : null}

      {/* verify mode — a quiet cue above the field, since verifying now happens ON the graph's edges */}
      {open === "verify" ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/20 bg-primary/[0.04] px-3 py-2 text-[13px]">
          <span className="text-muted-foreground">
            Verifying <span className="font-medium text-foreground">{pending.length}</span> proposed link
            {pending.length === 1 ? "" : "s"} — hover an edge, then ✓ confirm or ✕ dismiss.
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

