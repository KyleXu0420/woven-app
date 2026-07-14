"use client";

import * as React from "react";
import Link from "next/link";
import { PAGE_FRAME } from "@/lib/frame";
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
  LayoutList,
  LayoutGrid,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { EXPORT_FORMATS, exportArtifacts } from "@/lib/export";
import { IconButton } from "@/components/ui/icon-button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { FilterChips } from "@/components/controls";
import { FacetBar, type FacetDef } from "@/components/facet-filter";
import { TypeBadge, StatusPill } from "@/components/artifact-ui";
import { CoverArt } from "@/components/cover-art";
import { PersonAvatar } from "@/components/identity";
import { PageHeading } from "@/components/page-heading";
import { AddToCollectionSub, AddToCollectionButton } from "@/components/add-to-collection";
import { notify } from "@/lib/notifications";
import {
  archiveArtifacts,
  getArtifactGraph,
  getFreshness,
  listArtifacts,
  listCollections,
  listPeople,
  relationCount,
} from "@/lib/api";
import type { Artifact } from "@/lib/types";
import { startArtifactDrag } from "@/lib/artifact-drag";

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

// a document can sit in several collections — show the first, fold the rest into a +N that unfolds the full
// list on hover. Shared by both views so a doc reads the same whether it's a row or a card.
function CollectionTag({ ids, className }: { ids: string[]; className?: string }) {
  // keep the document's own order — the first collection it was filed in leads, the rest fold
  const all = listCollections();
  const cos = ids.flatMap((id) => {
    const c = all.find((x) => x.id === id);
    return c ? [c] : [];
  });
  if (!cos.length) return null;

  const lead = (
    <>
      <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: cos[0].color }} />
      <span className="truncate">{cos[0].name}</span>
    </>
  );

  // single collection → a plain tag, no affordance
  if (cos.length === 1) {
    return <span className={cn("inline-flex min-w-0 items-center gap-1.5", className)}>{lead}</span>;
  }

  // several → the +N is the fold; hovering the tag unfolds every collection in a small popover (portaled, so
  // the card's overflow-hidden can't clip it).
  return (
    <Tooltip>
      <TooltipTrigger
        render={<span className={cn("group/col inline-flex min-w-0 items-center gap-1.5", className)} />}
      >
        {lead}
        <span className="shrink-0 rounded-full bg-secondary px-1 text-[11px] font-medium tabular-nums text-muted-foreground transition-colors group-hover/col:bg-primary/15 group-hover/col:text-foreground">
          +{cos.length - 1}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" align="start" className="flex-col items-start gap-1.5 py-2">
        {cos.map((c) => (
          <span key={c.id} className="inline-flex items-center gap-1.5">
            <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: c.color }} />
            <span>{c.name}</span>
          </span>
        ))}
      </TooltipContent>
    </Tooltip>
  );
}

