"use client";

// CatchUp — the Inbox "since you were away" recap: an agent-narrated, cross-space digest of what your
// teammates + the agent moved while you were out (recentEpisodes excludes your own actions), each a
// followable row that jumps to the artifact. The episodic complement to the Verify queue below it —
// where Verify asks "what needs a decision", this answers "what happened". Same compact label-led grammar
// as the reader's StoryStrip. Dismissible.

import * as React from "react";
import { X } from "lucide-react";
import { AgentAvatar, PersonAvatar } from "@/components/identity";
import { Section, Row, RowList } from "@/components/today-ui";
import { getArtifact, personById, recentEpisodes } from "@/lib/api";
import { useGraphVersion } from "@/lib/use-graph-version";
import type { EpisodeKind } from "@/lib/types";

const LABEL: Record<EpisodeKind, { text: string; cls: string }> = {
  captured: { text: "Capture", cls: "text-muted-foreground" },
  proposed: { text: "Proposed", cls: "text-muted-foreground" },
  confirmed: { text: "Confirmed", cls: "text-primary" },
  commented: { text: "Comment", cls: "text-muted-foreground" },
  resolved: { text: "Resolved", cls: "text-muted-foreground" },
  edited: { text: "Edit", cls: "text-muted-foreground" },
  superseded: { text: "Version", cls: "text-muted-foreground" },
};

export function CatchUp() {
  useGraphVersion();
  const [dismissed, setDismissed] = React.useState(false);
  const eps = recentEpisodes(6);
  if (dismissed || eps.length === 0) return null;

  return (
    <Section
      label="Since you were away"
      action={
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
          aria-label="Mark caught up"
          title="Caught up"
        >
          <X className="size-3.5" />
        </button>
      }
    >
      <RowList>
        {eps.map((ep) => {
          const art = getArtifact(ep.artifactId);
          const isAgent = ep.actor === "agent";
          const name = isAgent ? "Woven" : personById(ep.actor)?.name ?? ep.actor;
          const label = LABEL[ep.kind];
          return (
            <Row
              key={ep.id}
              href={`/artifact/${ep.artifactId}`}
              marker={isAgent ? <AgentAvatar size="xs" /> : <PersonAvatar seed={ep.actor} name={name} size="xs" />}
              trailing={<span className="text-[11px] tabular-nums text-muted-foreground">{ep.at}</span>}
            >
              <span className="flex min-w-0 items-center gap-2 text-[13px]">
                <span
                  className={`shrink-0 rounded-[4px] bg-foreground/[0.06] px-1.5 py-0.5 text-[10px] font-medium leading-none ${label.cls}`}
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
        })}
      </RowList>
    </Section>
  );
}
