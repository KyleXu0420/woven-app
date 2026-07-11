"use client";

// StoryStrip — the artifact's EPISODIC memory beside the semantic graph. Where the ContextRail's
// properties answer "what does this connect to", this answers "what happened to it, when, and who
// moved it": captured → parsed → edges proposed → confirmed → commented → resolved → edited →
// superseded. A compact, newest-first timeline for the reader's right rail. The avatars are strung
// on a thin spine in their own gutter (a between-items connector, never a left accent bar on the
// section); a tiny kind-colored dot on each avatar cues what kind of event it was.

import * as React from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { AgentAvatar, PersonAvatar } from "@/components/identity";
import { artifactEpisodes, personById } from "@/lib/api";
import { useGraphVersion } from "@/lib/use-graph-version";
import type { Episode, EpisodeKind } from "@/lib/types";

// how many of the newest episodes show before the "N earlier" fold
const LATEST = 4;

// the kind cue — subtle by design: only a confirm (green) or a version roll (amber/ochre) lights up;
// every other kind gets a faint muted dot so "who + when" stays the emphasis, not the event type.
const KIND_COLOR: Record<EpisodeKind, string> = {
  confirmed: "var(--primary)",
  superseded: "var(--chart-2)",
  captured: "color-mix(in srgb, var(--muted-foreground) 50%, transparent)",
  proposed: "color-mix(in srgb, var(--muted-foreground) 50%, transparent)",
  commented: "color-mix(in srgb, var(--muted-foreground) 50%, transparent)",
  resolved: "color-mix(in srgb, var(--muted-foreground) 50%, transparent)",
  edited: "color-mix(in srgb, var(--muted-foreground) 50%, transparent)",
};

// the node marker in the gutter — the actor's avatar (agent or person), with the kind dot badged on it.
// z-10 so it paints over the spine; the avatar's own opaque fill makes the spine read as passing behind it.
function Marker({ episode }: { episode: Episode }) {
  const isAgent = episode.actor === "agent";
  const name = isAgent ? "Woven" : personById(episode.actor)?.name ?? episode.actor;
  return (
    <span className="relative z-10 inline-flex">
      {isAgent ? (
        <AgentAvatar size="xs" />
      ) : (
        <PersonAvatar seed={episode.actor} name={name} size="xs" />
      )}
      <span
        className="absolute -bottom-0.5 -right-0.5 size-1.5 rounded-full ring-2 ring-card"
        style={{ backgroundColor: KIND_COLOR[episode.kind] }}
      />
    </span>
  );
}

export function StoryStrip({ artifactId }: { artifactId: string }) {
  const [open, setOpen] = React.useState(false);
  // re-render when a new episode is recorded (e.g. after a Verify confirm writes a "confirmed" episode)
  useGraphVersion();

  // artifactEpisodes is CHRONOLOGICAL (oldest first) — reverse for a newest-first feed.
  const episodes = artifactEpisodes(artifactId);
  if (episodes.length === 0) return null;
  const ordered = [...episodes].reverse();

  const shown = open ? ordered : ordered.slice(0, LATEST);
  const hidden = ordered.length - LATEST;

  return (
    <section>
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        Story
      </span>

      <ol className="mt-2.5">
        {shown.map((ep, i) => {
          const notFirst = i > 0;
          const notLast = i < shown.length - 1;
          return (
            <li key={ep.id} className="relative flex gap-3">
              {/* gutter — avatar strung on a thin spine. The spine is split into an upper half (skipped on
                  the first row) and a lower half (skipped on the last row), so flush rows join into one
                  continuous line between avatar centers with no stub above the first / tail below the last. */}
              <div className="relative flex w-5 shrink-0 justify-center">
                {notFirst ? (
                  <span className="absolute left-1/2 top-0 h-2.5 w-px -translate-x-1/2 bg-border" />
                ) : null}
                {notLast ? (
                  <span className="absolute bottom-0 left-1/2 top-2.5 w-px -translate-x-1/2 bg-border" />
                ) : null}
                <Marker episode={ep} />
              </div>

              {/* content — the agent-narrated line on one row, the relative time right-aligned. pb creates
                  the vertical rhythm the spine spans down to the next avatar. */}
              <div className="min-w-0 flex-1 pb-4">
                <div className="flex items-start justify-between gap-2">
                  <p
                    className="min-w-0 flex-1 truncate text-[13px] leading-snug text-foreground"
                    title={ep.summary}
                  >
                    {ep.summary}
                  </p>
                  <span className="shrink-0 pt-px text-[11px] tabular-nums text-muted-foreground">
                    {ep.at}
                  </span>
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {/* fold — a horizontal fold line + a rotating chevron reveals the older episodes below */}
      {hidden > 0 ? (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="group flex w-full items-center gap-2 pt-0.5 text-muted-foreground transition-colors hover:text-foreground"
        >
          <span className="h-px flex-1 bg-border" />
          <span className="text-[11px] font-medium">{open ? "Fewer" : `${hidden} earlier`}</span>
          <ChevronRight
            className={cn("size-3.5 transition-transform", open ? "-rotate-90" : "rotate-90")}
          />
        </button>
      ) : null}
    </section>
  );
}
