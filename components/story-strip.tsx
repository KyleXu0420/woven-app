"use client";

// StoryStrip — the artifact's EPISODIC memory beside the semantic graph: "what happened to it, when, who
// moved it, and why". Two surfaces, two clear jobs:
//   • the RAIL strip = a readable PREVIEW — the latest few episodes, each a followable row (click → go to
//     where it happened: its block / the version diff / the graph). One entry, the ↗, opens the full story.
//   • the OVERLAY = the whole timeline, given room to read.
// No cryptic status dot (the narrated line says the kind), no inline fold competing with the ↗.

import * as React from "react";
import { ArrowUpRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AgentAvatar, PersonAvatar } from "@/components/identity";
import { artifactEpisodes, getBlocks, personById } from "@/lib/api";
import { useGraphVersion } from "@/lib/use-graph-version";
import type { Block, Episode } from "@/lib/types";

// how many of the newest episodes the rail previews before the ↗ takes you to the rest
const PREVIEW = 3;

// where following an episode lands — surfaced on the row so the click is predictable, not a mystery jump.
function targetLabel(ep: Episode, blocks: Block[]): string {
  if (ep.blockId) return blocks.find((b) => b.id === ep.blockId)?.heading ?? "the section";
  if (ep.kind === "superseded" || ep.kind === "edited") return "Version history";
  return "the graph";
}

// one episode — the actor's avatar on the timeline spine, the agent-narrated line (readable, up to two
// lines), the time, and — when followable — a "→ {where}" that fades in on hover so you know where it goes.
function EpisodeRow({
  episode,
  target,
  first,
  last,
  onSelect,
}: {
  episode: Episode;
  target: string;
  first: boolean;
  last: boolean;
  onSelect?: (e: Episode) => void;
}) {
  const isAgent = episode.actor === "agent";
  const name = isAgent ? "Woven" : personById(episode.actor)?.name ?? episode.actor;
  const body = (
    <>
      {/* gutter — the avatar on a split spine (upper half skipped on the first row, lower on the last) */}
      <div className="relative flex w-5 shrink-0 justify-center">
        {!first ? <span className="absolute left-1/2 top-0 h-3 w-px -translate-x-1/2 bg-border" /> : null}
        {!last ? <span className="absolute bottom-0 left-1/2 top-3 w-px -translate-x-1/2 bg-border" /> : null}
        <span className="relative z-10 mt-0.5 inline-flex">
          {isAgent ? <AgentAvatar size="xs" /> : <PersonAvatar seed={episode.actor} name={name} size="xs" />}
        </span>
      </div>
      <div className="min-w-0 flex-1 pb-4">
        <div className="flex items-start gap-2">
          <p className="min-w-0 flex-1 text-[13px] leading-snug text-foreground/90 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden">
            {episode.summary}
          </p>
          <span className="shrink-0 pt-px text-[11px] tabular-nums text-muted-foreground">{episode.at}</span>
        </div>
        {onSelect ? (
          <span className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground/70 opacity-0 transition-opacity group-hover/ep:opacity-100">
            <ArrowUpRight className="size-3" /> {target}
          </span>
        ) : null}
      </div>
    </>
  );
  if (!onSelect) return <li className="flex gap-3">{body}</li>;
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(episode)}
        title={`Go to ${target}`}
        className="group/ep -mx-2 flex w-full gap-3 rounded-lg px-2 pt-1 text-left transition-colors hover:bg-foreground/[0.04]"
      >
        {body}
      </button>
    </li>
  );
}

// the full story, given room — a dialog listing every episode (each followable), opened by the ↗.
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
  const blocks = getBlocks(artifactId);
  const ordered = [...artifactEpisodes(artifactId)].reverse();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Story · {title}</DialogTitle>
          <DialogDescription>
            How this artifact came to be — captured, proposed, confirmed, discussed, and revised. Follow a row
            to where it happened.
          </DialogDescription>
        </DialogHeader>
        <ol className="scrollbar-subtle -mx-1 max-h-[62vh] overflow-y-auto px-1">
          {ordered.map((ep, i) => (
            <EpisodeRow
              key={ep.id}
              episode={ep}
              target={targetLabel(ep, blocks)}
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
  const [overlay, setOverlay] = React.useState(false);
  // re-render when a new episode is recorded (e.g. after a Verify confirm writes a "confirmed" episode)
  useGraphVersion();

  const episodes = artifactEpisodes(artifactId);
  if (episodes.length === 0) return null;
  const blocks = getBlocks(artifactId);
  const ordered = [...episodes].reverse(); // artifactEpisodes is chronological → newest-first feed
  const preview = ordered.slice(0, PREVIEW);
  const rest = ordered.length - preview.length;

  return (
    <section>
      {/* header — the eyebrow + an icon-only ↗ pinned right that opens the full story */}
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Story</span>
        <button
          type="button"
          onClick={() => setOverlay(true)}
          aria-label="Open the full story"
          title={`Open the full story · ${ordered.length} events`}
          className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground/70 transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
        >
          <ArrowUpRight className="size-3.5" />
        </button>
      </div>

      {/* preview — the latest few, readable + followable */}
      <ol>
        {preview.map((ep, i) => (
          <EpisodeRow
            key={ep.id}
            episode={ep}
            target={targetLabel(ep, blocks)}
            first={i === 0}
            last={i === preview.length - 1}
            onSelect={onEpisodeSelect}
          />
        ))}
      </ol>

      {/* the rest live in the full story — one quiet way there (agrees with the ↗, no competing inline fold) */}
      {rest > 0 ? (
        <button
          type="button"
          onClick={() => setOverlay(true)}
          className="mt-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          {rest} earlier — view the full story
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
