"use client";

import * as React from "react";
import { PageHeading } from "@/components/page-heading";
import { LocalGraph } from "@/components/local-graph";
import { EntityProfile } from "@/components/entity-profile";
import { AgentAvatar, PersonAvatar } from "@/components/identity";
import {
  listActivity,
  listPeople,
  nodeStats,
  personById,
  spaceById,
  teamGraph,
  workspaceStats,
} from "@/lib/api";

const SPACE_ID = "sp_product";

function RailLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
      {children}
    </p>
  );
}

// Team — the space-scoped map: the whole workspace's collections + people, one tier above a single
// collection's Map. The collective brain at a glance — its shape (pulse), its field (the graph), who's
// in it (people), and its pulse (recent activity).
export default function TeamPage() {
  const space = spaceById(SPACE_ID);
  const nb = React.useMemo(() => teamGraph(SPACE_ID), []);
  const stats = React.useMemo(() => workspaceStats(), []);
  const people = React.useMemo(() => listPeople(), []);
  const activity = React.useMemo(() => listActivity(), []);
  const [selected, setSelected] = React.useState<string | null>(null);
  // the space centre isn't a real entity to profile — only collections / people open a profile
  const node = selected && selected !== SPACE_ID ? nb.nodes.find((n) => n.id === selected) : undefined;

  const pulse = [
    { v: stats.people, l: "People" },
    { v: stats.collections, l: "Collections" },
    { v: stats.artifacts, l: "Artifacts" },
    { v: stats.links, l: "Connections" },
  ];

  return (
    <div className="mx-auto w-full max-w-5xl p-8 sm:p-10">
      <PageHeading
        title={space?.name ?? "Team"}
        hint="The whole team space at a glance — its collections, the people, and who touches what. The collective brain, one tier up from a single collection's map."
      />

      {/* pulse — the collective brain's shape, at a glance */}
      <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-4">
        {pulse.map((s) => (
          <div key={s.l} className="bg-card p-4">
            <div className="font-serif text-2xl tracking-[-0.01em] tabular-nums">{s.v}</div>
            <div className="mt-1 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              {s.l}
            </div>
          </div>
        ))}
      </div>

      {/* the space's field — collections + people, wired by participation */}
      <div className="relative mt-3 overflow-hidden rounded-2xl border bg-card">
        <div className="px-4 pt-8 pb-8 sm:px-6">
          <LocalGraph data={nb} onSelect={setSelected} />
        </div>
      </div>

      {/* profile of the selected collection / person */}
      {node ? (
        <div className="mt-3">
          <EntityProfile node={node} placement="inline" onSelect={setSelected} />
        </div>
      ) : null}

      {/* people + activity — who's in the brain, and what it's been doing */}
      <div className="mt-10 grid gap-x-8 gap-y-8 sm:grid-cols-[minmax(0,1fr)_300px]">
        <div>
          <RailLabel>People · {people.length}</RailLabel>
          <div className="flex flex-col">
            {people.map((p, i) => {
              const st = nodeStats(p.id);
              const authored = st.find((s) => s.label === "Authored")?.value ?? "0";
              const mentioned = st.find((s) => s.label === "Mentioned in")?.value ?? "0";
              return (
                <button
                  key={p.id}
                  onClick={() => setSelected(p.id)}
                  className={`flex items-center gap-3 px-1 py-2.5 text-left transition-colors hover:bg-foreground/[0.03] ${
                    selected === p.id ? "bg-foreground/[0.04]" : ""
                  } ${i > 0 ? "border-t" : ""}`}
                >
                  <PersonAvatar seed={p.id} name={p.name} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{p.name}</span>
                    <span className="block truncate text-[12px] text-muted-foreground">{p.role}</span>
                  </span>
                  <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                    {authored} authored · {mentioned} mentions
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <RailLabel>Recent activity</RailLabel>
          <ol className="flex flex-col gap-3.5">
            {activity.map((a) => {
              const who = a.actor ? personById(a.actor) : undefined;
              return (
                <li key={a.id} className="flex gap-2.5">
                  {a.agent ? (
                    <AgentAvatar size="xs" className="mt-0.5" />
                  ) : (
                    <PersonAvatar
                      seed={a.actor ?? a.initial}
                      name={who?.name ?? a.initial}
                      size="xs"
                      className="mt-0.5"
                    />
                  )}
                  <p className="min-w-0 flex-1 text-[13px] leading-snug text-foreground/85">
                    {a.text}
                    <span className="ml-1.5 font-mono text-[11px] text-muted-foreground">· {a.t}</span>
                  </p>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </div>
  );
}
