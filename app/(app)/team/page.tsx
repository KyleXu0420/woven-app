"use client";

import * as React from "react";
import Link from "next/link";
import { Sparkles, Clock, ArrowRight, ChevronDown } from "lucide-react";
import { PageHeading } from "@/components/page-heading";
import { LocalGraph, GraphLegend } from "@/components/local-graph";
import { EntityProfile } from "@/components/entity-profile";
import { PersonAvatar } from "@/components/identity";
import { Valve } from "@/components/proposal";
import { notify, toasts } from "@/lib/notifications";
import {
  getFreshness,
  listArtifacts,
  listPeople,
  listPending,
  restoreEdge,
  spaceById,
  teamGraph,
  verifyEdge,
  workspaceStats,
} from "@/lib/api";
import { bumpGraph } from "@/lib/store";

const SPACE_ID = "sp_product";

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
  const [, bump] = React.useReducer((x: number) => x + 1, 0); // re-read live counts after an inline verify
  const node = selected && selected !== SPACE_ID ? nb.nodes.find((n) => n.id === selected) : undefined;

  // KB health — computed each render (not memoised) so verifying inline updates the counts immediately.
  const pending = listPending();
  const stale = listArtifacts().filter((a) => getFreshness(a.id).state !== "fresh");

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
        <div className="flex items-center gap-2">
          <HealthChip
            icon={Sparkles}
            n={pending.length}
            label="to verify"
            open={open === "verify"}
            onToggle={() => setOpen(open === "verify" ? null : "verify")}
          />
          <HealthChip
            icon={Clock}
            n={stale.length}
            label="out of date"
            amber
            open={open === "stale"}
            onToggle={() => setOpen(open === "stale" ? null : "stale")}
          />
        </div>
      </div>

      {/* the expanded panel — verify links, or the specific stale artifacts, in context with the graph */}
      {open === "verify" ? (
        <div className="mt-2 overflow-hidden rounded-xl border bg-card [&>*+*]:border-t">
          {pending.length ? (
            pending.map((p) => (
              <div key={p.edge_id} className="flex items-center gap-3 p-3">
                <span className="min-w-0 flex-1 text-[13px] leading-snug">
                  <span className="font-medium">{p.fromLabel}</span>{" "}
                  <span className="text-muted-foreground">→ {p.toLabel}</span>
                  {p.rationale ? (
                    <span className="mt-0.5 block truncate text-[12px] text-muted-foreground">{p.rationale}</span>
                  ) : null}
                </span>
                <Valve
                  size="icon-xs"
                  onConfirm={() => resolve(p.edge_id, "confirm", `${p.fromLabel} → ${p.toLabel}`)}
                  onDismiss={() => resolve(p.edge_id, "discard", `${p.fromLabel} → ${p.toLabel}`)}
                />
              </div>
            ))
          ) : (
            <p className="p-3 text-[13px] text-muted-foreground">Nothing to verify — the graph is all confirmed.</p>
          )}
        </div>
      ) : open === "stale" ? (
        <div className="mt-2 overflow-hidden rounded-xl border bg-card [&>*+*]:border-t">
          {stale.length ? (
            stale.map((a) => {
              const f = getFreshness(a.id);
              return (
                <Link
                  key={a.id}
                  href={`/artifact/${a.id}`}
                  className="flex items-center gap-3 p-3 transition-colors hover:bg-foreground/[0.02]"
                >
                  <span className="size-1.5 shrink-0 rounded-full bg-amber-500" />
                  <span className="min-w-0 flex-1 text-[13px] font-medium">{a.title}</span>
                  <span className="shrink-0 text-[12px] text-muted-foreground">
                    {f.state === "superseded" ? "superseded" : "review"}
                  </span>
                </Link>
              );
            })
          ) : (
            <p className="p-3 text-[13px] text-muted-foreground">Everything's current.</p>
          )}
        </div>
      ) : null}

      {/* the space's field — the hero + the page's one navigable surface (click a node to inspect) */}
      <div id="space-graph" className="relative mt-6 overflow-hidden rounded-2xl border bg-card">
        <div className="px-4 pt-8 pb-8 sm:px-6">
          <LocalGraph
            data={nb}
            onSelect={(id) => {
              if (id !== SPACE_ID) setSelected(id);
            }}
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

function HealthChip({
  icon: Icon,
  n,
  label,
  amber,
  open,
  onToggle,
}: {
  icon: typeof Sparkles;
  n: number;
  label: string;
  amber?: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      aria-expanded={open}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[13px] transition-colors ${
        open ? "border-foreground/20 bg-foreground/[0.04]" : "hover:bg-foreground/[0.03]"
      }`}
    >
      <Icon className={`size-3.5 shrink-0 ${amber ? "text-amber-500" : "text-primary"}`} />
      <span className="font-medium tabular-nums">{n}</span>
      <span className="text-muted-foreground">{label}</span>
      <ChevronDown className={`size-3.5 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
    </button>
  );
}
