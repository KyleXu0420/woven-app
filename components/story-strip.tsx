"use client";

// StoryStrip — the artifact's EPISODIC memory beside the semantic graph. "What happened to it, when, and
// who moved it": captured → proposed → confirmed → commented → resolved → edited → superseded. A compact,
// newest-first, INTERACTIVE timeline in the reader's right rail — each row jumps to its context (the block,
// the version diff, the graph); the ↗ on the title opens the full story. Avatars are strung on a thin spine
// in their own gutter (a between-items connector, never a left accent bar on the section). The event kind is
// carried by the agent-narrated line itself ("Maya confirmed…", "Dan opened a decision thread…"), so there's
// no cryptic status dot — who + what + when reads straight.

import * as React from "react";
import { ArrowUpRight, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AgentAvatar, PersonAvatar } from "@/components/identity";
import { artifactEpisodes, personById } from "@/lib/api";
import { useGraphVersion } from "@/lib/use-graph-version";
import type { Episode } from "@/lib/types";

// how many of the newest episodes show before the "N earlier" fold
const LATEST = 4;

// one episode — the actor's avatar strung on the timeline spine, the agent-narrated line, and the time.
// With onSelect the whole row is a button that jumps to the episode's context (block / version / graph),
// with a ↗ that fades in on hover to signal it's followable.
function EpisodeRow({
  episode,
  first,
  last,
  onSelect,
}: {
  episode: Episode;
  first: boolean;
  last: boolean;
  onSelect?: (e: Episode) => void;
}) {
  const isAgent = episode.actor === "agent";
  const name = isAgent ? "Woven" : personById(episode.actor)?.name ?? episode.actor;
  const body = (
    <>
      {/* gutter — the avatar on a split spine (upper half skipped on the first row, lower on the last), so
          flush rows join into one continuous avatar-to-avatar line with no stub above the first / below the last */}
      <div className="relative flex w-5 shrink-0 justify-center">
        {!first ? <span className="absolute left-1/2 top-0 h-2.5 w-px -translate-x-1/2 bg-border" /> : null}
        {!last ? <span className="absolute bottom-0 left-1/2 top-2.5 w-px -translate-x-1/2 bg-border" /> : null}
        <span className="relative z-10 inline-flex">
          {isAgent ? <AgentAvatar size="xs" /> : <PersonAvatar seed={episode.actor} name={name} size="xs" />}
        </span>
      </div>
      <div className="flex min-w-0 flex-1 items-start gap-2 pb-4">
        <p className="min-w-0 flex-1 truncate text-[13px] leading-snug text-foreground/90" title={episode.summary}>
          {episode.summary}
        </p>
        {onSelect ? (
          <ArrowUpRight className="mt-0.5 size-3 shrink-0 text-muted-foreground/50 opacity-0 transition-opacity group-hover/ep:opacity-100" />
        ) : null}
        <span className="shrink-0 pt-px text-[11px] tabular-nums text-muted-foreground">{episode.at}</span>
      </div>
    </>
  );
  if (!onSelect) return <li className="flex gap-3">{body}</li>;
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(episode)}
        className="group/ep -mx-2 flex w-full gap-3 rounded-lg px-2 text-left transition-colors hover:bg-foreground/[0.04]"
      >
        {body}
      </button>
    </li>
  );
}

// the full story, given room — a dialog listing every episode (clickable), opened by the ↗ on the strip.
function StoryOverlay({
  artifactId,
  title,
  open,
  onOpenChange,
  onEpisodeSelect,
}: {
  artifactId: string;
  title: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onEpisodeSelect?: (e: Episode) => void;
}) {
  useGraphVersion();
  const ordered = [...artifactEpisodes(artifactId)].reverse();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Story · {title}</DialogTitle>
          <DialogDescription>
            How this artifact came to be — captured, proposed, confirmed, discussed, and revised. Follow a row
            to its place in the document.
          </DialogDescription>
        </DialogHeader>
        <ol className="scrollbar-subtle -mx-1 max-h-[62vh] overflow-y-auto px-1">
          {ordered.map((ep, i) => (
            <EpisodeRow
              key={ep.id}
              episode={ep}
              first={i === 0}
              last={i === ordered.length - 1}
              onSelect={
                onEpisodeSelect
                  ? (e) => {
                      onEpisodeSelect(e);
                      onOpenChange(false);
                    }
                  : undefined
              }
            />
          ))}
        </ol>
      </DialogContent>
    </Dialog>
  );
}

export function StoryStrip({
  artifactId,
  title = "this artifact",
  onEpisodeSelect,
}: {
  artifactId: string;
  title?: string;
  onEpisodeSelect?: (e: Episode) => void;
}) {
  const [open, setOpen] = React.useState(false); // the inline "N earlier" fold
  const [overlay, setOverlay] = React.useState(false); // the full-story dialog
  // re-render when a new episode is recorded (e.g. after a Verify confirm writes a "confirmed" episode)
  useGraphVersion();

  const episodes = artifactEpisodes(artifactId);
  if (episodes.length === 0) return null;
  const ordered = [...episodes].reverse(); // artifactEpisodes is chronological → newest-first feed
  const shown = open ? ordered : ordered.slice(0, LATEST);
  const hidden = ordered.length - LATEST;

  return (
    <section>
      {/* header — the eyebrow, with an icon-only ↗ pinned right that opens the full story */}
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Story</span>
        <button
          type="button"
          onClick={() => setOverlay(true)}
          aria-label="Open the full story"
          title="Open the full story"
          className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground/70 transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
        >
          <ArrowUpRight className="size-3.5" />
        </button>
      </div>

      <ol>
        {shown.map((ep, i) => (
          <EpisodeRow
            key={ep.id}
            episode={ep}
            first={i === 0}
            last={i === shown.length - 1}
            onSelect={onEpisodeSelect}
          />
        ))}
      </ol>

      {/* fold — a horizontal fold line + a rotating chevron reveals the older episodes below */}
      {hidden > 0 ? (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex w-full items-center gap-2 pt-0.5 text-muted-foreground transition-colors hover:text-foreground"
        >
          <span className="h-px flex-1 bg-border" />
          <span className="text-[11px] font-medium">{open ? "Fewer" : `${hidden} earlier`}</span>
          <ChevronRight className={cn("size-3.5 transition-transform", open ? "-rotate-90" : "rotate-90")} />
        </button>
      ) : null}

      <StoryOverlay
        artifactId={artifactId}
        title={title}
        open={overlay}
        onOpenChange={setOverlay}
        onEpisodeSelect={onEpisodeSelect}
      />
    </section>
  );
}
