"use client";

import {
  FileText,
  PencilLine,
  AtSign,
  Link2,
  Check,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { DIVIDED_FLUSH } from "./classes";
import { PersonAvatar, AgentAvatar } from "./identity";
import { EPISODE_LABEL } from "./catch-up";
import { getArtifact, nodeTimeline, personById, type TimelineEvent } from "@/lib/api";
import type { Episode, GraphNode } from "@/lib/types";

const KIND_ICON: Record<TimelineEvent["kind"], LucideIcon> = {
  created: FileText,
  edited: PencilLine,
  mentioned: AtSign,
  linked: Link2,
  confirmed: Check,
  proposed: Sparkles,
};

// the dot on the rail — a person avatar when there's an actor, the agent mark for Woven's own
// actions, otherwise a quiet kind icon.
function EventLead({ ev }: { ev: TimelineEvent }) {
  if (ev.agent) return <AgentAvatar size="md" />;
  if (ev.actor) {
    const p = personById(ev.actor);
    return <PersonAvatar seed={ev.actor} name={p?.name ?? ev.actor} size="md" />;
  }
  const Icon = KIND_ICON[ev.kind] ?? FileText;
  return (
    <span className="flex size-7 items-center justify-center rounded-full bg-tint-1 text-muted-foreground">
      <Icon className="size-3.5" />
    </span>
  );
}

// Timeline view — the focused entity's history as a vertical thread. The graph answers "what does it
// connect to"; this answers "what has it been through". Same entity, the time axis instead of links.
export function TimelineView({ center }: { center: GraphNode }) {
  const events = nodeTimeline(center.id);

  return (
    // on the page ground, under the explorer's tabs, so its text edge is the column's — the horizontal
    // padding it carried was a card's inset, and the card is gone
    <div className="py-5">
      <p className="mb-7 flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <span className="truncate">{center.label}</span>
        <span aria-hidden="true" className="h-3 w-px shrink-0 bg-border" />
        <span className="shrink-0">history</span>
      </p>
      <ol className="space-y-0">
        {events.map((ev, i) => {
          const last = i === events.length - 1;
          return (
            <li key={ev.id} className="flex gap-3.5">
              {/* rail — the dot, with a hairline connector dropping toward the next event */}
              <div className="flex flex-col items-center">
                <EventLead ev={ev} />
                {!last ? <span className="mt-1 w-px flex-1 bg-border" /> : null}
              </div>
              {/* event */}
              <div className={last ? "pb-0" : "pb-7"}>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    {ev.at}
                  </span>
                  {ev.agent ? (
                    <span className="rounded-full bg-tint-1 px-1.5 py-px text-xs font-medium text-muted-foreground">
                      Woven
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-base">{ev.text}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// EpisodeTimeline — the SPACE's timeline: not one entity's thread (a node has a history of its own, and the
// space has none — nodeTimeline gives it nothing) but the recent episodes across the whole space, newest
// first, each a narrated row in the house's episode grammar (the ⌘K zero-state's and the StoryStrip's): who
// (the actor's avatar, or the agent's dish), the kind as a small chip, the artifact it touched, its summary,
// and the time trailing. Rows in the explorer's list grammar — flush to the column, parted by the hairline,
// one text edge (a marker slot one body line tall, the avatar centred in it), tint-1 on hover, the ring
// inset — so the Team page's three views share one row. A row goes to the artifact the episode is about.
// The episodes are the record's; nothing here is invented (a summary a row has not got is not written).
export function EpisodeTimeline({ episodes }: { episodes: Episode[] }) {
  if (!episodes.length) {
    return <p className="py-12 text-center text-sm text-muted-foreground">Nothing has happened here yet.</p>;
  }
  return (
    <div className={cn(DIVIDED_FLUSH, "border-b border-border")}>
      {episodes.map((ep) => {
        const agent = ep.actor === "agent";
        const who = agent ? "Woven" : (personById(ep.actor)?.name ?? ep.actor);
        const label = EPISODE_LABEL[ep.kind];
        return (
          <Link
            key={ep.id}
            href={`/artifact/${ep.artifactId}`}
            className="flex items-center gap-3 py-2.5 outline-none transition-colors hover:bg-tint-1 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus"
          >
            <span className="flex h-(--text-base--line-height) w-6 shrink-0 items-center justify-center">
              {agent ? <AgentAvatar size="sm" /> : <PersonAvatar seed={ep.actor} name={who} size="sm" />}
            </span>
            {/* the kind chip — an object at rest, tint-1 on the ground, 12/500; leading-none because the box is
                the glyph. Its ink is the house's own for that kind (forest on the confirm beat, muted otherwise).
                In a fixed slot (w-20 holds "Confirmed"), so the titles after it share one edge down the list —
                the RelationRow's rule: the same slots on every row, never a column that jogs with its word. */}
            <span className="flex w-20 shrink-0">
              <span className={cn("rounded-sm bg-tint-1 px-1.5 py-0.5 text-xs font-medium leading-none", label.cls)}>{label.text}</span>
            </span>
            {/* the phrase: the artifact in the row's weight, then the episode's own words, parted by a hairline
                — the row title's rung, truncated because the artifact is one click away */}
            <span className="flex min-w-0 flex-1 items-center gap-2 text-base">
              <span className="min-w-0 truncate font-medium">{getArtifact(ep.artifactId)?.title ?? "an artifact"}</span>
              <span aria-hidden="true" className="h-3 w-px shrink-0 bg-border" />
              <span className="min-w-0 truncate text-sm text-muted-foreground">{ep.summary}</span>
            </span>
            {/* the age: the list's trailing column, 12 tabular muted, right-aligned on the column's edge */}
            <span className="flex w-14 shrink-0 justify-end text-xs tabular-nums text-muted-foreground">{ep.at}</span>
          </Link>
        );
      })}
    </div>
  );
}