function Row({
  a,
  index,
  selected,
  anySelected,
  selectedIds,
  onToggle,
}: {
  a: Artifact;
  index: number;
  selected: boolean;
  anySelected: boolean;
  selectedIds: string[];
  onToggle: (index: number, shift: boolean) => void;
}) {
  const fresh = getFreshness(a.id);
  const [, bump] = React.useReducer((x: number) => x + 1, 0);
  const [dragging, setDragging] = React.useState(false);
  // drag a selected row → carry the whole selection; drag an unselected row → carry just that one
  const dragIds = selected && selectedIds.length ? selectedIds : [a.id];
  function copyLink() {
    navigator.clipboard
      ?.writeText(a.public ? `woven.dev/a/${a.hub_slug ?? a.id}` : `woven.dev/artifact/${a.id}`)
      .catch(() => {});
    notify.success("Link copied", { description: a.title });
  }
  return (
    <div
      draggable
      onDragStart={(e) => {
        startArtifactDrag(e, dragIds);
        setDragging(true);
      }}
      onDragEnd={() => setDragging(false)}
      className={cn(
        "group relative border-t transition-colors first:border-t-0",
        selected ? "bg-primary/[0.05]" : "hover:bg-foreground/[0.025]",
        dragging && "opacity-50",
      )}
    >
      <Link
        href={`/artifact/${a.id}`}
        draggable={false}
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
            <span className="truncate text-[15px] font-medium">{a.title}</span>
            {fresh.state === "stale" ? (
              <span title="May be out of date" className="size-1.5 shrink-0 rounded-full bg-warn" />
            ) : fresh.state === "superseded" ? (
              <span className="shrink-0 rounded-full bg-secondary px-1.5 py-px text-[11px] font-medium text-muted-foreground">
                Superseded
              </span>
            ) : null}
          </div>
          {a.collection_ids.length ? (
            <div className="mt-0.5 text-[13px] text-muted-foreground">
              <CollectionTag ids={a.collection_ids} />
            </div>
          ) : null}
        </div>
        <div className="hidden sm:block">
          <StatusPill state={a.state} />
        </div>
        <span className="text-right font-mono text-[12px] tabular-nums text-muted-foreground transition-opacity group-hover:opacity-0">
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

// the grid tile — the SAME object as a Row, as a tall cover card. Anatomy (top→down): generated cover art →
// type + collection on one line → serif title → gist summary → a minimal footer of who's on it + when. Real
// document-library cards (Sketch · Tango · Memotron) lead with a preview then keep metadata to a title, a
// timestamp, and faces — so the graph stats that cluttered v1 are gone; the people are the one kept signal.
// Carries every Row affordance: the badge-less checkbox, drag (a selected tile carries the whole selection),
// and the hover more-menu.
function GridCard({
  a,
  index,
  selected,
  anySelected,
  selectedIds,
  onToggle,
}: {
  a: Artifact;
  index: number;
  selected: boolean;
  anySelected: boolean;
  selectedIds: string[];
  onToggle: (index: number, shift: boolean) => void;
}) {
  const fresh = getFreshness(a.id);
  const people = getArtifactGraph(a.id).people;
  const [, bump] = React.useReducer((x: number) => x + 1, 0);
  const [dragging, setDragging] = React.useState(false);
  const dragIds = selected && selectedIds.length ? selectedIds : [a.id];
  function copyLink() {
    navigator.clipboard
      ?.writeText(a.public ? `woven.dev/a/${a.hub_slug ?? a.id}` : `woven.dev/artifact/${a.id}`)
      .catch(() => {});
    notify.success("Link copied", { description: a.title });
  }
  return (
    <div
      draggable
      onDragStart={(e) => {
        startArtifactDrag(e, dragIds);
        setDragging(true);
      }}
      onDragEnd={() => setDragging(false)}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-xl border bg-card transition-all hover:-translate-y-px hover:border-ring/30",
        selected && "border-primary/40 ring-2 ring-primary/30",
        dragging && "opacity-50",
      )}
    >
      <Link href={`/artifact/${a.id}`} draggable={false} className="flex flex-1 flex-col">
        {/* ① cover — pure generated art as a slim band; the title lives below, readable */}
        <div className="relative aspect-[3/1] border-b">
          <CoverArt a={a} label={false} />
        </div>
        {/* ② info — type · collection → title → gist → people · updated */}
        <div className="flex flex-1 flex-col p-4">
          <div className="flex items-center gap-2 text-[13px]">
            <TypeBadge type={a.type} />
            {a.collection_ids.length ? (
              <CollectionTag ids={a.collection_ids} className="text-muted-foreground" />
            ) : null}
            <span className="ml-auto shrink-0">
              {fresh.state === "superseded" ? (
                <span className="rounded-full bg-secondary px-1.5 py-px text-[11px] font-medium text-muted-foreground">
                  Superseded
                </span>
              ) : (
                <StatusPill state={a.state} />
              )}
            </span>
          </div>

          <h3 className="mt-3 flex items-start gap-1.5 font-serif text-[15px] leading-snug font-medium">
            <span className="line-clamp-2">{a.title}</span>
            {fresh.state === "stale" ? (
              <span title="May be out of date" className="mt-1.5 size-1.5 shrink-0 rounded-full bg-warn" />
            ) : null}
          </h3>

          {a.gist ? (
            <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">{a.gist}</p>
          ) : null}

          <div className="mt-auto flex items-center justify-between gap-2 pt-4">
            {people.length ? (
              <span className="flex items-center gap-1.5">
                <span className="flex -space-x-1.5">
                  {people.slice(0, 3).map((p) => (
                    <PersonAvatar key={p.id} seed={p.id} name={p.name} size="xs" className="ring-2 ring-card" />
                  ))}
                </span>
                {people.length > 3 ? (
                  <span className="text-[12px] tabular-nums text-muted-foreground">+{people.length - 3}</span>
                ) : null}
              </span>
            ) : (
              <span />
            )}
            <span className="shrink-0 font-mono text-[12px] tabular-nums text-muted-foreground">{a.updated}</span>
          </div>
        </div>
      </Link>

      {/* select — top-left over the cover: badge-less checkbox that appears on hover / in select mode */}
      <button
        type="button"
        aria-label={selected ? "Deselect" : "Select"}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onToggle(index, e.shiftKey);
        }}
        className={cn(
          "absolute top-2.5 left-2.5 flex size-5 items-center justify-center rounded-[6px] border shadow-sm transition-opacity",
          selected
            ? "border-primary bg-primary text-primary-foreground opacity-100"
            : anySelected
              ? "border-foreground/30 bg-card opacity-100"
              : "border-foreground/30 bg-card opacity-0 group-hover:opacity-100",
        )}
      >
        {selected ? <Check className="size-3.5" /> : null}
      </button>

      {/* more — top-right over the cover */}
      <div className="absolute top-2.5 right-2.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="More"
            className="flex size-7 items-center justify-center rounded-md bg-card/90 text-muted-foreground shadow-sm outline-none backdrop-blur-sm transition-colors hover:bg-card hover:text-foreground data-[popup-open]:bg-card data-[popup-open]:text-foreground"
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

