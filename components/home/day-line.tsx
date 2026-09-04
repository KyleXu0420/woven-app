"use client";

import { TodayDate } from "@/components/today-date";
import { inboxBadgeCount, runCounts } from "@/lib/api";
import { useGraphVersion } from "@/lib/use-graph-version";

// The day, then the fastest read on the page: what the agent has going and how much waits on you. Both numbers
// come from the selectors the sidebar badge and the Needs-you count use, so the three can never disagree.
// A client island: the numbers move when the user acts (approve in the Inbox, come back — the sentence follows).
export function DayLine() {
  useGraphVersion();
  const running = runCounts().running;
  const waiting = inboxBadgeCount();
  const parts: string[] = [];
  if (running) parts.push(`${running} run${running === 1 ? "" : "s"} going`);
  parts.push(waiting ? `${waiting} waiting on you` : "nothing waiting on you");
  return <TodayDate after={parts.join(", ")} />;
}
