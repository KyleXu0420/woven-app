"use client";

// StoryStrip — the artifact's EPISODIC memory beside the semantic graph: who did what here, and when. Rows are
// followable (→ their block / the version diff / the graph); "All N" opens every event.
//
// Each event is TWO lines: what happened, in full ink, then the kind, who and when, muted. It was one line per
// event — avatar, a kind chip, the summary, the time — in the rail's 196px column (w-56 less its padding, measured
// at 1440), and after the avatar (20), the chip (50–70), the time (24) and three gaps the summary kept ~70px:
// "v3 replace…", "Dropped S…", "Production …", every row cut mid-word. Showing fewer items alone would have left
// that one-line row as it was and so still cut at ~10 characters; only a second line gives the words the column.
// With the summary on a line of its own it has all 196px (~28 characters at 13px): four of the five summaries fit
// on one line, and the longest wraps rather than truncates (a fact that exists only here wraps; truncation is for
// a title one click from its fuller form). Two lines an event is also why the rail shows three of them (PREVIEW).
// The avatar went with the move: five identical "MC" dishes down one rail said the actor five times, and the name
// on the second line says it once per row in words. The kind word lost its chip (a hand-written foreground alpha
// fill) and keeps its one accent: an event that changed what the graph trusts is inked forest, every other kind
// stays muted — a confirm is the moment something entered the graph.

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { SectionAction } from "./today-ui";
import { undot } from "./inbox-agent-band";
import { artifactEpisodes, getBlocks, personById } from "@/lib/api";
import { notify } from "@/lib/notifications";
import { useGraphVersion } from "@/lib/use-graph-version";
import type { Block, Episode, EpisodeKind } from "@/lib/types";

// Three in the rail, the rest behind "All N". Five two-line events made the Story 335px, and with the "Woven into"
// band above it the section started at 900 in a 900px window: the newest event, the one a returning reader looks
// for, was under the fold. Three is the newest three, which on a_notif is the last day's work (17m, 17m, 5h);
// "All 14" says how much more there is.
const PREVIEW = 3;

// the kind word — categorizes the event in sentence case. Trust-changing events carry the accent;
// capture/proposal/discussion/version mechanics stay muted.
const LABEL: Record<EpisodeKind, { text: string; cls: string }> = {
  captured: { text: "Captured", cls: "text-muted-foreground" },
  proposed: { text: "Proposed", cls: "text-muted-foreground" },
  confirmed: { text: "Confirmed", cls: "text-primary" },
  approved: { text: "Approved", cls: "text-primary" },
  activated: { text: "In effect", cls: "text-primary" },
  revalidated: { text: "Revalidated", cls: "text-primary" },
  commented: { text: "Comment", cls: "text-muted-foreground" },
  resolved: { text: "Resolved", cls: "text-muted-foreground" },
  edited: { text: "Edit", cls: "text-muted-foreground" },
  superseded: { text: "New version", cls: "text-muted-foreground" },
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

// "17m" is the prototype's relative label; on a line of words it reads as an age ("17m ago")
function ago(at: string): string {
  return /^\d/.test(at) ? `${at} ago` : at === "now" ? "just now" : at;
}

// A real value inside a summary — a config key and its value ("max_push_per_day = 2"), a commit or content hash —
// is set as what it is: a mono chip (mono is for real code and values), copyable with one click. A hash shows its
// first 7 characters, the full value in the tooltip and on the clipboard: a 40- or 64-character run set as body
// text was the verdict's "hash as body text". Everything else in the summary stays words.
const VALUE_RE = /\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+(?:\s*=\s*[^\s.,;]+)?|\b[0-9a-f]{12,64}\b/g;

function ValueChip({ value }: { value: string }) {
  const hash = /^[0-9a-f]{12,64}$/.test(value);
  const shown = hash ? value.slice(0, 7) : value;
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              void navigator.clipboard?.writeText(value).then(
                () => notify.success("Copied", { description: shown }),
                () => undefined,
              );
            }}
            aria-label={`Copy ${value}`}
            className="pointer-events-auto relative z-10 inline rounded-sm bg-tint-1 px-1 font-mono text-xs whitespace-nowrap text-foreground outline-none transition-colors hover:bg-tint-2 focus-visible:ring-2 focus-visible:ring-focus"
          />
        }
      >
        {shown}
      </TooltipTrigger>
      <TooltipContent side="top">{hash ? `Copy ${value}` : "Copy"}</TooltipContent>
    </Tooltip>
  );
}

function withValues(summary: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const m of summary.matchAll(VALUE_RE)) {
    const at = m.index ?? 0;
    if (at > last) parts.push(summary.slice(last, at));
    parts.push(<ValueChip key={at} value={m[0]} />);
    last = at + m[0].length;
  }
  if (last === 0) return summary;
  if (last < summary.length) parts.push(summary.slice(last));
  return parts;
}

