"use client";

// CatchUp — the Today "since you were away" recap: an agent-narrated, cross-space digest of what your
// teammates + the agent moved while you were out (recentEpisodes excludes your own actions), each a
// followable row that jumps to the artifact. A PREVIEW of the full Activity feed (All activity →) — where the
// Inbox asks "what needs a decision", this answers "what happened". Same compact label-led grammar as the
// reader's StoryStrip. (EpisodeRow is shared with the Activity page.)

import { AgentAvatar, PersonAvatar } from "@/components/identity";
import { Section, Row, RowList, SectionAction } from "@/components/today-ui";
import { getArtifact, personById, recentEpisodes } from "@/lib/api";
import { useGraphVersion } from "@/lib/use-graph-version";
import type { Episode, EpisodeKind } from "@/lib/types";

const LABEL: Record<EpisodeKind, { text: string; cls: string }> = {
  captured: { text: "Capture", cls: "text-muted-foreground" },
  proposed: { text: "Proposed", cls: "text-muted-foreground" },
  confirmed: { text: "Confirmed", cls: "text-primary" },
  commented: { text: "Comment", cls: "text-muted-foreground" },
  resolved: { text: "Resolved", cls: "text-muted-foreground" },
  edited: { text: "Edit", cls: "text-muted-foreground" },
  superseded: { text: "Version", cls: "text-muted-foreground" },
};

// one episode as a followable row — shared by the Today CatchUp preview and the full Activity page
export function EpisodeRow({ ep }: { ep: Episode }) {
  const art = getArtifact(ep.artifactId);
  const isAgent = ep.actor === "agent";
  const name = isAgent ? "Woven" : personById(ep.actor)?.name ?? ep.actor;
  const label = LABEL[ep.kind];
  return (
    <Row
      href={`/artifact/${ep.artifactId}`}
      marker={isAgent ? <AgentAvatar size="xs" /> : <PersonAvatar seed={ep.actor} name={name} size="xs" />}
      trailing={<span className="text-[12px] tabular-nums text-muted-foreground">{ep.at}</span>}
    >
      <span className="flex min-w-0 items-center gap-2 text-[14px]">
        <span
          className={`shrink-0 rounded-[4px] bg-foreground/[0.06] px-1.5 py-0.5 text-[11px] font-medium leading-none ${label.cls}`}
        >
          {label.text}
        </span>
        <span className="min-w-0 truncate">
          <span className="font-medium">{art?.title ?? "an artifact"}</span>
          <span className="text-muted-foreground"> · {ep.summary}</span>
        </span>
      </span>
    </Row>
  );
}

export function CatchUp() {
  useGraphVersion();
  const eps = recentEpisodes(6);
  if (eps.length === 0) return null;

  // no dismiss — "since you were away" is a standing preview of the full feed, not a card you clear away;
  // the header hands off to the Activity page for the rest (All activity →).
  return (
    <Section label="Since you were away" action={<SectionAction href="/activity">All activity</SectionAction>}>
      <RowList>
        {eps.map((ep) => (
          <EpisodeRow key={ep.id} ep={ep} />
        ))}
      </RowList>
    </Section>
  );
}
