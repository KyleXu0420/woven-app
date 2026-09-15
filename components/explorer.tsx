"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Check, ChevronDown, Crosshair } from "lucide-react";
import { cn } from "@/lib/utils";
import { LocalGraph, FoldChip, sectorKids, type Fold } from "./local-graph";
import { TimelineView } from "./timeline-view";
import { useSearch } from "./search";
import { EntityProfile } from "./entity-profile";
import { PageBreadcrumb } from "./page-heading";
import { ViewTabs, DIVIDED_FLUSH, FOCUS_RING } from "./controls";
import { MENU_SURFACE } from "./classes";
import { NodeMark } from "./entity-profile";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { CONFIDENCE_COPY, confidenceLevel } from "./confidence";
import { getNeighborhood, verifyEdge, restoreEdge, listPending, getArtifact, getArtifactEvidence, getBlocks, sourceById } from "@/lib/api";
import { bumpGraph } from "@/lib/store";
import { toasts } from "@/lib/notifications";
import { useGraphVersion } from "@/lib/use-graph-version";
import type { EdgeType, GraphEdge, GraphNode, Neighborhood, RefKind } from "@/lib/types";

// SubjectSwitcher — WHICH topic (or person) the explorer is centred on, and it IS the page's h1: the
// subject's kind-mark, its name and a chevron at the title rung, under a small muted eyebrow that names the
// section ("Topics"). For six rounds the h1 was the section ("Topics", with a hint glyph) and the subject
// stood beside it at the same size, and six blind verdicts in a row ranked the same defect first: two titles
// on one line, the label and the control undifferentiated, the ⓘ a stock tell beside a heading. The
// product already answers this on the collection page — the eyebrow "Collections" over the collection's own
// name as the h1 — so the explorer takes the same shape: the section is the crumb (PageBreadcrumb, the
// detail page's one line), the subject is the only large thing on the page. No hint: the empty state
// explains the page the one time it needs explaining.
//
// The mark leads the title in the graph's own alphabet (shape = kind, hue = identity — the hexagon the
// subject wears on the canvas) at the title's CAP HEIGHT, 20 (Geist's cap is 0.71 of the 28): at 16 it sat
// under the capitals and read as a bullet in front of the name, not as the subject's own letter. The
// chevron is 20, muted (the nearest rung under the title's ink), tight to the name's last glyph (ml-0.5;
// the glyph's inner padding does the rest) — the only hint the title is a picker — and it flips when the
// menu is open. The whole title is the trigger, and the hover ground is on the NAME alone (tint-1,
// rounded-md, -mx-1 / px-1 so the glyphs stay on the text edge and the ground bleeds 4px past them): a
// title that reads as pressable, not a button holding a title.
//
// Open, the title BECOMES the input: the name gives way to a field of the same size and weight carrying
// the name as its placeholder, and typing filters the list at once. There is no search row inside the
// popup — a search field on top of a five-item menu was a command palette wearing a picker's clothes.
// The list drops from under the NAME, its left edge on the title's text edge (left-7.5: the mark and its
// gap), so the menu is the name opening and not a card hung from the mark — with the edge on the mark two
// verdicts in a row read it as hanging under the hexagon. It is a BARE list, a menu and not a table: each
// row its name and, at the trailing edge, its count and the slot for the tick. NO mark on the rows: the
// five topics' hues (rose, plum, slate, ocean, gold) sit close enough on the warm wheel that a row of five
// marks could not be told apart, and a mark that cannot be told from its neighbour says nothing a name
// does not; the title carries the one mark that matters. The count is the same figure on every row —
// the subject's DIRECT ties, the ring the graph opens on (the number the retired depth switch's "Direct"
// read; the list's direct rows are still that many) — and the current row keeps it (the tick took its
// place for a round, and the one row without a figure was the one the reader was on). Rows are in MUTED
// ink; the current subject alone is in full ink at the row's weight and carries the tick after its count.
// The highlight (pointer or arrows) lifts a row to full ink on a tint-1 wash; NO wash at open — nothing is
// highlighted until one of them moves. On the menu material (one rung lighter than a popover's shadow).
// Arrow keys move the highlight (starting from the current subject), Enter picks, Escape puts the name
// back. Sorted by that count so the busiest subjects lead. Not the Popover primitive: its anchor must be a
// trigger it owns, and the anchor here is an input that replaces the trigger, so the popup is drawn by hand.
function SubjectSwitcher({
  entities,
  kind,
  currentId,
  onSelect,
  noun,
  nounPlural,
}: {
  entities: { id: string; name: string }[];
  kind: RefKind;
  currentId: string;
  onSelect: (id: string) => void;
  noun: string;
  nounPlural: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  // -1 = no row highlighted (the state the menu opens in); the pointer or the arrows set it
  const [active, setActive] = React.useState(-1);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);
  const refocus = React.useRef(false);
  const listId = React.useId();
  const current = entities.find((e) => e.id === currentId);
  const ql = q.trim().toLowerCase();
  // the row's figure is the subject's direct neighbours — the first ring it opens on once it is the subject
  // — not its tie count (a neighbour tied twice is one neighbour, and the two figures differed)
  const directOf = React.useMemo(() => new Map(entities.map((e) => [e.id, getNeighborhood(e.id, 1).nodes.length - 1])), [entities]);
  const shown = entities
    .filter((e) => e.name.toLowerCase().includes(ql))
    .sort((a, b) => (directOf.get(b.id) ?? 0) - (directOf.get(a.id) ?? 0));
  const currentIx = shown.findIndex((e) => e.id === currentId);

  function close(back: boolean) {
    refocus.current = back;
    setOpen(false);
    setQ("");
    setActive(-1);
  }
  function pick(id: string) {
    onSelect(id);
    close(true);
  }

  // the trigger unmounts while the field is up; hand focus back to it once it is there again
  React.useEffect(() => {
    if (!open && refocus.current) {
      refocus.current = false;
      triggerRef.current?.focus();
    }
  }, [open]);

  // a press anywhere outside the title and its list puts the name back
  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  // the highlighted row stays in view as the arrow keys move it
  React.useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>("[data-active]")?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      // the first arrow lands on the current subject (where the reader is), the next ones walk from there
      setActive((i) => (shown.length ? (i < 0 ? Math.max(currentIx, 0) : (i + 1) % shown.length) : -1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (shown.length ? (i < 0 ? Math.max(currentIx, 0) : (i - 1 + shown.length) % shown.length) : -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      // Enter with nothing highlighted takes the first match — what typing a name and pressing Enter means
      const target = shown[active] ?? (ql ? shown[0] : undefined);
      if (target) pick(target.id);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close(true);
    } else if (e.key === "Tab") {
      close(false);
    }
  }

  // one box for both states, so nothing on the line moves when the name becomes a field. No padding of its
  // own: the mark sits on the text edge (the crumb's), and the hover ground belongs to the name. The mark
  // carries its own gap (mr-2.5) and the chevron its own (ml-0.5) — two different distances; the menu's
  // left-7.5 below is the mark and its gap, so the menu's edge is the name's.
  const box = "inline-flex min-w-0 max-w-full items-center text-left";
  const mark = current ? <NodeMark node={{ id: current.id, kind }} className="mr-2.5 size-5" /> : null;
  // the chevron flips when the menu is open — the one moving part of the title, and the reader's proof
  // that the field under the pointer is the same control they pressed
  const chevron = (
    <ChevronDown className={cn("ml-0.5 size-5 shrink-0 text-muted-foreground", open && "rotate-180")} aria-hidden="true" />
  );
  return (
    // `relative`: the list positions against this box, whose left edge is the title's text edge
    <div
      ref={rootRef}
      className="relative"
      onBlur={(e) => {
        // focus leaving the title AND its list (a Tab away) puts the name back; a click on a row keeps
        // focus in the field (the row's pointerdown is prevented), so it never fires for a pick
        if (open && !rootRef.current?.contains(e.relatedTarget as Node)) close(false);
      }}
    >
      {/* the h1 is the subject — one title on the page, at the title rung (28/500), and it is the switcher */}
      <h1 className="text-2xl font-medium">
        {open ? (
          <span className={box}>
            {mark}
            {/* the field and a sizer share one grid cell, so the field is exactly as wide as the name it
                stands in for (and grows with what is typed) — the chevron holds its place. size={1}: a
                field's own intrinsic width is twenty characters, and the grid track took it over the sizer. */}
            <span className="inline-grid min-w-0">
              <span aria-hidden="true" className="invisible col-start-1 row-start-1 whitespace-pre">
                {q || current?.name || `Pick a ${noun}`}
              </span>
              <input
                autoFocus
                size={1}
                role="combobox"
                aria-expanded="true"
                aria-controls={listId}
                aria-autocomplete="list"
                aria-activedescendant={shown[active] ? `${listId}-${shown[active].id}` : undefined}
                aria-label={`Search ${nounPlural}`}
                value={q}
                placeholder={current?.name ?? `Pick a ${noun}`}
                onChange={(e) => {
                  setQ(e.target.value);
                  setActive(-1);
                }}
                onKeyDown={onKey}
                className="col-start-1 row-start-1 w-full min-w-0 bg-transparent p-0 text-2xl font-medium text-foreground outline-none placeholder:text-muted-foreground"
              />
            </span>
            {chevron}
          </span>
        ) : (
          <button
            ref={triggerRef}
            type="button"
            data-subject-switcher=""
            aria-haspopup="listbox"
            aria-expanded="false"
            aria-label={`Change ${noun}`}
            onClick={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setOpen(true);
              }
            }}
            className={cn(box, "group rounded-md text-foreground", FOCUS_RING)}
          >
            {mark}
            {/* the ground on the name only: -mx-1 / px-1 keep the first glyph on the text edge and let the
                tint bleed 4px past the word on either side; the mark and the chevron stay on the page */}
            <span className="-mx-1 min-w-0 truncate rounded-md px-1 transition-colors group-hover:bg-tint-1">
              {current?.name ?? `Pick a ${noun}`}
            </span>
            {chevron}
          </button>
        )}
      </h1>
      {open ? (
        // under the name, its left edge on the title's text edge (left-7.5 = the 20px mark + its 10px gap);
        // w-64: five names and their counts — a menu is as wide as its rows
        <div
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label={nounPlural}
          className={cn(MENU_SURFACE, "scrollbar-subtle absolute top-full left-7.5 z-50 mt-1 flex max-h-72 w-64 flex-col overflow-y-auto")}
        >
          {shown.length ? (
            shown.map((e, i) => {
              const sel = e.id === currentId;
              return (
                <div
                  key={e.id}
                  id={`${listId}-${e.id}`}
                  role="option"
                  aria-selected={sel}
                  data-active={i === active ? "" : undefined}
                  onPointerMove={() => setActive(i)}
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => pick(e.id)}
                  // one highlight for pointer and keyboard (the row the arrows are on IS the hovered row), and
                  // none until one of them moves. Muted rows, the current subject in full ink and the row's
                  // weight — the tab strip's "the one you are on" — and the highlight lifts a row to full ink
                  // on the wash.
                  className={cn(
                    "flex cursor-default items-center gap-3 rounded-md px-2 py-1.5 text-sm transition-colors data-active:bg-tint-1 data-active:text-foreground",
                    sel ? "font-medium text-foreground" : "text-muted-foreground",
                  )}
                >
                  <span className="min-w-0 flex-1 truncate">{e.name}</span>
                  {/* the count is inventory: muted, tabular, on every row — the current one too, so the
                      column has one meaning down its length; then the tick's slot, filled only on the
                      current row — a bare tick is the house's "this one", in the row's own ink */}
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{directOf.get(e.id) ?? 0}</span>
                  <span className="flex size-4 shrink-0 items-center justify-center">
                    {sel ? <Check className="size-4" aria-hidden="true" /> : null}
                  </span>
                </div>
              );
            })
          ) : (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">No matches.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

// The tie read from the ROW's side with the other end left unsaid, because something on screen already names
// it — [row is `from`, row is `to`]. On a direct row the other end is the page's subject; on a second-hop row it
// is the hub the group's band names. "Ana: authored" under an artifact on Ana's page is "Ana authored this";
// "Q4 launch plan: linked from" under the band "Through Notification strategy v3" is "linked from it".
const AS_ROW: Record<EdgeType, [string, string]> = {
  links_to: ["links to", "linked from"],
  sourced_from: ["sourced from", "source for"],
  mentions: ["mentions", "mentioned in"],
  in_collection: ["in", "contains"],
  authored_by: ["by", "authored"],
  decided: ["decided", "decided in"],
  supersedes: ["supersedes", "superseded by"],
};

// a tie's relation word — the tie's KIND from the row's side ("mentions", "linked from", "source for").
function relationWord(rowId: string, e: GraphEdge): string {
  return e.from === rowId ? AS_ROW[e.type][0] : AS_ROW[e.type][1];
}

// WHERE the tie lives, for a tie with an anchor: the section of the artifact the mention sits in ("in
// Goals"). Only an artifact row has evidence to read; a mention with no anchor stays silent, and the cell is
// simply empty — a muted qualifier or nothing, the same slot on every row. A proposed tie's rationale is NOT
// here any more: the agent's sentence sat in this slot on one row beside "in Goals" on another, a paragraph
// at a phrase's rhythm, and the row broke the list's meter. The sentence is in the peek on the status word
// (ProposedPeek), one hover away, where a reason belongs.
function detailFor(row: GraphNode, e: GraphEdge): string | null {
  if (row.kind === "artifact") {
    const blockId = getArtifactEvidence(row.id).find((ev) => ev.edge_id === e.id)?.block_id;
    const heading = blockId ? getBlocks(row.id).find((b) => b.id === blockId)?.heading : undefined;
    if (heading) return `in ${heading}`;
  }
  return null;
}

// when the thing at the row's end was last touched: an artifact's own age, or when a source was captured.
// A source had no age here and the second hop (mostly sources and people) lost the column, so the list
// broke into a half with ages and a half without. A person or a collection has no "when"; its cell holds
// a deliberate dash (see RelationRow) — a row with an empty kind cell and an empty age cell ("Maya Chen",
// a person mentioned by a hub) read as a row that had lost its columns, not as a row with nothing to say.
function ageOf(node: GraphNode): string | undefined {
  if (node.kind === "artifact") return getArtifact(node.id)?.updated;
  if (node.kind === "source") return sourceById(node.id)?.at;
  return undefined;
}

// ProposedPeek — a proposed tie's status on the row, and its REASON one hover away. At rest the row says
// "proposed" in muted ink, and the confidence word only when it earns its ink (settled 2026-09-12: high
// silent, likely muted, unsure full ink — a demand on the reviewer; it is the one weighted word in the
// row's secondaries, and that is the rule's point). The word "proposed" stays because the row's mark cannot
// say it: the mark is the NODE — its kind, its hue, dashed only while the node itself is still being woven —
// and the tie's provenance is a fact about the tie, which the list does not draw (the canvas dashes the
// line). The peek carries what the row no longer does: the agent's rationale as prose, and the confidence
// in the Inbox card's own words with its figure — the house's hover-peek (a Popover that opens on hover),
// the same one the confidence word wears in Inbox.
function ProposedPeek({ edge }: { edge: GraphEdge }) {
  const level = edge.confidence != null ? confidenceLevel(edge.confidence) : "high";
  const rationale = listPending().find((p) => p.edge_id === edge.id)?.rationale;
  const { word, guidance } = CONFIDENCE_COPY[level];
  return (
    <Popover>
      <PopoverTrigger
        nativeButton={false}
        openOnHover
        delay={120}
        // `relative`: above the name's stretched hit area, so the hover lands on the word and not the row
        render={<span className="relative shrink-0 cursor-help whitespace-nowrap text-sm text-muted-foreground outline-none" />}
      >
        proposed
        {level === "likely" ? ", likely" : null}
        {level === "unsure" ? (
          <>
            {", "}
            <span className="font-medium text-foreground">unsure</span>
          </>
        ) : null}
      </PopoverTrigger>
      <PopoverContent side="top" align="start" sideOffset={8} className="w-72 p-3">
        {rationale ? <p className="text-sm text-foreground-prose">{rationale}</p> : null}
        <p className={cn("flex items-baseline gap-2 text-sm", rationale && "mt-2")}>
          <span className="font-medium">{word}</span>
          <span className="text-muted-foreground">{guidance}</span>
          {edge.confidence != null ? (
            <span className="ml-auto text-xs tabular-nums text-muted-foreground">{Math.round(edge.confidence * 100)}%</span>
          ) : null}
        </p>
      </PopoverContent>
    </Popover>
  );
}

// one neighbour, ONE line, in the same slots on every row: the kind-mark, the name, then (muted, or nothing)
// where the tie lives, then at the trailing end a proposed tie's status word, the tie's KIND — only when the
// rows differ in it — and the age. Where and what-state are two kinds of fact, and they were two muted
// phrases side by side after the name ("in Goals", "proposed, unsure"), read as one kind: the qualifier
// stays with the name (it is about the name), the status is a trailing word (the review panel's rule — a
// row's state is its trailing word), and the two registers are told apart by where they sit, not by ink.
// The kind column ("mentions", "linked from", "source for", "authored";
// see relationWord) is drawn only when the list has more than one word in it: under Direct on a topic every
// row was a mention, and "mentions" four times down a column was the page's premise restated on every line
// (a topic is in the graph because artifacts mention it). When the rows DO differ (the second hop: "linked
// from", "source for", "decided in") the word is a fact the row needs, and then every row carries one so the
// column holds. Decided once for the whole list (ListView), never per group — a column that appeared in one
// group and not the next was the round-5 defect. The age (12 tabular, muted): the collection list's own
// trailing column, on every row — a person has no "when", and its cell says so with a dash in the glyph ink,
// where an empty cell beside another empty cell was a row with no columns at all. The name gives way first
// (it has a fuller form one click away); the detail truncates after it; the kind and the age never do. A node
// the graph draws dashed (still being processed) is dashed here too — the provenance vocabulary holds between
// the views.
//
// The row is a div and the NAME is the button, stretched over the whole row (after:absolute inset-0) so the
// row is one hit area and one focus stop: the row was a button, and a button may not hold the status word's
// peek (a popover trigger is interactive content). The ring is the row's, summoned by the button's focus.
// `indent`: a row a hop further, listed under the hub it hangs off — set in by the marker slot (the mark and
// its gap, 24), so its own mark starts where the hub's name did and the hop reads as a step in.
function RelationRow({
  node,
  edge,
  detail,
  kind,
  indent,
  onSelect,
}: {
  node: GraphNode;
  edge: GraphEdge;
  detail: string | null;
  kind: string | null; // the tie's word, or null when the list has one word only (see above)
  indent?: boolean;
  onSelect: (id: string) => void;
}) {
  const proposed = edge.prov === "ai_generated";
  const age = ageOf(node);
  return (
    <div
      className={cn(
        "relative flex items-center gap-3 py-2.5 transition-colors hover:bg-tint-1 has-[>button:focus-visible]:ring-2 has-[>button:focus-visible]:ring-inset has-[>button:focus-visible]:ring-focus",
        indent && "pl-6",
      )}
    >
      {/* the graph's letter at 12px — the same size the picker's rows use, one alphabet at one size across
          the page. At 14 the filled square outweighed the 15px title beside it; at 10 the topic's hexagon
          had collapsed into a dot and the shape stopped saying the kind. */}
      <NodeMark node={{ id: node.id, kind: node.kind }} className="size-3" pending={node.state === "processing"} />
      <button
        type="button"
        onClick={() => onSelect(node.id)}
        className="min-w-0 truncate text-left text-base font-medium outline-none after:absolute after:inset-0 after:content-['']"
      >
        {node.label}
      </button>
      {detail ? <span className="min-w-0 truncate text-sm text-muted-foreground">{detail}</span> : null}
      {/* the trailing cluster: status (only a proposed tie has one), kind (only when the list has more than
          one word), age (always). ml-auto on the first of them that is drawn. */}
      {proposed ? (
        <span className="ml-auto flex shrink-0 justify-end">
          <ProposedPeek edge={edge} />
        </span>
      ) : null}
      {/* w-28 holds the longest kind ("superseded by") without a jog; w-14 the longest age ("17m", "3d") */}
      {kind ? <span className={cn("w-28 shrink-0 truncate text-sm text-muted-foreground", !proposed && "ml-auto")}>{kind}</span> : null}
      <span className={cn("flex w-14 shrink-0 justify-end text-xs tabular-nums text-muted-foreground", !kind && !proposed && "ml-auto")}>
        {age ?? (
          <span aria-label="no date" className="text-foreground-hint">
            —
          </span>
        )}
      </span>
    </div>
  );
}

// FoldRow — the list's fold: under a direct row whose node is a hub with further ties, ONE row in the list's
// own grammar. Its leading slot is EMPTY (the marker slot, held at the mark's width so the text edge is the
// names' edge — a fold is not a node and wears no mark), then the house fold chip and, in muted 13, what it
// stands for: "+5 through Notification strategy v3". Open, the chip reads "−" and the row "Hide", and the
// hub's hop-2 rows stand under it, set in by the marker slot. The row is one hit area and one focus stop the
// way RelationRow is (the button stretched over the row, the ring summoned onto the row). The chip steps to
// tint-2 on the row's hover: tint-1 on the hovered row's tint-1 measured as nothing (the rail's lesson).
function FoldRow({ hub, count, open, onToggle }: { hub: GraphNode; count: number; open: boolean; onToggle: () => void }) {
  return (
    <div className="group/fold relative flex items-center gap-3 py-2.5 transition-colors hover:bg-tint-1 has-[>button:focus-visible]:ring-2 has-[>button:focus-visible]:ring-inset has-[>button:focus-visible]:ring-focus">
      <span aria-hidden="true" className="size-3 shrink-0" />
      <button
        type="button"
        aria-expanded={open}
        aria-label={open ? `Hide ${count} around ${hub.label}` : `Show ${count} more around ${hub.label}`}
        onClick={onToggle}
        // h-5.5: the name row's line (15 on its 22 leading), so a fold row is as tall as the rows it sits
        // among — the 20px chip alone left it 2px short, and the list's meter jogged at every fold
        className="flex h-5.5 min-w-0 items-center gap-2 text-left text-sm text-muted-foreground outline-none after:absolute after:inset-0 after:content-['']"
      >
        <FoldChip count={count} open={open} className="group-hover/fold:bg-tint-2 group-hover/fold:text-foreground" />
        {open ? (
          <span>Hide</span>
        ) : (
          <span className="flex min-w-0 items-baseline gap-1">
            <span className="shrink-0">through</span>
            <span className="min-w-0 truncate">{hub.label}</span>
          </span>
        )}
      </button>
    </div>
  );
}

// ListView — the focus's neighbourhood AS A LIST: the direct ties, one row each, and under each direct row
// whose node reaches further, a FOLD (FoldRow) that opens that hub's second hop under it — the same folds
// the graph wears beside its hubs' names, on ONE expanded set the explorer keeps for both views, so a hub
// unfolded here is unfolded on the field and back. The list had a depth setting (Direct / Nearby, on the tab
// row) and, at the wider reach, bands ("Direct 4", then "Through …") heading whole groups; the reach grows
// by touching the list now, and a fold is a row, not a band — the list keeps one grammar. The rows start
// IMMEDIATELY under the tab row's hairline. "The list is the truth; the graph is the show me" — same data,
// listed instead of drawn. Click a row to re-focus there.
function ListView({
  nb,
  wide,
  kids,
  unfolded,
  onToggle,
  onSelect,
}: {
  nb: Neighborhood; // the direct neighbourhood
  wide: Neighborhood; // the two-hop one — the rows a fold opens
  kids: Map<string, GraphNode[]>; // each hub's second hop (sectorKids — the graph's own assignment)
  unfolded: ReadonlySet<string>; // the hubs whose second hop is out, shared with the graph
  onToggle: (hubId: string) => void;
  onSelect: (id: string) => void;
}) {
  const byId = new Map(wide.nodes.map((n) => [n.id, n]));
  // one row per direct tie (a neighbour tied twice is listed twice — each tie is its own fact)
  const direct = nb.edges
    .filter((e) => e.from === nb.centerId || e.to === nb.centerId)
    .map((e) => ({ edge: e, node: byId.get(e.from === nb.centerId ? e.to : e.from) }))
    .filter((r): r is { edge: GraphEdge; node: GraphNode } => !!r.node);
  // a hub's second-hop rows: each node in its sector, with the tie that hangs it there
  const rowsOf = (hubId: string) =>
    (kids.get(hubId) ?? []).flatMap((n) => {
      const edge = wide.edges.find((e) => (e.from === n.id && e.to === hubId) || (e.to === n.id && e.from === hubId));
      return edge ? [{ edge, node: n }] : [];
    });
  // the fold sits after the LAST of a hub's direct rows (a neighbour tied twice has two), so every row of
  // the hub's own stands above what it opens
  const foldAfter = new Map<string, string>(); // edge id → hub id
  for (const r of direct) if (kids.get(r.node.id)?.length) foldAfter.set(r.edge.id, r.node.id);
  const lastRow = new Map<string, string>();
  for (const [edgeId, hubId] of foldAfter) lastRow.set(hubId, edgeId);
  const shownGroups = [...lastRow.keys()].filter((hubId) => unfolded.has(hubId)).map((hubId) => rowsOf(hubId));
  // the kind column is drawn only when the rows SHOWN do not all say the same word (see RelationRow) —
  // decided over every row on the page at once, so the column is there on all of them or on none; a fold
  // that opens rows with a second word brings the column to the direct rows too
  const words = new Set([...direct, ...shownGroups.flat()].map((r) => relationWord(r.node.id, r.edge)));
  const kindOf = (r: { edge: GraphEdge; node: GraphNode }) => (words.size > 1 ? relationWord(r.node.id, r.edge) : null);

  if (!direct.length) return <p className="py-12 text-center text-sm text-muted-foreground">No relations yet.</p>;
  return (
    <div className={cn(DIVIDED_FLUSH, "border-b border-border")}>
      {direct.map((r) => {
        const hubId = [...lastRow].find(([, edgeId]) => edgeId === r.edge.id)?.[0];
        const open = !!hubId && unfolded.has(hubId);
        return (
          <React.Fragment key={r.edge.id}>
            <RelationRow node={r.node} edge={r.edge} detail={detailFor(r.node, r.edge)} kind={kindOf(r)} onSelect={onSelect} />
            {hubId ? <FoldRow hub={r.node} count={kids.get(hubId)?.length ?? 0} open={open} onToggle={() => onToggle(hubId)} /> : null}
            {open
              ? rowsOf(hubId).map((k) => (
                  // the hub is unsaid in the row: the fold above names it; the row keeps where its tie lives
                  // and, when the list has more than one word, what kind of tie it is
                  <RelationRow key={k.node.id} node={k.node} edge={k.edge} detail={detailFor(k.node, k.edge)} kind={kindOf(k)} indent onSelect={onSelect} />
                ))
              : null}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// GraphView — the relationship view: the field straight on the page ground (no card, no border), starting
// directly under the tab row's hairline. There is no depth switch any more — it sat in the field's corner,
// then on the tab row, and Kyle's call (2026-09-14) retired it: a setting for "how far" is a dial the
// reader has to find, and the reach grows more naturally by touching the graph — each first-ring node with
// further ties wears a fold ("+N") that unfolds its own ring in place, and the peek offers the same. The
// key (a hover ⓘ in the corner) is gone from every field: the marks carry the vocabulary — shape is the
// kind, hue the identity, the dash the provenance — and the one glyph the collection map, the ego map and
// the space field all hung in their corner was the one stock tell the three shared.
//
// One field for two drawings: the subject's ego map (radial, laid out on the wide neighbourhood so the
// inner ring holds still while a hub's ring is previewed or unfolded) and the space field the Team page
// brings with it (`fixed`: the orbit layout at rest, the spread force settle of the pending-links map in
// verify mode; it has no folds — its data has no second ring). The drawing changes; the ground, the cap,
// the peek and the verify gesture do not.
function GraphView({
  nb,
  wide,
  centerId,
  previewIds,
  folds,
  onFoldToggle,
  onFoldPeek,
  fixed,
  focusable,
  onSelect,
  onVerifyEdge,
}: {
  nb: Neighborhood;
  // the field: the wide neighbourhood with the ties a fold can draw — the layout and every name's seat are
  // decided on it whatever `nb` draws (the explorer builds it, see `field`)
  wide: Neighborhood;
  centerId: string;
  previewIds?: string[];
  // each hub's fold (its hidden count, whether it is out) — the explorer's one expanded set, shared with
  // the list; absent where the graph is fixed
  folds?: Map<string, Fold>;
  onFoldToggle?: (id: string) => void;
  onFoldPeek?: (id: string | null) => void;
  // the space field's own lens — the Team page hands the drawing in; the shell draws it where the ego map
  // goes. Absent for a subject whose neighbourhood the shell derives itself.
  fixed?: Pick<FixedGraph, "layout" | "spread" | "inspectable">;
  // "Focus here" on a peek re-centres the explorer — only where the subject can change (a switcher exists)
  focusable: boolean;
  onSelect: (id: string) => void;
  onVerifyEdge?: (edgeId: string, action: "confirm" | "discard") => void;
}) {
  const radial = !fixed;
  return (
    // the names' knockout paints in the ground colour; this field is the page, not a card
    <div className="relative" style={{ "--graph-ground": "var(--background)" } as React.CSSProperties}>
      {/* click a node → peek it in a popover anchored AT the node (no card docked below the canvas, which
          would just re-list the graph); re-centering the explorer is the peek's deliberate "Focus here"
          action, and a proposed (dashed) edge is confirmable in place via onVerifyEdge.
          radial, laid out on the WIDE neighbourhood whatever is drawn: the inner ring's sectors are sized by
          each neighbour's second-hop weight and every hub's fan has its seats reserved, so a hub's ring —
          ghosted on the fold's hover, drawn on its click — appears inside its own sector and nothing already
          there moves. fullLabels + namedDepth=2: every name written out in full where it fits — the subject's
          in full ink, the first ring's muted, an unfolded ring's one step lighter (and culled where the fan is
          too tight for a name) — so an unfolded hub says what is there and not only that there is a lot.
          outerRing="full": a ring the reader opened is drawn in full ink. labelRule="below": one placement
          for every name. The svg is capped at 650, which at the 520-unit box is a 1.25 scale: the subject's
          12-unit name lands on the 15 rung and a neighbour's 10.5 on 13 — the two rungs the page's rows use,
          not a size of the canvas's own. The space field takes the same cap for the same reason: it drew at
          720 inside its card, its names at 16.6 and 14.5 — sizes on no rung — and one shell draws its fields
          at one scale. */}
      <LocalGraph
        data={nb}
        layoutData={radial ? wide : undefined}
        layout={fixed?.layout ?? "radial"}
        spread={fixed?.spread}
        fullLabels={radial}
        namedDepth={radial ? 2 : undefined}
        outerRing={radial ? "full" : undefined}
        labelRule={radial ? "below" : undefined}
        previewIds={previewIds}
        folds={radial ? folds : undefined}
        onFoldToggle={onFoldToggle}
        onFoldPeek={onFoldPeek}
        className="max-w-[650px]"
        onSelect={() => {}}
        onVerifyEdge={onVerifyEdge}
        renderPopover={(id, api) => {
          // the space field's hub is the frame, not a thing — it has no profile to peek (the Team rule)
          if (fixed?.inspectable && !fixed.inspectable(id)) return null;
          const n = nb.nodes.find((x) => x.id === id);
          if (!n) return null;
          const fold = folds?.get(id);
          return (
            <EntityProfile
              node={n}
              placement="popover"
              onSelect={(relId) => {
                if (!focusable) return api.select(relId); // a related chip moves the peek; nothing re-centres
                onSelect(relId);
                api.close();
              }}
              primaryAction={
                !focusable || id === centerId
                  ? undefined
                  : { label: "Focus here", onClick: () => { onSelect(id); api.close(); }, icon: Crosshair }
              }
              // a hub's peek offers what its fold does — the same verb the list row has — and stays open,
              // so the reader sees the word flip to "Hide N" as the ring arrives behind it
              secondaryAction={
                fold && onFoldToggle
                  ? { label: fold.open ? `Hide ${fold.count}` : `Show ${fold.count} more`, onClick: () => onFoldToggle(id) }
                  : undefined
              }
            />
          );
        }}
      />
    </div>
  );
}

// the subject a page is centred on: its mark's kind and its name — and, for the one subject with no identity
// hue (the space, a "collection" with no swatch), the ink the field draws its hub in
export type Subject = { id: string; kind: RefKind; name: string; fill?: string };

// the picker's material where the subject can change: the entities the h1 switches between, their kind
// (every row's mark), and the nouns the field and the empty state speak in
export type Switcher = { entities: { id: string; name: string }[]; kind: RefKind; noun: string; nounPlural: string };

// a graph the page brings with it instead of one the shell derives from the subject's ties: the Team page's
// space field (teamGraph) and, while its review panel asks for verify-on-the-map, the pending-links map
export type FixedGraph = {
  data: Neighborhood;
  layout: "orbit" | "force";
  spread?: boolean;
  // which nodes open a peek — the space's hub does not (it is the frame, not a thing)
  inspectable?: (id: string) => boolean;
  onVerifyEdge?: (edgeId: string, action: "confirm" | "discard") => void;
  // verify mode's cue, drawn inside the view above the field — the one time a line sits between the tab
  // row's hairline and the drawing, and it is a state the reader entered, not the page's rest
  notice?: React.ReactNode;
};

export type View = "list" | "graph" | "timeline";

// one empty set for "nothing unfolded", so a subject switch never hands the views a fresh identity per render
const EMPTY_SET: ReadonlySet<string> = new Set<string>();

// SubjectTitle — the h1 where the subject cannot change: the space. The same title the switcher draws (its
// mark at cap height, mr-2.5, the name at the title rung) with no chevron, no button, no hover ground —
// there is nothing to pick. The mark sits in a slot one title line tall so a name that wraps on a phone
// keeps the mark on its first line; the name wraps rather than truncates, because a page's h1 has no
// fuller form one click away.
function SubjectTitle({ subject }: { subject: Subject }) {
  return (
    <h1 className="flex min-w-0 items-start text-2xl font-medium">
      <span className="flex h-(--text-2xl--line-height) shrink-0 items-center">
        <NodeMark node={{ id: subject.id, kind: subject.kind }} fill={subject.fill} className="mr-2.5 size-5" />
      </span>
      <span className="min-w-0">{subject.name}</span>
    </h1>
  );
}

// Explorer — the shell. Two choices of two kinds, each in its own material so the reader can tell at a
// glance which changes WHAT they look at and which changes HOW it is shown:
//   the subject  — the page's h1: its mark (at cap height) and name at the title rung under the section's
//                  eyebrow (a crumb, linking back to the section); a switcher (name + chevron) where the
//                  subject can change, the name alone where it cannot — the loudest, it carries the one colour
//   the view     — ViewTabs, the page-level control (underline, forest) — the middle weight
// There was a third, the depth — a SegToggle on the tab row's trailing end (Direct N / Nearby N), one state
// the list and the graph both honoured. Kyle retired it (2026-09-14): a dial for "how far" is a setting the
// reader has to find and reason about, when the graph itself can ask the question — so the reach now grows
// by touching it. Every first-ring node with further ties wears a FOLD ("+N", the house's fold chip) beside
// its name; hovering it ghosts that hub's ring in, clicking unfolds it in place, and the list has the same
// fold as a row under the hub. ONE expanded set (`openFolds`, hub ids) serves both views, so a hub unfolded in
// the list is unfolded on the field and back. The tab row's trailing slot stays, empty.
// Two lines of chrome over one hairline: the title, then the row that chooses the view; the content starts
// under the hairline. (See woven/product/explorer-framework.md.)
//
// ONE shell for /team, /topics and /people (2026-09-14). Team was a different animal — a PageHeading with a
// ⓘ, a stat line of four hover-peeks, a bell in a forest badge, its field in a card with a key — and the
// three pages that explore one subject's neighbourhood read as three products. The subject varies (a topic,
// a person, the space); the shell does not: Team passes its subject with no switcher, its bell as the title
// line's trailing action, its own graph and its own List and Timeline, and takes the eyebrow, the h1, the
// tab row and the ground from here.
export function Explorer({
  section,
  subject,
  switcher,
  action,
  view: viewProp,
  onViewChange,
  graph,
  list,
  timeline,
}: {
  // the section this explorer is one page of — the eyebrow over the subject's name, linking back to the
  // section's own route (/team, /topics, /people), the way the collection page's eyebrow "Collections"
  // links to the library
  section: "Team" | "Topics" | "People";
  // the fixed subject (the space) — the h1 with no picker. Ignored when a switcher is given.
  subject?: Subject;
  // the subjects the h1 picks between (topics, people) — the current one is the subject
  switcher?: Switcher;
  // a trailing control on the title line (Team's bell); nothing on the others
  action?: React.ReactNode;
  // the view, controlled from outside where a page needs to set it (Team's "Verify on the map" opens the
  // graph); otherwise the shell keeps it
  view?: View;
  onViewChange?: (v: View) => void;
  // the page's own graph, list and timeline — where the shell cannot derive them from the subject's ties
  graph?: FixedGraph;
  list?: React.ReactNode;
  timeline?: React.ReactNode;
}) {
  useGraphVersion(); // re-render after an in-graph verify/undo so the field reflects it
  const entities = React.useMemo(() => switcher?.entities ?? [], [switcher]);
  // a ?focus=<id> deep-link (from ⌘K opening a person/topic while NOT already on this page) seeds the center;
  // without this the Explorer hard-centered on entities[0], landing on the wrong entity. Re-centers if it changes.
  const params = useSearchParams();
  const focusParam = params.get("focus");
  const [centerId, setCenterId] = React.useState(() =>
    focusParam && entities.some((e) => e.id === focusParam) ? focusParam : entities[0]?.id ?? subject?.id ?? "",
  );
  const [viewState, setViewState] = React.useState<View>("graph");
  const view = viewProp ?? viewState;
  const setView = (v: string) => {
    setViewState(v as View);
    onViewChange?.(v as View);
  };
  // the hubs whose second hop is OUT, keyed to the subject they were opened on: a new subject starts folded
  // (the ids would not match its hubs anyway, and a set that survives the switch would leave a stale open
  // state waiting for the reader to come back). Shared by the graph and the list.
  const [openFolds, setOpenFolds] = React.useState<{ center: string; open: Set<string> }>({ center: "", open: new Set() });
  const unfolded = openFolds.center === centerId ? openFolds.open : EMPTY_SET;
  const toggleFold = (hubId: string) =>
    setOpenFolds((f) => {
      const open = new Set(f.center === centerId ? f.open : []);
      if (open.has(hubId)) open.delete(hubId);
      else open.add(hubId);
      return { center: centerId, open };
    });
  // the hub whose fold the pointer (or a keyboard focus) rests on — its ring ghosts in while it does
  const [peekHub, setPeekHub] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (focusParam && entities.some((e) => e.id === focusParam)) setCenterId(focusParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusParam]);

  // register this explorer's re-center fn so the global search's "Find → Focus on this" lands here — only
  // where the subject can change; with a fixed subject the search keeps its own routing (a person goes to
  // /people?focus=…), which is where "focus on this" means something
  const { registerFocus } = useSearch();
  const canSwitch = !!switcher;
  React.useEffect(() => {
    if (!canSwitch) return;
    registerFocus(setCenterId);
    return () => registerFocus(null);
  }, [registerFocus, canSwitch]);

  // calm one-line empty state — no broken chrome (garbage center node) when a space has no topics/people
  // yet. With no subject to be the title, the section is: the one h1 the page has.
  if (switcher && !entities.length) {
    return (
      <div>
        <h1 className="text-2xl font-medium">{section}</h1>
        <div className="mt-6 rounded-lg bg-card py-16 text-center text-sm text-muted-foreground">
          No {switcher.nounPlural} yet — they emerge as Woven weaves your artifacts.
        </div>
      </div>
    );
  }

  const current: Subject | undefined = switcher
    ? { id: centerId, kind: switcher.kind, name: entities.find((e) => e.id === centerId)?.name ?? "" }
    : subject;

  // the direct neighbourhood is what the page opens on; the two-hop one is the reach a fold can grow it by.
  // A page that brings its own graph is the direct reach and folds nothing (the space has no ties of its
  // own to walk). Each first-ring node's fold is its SECTOR — the hop-2 nodes the radial layout hangs off
  // it (sectorKids, the same assignment the fan uses), so "+5" on a hub is exactly the five marks its fan
  // will hold; a hop-2 node two hubs reach belongs to the first and keeps a chord to the other.
  const nbDirect = graph ? graph.data : getNeighborhood(centerId, 1);
  const nbWide = getNeighborhood(centerId, 2);
  const kids = graph ? new Map<string, GraphNode[]>() : sectorKids(nbWide.nodes, nbWide.edges);
  const foldOf = new Map<string, Fold>();
  for (const [hubId, ks] of kids) if (ks.length) foldOf.set(hubId, { count: ks.length, open: unfolded.has(hubId) });
  // what is drawn: the direct ring, plus every unfolded hub's kids and the ties that reach them from anything
  // drawn — the hub's own, a chord to another first-ring node, a tie between two live kids. A tie between two
  // first-ring nodes (picked up only on the second hop) is not "around" any hub and no fold counts it, so
  // it stays undrawn, as the direct reach always left it.
  const directEdgeIds = new Set(nbDirect.edges.map((e) => e.id));
  const liveKids = [...unfolded].flatMap((hubId) => kids.get(hubId) ?? []);
  const drawn = new Set([...nbDirect.nodes.map((n) => n.id), ...liveKids.map((n) => n.id)]);
  const liveKidIds = new Set(liveKids.map((n) => n.id));
  const reaches = (e: GraphEdge, ids: Set<string>, all: Set<string>) =>
    !directEdgeIds.has(e.id) && (ids.has(e.from) || ids.has(e.to)) && all.has(e.from) && all.has(e.to);
  const liveEdges = nbWide.edges.filter((e) => reaches(e, liveKidIds, drawn));
  // the ghost: the hub under the pointer's kids and their ties — scoped to that hub, one grey at half
  // strength (previewIds), exactly what the old Nearby hover did for the whole field. Nothing for a hub
  // already out (its kids are live) or for a pointer on nothing.
  const ghostKids = peekHub && !unfolded.has(peekHub) ? (kids.get(peekHub) ?? []) : [];
  const ghostKidIds = new Set(ghostKids.map((n) => n.id));
  const liveEdgeIds = new Set(liveEdges.map((e) => e.id));
  const ghostEdges = ghostKids.length
    ? nbWide.edges.filter((e) => !liveEdgeIds.has(e.id) && reaches(e, ghostKidIds, new Set([...drawn, ...ghostKidIds])))
    : [];
  const nb: Neighborhood =
    liveKids.length || ghostKids.length
      ? {
          centerId: nbDirect.centerId,
          nodes: [...nbDirect.nodes, ...liveKids, ...ghostKids],
          edges: [...nbDirect.edges, ...liveEdges, ...ghostEdges],
        }
      : nbDirect;
  const previewIds = ghostKids.length ? [...ghostKidIds, ...ghostEdges.map((e) => e.id)] : undefined;
  // the FIELD the graph lays out and seats its names on: the wide neighbourhood, every node of it, with the
  // ties the folds can ever draw — a tie between two first-ring nodes (see `reaches`) is not among them, so
  // it is no line for a name to keep clear of. The graph decides every seat against this field, drawn or
  // not, which is what keeps a hub's name (and its chip) where the reader found it when its ring unfolds.
  const depth2 = new Set(nbWide.nodes.filter((n) => n.depth === 2).map((n) => n.id));
  const field: Neighborhood = {
    ...nbWide,
    edges: nbWide.edges.filter((e) => directEdgeIds.has(e.id) || depth2.has(e.from) || depth2.has(e.to)),
  };
  const center = nb.nodes.find((n) => n.depth === 0);

  // a proposed (dashed) edge is confirmable IN the graph — verifyEdge + a toast with Undo, then re-render
  function resolve(edgeId: string, action: "confirm" | "discard") {
    const p = listPending().find((x) => x.edge_id === edgeId);
    const label = p ? `${p.fromLabel} → ${p.toLabel}` : "link";
    const prev = verifyEdge(edgeId, action);
    bumpGraph();
    const undo = prev ? { label: "Undo", onClick: () => { restoreEdge(prev); bumpGraph(); } } : undefined;
    if (action === "confirm") toasts.linkConfirmed(label, undo);
    else toasts.proposalDismissed(label, undo);
  }

  return (
    <div>
      {/* the eyebrow: the section, in the detail page's crumb register, linking to the section's route —
          the page is one subject of many, and this line is where that hierarchy lives, so the h1 can be
          the subject alone. mb-3: the collection page's distance between its crumb and its name. */}
      <PageBreadcrumb trail={[{ label: section, href: `/${section.toLowerCase()}` }]} className="mb-3" />
      {/* the title line: the subject's mark and name (the switcher where the subject can change, see
          SubjectSwitcher; the name alone where it cannot), and at the line's trailing end the page's one
          control, if it has one — Team's bell, centred on the h1's first line, its right edge the column's.
          The title takes the rest of the line (min-w-0 flex-1) so its truncation and its menu are unchanged
          where there is nothing beside it. */}
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          {switcher ? (
            <SubjectSwitcher
              entities={entities}
              kind={switcher.kind}
              currentId={centerId}
              onSelect={setCenterId}
              noun={switcher.noun}
              nounPlural={switcher.nounPlural}
            />
          ) : current ? (
            <SubjectTitle subject={current} />
          ) : null}
        </div>
        {action ? <div className="flex h-(--text-2xl--line-height) shrink-0 items-center">{action}</div> : null}
      </div>

      {/* the view — the one page-level switch: three lenses on the same subject. The row's trailing slot
          (ViewTabs `trailing`) held the depth switch; it stays on the primitive, and stays empty here — the
          reach is set on the graph and in the list now, where the thing it grows is. */}
      <div className="mt-5">
        <ViewTabs
          ariaLabel="View"
          options={[
            { id: "list", label: "List" },
            { id: "graph", label: "Graph" },
            { id: "timeline", label: "Timeline" },
          ]}
          value={view}
          onChange={setView}
        />
      </div>

      {/* no gap: the header closes with the tab row's hairline and the view starts under it — the list's
          first row, the graph's field, the timeline's own top padding */}
      <div data-explorer-view={view}>
        {view === "timeline" ? (
          (timeline ??
            (center ? (
              <TimelineView center={center} />
            ) : (
              <div className="flex h-80 items-center justify-center text-sm text-muted-foreground">
                Select an entity to explore.
              </div>
            )))
        ) : view === "list" ? (
          (list ?? <ListView nb={nbDirect} wide={nbWide} kids={kids} unfolded={unfolded} onToggle={toggleFold} onSelect={setCenterId} />)
        ) : (
          <>
            {graph?.notice ? <div className="pt-4">{graph.notice}</div> : null}
            <GraphView
              nb={nb}
              wide={field}
              centerId={centerId}
              previewIds={previewIds}
              folds={graph ? undefined : foldOf}
              onFoldToggle={toggleFold}
              onFoldPeek={setPeekHub}
              fixed={graph ? { layout: graph.layout, spread: graph.spread, inspectable: graph.inspectable } : undefined}
              focusable={canSwitch}
              onSelect={setCenterId}
              onVerifyEdge={graph ? graph.onVerifyEdge : resolve}
            />
          </>
        )}
      </div>
    </div>
  );
}
