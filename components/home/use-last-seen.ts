"use client";

import * as React from "react";
import { readLastSeen, windowLabel, windowMinutes } from "@/lib/last-seen";

// The away window, read once per mount and held: a stable value the islands can memo on. Nothing is written
// here — the shell stamps the visit when the viewer leaves (components/seen-stamp.tsx).
export function useLastSeenWindow(): { minutes: number; label?: string } {
  const [win, setWin] = React.useState<{ minutes: number; label: string } | null>(null);
  React.useEffect(() => {
    const since = readLastSeen();
    setWin({ minutes: windowMinutes(since), label: windowLabel(since) });
  }, []);
  return win ?? { minutes: 24 * 60, label: undefined };
}
