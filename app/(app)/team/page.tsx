"use client";

import * as React from "react";
import Link from "next/link";
import { Sparkles, Clock, ArrowRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import { PageHeading } from "@/components/page-heading";
import { LocalGraph, GraphLegend } from "@/components/local-graph";
import { EntityProfile } from "@/components/entity-profile";
import { PersonAvatar } from "@/components/identity";
import {
  getFreshness,
  listArtifacts,
  listPeople,
  listPending,
  spaceById,
  teamGraph,
  workspaceStats,
} from "@/lib/api";

const SPACE_ID = "sp_product";

function RailLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{children}</p>
  );
}

// A single "needs a human" row — a count + where to go clear it. This is what an overview is FOR.
function HealthRow({
  href,
  icon: Icon,
  n,
  label,
  amber,
}: {
  href: string;
  icon: LucideIcon;
  n: number;
  label: string;
  amber?: boolean;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-xl border bg-card px-3.5 py-3 transition-colors hover:bg-foreground/[0.02]"
    >
      <Icon className={`size-4 shrink-0 ${amber ? "text-amber-500" : "text-primary"}`} />
      <span className="min-w-0 flex-1 text-sm">
        <span className="font-medium tabular-nums">{n}</span> <span className="text-muted-foreground">{label}</span>
      </span>
      <ArrowUpRight className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </Link>
  );
}

// Team — the space's SITUATION ROOM (not an entity explorer like People/Topics): the whole collective
// brain at a glance. Its shape (pulse), its field (the space graph, the hero), who's in it (a compact
// contributors strip → People), and what needs a human (KB health → Inbox / Library). One tier up from a
// single collection's map.
export default function TeamPage() {
  const space = spaceById(SPACE_ID);
  const nb = React.useMemo(() => teamGraph(SPACE_ID), []);
  const stats = React.useMemo(() => workspaceStats(), []);
  const people = React.useMemo(() => listPeople(), []);
  const [selected, setSelected] = React.useState<string | null>(null);
  const node = selected && selected !== SPACE_ID ? nb.nodes.find((n) => n.id === selected) : undefined;

  // KB health — the two questions an overview should answer: what's unverified, and what's going stale.
  const toVerify = React.useMemo(() => listPending().length, []);
  const attention = React.useMemo(
    () => listArtifacts().filter((a) => getFreshness(a.id).state !== "fresh").length,
    [],
  );

  const pulse = [
    { v: stats.people, l: "People" },
    { v: stats.collections, l: "Collections" },
    { v: stats.artifacts, l: "Artifacts" },
    { v: stats.links, l: "Connections" },
  ];

  return (
    <div className="mx-auto w-full max-w-5xl p-8 sm:p-10">
      <PageHeading
        title={space?.name ?? "Overview"}
        hint="Your whole space at a glance — its shape, its field of collections and people, and what needs a human. One tier up from a single collection's map."
      />

      {/* a quiet state line — the space's size at a glance, not a scoreboard that owns the page */}
      <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
        {pulse.map((s, i) => (
          <React.Fragment key={s.l}>
            {i > 0 ? <span className="opacity-40">·</span> : null}
            <span>
              <span className="font-medium tabular-nums text-foreground">{s.v}</span> {s.l.toLowerCase()}
            </span>
          </React.Fragment>
        ))}
      </p>

      {/* what needs a human — the situation room's point, up top before you explore the field */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <HealthRow href="/inbox" icon={Sparkles} n={toVerify} label="links to verify" />
        <HealthRow href="/library" icon={Clock} n={attention} label="may be out of date" amber />
      </div>

      {/* the space's field — collections + people wired by participation (the hero) */}
      <div className="relative mt-6 overflow-hidden rounded-2xl border bg-card">
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

      {/* who's in it — a compact strip; the full, filterable roster lives on People */}
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
          {people.map((p) => (
            <Link
              key={p.id}
              href="/people"
              className="inline-flex items-center gap-1.5 rounded-full border bg-card py-1 pr-3 pl-1 text-[13px] transition-colors hover:bg-foreground/[0.04]"
            >
              <PersonAvatar seed={p.id} name={p.name} size="xs" />
              <span className="truncate">{p.name}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
