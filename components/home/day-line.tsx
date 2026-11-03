"use client";

import { TodayDate } from "@/components/today-date";
import { homeFacts } from "@/components/home/home-facts";
import { plural } from "@/lib/text";
import { useGraphVersion } from "@/lib/use-graph-version";

// The day, then the fastest read on the page: what the agent has going and how much waits on you — from the
// snapshot the other islands and the sidebar badge share, so the three numbers cannot disagree.
export function DayLine() {
  const { runCounts, badge } = homeFacts(useGraphVersion());
  const parts: string[] = [];
  if (runCounts.running) parts.push(`${plural(runCounts.running, "run", "runs")} going`);
  parts.push(badge ? `${badge} waiting on you` : "nothing waiting on you");
  return <TodayDate after={parts.join(", ")} />;
}
