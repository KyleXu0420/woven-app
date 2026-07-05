"use client";

import { useSyncExternalStore } from "react";
import { subscribeGraph, getGraphVersion } from "./store";

// Subscribe a client component to the in-memory graph signal — it re-renders on any bumpGraph()
// (Inbox verify/dismiss, add-to-collection, publish…). Lives in its own "use client" module so the
// underlying store stays server-safe. See lib/store.ts.
export function useGraphVersion(): number {
  return useSyncExternalStore(subscribeGraph, getGraphVersion, getGraphVersion);
}
