"use client";

// CatchUp — the Inbox "since you were away" recap: an agent-narrated, cross-space digest of what your
// teammates + the agent moved while you were out (recentEpisodes excludes your own actions), each a
// followable row that jumps to the artifact. The episodic complement to the Verify queue below it —
// where Verify asks "what needs a decision", this answers "what happened". Same compact label-led grammar
// as the reader's StoryStrip. Dismissible.

import * as React from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { AgentAvatar, PersonAvatar } from "@/components/identity";
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

  const docs = new Set(eps.map((e) => e.artifactId)).size;

  return (
    <section className="mb-6 overflow-hidden rounded-xl border bg-card">
      <div className="flex items-center gap-2.5 border-b px-4 py-3">
        <AgentAvatar size="sm" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Since you were away</p>
          <p className="text-[12px] text-muted-foreground">
            {eps.length} update{eps.length === 1 ? "" : "s"} across {docs} artifact{docs === 1 ? "" : "s"} — from
            your team and the agent.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
          aria-label="Mark caught up"
          title="Caught up"
        >
          <X className="size-4" />
        </button>
      </div>

      <ul className="flex flex-col">
        {eps.map((ep, i) => {
          const art = getArtifact(ep.artifactId);
          const isAgent = ep.actor === "agent";
          const name = isAgent ? "Woven" : personById(ep.actor)?.name ?? ep.actor;
          const label = LABEL[ep.kind];
          return (
            <li key={ep.id} className={i > 0 ? "border-t" : ""}>
              <Link
                href={`/artifact/${ep.artifactId}`}
                className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-foreground/[0.025]"
              >
                {isAgent ? <AgentAvatar size="xs" /> : <PersonAvatar seed={ep.actor} name={name} size="xs" />}
                <span
                  className={`shrink-0 rounded-[4px] bg-foreground/[0.06] px-1.5 py-0.5 text-[10px] font-medium leading-none ${label.cls}`}
                >
                  {label.text}
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px]">
                  <span className="font-medium">{art?.title ?? "an artifact"}</span>
                  <span className="text-muted-foreground"> · {ep.summary}</span>
                </span>
                <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{ep.at}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
