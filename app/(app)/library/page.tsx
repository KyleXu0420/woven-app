"use client";

import * as React from "react";
import Link from "next/link";
import {
  MoreHorizontal,
  ArrowUpRight,
  ArrowUpDown,
  Hash,
  CircleDot,
  Calendar,
  Users,
  Waypoints,
  Link2,
  SlidersHorizontal,
  Sparkles,
  Check,
  Archive,
  Download,
  X,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { cn } from "@/lib/utils";
import { FilterChips } from "@/components/controls";
import { FacetBar, type FacetDef } from "@/components/facet-filter";
import { TypeBadge, StatusPill } from "@/components/artifact-ui";
import { AddToCollectionSub, AddToCollectionButton } from "@/components/add-to-collection";
import { notify } from "@/lib/notifications";
import {
  getArtifactGraph,
  getFreshness,
  listArtifacts,
  listCollections,
  listPeople,
  primaryCollection,
  relationCount,
} from "@/lib/api";
import type { Artifact } from "@/lib/types";

const TYPE = ["All", "HTML", "MD", "DOC"];

type Facets = {
  type: string;
  state: string;
  collection: string;
  sort: string;
  date: string;
  person: string;
  has: string;
  review: string;
};
const EMPTY: Facets = {
  type: "All",
  state: "All",
  collection: "All",
  sort: "Recent",
  date: "Any",
  person: "Any",
  has: "Any",
  review: "All",
};

// ——— date bucketing over the prototype's relative `updated` labels ("17m" · "2h" · "6d" · "3w" · "1mo")
function daysAgo(updated: string): number {
  const m = updated.match(/^(\d+)(mo|m|h|d|w|y)/);
  if (!m) return 9999;
  const n = Number(m[1]);
  switch (m[2]) {
    case "m":
    case "h":
      return 0;
    case "d":
      return n;
    case "w":
      return n * 7;
    case "mo":
      return n * 30;
    case "y":
      return n * 365;
    default:
      return 9999;
  }
}
const DATE_MAX: Record<string, number> = { "This week": 7, "This month": 31, "This quarter": 92 };

function Row({
  a,
  index,
  selected,
  anySelected,
  onToggle,
}: {
  a: Artifact;
  index: number;
  selected: boolean;
  anySelected: boolean;
  onToggle: (index: number, shift: boolean) => void;
}) {
  const co = primaryCollection(a.id);
  const fresh = getFreshness(a.id);
  const [, bump] = React.useReducer((x: number) => x + 1, 0);
  function copyLink() {
    navigator.clipboard?.writeText(`woven.dev/a/${a.id}`).catch(() => {});
    notify.success("Link copied", { description: a.title });
  }
  return (
    <div
      className={cn(
        "group relative border-t transition-colors first:border-t-0",
        selected ? "bg-primary/[0.05]" : "hover:bg-foreground/[0.025]",
      )}
    >
      <Link
        href={`/artifact/${a.id}`}
        className="grid grid-cols-[3.5rem_1fr_auto] items-center gap-4 px-4 py-3 sm:grid-cols-[3.5rem_1fr_7rem_4.5rem]"
      >
        {/* the type badge doubles as the select control — badge at rest, a checkbox on hover / in select mode */}
        <span className="relative inline-flex items-center">
          <span className={cn("transition-opacity", selected || anySelected ? "opacity-0" : "group-hover:opacity-0")}>
            <TypeBadge type={a.type} />
          </span>
          <button
            type="button"
            aria-label={selected ? "Deselect" : "Select"}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggle(index, e.shiftKey);
            }}
            className={cn(
              "absolute left-0 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded-[6px] border transition-opacity",
              selected
                ? "border-primary bg-primary text-primary-foreground opacity-100"
                : anySelected
                  ? "border-foreground/30 bg-card opacity-100"
                  : "border-foreground/30 bg-card opacity-0 group-hover:opacity-100",
            )}
          >
            {selected ? <Check className="size-3.5" /> : null}
          </button>
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-medium">{a.title}</span>
            {fresh.state === "stale" ? (
              <span title="May be out of date" className="size-1.5 shrink-0 rounded-full bg-amber-500" />
            ) : fresh.state === "superseded" ? (
              <span className="shrink-0 rounded-full bg-secondary px-1.5 py-px text-[10px] font-medium text-muted-foreground">
                Superseded
              </span>
            ) : null}
          </div>
          {co ? (
            <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: co.color }} />
              <span className="truncate">{co.name}</span>
            </div>
          ) : null}
        </div>
        <div className="hidden sm:block">
          <StatusPill state={a.state} />
        </div>
        <span className="text-right font-mono text-[11px] tabular-nums text-muted-foreground transition-opacity group-hover:opacity-0">
          {a.updated}
        </span>
      </Link>

      <div className="absolute top-1/2 right-2.5 -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="More"
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-foreground/[0.06] hover:text-foreground data-[popup-open]:bg-foreground/[0.06] data-[popup-open]:text-foreground"
          >
            <MoreHorizontal className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={4} className="w-44">
            <DropdownMenuItem render={<Link href={`/artifact/${a.id}`} />} className="gap-2">
              <ArrowUpRight className="size-4 text-muted-foreground" /> Open artifact
            </DropdownMenuItem>
            <AddToCollectionSub artifactIds={[a.id]} onChanged={bump} />
            <DropdownMenuItem className="gap-2" onClick={copyLink}>
              <Link2 className="size-4 text-muted-foreground" /> Copy link
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

