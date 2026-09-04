"use client";

import { inboxBadgeCount, listRuns, needsYou, runCounts, viewerRecents, VIEWER } from "@/lib/api";
import { pickHeroId } from "@/lib/home";
import type { AgentRun, NeedItem, RunStatus } from "@/lib/types";

export type HomeFacts = { badge: number; runs: AgentRun[]; runCounts: Record<RunStatus, number>; needs: NeedItem[]; heroId: string };

// The islands read the same facts. Each used to run the decision + pending pipelines itself, on every render
// (three badge pipelines and two recents walks per page render). One snapshot per graph version instead:
// pass the version useGraphVersion() returns, get the same object back until something bumps the graph.
let cache: { v: number; facts: HomeFacts } | null = null;
export function homeFacts(version: number): HomeFacts {
  if (cache?.v !== version) {
    cache = {
      v: version,
      facts: { badge: inboxBadgeCount(), runs: listRuns(), runCounts: runCounts(), needs: needsYou(), heroId: pickHeroId(viewerRecents(VIEWER, 6)) },
    };
  }
  return cache.facts;
}
