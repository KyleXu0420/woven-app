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
import { cn } from "@/lib/utils";
import { DIVIDED_FLUSH, FilterChips } from "@/components/controls";
import { FacetBar, type FacetDef, type FacetOption } from "@/components/facet-filter";
import { TypeBadge, StatusPill, PeopleStack, CollectionTag } from "@/components/artifact-ui";
import { NodeMark } from "@/components/entity-profile";
import { CoverArt } from "@/components/cover-art";
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
import { useGraphVersion } from "@/lib/use-graph-version";

const TYPE = ["All", "HTML", "MD", "DOC"];

// every facet holds an ARRAY of selected values (multi-select); empty = its default (All/Any). sort is single
// (1 element); type stays a single L1 chip, tracked separately.
type Facets = {
  sort: string[];
  collection: string[];
  state: string[];
  date: string[];
  person: string[];
  has: string[];
  review: string[];
};
const EMPTY: Facets = {
  sort: ["Recent"],
  collection: [],
  state: [],
  date: [],
  person: [],
  has: [],
  review: [],
};

// ——— date bucketing over the prototype's relative `updated` labels ("17m", "2h", "6d", "3w", "1mo")
function daysAgo(updated: string): number {
  // the seed's one word-form age ("just now") matched no unit and fell to 9999, so every date filter
  // dropped the newest artifact in the library as if it were 27 years old
  if (updated === "just now") return 0;
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

// The house checkbox — the facet panel's and the Share dialog's box (16px, sm corner, ink when on). The Library
// drew its own: 20px, a 6px corner off the radius ladder, and FOREST when on. Selecting rows is not assenting to
// anything, and forest is the colour of assent (the facet filter and the Share dialog moved to ink on 09-03).
function SelectBox({ on }: { on: boolean }) {
  return (
    <span
      className={cn(
        "flex size-4 items-center justify-center rounded-sm border transition-colors group-focus-visible/sel:ring-2 group-focus-visible/sel:ring-focus",
        on ? "border-foreground bg-foreground text-background" : "border-line-stroke bg-card",
      )}
    >
      {on ? <Check className="size-3" /> : null}
    </span>
  );
}

// One Library row, on the collection Contents grammar (components/collection-members.tsx): line 1 = the kind
// mark, the title, ONE trailing cluster (type, then state only when it is an exception), then cells for the
// collection, the people and the age; line 2 = the gist, on the title's edge. The row used to be its own
// anatomy — the type code in a 56px left gutter that doubled as the select control, "Living" on 7 of 8 rows,
// a stale DOT with no word, and the collection and people on a third line under the gist — so the one object
// had two layouts depending on which list you met it in, and the most common state on the page was the
// loudest label on it.
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
  const people = getArtifactGraph(a.id).people;
  const processing = a.state === "processing";
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
      // Selection is tint-2, one rung over the hover's tint-1: it was a forest wash (bg-primary/5), and a
      // selected row of settled content is not a confirm. The focus ring is the ROW's, inset, as on Contents.
      className={cn(
        "group/row relative flex items-stretch transition-colors has-[>a:focus-visible]:ring-2 has-[>a:focus-visible]:ring-inset has-[>a:focus-visible]:ring-focus",
        selected ? "bg-tint-2" : "hover:bg-tint-1",
        dragging && "opacity-50",
      )}
    >
      <Link
        href={`/artifact/${a.id}`}
        draggable={false}
        className="flex min-w-0 flex-1 items-start gap-3 py-2.5 pl-2 outline-none"
      >
        {/* The select slot, held in flow and empty: the checkbox is drawn over it from outside the link
            (below), so a hover or select mode reveals it without moving a pixel of the row. It used to be
            the type badge's slot — hover swapped the type for a checkbox, and selecting any row hid the type
            on all of them: a control taking a fact's pixels. pl-2: on a flush row the box sat 1px inside the
            hover and selection fill and read as clipped by it; 8px of the row's own ground keeps it whole. */}
        <span aria-hidden className="h-(--text-base--line-height) w-4 shrink-0" />
        {/* the kind mark leads the row — the rounded square in its collection's hue, dashed while the
            agent is still processing it, the same letter the graph, /team and the Inbox draw */}
        <span aria-hidden className="flex h-(--text-base--line-height) w-3 shrink-0 items-center">
          <NodeMark node={{ id: a.id, kind: "artifact" }} className="size-3" pending={processing} />
        </span>
        {/* the text column: title and gist share this left edge */}
        <div className="min-w-0 flex-1">
          {/* items-start: the trailing cells are slots one body line tall, so each value sits on line 1.
              Below lg the cluster drops under the title instead of squeezing it (Contents does this below sm;
              here the hinge is lg, where the row already reflows to three lines, and at 768 a stale row's
              cluster cut the title to its first word). */}
          <div className="flex items-start gap-4">
            <div className="flex min-w-0 flex-1 items-center gap-x-1.5 gap-y-1 max-lg:flex-wrap">
              <span className="truncate text-base font-medium">{a.title}</span>
              {/* ONE trailing cluster: the type code after the title (so every title lands on the column's
                  spine), then a state ONLY when it is an exception. "Living" is what nearly every row is,
                  so it is said by saying nothing. Stale is the sentence StatusPill writes ("Source changed
                  2d ago"); the warn dot alone read as a recording light. */}
              <span className="inline-flex shrink-0 items-center gap-1.5">
                <TypeBadge type={a.type} />
                {processing ? <StatusPill state="processing" /> : null}
                {fresh.state === "stale" ? <StatusPill state="stale" stale={{ since: fresh.since }} /> : null}
                {fresh.state === "superseded" ? (
                  <span className="shrink-0 rounded-full bg-tint-1 px-1.5 py-px text-xs font-medium text-muted-foreground">
                    Superseded
                  </span>
                ) : null}
              </span>
            </div>
            {/* The collection and the people were a third line under the gist; from lg they are cells on
                line 1 (the Contents row's trailing cells), so a row is two lines and its values read down a
                column. Below lg there is no room beside the title, and they keep their line (below). */}
            <span className="hidden h-(--text-base--line-height) w-36 shrink-0 items-center text-sm text-muted-foreground lg:flex">
              {a.collection_ids.length ? <CollectionTag ids={a.collection_ids} /> : null}
            </span>
            {/* anchored LEFT, as on Contents: a stack of one to four has no fixed width, and right-aligned
                its optical centre wandered row to row. With the artifact's id, the stack's hover card says
                what each person did here and when — without it the card could only list names. */}
            <span className="hidden h-(--text-base--line-height) w-24 shrink-0 items-center lg:flex">
              <PeopleStack people={people} artifactId={a.id} />
            </span>
            {/* the age stays in every state: it used to fade out under the hovering ⋯, which sat on it */}
            <span className="flex h-(--text-base--line-height) w-16 shrink-0 items-center justify-end text-xs tabular-nums text-muted-foreground">
              {a.updated}
            </span>
          </div>
          {/* text-sm: the sub half of an Interface row (15 over 13); it was a hand-written 13px */}
          {a.gist ? <p className="mt-0.5 truncate text-sm text-muted-foreground">{a.gist}</p> : null}
          {a.collection_ids.length || people.length ? (
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground lg:hidden">
              {a.collection_ids.length ? <CollectionTag ids={a.collection_ids} /> : null}
              <PeopleStack people={people} artifactId={a.id} />
            </div>
          ) : null}
        </div>
      </Link>

      {/* The checkbox, over the slot the link holds for it, and outside the link: a <button> inside an <a> is
          invalid nesting that browsers repair by splitting the link. A 36px target centred on the 16px box.
          Shown on hover, on focus within the row, and on every row once anything is selected. */}
      <span className="absolute top-2.5 left-2 flex h-(--text-base--line-height) w-4 items-center justify-center">
        <button
          type="button"
          role="checkbox"
          aria-checked={selected}
          aria-label={`Select ${a.title}`}
          onClick={(e) => {
            e.stopPropagation();
            onToggle(index, e.shiftKey);
          }}
          className={cn(
            "group/sel flex size-9 shrink-0 items-center justify-center outline-none transition-opacity",
            selected || anySelected
              ? "opacity-100"
              : "opacity-0 group-hover/row:opacity-100 group-focus-within/row:opacity-100 focus-visible:opacity-100",
          )}
        >
          <SelectBox on={selected} />
        </button>
      </span>

      {/* the row's ⋯, as on Contents. At md+ it hangs in the right margin (singular and transient, the one
          thing the margin may hold); it used to sit INSIDE the row on top of the age, which is why the age
          had to fade out on hover. The reveal rides on the trigger itself, so the button stays while its
          portalled menu is open. Below md it sits in flow at rest: a phone has no hover. The offset is the
          page's: the frame's md padding is 32px, so -right-8 hangs the 28px button at W+4..W+32, inside it.
          The Contents row's -right-9 (copied here first) put it 4px past the frame and scrolled the page
          sideways at 1024. */}
      <span className="flex h-(--text-base--line-height) shrink-0 items-center max-md:mt-2.5 max-md:ml-2 md:absolute md:top-2.5 md:-right-8">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="ghost" size="icon-sm" aria-label="More" />}
            className="md:opacity-0 md:transition-opacity md:group-hover/row:opacity-100 md:group-focus-within/row:opacity-100 md:data-[popup-open]:opacity-100"
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
      </span>
    </div>
  );
}

