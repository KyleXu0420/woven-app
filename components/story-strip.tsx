"use client";

// StoryStrip — the artifact's EPISODIC memory beside the semantic graph. A COMPACT, label-led log: each
// episode leads with a small kind LABEL that categorizes it (Confirmed / Comment / Version / Edit …), then
// a terse one-line note, then the time. Dense and calm — no avatars, spine, hover-hints, or "N earlier"
// footer. Only the two load-bearing kinds carry an accent (a confirm enters the graph; a version supersedes).
// Rows are followable (→ their block / the version diff / the graph); the ↗ opens the full story.

import * as React from "react";
import { ArrowUpRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { artifactEpisodes, getBlocks } from "@/lib/api";
import { useGraphVersion } from "@/lib/use-graph-version";
import type { Block, Episode, EpisodeKind } from "@/lib/types";

const PREVIEW = 5;

// the kind LABEL — the categorizer. Confirmed (entered the graph) + Version (superseded) carry an accent;
// the rest stay muted so the list reads calm and the eye lands on what changed the graph.
const LABEL: Record<EpisodeKind, { text: string; cls: string }> = {
  captured: { text: "Capture", cls: "text-muted-foreground" },
  proposed: { text: "Proposed", cls: "text-muted-foreground" },
  confirmed: { text: "Confirmed", cls: "text-primary" },
  commented: { text: "Comment", cls: "text-muted-foreground" },
  resolved: { text: "Resolved", cls: "text-muted-foreground" },
  edited: { text: "Edit", cls: "text-muted-foreground" },
  superseded: { text: "Version", cls: "text-[color:var(--chart-2)]" },
};

// where following an episode lands — kept in the row's tooltip so the jump is predictable.
function targetLabel(ep: Episode, blocks: Block[]): string {
  if (ep.blockId) return blocks.find((b) => b.id === ep.blockId)?.heading ?? "the section";
  if (ep.kind === "superseded" || ep.kind === "edited") return "Version history";
  return "the graph";
}

function EpisodeRow({ episode, target, onSelect }: { episode: Episode; target: string; onSelect?: (e: Episode) => void }) {
  const label = LABEL[episode.kind];
  const body = (
    <>
      <span className={`w-16 shrink-0 text-[10px] font-semibold uppercase tracking-wide ${label.cls}`}>
        {label.text}
      </span>
      <span className="min-w-0 flex-1 truncate text-[13px] leading-snug text-foreground/85" title={episode.summary}>
        {episode.summary}
      </span>
      <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{episode.at}</span>
    </>
  );
  if (!onSelect) return <li className="flex items-baseline gap-2 py-1">{body}</li>;
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(episode)}
        title={`Go to ${target}`}
        className="-mx-2 flex w-full items-baseline gap-2 rounded-md px-2 py-1 text-left transition-colors hover:bg-foreground/[0.04]"
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
      {/* header — the eyebrow + an icon-only ↗ pinned right that opens the full story */}
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Story</span>
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
