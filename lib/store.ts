import { useSyncExternalStore } from "react";

// A tiny global "the in-memory graph changed" signal. In this prototype the data lives in mutable
// modules (lib/data.ts); mutating it doesn't re-render React. Anything that mutates calls bumpGraph();
// any surface that reads derived state (the sidebar Inbox badge, membership, counts) subscribes via
// useGraphVersion() and re-renders on change. Real backend → this becomes a query cache invalidation.
let version = 0;
const listeners = new Set<() => void>();

export function bumpGraph(): void {
  version += 1;
  for (const l of listeners) l();
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function useGraphVersion(): number {
  return useSyncExternalStore(
    subscribe,
    () => version,
    () => version,
  );
}
