"use client";

import Link from "next/link";
import { Link2, Users, FileText, History, type LucideIcon, Network } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PersonAvatar, IdentityGroup, OverflowAvatar } from "@/components/identity";
import { DIVIDED, FOCUS_RING } from "@/components/classes";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { agoMinutes, artifactEpisodes, getArtifact, listCollections, nodeRelations } from "@/lib/api";
import type { Conn, ConnKind, Episode, Person } from "@/lib/types";

// Shared artifact vocabulary — used by the Today cards AND the Artifact page, so the
// two never drift (one system, not two).

// connection kind → icon (the lib stays React/lucide-free; the mapping lives here)
const CONN_ICON: Record<ConnKind, LucideIcon> = {
  link: Link2,
  people: Users,
  sources: FileText,
  version: History,
};

export function StatusPill({ state, stale }: { state: string; stale?: { since: string } | null }) {
  // a living doc whose source moved is not "Living" — the pill told the reader to resume a doc the system
  // already knew was stale. The warn dot and the fact, in ink; Living cannot render while stale is set.
  if (stale) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground">
        <span className="size-1.5 rounded-full bg-warn" />
        Source changed {stale.since}
      </span>
    );
  }
  if (state === "processing") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {/* the agent in motion — the one state on a row that is the agent's, so the one that is forest.
            It was grey while the settled "Living" dot below was forest: inverted. Activity's "Working"
            pill already draws the agent this way. */}
        <span className="size-1.5 animate-pulse rounded-full bg-primary" />
        Processing
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
      <span className="size-1.5 rounded-full bg-foreground/40" />
      Living
    </span>
  );
}

export function TypeBadge({ type }: { type: string }) {
  return (
    // Bare caps in muted ink, fixed width. Six bordered pills stacked in a column were the heaviest
    // ink on the page after the titles, and their varying widths made a ragged gutter for nothing.
    <span className="inline-block shrink-0 text-xs font-medium uppercase tracking-wider text-muted-foreground [&:not(:first-child)]:ml-1">
      {type}
    </span>
  );
}

// ③ CONNECTIONS — divider + small icons + mono (the graph value, on a card)
export function Connections({ items, className }: { items: Conn[]; className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-1 border-t pt-3 text-xs text-muted-foreground",
        className,
      )}
    >
      {items.map((c) => {
        const Icon = CONN_ICON[c.kind];
        return (
          <span key={c.label} className="inline-flex items-center gap-1.5">
            <Icon className="size-3 opacity-70" />
            {c.label}
          </span>
        );
      })}
    </div>
  );
}

