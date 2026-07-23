"use client";

// CatchUp — the Today "since you were away" DIGEST: two narrated lines, one per actor (what Woven did on its
// own; what the team moved), excluding your own actions. It is deliberately NOT a feed — Today hands off, and
// the Inbox's Activity tense owns the full stream (All activity →). (EpisodeRow + EPISODE_LABEL stay exported;
// the reader's StoryStrip and the ⌘K zero-state share that row grammar.)

import { AgentAvatar, PersonAvatar } from "@/components/identity";
import { Section, Row, RowList, SectionAction } from "@/components/today-ui";
import { awayDigest, getArtifact, personById } from "@/lib/api";
import { useGraphVersion } from "@/lib/use-graph-version";
import type { Episode, EpisodeKind } from "@/lib/types";

// the episode-kind chip (text + accent) — shared with the ⌘K zero-state "While you were away" rows
export const EPISODE_LABEL: Record<EpisodeKind, { text: string; cls: string }> = {
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
  const label = EPISODE_LABEL[ep.kind];
  return (
    <Row
      href={`/artifact/${ep.artifactId}`}
      marker={isAgent ? <AgentAvatar size="sm" /> : <PersonAvatar seed={ep.actor} name={name} size="sm" />}
      trailing={<span className="text-[12.5px] tabular-nums text-muted-foreground">{ep.at}</span>}
    >
      <span className="flex min-w-0 items-center gap-2 text-[15px]">
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

// the digest's two sentences. Adaptive — a part only appears when its count is real.
function agentLine(a: { proposed: number; captured: number }) {
  const parts: string[] = [];
  if (a.captured) parts.push(`wove ${a.captured} drop${a.captured === 1 ? "" : "s"} into your space`);
  if (a.proposed) parts.push(`proposed ${a.proposed} link${a.proposed === 1 ? "" : "s"}`);
  return parts.join(" and ");
}
function teamLine(t: { changes: number; docs: number; names: string[] }) {
  const n = t.names.length;
  const who =
    n === 0
      ? "Your team"
      : n === 1
        ? t.names[0]
        : n === 2
          ? `${t.names[0]} and ${t.names[1]}`
          : `${t.names[0]}, ${t.names[1]} and ${n - 2} other${n - 2 === 1 ? "" : "s"}`;
  return `${who} made ${t.changes} change${t.changes === 1 ? "" : "s"} across ${t.docs} doc${t.docs === 1 ? "" : "s"}`;
}

// Orient = a DIGEST, not a feed. Today hands off; the Inbox's Activity tense owns the full stream. Two actors
// get one line each — what Woven did on its own (the thing only this product can say), and what the team moved.
export function CatchUp() {
  useGraphVersion();
  const d = awayDigest();
  if (!d.agent.total && !d.team.changes) return null;
  const agent = agentLine(d.agent);

  return (
    <Section label="Since you were away" action={<SectionAction href="/inbox?tab=activity">All activity</SectionAction>}>
      <RowList>
        {agent ? (
          <Row href="/inbox?tab=activity" marker={<AgentAvatar size="sm" />}>
            <span className="block truncate text-[15px]">
              <span className="font-medium">Woven</span>
              <span className="text-muted-foreground"> {agent}</span>
            </span>
          </Row>
        ) : null}
        {d.team.changes ? (
          <Row
            href="/inbox?tab=activity"
            marker={<PersonAvatar seed={d.team.names[0] ?? "team"} name={d.team.names[0] ?? "Team"} size="sm" />}
          >
            <span className="block truncate text-[15px] text-muted-foreground">{teamLine(d.team)}</span>
          </Row>
        ) : null}
      </RowList>
    </Section>
  );
}