function EpisodeRow({
  episode,
  target,
  onSelect,
  flash,
}: {
  episode: Episode;
  target: string;
  onSelect?: (e: Episode) => void;
  // when a confirm (or any new event) just landed, the row slides in with an accent tint that settles —
  // the remembered gesture made felt in the timeline, echoing the ledger stamp on the graph edge.
  flash?: boolean;
}) {
  const label = LABEL[episode.kind];
  const summary = undot(episode.summary);
  // The whole row follows the episode, but a value chip inside it copies, and a button inside a button is not
  // valid: the follow control is a button stretched over the row (absolute inset-0) under the text, the text lets
  // the pointer through to it, and the chip alone takes the pointer back.
  return (
    // the rail's one row model, the same as the band's rows and the suggestions above: the li is the HIT box (the
    // follow button covers it, rows abut, the focus ring draws on it) and bleeds 6px into the gutter; the div is
    // the PAINT box, 2px short of it top and bottom, so a lit event is parted from the next by 4px of ground.
    // 42 an event as before (2 + 2, two lines of 18 and 16, 2 + 2), fill 38; the second line sits straight under
    // the first, as two lines of two inks already part one event from the next.
    <li className="group/ep relative -mx-1.5 py-0.5">
      {onSelect ? (
        <button
          type="button"
          onClick={() => onSelect(episode)}
          title={`Go to ${target}`}
          aria-label={`${summary} Go to ${target}.`}
          className="absolute inset-0 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-focus"
        />
      ) : null}
      <div
        className={cn(
          "pointer-events-none rounded-md px-1.5 py-0.5 transition-colors",
          onSelect && "group-hover/ep:bg-tint-1 group-has-[>button:active]/ep:bg-tint-2",
          flash && "episode-flash",
        )}
      >
        <p className="pointer-events-none relative text-sm text-pretty text-foreground">{withValues(summary)}</p>
        <p className="pointer-events-none relative text-xs text-muted-foreground">
          <span className={cn("font-medium", label.cls)}>{label.text}</span>, {actorName(episode)},{" "}
          <span className="tabular-nums">{ago(episode.at)}</span>
        </p>
      </div>
    </li>
  );
}

// the full story, given room — a dialog listing every episode (each followable), opened by "All N".
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
          {/* "Story · <title>" ran the doc's name off a middle dot; the description's em-dash list is a colon */}
          <DialogTitle>How {title} came to be</DialogTitle>
          <DialogDescription>
            Every event, newest first: captured, proposed, confirmed, discussed and revised. Follow one to where it
            happened.
          </DialogDescription>
        </DialogHeader>
        <ol className="scrollbar-subtle -mx-1 flex max-h-[60vh] flex-col overflow-y-auto px-3">
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
  const gv = useGraphVersion();

  // an episode that ARRIVES this session (a confirm just happened) lands with an animation; the history present
  // on mount does not. We read the mount baseline PURELY during render (StrictMode-safe, no post-commit flicker
  // — the new row mounts already animating) and absorb arrivals in an effect so each one flashes exactly once.
  const seen = React.useRef<{ id: string; ids: Set<string> } | null>(null);
  const episodes = artifactEpisodes(artifactId);
  const baseline = seen.current && seen.current.id === artifactId ? seen.current.ids : null;
  const flashId = baseline
    ? (episodes.map((e) => e.id).filter((id) => !baseline.has(id)).slice(-1)[0] ?? null)
    : null;
  React.useEffect(() => {
    const ids = artifactEpisodes(artifactId).map((e) => e.id);
    if (!seen.current || seen.current.id !== artifactId) {
      seen.current = { id: artifactId, ids: new Set(ids) }; // (re)baseline on mount / artifact switch
    } else {
      for (const id of ids) seen.current.ids.add(id); // absorb the arrival so its flash is one-shot
    }
  }, [gv, artifactId]);

  if (episodes.length === 0) return null;
  const blocks = getBlocks(artifactId);
  const preview = [...episodes].reverse().slice(0, PREVIEW); // chronological → newest-first

  return (
    <section>
      {/* the sub-label, and the way to every event as WORDS with their count: "All 15" where an icon-only ↗ hid
          "Open the full story · 15 events" in a tooltip. Only offered when the preview is not already all of it.
          The action hangs 4px into the air above and below the label (-my-1): its 26px box on the 16px label line
          made this head 26 tall, the one rail head that grew for its action. The label is a zone head of the rail
          (with Suggestions and Collections): 13/500 in full ink, on the 18px line the hung action already made. */}
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-foreground">Story</span>
        {episodes.length > PREVIEW ? (
          <span className="-my-1 flex">
            <SectionAction onClick={() => setOverlay(true)}>
              All <span className="tabular-nums">{episodes.length}</span>
            </SectionAction>
          </span>
        ) : null}
      </div>

      <ol className="flex flex-col">
        {preview.map((ep) => (
          <EpisodeRow
            key={ep.id}
            episode={ep}
            target={targetLabel(ep, blocks)}
            onSelect={onEpisodeSelect}
            flash={ep.id === flashId}
          />
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