// the people on a document, as a small avatar stack (+N overflow) — the "faces, not stats" card footer signal.
// Shared so every surface (Library grid + row, Today Continue hero) shows participants identically.
//
// The stack is a FOLD, and a fold unfolds: hovering it (or tapping it on a phone) opens a card with one row
// per person — who they are and, when the stack knows its artifact, what they last did here and when. It
// used to say "+1" and nothing more; the names lived in a native title tooltip, and "what did Jordan do
// here" needed a click through to the artifact. The same shape the collection fold below already has.
//
// The trigger is the whole stack, not just the "+N": a face is as much a question as the count is, and a
// stack of two has no "+N" to hover. It renders as a <span> (nativeButton=false): every stack sits inside a
// row that is an <a>, and a <button> inside an anchor is invalid HTML that browsers repair by splitting the
// link. The card is portalled, so its own links are not nested in the row's.
//
// artifactId: pass it wherever the caller has the artifact — without it the card can only say who, not what.
export function PeopleStack({ people, artifactId, className }: { people: Person[]; artifactId?: string; className?: string }) {
  if (!people.length) return null;
  return (
    <Popover>
      <PopoverTrigger
        nativeButton={false}
        openOnHover
        delay={160}
        render={
          <span
            // the names in one label: the faces are 10px monograms, and the "+N" is aria-hidden
            aria-label={people.map((p) => p.name).join(", ")}
            className={cn("inline-flex items-center rounded-full", FOCUS_RING, className)}
            onClick={(e) => {
              e.preventDefault(); // don't let the tap fall through to the row's link
              e.stopPropagation();
            }}
          />
        }
      >
        <IdentityGroup>
          {people.slice(0, 3).map((p) => (
            // title="" — the card now names every face; a native tooltip rising over an open card is two
            // answers to one hover. The aria-label stays: it is the name a reader hears.
            <PersonAvatar key={p.id} seed={p.id} name={p.name} initials={p.initial} size="xs" title="" />
          ))}
          {/* the count joins the stack rather than standing beside it: it was 12px bare text 6px to
              the right, so a stack of four read as three faces and a stray number. Last child, so it
              overlaps on top at the tail the way each face overlaps the one before it. */}
          {people.length > 3 ? <OverflowAvatar count={people.length - 3} /> : null}
        </IdentityGroup>
      </PopoverTrigger>
      {/* the house popover paper; rows on hairlines, no header — the count is the stack's */}
      <PopoverContent align="start" sideOffset={6} className="w-72 p-1.5">
        <div className={DIVIDED}>
          {peopleRows(people, artifactId).map(({ person, at, line }) => (
            <Link
              key={person.id}
              href={`/people?focus=${person.id}`}
              // px-3, because the hairline between rows is DIVIDED's inset-x-3: the line and the row's
              // content share an edge, instead of the line starting 4px inside the avatar's disc
              className={cn("flex items-start gap-2.5 rounded-md px-3 py-2 transition-colors hover:bg-tint-1", FOCUS_RING)}
            >
              {/* the marker sits on the two lines it belongs to (h-9 = name + what), not the row's centre */}
              <span className="flex h-9 shrink-0 items-center">
                <PersonAvatar seed={person.id} name={person.name} initials={person.initial} size="sm" title="" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{person.name}</span>
                  {/* when they last touched this — nothing if they never did */}
                  {at ? <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{at}</span> : null}
                </span>
                {/* what they did here, in the episode's own narrated words; the relation when there is no
                    episode; the role when the stack has no artifact to ask about. Wraps: a line that exists
                    only here has no fuller form to truncate toward. */}
                <span className="block text-sm text-muted-foreground">{line}</span>
              </span>
            </Link>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// the card's rows: people with activity on this artifact first, most recent first, then the rest in the
// stack's order. Each row carries the latest episode where this person is the actor (its summary is already
// a narrated line, its `at` the relative time), else the relation that put them in the stack.
function peopleRows(people: Person[], artifactId?: string): { person: Person; at: string | null; line: string }[] {
  // no artifact → names and roles only; there is no "here" to report on
  if (!artifactId) return people.map((person) => ({ person, at: null, line: person.role }));
  const episodes = artifactEpisodes(artifactId);
  const relations = nodeRelations(artifactId);
  const authorId = getArtifact(artifactId)?.author_id;
  return people
    .map((person, order) => {
      const latest = episodes
        .filter((e) => e.actor === person.id)
        // <=, not <: the seed lists episodes oldest-first, so of two at the same minute the LATER one in
        // the array is the newer, and it must win the tie (the story strip already reads it that way)
        .reduce<Episode | null>((best, e) => (!best || agoMinutes(e.at) <= agoMinutes(best.at) ? e : best), null);
      // authorship is on the record two ways — the artifact's author_id and an authored_by edge — and
      // either one makes the relation "Authored"; read, not inferred
      const authored =
        authorId === person.id ||
        relations.some((r) => r.edgeType === "authored_by" && r.dir === "out" && r.target_id === person.id);
      return {
        person,
        order,
        ago: latest ? agoMinutes(latest.at) : Number.POSITIVE_INFINITY,
        at: latest?.at ?? null,
        line: latest?.summary ?? (authored ? "Authored" : "Mentioned in this artifact"),
      };
    })
    .sort((a, b) => a.ago - b.ago || a.order - b.order)
    .map(({ person, at, line }) => ({ person, at, line }));
}

// a document can sit in several collections — show the first, fold the rest into a +N that unfolds the full list
// on hover. Shared so a doc reads the same whether it's a row, a grid card, or the Today hero.
export function CollectionTag({ ids, className }: { ids: string[]; className?: string }) {
  // keep the document's own order — the first collection it was filed in leads, the rest fold
  const all = listCollections();
  const cos = ids.flatMap((id) => {
    const c = all.find((x) => x.id === id);
    return c ? [c] : [];
  });
  if (!cos.length) return null;

  const lead = (
    <>
      <span className="size-2.5 shrink-0 rounded-sm" style={{ background: cos[0].color }} />
      <span className="truncate">{cos[0].name}</span>
    </>
  );

  // single collection → a plain tag, no affordance
  if (cos.length === 1) {
    return <span className={cn("inline-flex min-w-0 items-center gap-1.5", className)}>{lead}</span>;
  }

  // several → the +N is the fold; it unfolds every collection in a small light popover. Opens on hover
  // (desktop) AND on tap (mobile) — same panel — via base-ui's openOnHover on a click-triggered Popover.
  // Portaled, so the card's overflow-hidden can't clip it. The tap must not also follow the card's link.
  return (
    <Popover>
      <PopoverTrigger
        nativeButton={false}
        openOnHover
        delay={140}
        render={
          <span
            className={cn("group/col inline-flex min-w-0 items-center gap-1.5 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-focus max-md:min-h-11", className)}
            onClick={(e) => {
              e.preventDefault(); // don't let the tap fall through to the card's link
              e.stopPropagation();
            }}
          />
        }
      >
        {lead}
        <span className="shrink-0 rounded-full bg-tint-1 px-1 text-xs font-medium tabular-nums text-muted-foreground transition-colors group-hover/col:bg-tint-2 group-hover/col:text-foreground">
          +{cos.length - 1}
        </span>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" sideOffset={6} className="w-auto min-w-[8.5rem] p-2">
        <div className="flex flex-col gap-1.5 text-sm">
          {cos.map((c) => (
            <span key={c.id} className="inline-flex items-center gap-2">
              <span className="size-2.5 shrink-0 rounded-sm" style={{ background: c.color }} />
              <span className="truncate">{c.name}</span>
            </span>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// How many other artifacts this one is joined to in the graph. It was a bare glyph and a number —
// "18" next to a chain link, which reads as "eighteen URLs" and is not what it counts.
//
// Three surfaces drew the same fact three ways: a Link2 glyph here, a Network glyph in the reader's
// graph affordance, and an unlabelled number in the Explorer. Only the reader ever said the word,
// in prose, as "18 links". This is that sentence, made reusable.
//
// Network, not Link2: the number is a degree in the graph, not a count of hyperlinks. The tooltip
// carries the noun the glyph cannot.
export function LinkCount({ count, className, glyph = true }: { count: number; className?: string; glyph?: boolean }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={<span />}
        className={cn("inline-flex cursor-default items-center gap-1 tabular-nums", className)}
      >
        {glyph ? <Network className="size-3 opacity-70" aria-hidden="true" /> : null}
        {/* a fixed digit slot: with the number free-width the glyph slid 6px left on "18" vs "7",
            so a column of these never lined up. Two digits' worth, right-aligned, tabular. */}
        <span className="inline-block w-5 text-right tabular-nums">{count}</span>
        <span className="sr-only"> links to other artifacts</span>
      </TooltipTrigger>
      <TooltipContent side="top">
        {count === 1 ? "1 link to another artifact" : `${count} links to other artifacts`}
      </TooltipContent>
    </Tooltip>
  );
}
