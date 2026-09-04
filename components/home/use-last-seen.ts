"use client";

import * as React from "react";

// "Since you were away" needs an away. Nothing in the data knows when the viewer was last here, so the page
// remembers it itself: a stamp in localStorage, read on mount and then overwritten. First visit → no window
// (the digest covers the last 24 hours and says so). The label is the zone's byline, in the agent's mono voice.
const KEY = "woven:lastSeenAt";

export function useLastSeen(): { since: Date | null; minutes: number; label: string } {
  const [since, setSince] = React.useState<Date | null>(null);
  const [ready, setReady] = React.useState(false);
  React.useEffect(() => {
    let prev: Date | null = null;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const d = new Date(raw);
        if (!Number.isNaN(d.getTime())) prev = d;
      }
      localStorage.setItem(KEY, new Date().toISOString());
    } catch {
      // private mode or blocked storage: behave as a first visit
    }
    setSince(prev);
    setReady(true);
  }, []);
  const minutes = since ? Math.max(1, Math.round((Date.now() - since.getTime()) / 60000)) : 24 * 60;
  return { since, minutes, label: ready ? labelFor(since) : "" };
}

function labelFor(since: Date | null): string {
  if (!since) return "the last 24 hours";
  const now = new Date();
  const days = Math.floor((now.getTime() - since.getTime()) / 86400000);
  const time = since.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
  if (days === 0) return `since ${time} today`;
  if (days === 1) return `since ${time} yesterday`;
  const date = since.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
  return `since ${date}, ${days} days away`;
}