// list ↔ grid — a segmented icon toggle; the same object, two densities
function ViewToggle({ view, onChange }: { view: "list" | "grid"; onChange: (v: "list" | "grid") => void }) {
  const opts = [
    { key: "list" as const, Icon: LayoutList, label: "List view" },
    { key: "grid" as const, Icon: LayoutGrid, label: "Grid view" },
  ];
  return (
    <div className="inline-flex shrink-0 items-center rounded-full border p-0.5">
      {opts.map((o) => {
        const on = view === o.key;
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => onChange(o.key)}
            aria-label={o.label}
            aria-pressed={on}
            className={cn(
              "flex size-7 items-center justify-center rounded-full transition-colors",
              on ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <o.Icon className="size-4" />
          </button>
        );
      })}
    </div>
  );
}

export default function LibraryPage() {
  const [facets, setFacets] = React.useState<Facets>(EMPTY);
  const [filterOpen, setFilterOpen] = React.useState(false);
  const [view, setView] = React.useState<"list" | "grid">("list");
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const selectedIds = React.useMemo(() => [...selected], [selected]);
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
    if (a.state === "archived") return false; // archived artifacts drop out of the working library
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

  // keep the selection honest when the visible set changes — drop selected ids that filtered out (so
  // bulk actions never touch hidden rows) and reset the shift-anchor (so a range can't span a stale
  // order or dereference an out-of-bounds index after the list shrank).
  React.useEffect(() => {
    setSelected((prev) => {
      const visible = new Set(shown.map((a) => a.id));
      const next = [...prev].filter((id) => visible.has(id));
      return next.length === prev.size ? prev : new Set(next);
    });
    lastIndex.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facets]);

  const activeCount = defs.filter((d) => facets[d.key as keyof Facets] !== d.defaultValue).length;

  return (
    <div className={PAGE_FRAME.browse}>
      <PageHeading
        title="Library"
        hint="Every artifact in your space. Filter by type, collection, state, people, or review status; select rows to bulk-file, export, or archive."
      />
      <p className="mt-2 text-[15px] text-muted-foreground">
        <span className="font-medium text-foreground tabular-nums">
          {all.filter((a) => a.state !== "archived").length}
        </span>{" "}
        artifacts · {collections.length} collections
      </p>

      {/* L1 — persistent Type chips + the Filter toggle (reveals the facet bar below) */}
      <div className="mt-6 flex items-center justify-between gap-3">
        <FilterChips options={TYPE} value={facets.type} onChange={set("type")} />
        <div className="flex shrink-0 items-center gap-2">
          <ViewToggle view={view} onChange={setView} />
          <button
            onClick={() => setFilterOpen((o) => !o)}
            className={cn(
              "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[0.8rem] font-medium outline-none transition-colors hover:bg-muted",
              filterOpen && "bg-secondary text-foreground",
            )}
          >
            <SlidersHorizontal className="size-3.5" /> Filter
            {activeCount > 0 ? (
              <span className="ml-0.5 rounded-full bg-foreground/10 px-1.5 text-[11px] font-semibold tabular-nums">
                {activeCount}
              </span>
            ) : null}
          </button>
        </div>
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

      {shown.length === 0 ? (
        <div className="mt-4 rounded-xl border bg-card">
          <p className="px-4 py-12 text-center text-[15px] text-muted-foreground">
            No artifacts match these filters.
          </p>
        </div>
      ) : view === "grid" ? (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {shown.map((a, i) => (
            <GridCard
              key={a.id}
              a={a}
              index={i}
              selected={selected.has(a.id)}
              anySelected={selected.size > 0}
              selectedIds={selectedIds}
              onToggle={toggleSelect}
            />
          ))}
        </div>
      ) : (
        <div className="mt-4 overflow-hidden rounded-xl border bg-card">
          {shown.map((a, i) => (
            <Row
              key={a.id}
              a={a}
              index={i}
              selected={selected.has(a.id)}
              anySelected={selected.size > 0}
              selectedIds={selectedIds}
              onToggle={toggleSelect}
            />
          ))}
        </div>
      )}

      {/* bulk-select toolbar — floats up once anything is selected; reuses the same collection filer */}
      {selected.size > 0 ? (
        <div className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 rounded-2xl border bg-card px-2 py-1.5 shadow-xl ring-1 ring-foreground/5 duration-200 animate-in slide-in-from-bottom-4">
          <span className="px-2 text-[15px] font-medium tabular-nums">{selected.size} selected</span>
          <span className="mx-0.5 h-5 w-px bg-border" />
          <AddToCollectionButton artifactIds={[...selected]} onChanged={bump} />
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="sm" className="gap-2" />}>
              <Download className="size-4" /> Export
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="center" sideOffset={8} className="w-44">
              {EXPORT_FORMATS.map((f) => (
                <DropdownMenuItem
                  key={f.key}
                  className="gap-2"
                  onClick={() => {
                    const name = exportArtifacts([...selected], f.key);
                    notify.success(`${selected.size} exported`, { description: name });
                  }}
                >
                  {f.label}
                  <span className="ml-auto text-[12px] tabular-nums text-muted-foreground">{f.hint}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="ghost"
            size="sm"
            className="gap-2"
            onClick={() => {
              archiveArtifacts([...selected]);
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
