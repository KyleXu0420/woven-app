"use client";

import * as React from "react";
import { ArrowUpDown, Briefcase, Search, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { FacetBar, type FacetDef } from "./facet-filter";
import { NodeMark } from "./entity-profile";
import { PersonAvatar } from "./identity";
import { personById, relationCount } from "@/lib/api";

type Ent = { id: string; name: string };

// EntityDirectory — the Library, for people and topics: a browsable, filterable list of ALL of them
// (search + a facet bar) that opens the Explorer focused on whichever you pick. The Library filters
// artifacts; this filters the entities themselves, then hands off to the neighborhood view.
export function EntityDirectory({
  entities,
  kind,
  onOpen,
}: {
  entities: Ent[];
  kind: "person" | "topic";
  onOpen: (id: string) => void;
}) {
  const [q, setQ] = React.useState("");
  const empty = { sort: "Most connected", role: "Any" } as Record<string, string>;
  const [facets, setFacets] = React.useState<Record<string, string>>(empty);

  const roles =
    kind === "person"
      ? ["Any", ...Array.from(new Set(entities.map((e) => personById(e.id)?.role).filter(Boolean) as string[]))]
      : [];
  const defs: FacetDef[] = [
    { key: "sort", label: "Sort", icon: ArrowUpDown, options: ["Most connected", "Name"], defaultValue: "Most connected" },
    ...(kind === "person" && roles.length > 2
      ? [{ key: "role", label: "Role", icon: Briefcase, options: roles, defaultValue: "Any" } as FacetDef]
      : []),
  ];

  const ql = q.trim().toLowerCase();
  let shown = entities.filter((e) => e.name.toLowerCase().includes(ql));
  if (kind === "person" && facets.role !== "Any") shown = shown.filter((e) => personById(e.id)?.role === facets.role);
  shown = [...shown].sort((a, b) =>
    facets.sort === "Name" ? a.name.localeCompare(b.name) : relationCount(b.id) - relationCount(a.id),
  );

  return (
    <div>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-full border bg-card px-3.5 sm:max-w-xs">
          <Search className="size-3.5 shrink-0 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={kind === "person" ? "Search people…" : "Search topics…"}
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <FacetBar
          defs={defs}
          values={facets}
          onChange={(k, v) => setFacets((f) => ({ ...f, [k]: v }))}
          onClear={() => setFacets(empty)}
        />
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border bg-card">
        {shown.length ? (
          shown.map((e) => {
            const role = kind === "person" ? personById(e.id)?.role : "Topic";
            const n = relationCount(e.id);
            return (
              <button
                key={e.id}
                onClick={() => onOpen(e.id)}
                className="group flex w-full items-center gap-3 border-t px-4 py-3 text-left transition-colors first:border-t-0 hover:bg-foreground/[0.025]"
              >
                {kind === "person" ? (
                  <PersonAvatar seed={e.id} name={e.name} size="sm" />
                ) : (
                  <NodeMark node={{ id: e.id, kind: "topic" }} className="size-7" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{e.name}</div>
                  {role ? <div className="mt-0.5 truncate text-xs text-muted-foreground">{role}</div> : null}
                </div>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{n} links</span>
                <ArrowRight className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </button>
            );
          })
        ) : (
          <p className="px-4 py-12 text-center text-sm text-muted-foreground">
            {kind === "person" ? "No people match." : "No topics match."}
          </p>
        )}
      </div>
    </div>
  );
}