// the grid tile — the SAME object as a Row, as a tall cover card. Anatomy (top→down): the cover (the
// document's own neighbourhood drawing) → type + collection on one line, state at its end only when it is an
// exception → title → gist → a minimal footer of who's on it + when. Real document-library cards (Sketch,
// Tango, Memotron) lead with a preview then keep metadata to a title, a timestamp, and faces, so the graph
// stats that cluttered v1 are gone; the people are the one kept signal. Carries every Row affordance: the
// checkbox, drag (a selected tile carries the whole selection), and the hover more-menu.
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
      // rounded-lg, the surface rung (rounded-xl was off the ladder); no hover lift — no other surface in the
      // app moves, depth is carried by tone. Hover and selection are line rungs, not a forest ring: selecting
      // a card assents to nothing.
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-lg border bg-card transition-colors",
        selected ? "border-line-stroke ring-1 ring-line-stroke" : "hover:border-line-hover",
        dragging && "opacity-50",
      )}
    >
      <Link href={`/artifact/${a.id}`} draggable={false} className="flex flex-1 flex-col">
        {/* ① cover — the document's own neighbourhood as a slim band; the title lives below, readable */}
        <div className="relative aspect-[3/1] border-b">
          <CoverArt a={a} label={false} />
        </div>
        {/* ② info — type, collection → title → state (exception only) → gist → people, updated */}
        <div className="flex flex-1 flex-col p-4">
          <div className="flex items-center gap-2 text-sm">
            <TypeBadge type={a.type} />
            {a.collection_ids.length ? (
              <CollectionTag ids={a.collection_ids} className="text-muted-foreground" />
            ) : null}
          </div>

          <h3 className="mt-3 text-base font-medium">
            <span className="line-clamp-2">{a.title}</span>
          </h3>
          {/* State on exception only, the row's rule (every card used to say "Living"), and under the title the
              way the row sets it after the title. Not at the end of the type line: in a 230px card "Source
              changed 2d ago" ran over the collection name there. The stale dot that sat after the title is
              this sentence now, one statement of the fact. */}
          {fresh.state !== "fresh" || a.state === "processing" ? (
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
              {fresh.state === "superseded" ? (
                <span className="rounded-full bg-tint-1 px-1.5 py-px text-xs font-medium text-muted-foreground">
                  Superseded
                </span>
              ) : fresh.state === "stale" ? (
                <StatusPill state="stale" stale={{ since: fresh.since }} />
              ) : null}
              {a.state === "processing" ? <StatusPill state="processing" /> : null}
            </div>
          ) : null}

          {a.gist ? <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{a.gist}</p> : null}

          <div className="mt-auto flex items-center justify-between gap-2 pt-4">
            {people.length ? <PeopleStack people={people} artifactId={a.id} /> : <span />}
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{a.updated}</span>
          </div>
        </div>
      </Link>

      {/* select — top-left over the cover: the house checkbox, shown on hover, focus and in select mode */}
      <button
        type="button"
        role="checkbox"
        aria-checked={selected}
        aria-label={`Select ${a.title}`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onToggle(index, e.shiftKey);
        }}
        className={cn(
          "group/sel absolute top-2.5 left-2.5 flex items-center justify-center rounded-sm shadow-sm outline-none transition-opacity",
          selected || anySelected
            ? "opacity-100"
            : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100",
        )}
      >
        <SelectBox on={selected} />
      </button>

      {/* more — top-right over the cover; the shared icon-sm button, revealed on the trigger itself so it
          stays while its menu is open (a portalled menu escapes the wrapper's focus-within) */}
      <div className="absolute top-2.5 right-2.5">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="outline" size="icon-sm" aria-label="More" />}
            className="opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 data-[popup-open]:opacity-100"
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
    <div className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-secondary p-0.5">
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
              on ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
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
  useGraphVersion();
  const [type, setType] = React.useState("All");
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
  const opt = (arr: string[]): FacetOption[] => arr.map((v) => ({ value: v }));

  // the 2-step facet set (Type stays a persistent L1 chip row, so it isn't repeated here). Every facet is a
  // multi-select list; sort is single, date is single + a custom range.
  const defs: FacetDef[] = [
    { key: "sort", label: "Sort by", icon: ArrowUpDown, options: opt(["Recent", "Name", "Most linked"]), defaultValue: "Recent" },
    { key: "collection", label: "Collection", icon: Hash, options: collections.map((c) => ({ value: c.name, color: c.color })), defaultValue: "All", multi: true, searchable: true },
    { key: "state", label: "State", icon: CircleDot, options: opt(["Living", "Processing"]), defaultValue: "All", multi: true },
    { key: "date", label: "Date", icon: Calendar, options: opt(["This week", "This month", "This quarter"]), defaultValue: "Any", variant: "date" },
    { key: "person", label: "People", icon: Users, options: people.map((p) => ({ value: p.name, personId: p.id })), defaultValue: "Any", multi: true, searchable: true },
    { key: "has", label: "Has", icon: Waypoints, options: opt(["Links", "Sources", "Decisions", "People"]), defaultValue: "Any", multi: true },
    { key: "review", label: "Review", icon: Sparkles, options: opt(["Needs review", "Verified"]), defaultValue: "All", multi: true },
  ];

  function matchesPerson(a: Artifact, name: string): boolean {
    const pid = people.find((p) => p.name === name)?.id;
    if (!pid) return false;
    if (a.author_id === pid) return true;
    return getArtifactGraph(a.id).people.some((p) => p.id === pid);
  }
  function matchesHas(a: Artifact, has: string): boolean {
    const g = getArtifactGraph(a.id);
    if (has === "Links") return g.linkedTo.length + g.linkedFrom.length > 0;
    if (has === "Sources") return g.sources.length > 0;
    if (has === "Decisions") return g.decisions.length > 0;
    if (has === "People") return g.people.length > 0;
    return true;
  }

  // a facet with selections narrows within itself by OR (any selected collection / person / state matches).
  const filtered = all.filter((a) => {
    if (a.state === "archived") return false; // archived artifacts drop out of the working library
    if (type !== "All" && a.type !== type) return false;
    if (facets.state.length && !facets.state.map((s) => s.toLowerCase()).includes(a.state)) return false;
    if (facets.collection.length) {
      const ids = facets.collection.flatMap((name) => {
        const c = collections.find((x) => x.name === name);
        return c ? [c.id] : [];
      });
      if (!a.collection_ids.some((id) => ids.includes(id))) return false;
    }
    if (facets.date.length && facets.date[0] !== "Custom" && daysAgo(a.updated) > (DATE_MAX[facets.date[0]] ?? 9999)) return false;
    if (facets.person.length && !facets.person.some((name) => matchesPerson(a, name))) return false;
    if (facets.has.length && !facets.has.some((h) => matchesHas(a, h))) return false;
    if (facets.review.length) {
      const pending = getArtifactGraph(a.id).proposed.length > 0;
      if (!facets.review.includes(pending ? "Needs review" : "Verified")) return false;
    }
    return true;
  });

  const shown = [...filtered];
  const sort = facets.sort[0] ?? "Recent";
  if (sort === "Name") shown.sort((a, b) => a.title.localeCompare(b.title));
  else if (sort === "Most linked") shown.sort((a, b) => relationCount(b.id) - relationCount(a.id));

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
    // Selection is local UI state that must be reconciled after the external graph/filter result changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelected((prev) => {
      const visible = new Set(shown.map((a) => a.id));
      const next = [...prev].filter((id) => visible.has(id));
      return next.length === prev.size ? prev : new Set(next);
    });
    lastIndex.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facets, type]);

  const activeCount = defs.filter((d) => {
    const v = facets[d.key as keyof Facets];
    return v.length > 0 && !(v.length === 1 && v[0] === d.defaultValue);
  }).length;

  return (
    <div className={PAGE_FRAME.browse}>
      {/* no hint: PageHeading renders none (no ⓘ, no hint sentence on any page header), so the sentence
          passed here was dead text that only looked like it said something */}
      <PageHeading title="Library" />
      {/* L1 — persistent Type chips + the Filter toggle (reveals the facet bar below) */}
      <div className="mt-5 flex items-center justify-between gap-3">
        <FilterChips options={TYPE} value={type} onChange={setType} />
        <div className="flex shrink-0 items-center gap-2">
          <ViewToggle view={view} onChange={setView} />
          {/* the shared outline button at sm: the hand-rolled pill set its label at 0.8rem (12.8px, a fractional
              size in disguise) with no focus ring; the variant's aria-expanded rung is its open
              state. The count is a bare numeral in the label's ink, not a pill on a hand-written alpha. */}
          <Button
            variant="outline"
            size="sm"
            aria-expanded={filterOpen}
            onClick={() => setFilterOpen((o) => !o)}
          >
            <SlidersHorizontal /> Filter
            {activeCount > 0 ? <span className="tabular-nums">{activeCount}</span> : null}
          </Button>
        </div>
      </div>

      {/* the facet bar — a Mem-style row of facet pills, each opening its own panel of values */}
      {filterOpen ? (
        <div className="mt-3 animate-in fade-in-0 slide-in-from-top-1 duration-150">
          <FacetBar
            defs={defs}
            values={facets}
            onChange={(k, v) => setFacets((f) => ({ ...f, [k]: v }))}
            onClear={() => {
              setFacets(EMPTY);
              setType("All");
            }}
          />
        </div>
      ) : null}

      {shown.length === 0 ? (
        <p className="mt-4 py-16 text-center text-base text-muted-foreground">
          No artifacts match these filters.
        </p>
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
        // flush to the page column with a closing rule, the Contents list's container: the rows carry no
        // side padding of their own now, so the kind mark, not a 16px inset, sets the list's first edge
        <div className={cn("mt-4 border-b border-border", DIVIDED_FLUSH)}>
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
        <div className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 rounded-2xl border bg-card px-2 py-1.5 shadow-xl ring-1 ring-line-edge duration-200 animate-in slide-in-from-bottom-4">
          <span className="px-2 text-base font-medium tabular-nums">{selected.size} selected</span>
          <span className="mx-0.5 h-5 w-px bg-border" />
          <AddToCollectionButton artifactIds={[...selected]} onChanged={bump} />
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="default" className="gap-2" />}>
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
                  <span className="ml-auto text-xs tabular-nums text-muted-foreground">{f.hint}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="ghost"
            size="default"
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
          <IconButton label="Clear selection" size="icon" onClick={clearSelection}>
            <X />
          </IconButton>
        </div>
      ) : null}
    </div>
  );
}
