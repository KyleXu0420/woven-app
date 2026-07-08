"use client";

import { useEffect } from "react";
import { hydrateState } from "@/lib/api";
import { bumpGraph } from "@/lib/store";

// Re-applies persisted collection/publish state (localStorage) after mount, then nudges a re-render so
// the sidebar, collection pages, etc. reflect it. Kept as a mount-effect (not module init) so SSR and the
// first client paint both show the seed — no hydration mismatch; persisted state fills in a tick later.
export function StoreHydrator() {
  useEffect(() => {
    hydrateState();
    bumpGraph();
  }, []);
  return null;
}
