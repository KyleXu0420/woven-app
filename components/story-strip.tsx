"use client";

// StoryStrip — the artifact's EPISODIC memory beside the semantic graph. Linear's activity-feed grammar in a
// rail: each row leads with WHO (an avatar — so collaboration reads at a glance), then a tiny sentence-case
// type word that categorizes the event (Confirmed / Comment / Version …), a terse note, and the time. One
// accent only — a confirm is the moment something entered the graph, so it alone is inked; every other kind
// stays monochrome and calm. Rows are followable (→ their block / the version diff / the graph); ↗ opens all.

import * as React from "react";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AgentAvatar, PersonAvatar } from "./identity";
import { artifactEpisodes, getBlocks, personById } from "@/lib/api";
import { useGraphVersion } from "@/lib/use-graph-version";
import type { Block, Episode, EpisodeKind } from "@/lib/types";

const PREVIEW = 5;

// the tiny type word — categorizes the event in sentence case. Only a confirm carries the accent (it is the
// moment something entered the graph); every other kind stays muted, so the eye lands on what became fact.
const LABEL: Record<EpisodeKind, { text: string; cls: string }> = {
  captured: { text: "Captured", cls: "text-muted-foreground" },
  proposed: { text: "Proposed", cls: "text-muted-foreground" },
  confirmed: { text: "Confirmed", cls: "text-primary" },
  commented: { text: "Comment", cls: "text-muted-foreground" },
  resolved: { text: "Resolved", cls: "text-muted-foreground" },
  edited: { text: "Edit", cls: "text-muted-foreground" },
  superseded: { text: "Version", cls: "text-muted-foreground" },
};

// where following an episode lands — kept in the row's tooltip so the jump is predictable.
function targetLabel(ep: Episode, blocks: Block[]): string {
  if (ep.blockId) return blocks.find((b) => b.id === ep.blockId)?.heading ?? "the section";
  if (ep.kind === "superseded" || ep.kind === "edited") return "Version history";
  return "the graph";
}

function actorName(ep: Episode): string {
  return ep.actor === "agent" ? "Woven" : personById(ep.actor)?.name ?? ep.actor;
}

function EpisodeRow({
  episode,
  target,
  onSelect,
}: {
  episode: Episode;
  target: string;
  onSelect?: (e: Episode) => void;
}) {
  const label = LABEL[episode.kind];
  const isAgent = episode.actor === "agent";
  const body = (
    <>
      <span className="shrink-0">
        {isAgent ? (
          <AgentAvatar size="xs" />
        ) : (
          <PersonAvatar seed={episode.actor} name={actorName(episode)} size="xs" />
        )}
      </span>
      <span className="flex min-w-0 flex-1 items-center gap-2 leading-snug">
        <span
          className={cn(
            "shrink-0 rounded-[4px] bg-foreground/[0.06] px-1.5 py-0.5 text-[10px] font-medium leading-none",
            label.cls,
          )}
        >
          {label.text}
        </span>
        <span className="min-w-0 flex-1 truncate text-[13px] text-foreground/85" title={episode.summary}>
          {episode.summary}
        </span>
      </span>
      <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{episode.at}</span>
    </>
  );
  if (!onSelect) return <li className="flex items-center gap-1.5 py-1">{body}</li>;
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(episode)}
        title={`Go to ${target}`}
        className="-mx-2 flex w-[calc(100%_+_1rem)] items-center gap-1.5 rounded-md px-2 py-1 text-left transition-colors hover:bg-foreground/[0.04]"
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Story · {title}</DialogTitle>
          <DialogDescription>
            How this artifact came to be — captured, proposed, confirmed, discussed, and revised. Follow a row
            to where it happened.
          </DialogDescription>
        </DialogHeader>
        <ol className="scrollbar-subtle -mx-1 flex max-h-[60vh] flex-col overflow-y-auto px-1">
          {ordered.map((ep) => (
            <EpisodeRow
              key={ep.id}
              episode={ep}
              target={targetLabel(ep, blocks)}
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
  const preview = [...episodes].reverse().slice(0, PREVIEW); // chronological → newest-first

  return (
    <section>
      {/* sub-label — sentence case (Linear grammar) + an icon-only ↗ that opens the full story */}
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-[12px] font-medium text-muted-foreground">Story</span>
        <button
          type="button"
          onClick={() => setOverlay(true)}
          aria-label="Open the full story"
          title={`Open the full story · ${episodes.length} events`}
          className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground/70 transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
        >
          <ArrowUpRight className="size-3.5" />
        </button>
      </div>

      <ol className="flex flex-col">
        {preview.map((ep) => (
          <EpisodeRow key={ep.id} episode={ep} target={targetLabel(ep, blocks)} onSelect={onEpisodeSelect} />
        ))}
      </ol>

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