export default function LibraryPage() {
  const [facets, setFacets] = React.useState<Facets>(EMPTY);
  const [filterOpen, setFilterOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const lastIndex = React.useRef<number | null>(null);
  const [, bump] = React.useReducer((x: number) => x + 1, 0);

  const all = listArtifacts();
  const collections = listCollections();
  const people = listPeople();
  const set = (k: keyof Facets) => (v: string) => setFacets((f) => ({ ...f, [k]: v }));

  // the 2-step facet set (Type stays a persistent L1 chip row, so it isn't repeated here)
  const defs: FacetDef[] = [
    { key: "sort", label: "Sort by", icon: ArrowUpDown, options: ["Recent", "Name", "Most linked"], defaultValue: "Recent" },
    { key: "collection", label: "Collection", icon: Hash, options: ["All", ...collections.map((c) => c.name)], defaultValue: "All" },
    { key: "state", label: "State", icon: CircleDot, options: ["All", "Living", "Processing"], defaultValue: "All" },
    { key: "date", label: "Date", icon: Calendar, options: ["Any", "This week", "This month", "This quarter"], defaultValue: "Any", variant: "date" },
    { key: "person", label: "People", icon: Users, options: ["Any", ...people.map((p) => p.name)], defaultValue: "Any", variant: "people", people: people.map((p) => ({ id: p.id, name: p.name })) },
    { key: "has", label: "Has", icon: Waypoints, options: ["Any", "Links", "Sources", "Decisions", "People"], defaultValue: "Any" },
    { key: "review", label: "Review", icon: Sparkles, options: ["All", "Needs review", "Verified"], defaultValue: "All" },
  ];

  function matchesPerson(a: Artifact): boolean {
    const pid = people.find((p) => p.name === facets.person)?.id;
    if (!pid) return true;
    if (a.author_id === pid) return true;
    return getArtifactGraph(a.id).people.some((p) => p.id === pid);
  }
  function matchesHas(a: Artifact): boolean {
    const g = getArtifactGraph(a.id);
    if (facets.has === "Links") return g.linkedTo.length + g.linkedFrom.length > 0;
    if (facets.has === "Sources") return g.sources.length > 0;
    if (facets.has === "Decisions") return g.decisions.length > 0;
    if (facets.has === "People") return g.people.length > 0;
    return true;
  }

  const filtered = all.filter((a) => {
    if (facets.type !== "All" && a.type !== facets.type) return false;
    if (facets.state !== "All" && a.state !== facets.state.toLowerCase()) return false;
    if (facets.collection !== "All") {
      const co = collections.find((c) => c.name === facets.collection);
      if (!co || !a.collection_ids.includes(co.id)) return false;
    }
    if (facets.date !== "Any" && daysAgo(a.updated) > (DATE_MAX[facets.date] ?? 9999)) return false;
    if (facets.person !== "Any" && !matchesPerson(a)) return false;
    if (facets.has !== "Any" && !matchesHas(a)) return false;
    if (facets.review !== "All") {
      const pending = getArtifactGraph(a.id).proposed.length > 0;
      if (facets.review === "Needs review" && !pending) return false;
      if (facets.review === "Verified" && pending) return false;
    }
    return true;
  });

  const shown = [...filtered];
  if (facets.sort === "Name") shown.sort((a, b) => a.title.localeCompare(b.title));
  else if (facets.sort === "Most linked") shown.sort((a, b) => relationCount(b.id) - relationCount(a.id));

  // multi-select — a checkbox per row (shift-click extends a range over the shown order); the selection
  // drives a floating bulk toolbar. Selection is tracked by id, so it survives re-sorts + filter changes.
  function toggleSelect(index: number, shift: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (shift && lastIndex.current !== null) {
        const [lo, hi] = [Math.min(lastIndex.current, index), Math.max(lastIndex.current, index)];
        for (let i = lo; i <= hi; i++) next.add(shown[i].id);
      } else {
        const id = shown[index].id;
        if (next.has(id)) next.delete(id);
        else next.add(id);
      }
      return next;
    });
    lastIndex.current = index;
  }
  function clearSelection() {
    setSelected(new Set());
    lastIndex.current = null;
  }

  const activeCount = defs.filter((d) => facets[d.key as keyof Facets] !== d.defaultValue).length;

  return (
    <div className="mx-auto w-full max-w-5xl p-8 sm:p-10">
      <h1 className="font-serif text-3xl font-medium tracking-[-0.01em]">Library</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        <span className="font-medium text-foreground tabular-nums">{all.length}</span> artifacts ·{" "}
        {collections.length} collections
      </p>

      {/* L1 — persistent Type chips + the Filter toggle (reveals the facet bar below) */}
      <div className="mt-6 flex items-center justify-between gap-3">
        <FilterChips options={TYPE} value={facets.type} onChange={set("type")} />
        <button
          onClick={() => setFilterOpen((o) => !o)}
          className={cn(
            "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[0.8rem] font-medium outline-none transition-colors hover:bg-muted",
            filterOpen && "bg-secondary text-foreground",
          )}
        >
          <SlidersHorizontal className="size-3.5" /> Filter
          {activeCount > 0 ? (
            <span className="ml-0.5 rounded-full bg-foreground/10 px-1.5 text-[10px] font-semibold tabular-nums">
              {activeCount}
            </span>
          ) : null}
        </button>
      </div>

      {/* the facet bar — a Mem-style row of facet pills, each opening its own panel of values */}
      {filterOpen ? (
        <div className="mt-3 animate-in fade-in-0 slide-in-from-top-1 duration-150">
          <FacetBar
            defs={defs}
            values={facets}
            onChange={(k, v) => set(k as keyof Facets)(v)}
            onClear={() => setFacets(EMPTY)}
          />
        </div>
      ) : null}

      <div className="mt-4 overflow-hidden rounded-xl border bg-card">
        {shown.length > 0 ? (
          shown.map((a, i) => (
            <Row
              key={a.id}
              a={a}
              index={i}
              selected={selected.has(a.id)}
              anySelected={selected.size > 0}
              onToggle={toggleSelect}
            />
          ))
        ) : (
          <p className="px-4 py-12 text-center text-sm text-muted-foreground">
            No artifacts match these filters.
          </p>
        )}
      </div>

      {/* bulk-select toolbar — floats up once anything is selected; reuses the same collection filer */}
      {selected.size > 0 ? (
        <div className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 rounded-2xl border bg-card px-2 py-1.5 shadow-xl ring-1 ring-foreground/5 duration-200 animate-in slide-in-from-bottom-4">
          <span className="px-2 text-sm font-medium tabular-nums">{selected.size} selected</span>
          <span className="mx-0.5 h-5 w-px bg-border" />
          <AddToCollectionButton artifactIds={[...selected]} onChanged={bump} />
          <Button
            variant="ghost"
            size="sm"
            className="gap-2"
            onClick={() =>
              notify.success(`${selected.size} exported`, { description: "Your files will be ready in a moment." })
            }
          >
            <Download className="size-4" /> Export
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="gap-2"
            onClick={() => {
              notify.success(`${selected.size} archived`, { description: "Moved to the archive." });
              clearSelection();
            }}
          >
            <Archive className="size-4" /> Archive
          </Button>
          <span className="mx-0.5 h-5 w-px bg-border" />
          <IconButton label="Clear selection" size="icon-sm" onClick={clearSelection}>
            <X />
          </IconButton>
        </div>
      ) : null}
    </div>
  );
}
