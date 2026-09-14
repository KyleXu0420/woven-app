"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Check, ChevronDown, Crosshair } from "lucide-react";
import { cn } from "@/lib/utils";
import { LocalGraph } from "./local-graph";
import { TimelineView } from "./timeline-view";
import { useSearch } from "./search";
import { EntityProfile } from "./entity-profile";
import { PageHeading } from "./page-heading";
import { FeedHead } from "./inbox-agent-band";
import { ViewTabs, SegToggle, DIVIDED_FLUSH, FOCUS_RING } from "./controls";
import { MENU_SURFACE } from "./classes";
import { NodeMark } from "./entity-profile";
import { confidenceLevel } from "./confidence";
import { getNeighborhood, relationCount, verifyEdge, restoreEdge, listPending } from "@/lib/api";
import { bumpGraph } from "@/lib/store";
import { toasts } from "@/lib/notifications";
import { useGraphVersion } from "@/lib/use-graph-version";
import type { EdgeType, GraphEdge, GraphNode, Neighborhood, RefKind } from "@/lib/types";

// SubjectSwitcher — WHICH topic (or person) the explorer is centred on: the subject's own name at the
// TITLE rung, on the h1's line, with a chevron. It was one rung down (20) on a line of its own under the
// h1, and read as a subtitle — the reader's most important choice dressed as a breadcrumb, its chevron a
// 16px afterthought beside 20px type. At 28 beside "Topics" it is the second half of the title, "Topics /
// Activation", the path grammar every repo header uses: the kind, then the one. The chevron is 24, the
// cap-height of the rung, in muted ink. The whole name is the trigger; hover washes it (tint-1, hugging
// the text — the rail's workspace-switcher grammar: name + chevron, no box at rest).
//
// Open, the title BECOMES the input: the name gives way to a field of the same size and weight carrying
// the name as its placeholder, and typing filters the list at once. There is no search row inside the
// popup — a search field on top of a five-item menu was a command palette wearing a picker's clothes.
// The list is a MENU, and it speaks the graph's alphabet: every row leads with the subject's kind-mark in
// its identity colour (the hexagon a topic wears on the field, the disc a person wears), so a name in the
// menu and a mark on the canvas are the same thing said twice; the current subject carries a tick at the
// trailing edge, the rail's switcher grammar — it was said by weight alone, and a 500 among 400s in a
// five-row menu is a difference the eye reads as nothing. The count column is labelled once, at the top,
// muted ("links"), so a bare 4 is a fact and not a mystery; the head also says how many rows there are,
// which is the filter's feedback as you type. The menu hangs off the title's left text edge — its first
// glyph (the mark) on the edge the title's first glyph sits on, so the list is the title's column
// continued, not a panel beside it — 320 wide (the heading's own reach), on the menu material (one rung
// lighter than a popover's shadow; at title scale the heavier shadow read as a panel dropping out of the
// heading). Arrow keys move a highlight, Enter picks, Escape puts the name back. Sorted by connection
// count so the busiest subjects lead. Not the Popover primitive: its anchor must be a trigger it owns,
// and the anchor here is an input that replaces the trigger, so the popup is drawn by hand.
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
  const [active, setActive] = React.useState(0);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);
  const refocus = React.useRef(false);
  const listId = React.useId();
  const current = entities.find((e) => e.id === currentId);
  const ql = q.trim().toLowerCase();
  const shown = entities
    .filter((e) => e.name.toLowerCase().includes(ql))
    .sort((a, b) => relationCount(b.id) - relationCount(a.id));

  function close(back: boolean) {
    refocus.current = back;
    setOpen(false);
    setQ("");
    setActive(0);
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
      setActive((i) => (shown.length ? (i + 1) % shown.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (shown.length ? (i - 1 + shown.length) % shown.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (shown[active]) pick(shown[active].id);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close(true);
    } else if (e.key === "Tab") {
      close(false);
    }
  }

  // one box for both states: -mx-1.5 / px-1.5 keeps the name's first glyph on the title's text edge and
  // lets the hover wash bleed 6px past it; py-0.5 so the field and the button stand the same height and
  // nothing on the line moves when the name becomes a field
  // (no max-w-full on the box: with the negative margins it fed the wrapper's width back into the button's
  // limit, and "Activation" truncated to "Activati…" in a column with 800px to spare)
  const box = "-mx-1.5 inline-flex min-w-0 items-center gap-2 rounded-md px-1.5 py-0.5 text-2xl font-medium";
  return (
    <div
      ref={rootRef}
      className="relative inline-flex min-w-0 max-w-full"
      onBlur={(e) => {
        // focus leaving the title AND its list (a Tab away) puts the name back; a click on a row keeps
        // focus in the field (the row's pointerdown is prevented), so it never fires for a pick
        if (open && !rootRef.current?.contains(e.relatedTarget as Node)) close(false);
      }}
    >
      {open ? (
        <div className={box}>
          {/* the field and a sizer share one grid cell, so the field is exactly as wide as the name it
              stands in for (and grows with what is typed) — the chevron holds its place. size={1}: a
              field's own intrinsic width is twenty characters, and the grid track took it over the sizer */}
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
                setActive(0);
              }}
              onKeyDown={onKey}
              className="col-start-1 row-start-1 w-full min-w-0 bg-transparent p-0 text-2xl font-medium text-foreground outline-none placeholder:text-muted-foreground"
            />
          </span>
          <ChevronDown className="size-6 shrink-0 text-muted-foreground" aria-hidden="true" />
        </div>
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
          className={cn(box, "text-left text-foreground transition-colors hover:bg-tint-1", FOCUS_RING)}
        >
          <span className="truncate">{current?.name ?? `Pick a ${noun}`}</span>
          <ChevronDown className="size-6 shrink-0 text-muted-foreground" aria-hidden="true" />
        </button>
      )}
      {open ? (
        // -left-3: the menu's padding (p-1) plus a row's (px-2) is 12px, and that is how far the first mark
        // would have sat inside the title's text edge — the menu is pulled back by exactly that, derived, so
        // the marks stand on the edge the title stands on
        <div
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label={nounPlural}
          className={cn(MENU_SURFACE, "scrollbar-subtle absolute top-full -left-3 z-50 mt-1.5 flex max-h-72 w-80 flex-col overflow-y-auto")}
        >
          {/* the column head — what the rows are and what the number is, said once, in muted 12. The
              spacers hold the mark's and the tick's slots so the words sit over the names and the counts. */}
          <div role="presentation" className="flex items-center gap-2 px-2 pt-1 pb-1.5 text-xs text-muted-foreground">
            <span aria-hidden="true" className="size-2.5 shrink-0" />
            <span className="min-w-0 flex-1 truncate tabular-nums">
              {shown.length} {shown.length === 1 ? noun : nounPlural}
            </span>
            <span className="shrink-0">links</span>
            <span aria-hidden="true" className="size-3.5 shrink-0" />
          </div>
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
                  // one highlight for pointer and keyboard (the row the arrows are on IS the hovered row);
                  // the current subject is the row's weight AND the tick at the trailing edge — a wash is
                  // what hover does. The count is inventory: muted, tabular, in its labelled column. The
                  // tick's slot is held on every row so the counts stay in one column.
                  className="flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors data-active:bg-tint-1"
                >
                  <NodeMark node={{ id: e.id, kind }} className="size-2.5" />
                  <span className={cn("min-w-0 flex-1 truncate", sel && "font-medium")}>{e.name}</span>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{relationCount(e.id)}</span>
                  {sel ? (
                    <Check className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
                  ) : (
                    <span aria-hidden="true" className="size-3.5 shrink-0" />
                  )}
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

// [out-verb, in-verb] per edge type — read from the ROW's point of view: the row is the subject of the
// sentence, the other end its object. "Q4 Roadmap — linked from Notification strategy v3."
const VERB: Record<EdgeType, [string, string]> = {
  links_to: ["links to", "linked from"],
  sourced_from: ["sourced from", "source for"],
  mentions: ["mentions", "mentioned by"],
  in_collection: ["in", "contains"],
  authored_by: ["by", "authored"],
  decided: ["decided", "decided in"],
  supersedes: ["supersedes", "superseded by"],
};

// the same ties read from the SUBJECT's side — [subject is `from`, subject is `to`] — with the row as the
// object left unsaid, because the row's title says it: on Ana's page, "authored" under an artifact is
// "Ana authored this". Used for a direct tie, where the other end is always the page's subject.
const AS_SUBJECT: Record<EdgeType, [string, string]> = {
  links_to: ["links to", "linked from"],
  sourced_from: ["sourced from", "source for"],
  mentions: ["mentions", "mentioned in"],
  in_collection: ["in", "contains"],
  authored_by: ["by", "authored"],
  decided: ["decided", "decided in"],
  supersedes: ["supersedes", "superseded by"],
};

// the relation as a complete sentence from the row's side, naming the other end — for a second-hop row,
// whose tie is to a first-ring neighbour the reader has not picked
function relationOf(rowId: string, e: GraphEdge, labelOf: (id: string) => string): string {
  return e.from === rowId ? `${VERB[e.type][0]} ${labelOf(e.to)}` : `${VERB[e.type][1]} ${labelOf(e.from)}`;
}

// a direct tie's relation, or nothing. "mentions Activation" sat under every row: the subject is the page's
// title, so a sentence whose object is the subject restates the page, four times. A topic or a person
// exists in the graph BECAUSE artifacts mention it — "mentions" is the default tie and says nothing here.
// A tie of any other kind (Ana AUTHORED this one) is the exception, and the exception earns its word.
function directRelationOf(subjectId: string, e: GraphEdge): string | null {
  if (e.type === "mentions") return null;
  return e.from === subjectId ? AS_SUBJECT[e.type][0] : AS_SUBJECT[e.type][1];
}

// one neighbour, ONE line: the kind-mark, the name, and after it, in muted ink, only what earns it — a
// non-default relation, "proposed", a confidence word. The meta was a second line under the name, and one
// two-line row in a list of one-liners broke the list's rhythm for a word. It follows the name rather than
// sitting on the row's far edge: in a single-column list 976 wide, a word pinned to the right edge is 700px
// from the name it qualifies, over empty ground — the orphaned-control fault in prose form. "Q4 launch
// plan  linked from Notification strategy v3" reads as one sentence. A row is the same width as the tabs
// above it (flush), hover on the ground. A node the graph draws dashed (still being processed) is dashed
// here too — the provenance vocabulary holds between the views.
function RelationRow({
  node,
  edge,
  relation,
  onSelect,
}: {
  node: GraphNode;
  edge: GraphEdge;
  relation: string | null;
  onSelect: (id: string) => void;
}) {
  const proposed = edge.prov === "ai_generated";
  const level = proposed && edge.confidence != null ? confidenceLevel(edge.confidence) : "high";
  const meta = relation || proposed;
  return (
    <button
      type="button"
      onClick={() => onSelect(node.id)}
      className="flex w-full items-center gap-3 py-2.5 text-left transition-colors hover:bg-tint-1 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus outline-none"
    >
      {/* the graph's mark at the glyph rung — 10px, the size the graph draws a neighbour at. At 14 the
          filled square outweighed the 15px title beside it; at 10 it is the list's letter of the graph's
          alphabet (shape says kind, hue says identity), not a swatch. */}
      <NodeMark node={{ id: node.id, kind: node.kind }} className="size-2.5" pending={node.state === "processing"} />
      <span className="min-w-0 truncate text-base font-medium">{node.label}</span>
      {meta ? (
        // the name gives way first (it has a fuller form one click away); the relation phrase truncates
        // only after it, and the two words that judge the tie never do
        <span className="flex min-w-0 shrink-0 items-center gap-2 text-sm text-muted-foreground">
          {relation ? <span className="min-w-0 truncate">{relation}</span> : null}
          {relation && proposed ? <span aria-hidden="true" className="h-3 w-px shrink-0 bg-border" /> : null}
          {proposed ? <span className="shrink-0">proposed</span> : null}
          {/* the confidence word only where it earns ink (settled 2026-09-12): high is silent, Likely
              muted, Unsure in full ink — a demand on the reader's attention */}
          {level === "likely" ? <span className="shrink-0">Likely</span> : null}
          {level === "unsure" ? <span className="shrink-0 font-medium text-foreground">Unsure</span> : null}
        </span>
      ) : null}
    </button>
  );
}

// ListView — the focus's neighbourhood AS A LIST. The direct ties, and at the list's foot the FOLD: a row
// that says what the list is not showing, "+24 more", in the fold's material (the "+N" on tint-1, muted
// 500, no border), whose open state IS the shared depth setting. Open, the second hop lists under a
// grouped-list band ("A step further 24"), each row saying which first-ring neighbour it hangs off, and the
// fold row at the foot reads "Fewer". The depth switch itself (a SegToggle) is the GRAPH's control and stays
// in the graph: seated in the list's corner it floated at the column's far right over 700px of empty
// gutter while the rows sat at the left — a control with no surface under it — and the 24 rows it hid had
// no presence in the list at all. A fold is how a list says "more"; a switch is how a canvas does.
// "The list is the truth; the graph is the show me" — same data, listed instead of drawn. Click a row to
// re-focus there.
function ListView({
  nb,
  wide,
  extended,
  onExtend,
  onSelect,
}: {
  nb: Neighborhood; // the direct neighbourhood
  wide: Neighborhood; // the two-hop one
  extended: boolean; // the shared depth setting
  onExtend: (on: boolean) => void;
  onSelect: (id: string) => void;
}) {
  const byId = new Map(wide.nodes.map((n) => [n.id, n]));
  const labelOf = (id: string) => byId.get(id)?.label ?? id;
  // one row per direct tie (a neighbour tied twice is listed twice — each tie is its own fact)
  const direct = nb.edges
    .filter((e) => e.from === nb.centerId || e.to === nb.centerId)
    .map((e) => ({ edge: e, node: byId.get(e.from === nb.centerId ? e.to : e.from) }))
    .filter((r): r is { edge: GraphEdge; node: GraphNode } => !!r.node);
  // the second hop: each node a step further, with the tie that reaches it from the first ring
  const second = wide.nodes
    .filter((n) => n.depth === 2)
    .map((n) => ({
      node: n,
      edge: wide.edges.find(
        (e) => (e.from === n.id || e.to === n.id) && byId.get(e.from === n.id ? e.to : e.from)?.depth === 1,
      ),
    }))
    .filter((r): r is { edge: GraphEdge; node: GraphNode } => !!r.edge);

  // the fold row: the same row grammar as the neighbours (flush, py-2.5, hover on the ground), leading with
  // the "+N" chip in the mark's slot so "+24 more" starts on the rows' leading edge; open, it is the way
  // back, "Fewer", a plain muted row. One button, two states, one seat.
  const fold = second.length ? (
    <button
      type="button"
      onClick={() => onExtend(!extended)}
      aria-expanded={extended}
      className="flex w-full items-center gap-1.5 py-2.5 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-tint-1 hover:text-foreground focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus outline-none"
    >
      {extended ? (
        <span>Fewer</span>
      ) : (
        <>
          <span className="rounded-sm bg-tint-1 px-1.5 py-px text-xs tabular-nums">+{second.length}</span>
          <span>more</span>
        </>
      )}
    </button>
  ) : null;

  return (
    <div>
      {direct.length ? (
        <div className={cn(DIVIDED_FLUSH, "border-b border-border")}>
          {direct.map((r) => (
            <RelationRow
              key={r.edge.id}
              node={r.node}
              edge={r.edge}
              relation={directRelationOf(nb.centerId, r.edge)}
              onSelect={onSelect}
            />
          ))}
          {!extended ? fold : null}
        </div>
      ) : (
        <p className="py-12 text-center text-sm text-muted-foreground">No relations yet.</p>
      )}
      {extended && second.length ? (
        <>
          {/* the second ring under the house's group band — the count is inventory, how many are a step
              further; the band names the group where the fold row stood, and the fold moves to the foot */}
          <FeedHead count={second.length} kind="inventory">
            A step further
          </FeedHead>
          <div className={cn(DIVIDED_FLUSH, "border-b border-border")}>
            {second.map((r) => (
              <RelationRow
                key={r.node.id}
                node={r.node}
                edge={r.edge}
                relation={relationOf(r.node.id, r.edge, labelOf)}
                onSelect={onSelect}
              />
            ))}
            {fold}
          </div>
        </>
      ) : null}
    </div>
  );
}

// GraphView — the relationship view: the field straight on the page ground (no card, no border, no
// legend), starting directly under the tab row, the depth switch in its top-right corner. The canvas
// used to begin 16px down and the switch sat a further gap below the hairline — 30px of dead air between
// the tab row and the one control under it. Now the field's top IS the row under the hairline.
function GraphView({
  nb,
  wide,
  centerId,
  previewIds,
  onSelect,
  onVerifyEdge,
  controls,
}: {
  nb: Neighborhood;
  wide: Neighborhood;
  centerId: string;
  previewIds?: string[];
  onSelect: (id: string) => void;
  onVerifyEdge?: (edgeId: string, action: "confirm" | "discard") => void;
  controls?: React.ReactNode;
}) {
  return (
    // the names' knockout paints in the ground colour; this field is the page, not a card
    <div className="relative" style={{ "--graph-ground": "var(--background)" } as React.CSSProperties}>
      {/* controls — depth, in the field's own top-right corner: a setting of THIS view, so it lives inside it */}
      {controls ? <div className="absolute top-0 right-0 z-10 flex items-center gap-2">{controls}</div> : null}
      {/* click a node → peek it in a popover anchored AT the node (no card docked below the canvas, which
          would just re-list the graph); re-centering the explorer is the peek's deliberate "Focus here"
          action, and a proposed (dashed) edge is confirmable in place via onVerifyEdge.
          radial, laid out on the WIDE neighbourhood at every reach: the inner ring's sectors are sized by
          each neighbour's second-hop weight, and they hold still when the outer ring appears, so the hover
          preview adds nodes without moving the ones already there. fullLabels + outerRing="full": a subject
          with a handful of neighbours writes every name out, and a ring the reader asked for is drawn in
          full ink. labelRule="below": one placement for every name (five names had four), the subject's in
          full ink, the neighbours' muted. The svg is capped at 650, which at the 520-unit box is a 1.25
          scale: the subject's 12-unit name lands on the 15 rung and a neighbour's 10.5 on 13 — the two
          rungs the page's rows use, not a size of the canvas's own. */}
      <LocalGraph
        data={nb}
        layoutData={wide}
        layout="radial"
        fullLabels
        outerRing="full"
        labelRule="below"
        previewIds={previewIds}
        className="max-w-[650px]"
        onSelect={() => {}}
        onVerifyEdge={onVerifyEdge}
        renderPopover={(id, api) => {
          const n = nb.nodes.find((x) => x.id === id);
          if (!n) return null;
          return (
            <EntityProfile
              node={n}
              placement="popover"
              onSelect={(relId) => {
                onSelect(relId);
                api.close();
              }}
              primaryAction={
                id === centerId
                  ? undefined
                  : { label: "Focus here", onClick: () => { onSelect(id); api.close(); }, icon: Crosshair }
              }
            />
          );
        }}
      />
    </div>
  );
}

// Explorer — the shell. Three choices of three kinds, each in its own material so the reader can tell
// at a glance which changes WHAT they look at, which changes HOW it is shown, and which is a setting:
//   the subject  — its name at the title rung, on the h1's line: "Topics / Activation ⌄", a switcher
//                  (name + chevron; the rail's workspace grammar)
//   the view     — ViewTabs, the page-level control (underline, forest)
//   the depth    — a SegToggle inside the graph it governs; in the list, the same setting is a fold row
// The Explorer owns the page heading so the subject can share the h1's line: two lines of chrome
// (title, tabs) where there were three of decreasing size. (See woven/product/explorer-framework.md.)
export function Explorer({
  entities,
  entityKind,
  heading,
  entityNoun = "entity",
  entityNounPlural = "entities",
}: {
  entities: { id: string; name: string }[];
  // the kind every entity here is (a topic, a person) — the switcher's menu draws each row's kind-mark
  entityKind: RefKind;
  heading: { title: string; hint: string };
  entityNoun?: string;
  entityNounPlural?: string;
}) {
  useGraphVersion(); // re-render after an in-graph verify/undo so the field reflects it
  // a ?focus=<id> deep-link (from ⌘K opening a person/topic while NOT already on this page) seeds the center;
  // without this the Explorer hard-centered on entities[0], landing on the wrong entity. Re-centers if it changes.
  const params = useSearchParams();
  const focusParam = params.get("focus");
  const [centerId, setCenterId] = React.useState(() =>
    focusParam && entities.some((e) => e.id === focusParam) ? focusParam : entities[0]?.id ?? "",
  );
  const [view, setView] = React.useState("graph");
  const [depth, setDepth] = React.useState("1");
  // the depth option the pointer rests on — "2" while hovering "+24 more" ghosts the outer ring in
  const [peek, setPeek] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (focusParam && entities.some((e) => e.id === focusParam)) setCenterId(focusParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusParam]);

  // register this explorer's re-center fn so the global search's "Find → Focus on this" lands here
  const { registerFocus } = useSearch();
  React.useEffect(() => {
    registerFocus(setCenterId);
    return () => registerFocus(null);
  }, [registerFocus]);

  // calm one-line empty state — no broken chrome (garbage center node) when a space has no topics/people yet
  if (!entities.length) {
    return (
      <div>
        <PageHeading title={heading.title} hint={heading.hint} />
        <div className="mt-6 rounded-lg bg-card py-16 text-center text-sm text-muted-foreground">
          No {entityNounPlural} yet — they emerge as Woven weaves your artifacts.
        </div>
      </div>
    );
  }

  // both reaches, always: the counts on the depth switch say what each shows before it is chosen
  const nbDirect = getNeighborhood(centerId, 1);
  const nbWide = getNeighborhood(centerId, 2);
  const directCount = nbDirect.nodes.length - 1;
  const wideCount = nbWide.nodes.length - 1;
  const previewing = depth === "1" && peek === "2" && wideCount > directCount;
  const nb = depth === "2" || previewing ? nbWide : nbDirect;
  // the ghost is everything the wider reach ADDS: its ring, and any tie the direct view does not draw
  // (a tie between two direct neighbours is only picked up on the second hop)
  const previewIds = previewing
    ? [
        ...nbWide.nodes.filter((n) => n.depth === 2).map((n) => n.id),
        ...nbWide.edges.filter((e) => !nbDirect.edges.some((d) => d.id === e.id)).map((e) => e.id),
      ]
    : undefined;
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

  // the depth switch, the graph's own control, in its top-right corner. Its two options are the reach in
  // the reader's numbers and ONE grammar — "Direct 4" and "+24 more", what is drawn and what the click
  // adds — the figure in each phrase, at the phrase's size. "Extended +24" was a name for a setting with a
  // delta pinned to it: a word the reader had to translate, and a count beside a delta read as a stats
  // widget rather than a switch. Hovering "+24 more" previews it (see GraphView), so the copy names the
  // click's consequence before the click.
  const depthEl = (
    <SegToggle
      ariaLabel="Reach"
      options={[
        { id: "1", label: `Direct ${directCount}` },
        { id: "2", label: `+${wideCount - directCount} more` },
      ]}
      value={depth}
      onChange={setDepth}
      onHover={setPeek}
    />
  );
  return (
    <div>
      {/* the title line: the kind (the page's h1, with its hint) and, after a slash in glyph ink, the
          one — the subject, the trigger. gap-x-4 either side of the slash so the hint glyph stays with
          "Topics" and the path reads in three beats; it wraps under the h1 only when the column cannot
          hold both. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <PageHeading title={heading.title} hint={heading.hint} />
        <span aria-hidden="true" className="text-2xl text-foreground-hint">/</span>
        <SubjectSwitcher
          entities={entities}
          kind={entityKind}
          currentId={centerId}
          onSelect={setCenterId}
          noun={entityNoun}
          nounPlural={entityNounPlural}
        />
      </div>

      {/* the view — the one page-level switch: three lenses on the same subject */}
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

      {/* mt-3: the view's first row (the graph's depth switch, the list's first row, the timeline's first
          entry) sits one control gap under the hairline, not a section gap */}
      <div className="mt-3" data-explorer-view={view}>
        {view === "timeline" ? (
          center ? (
            <TimelineView center={center} />
          ) : (
            <div className="flex h-80 items-center justify-center text-sm text-muted-foreground">
              Select an entity to explore.
            </div>
          )
        ) : view === "list" ? (
          <ListView
            nb={nbDirect}
            wide={nbWide}
            extended={depth === "2"}
            onExtend={(on) => setDepth(on ? "2" : "1")}
            onSelect={setCenterId}
          />
        ) : (
          <GraphView nb={nb} wide={nbWide} centerId={centerId} previewIds={previewIds} onSelect={setCenterId} onVerifyEdge={resolve} controls={depthEl} />
        )}
      </div>
    </div>
  );
}
