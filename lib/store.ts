// A tiny global "the in-memory graph changed" signal. In this prototype the data lives in mutable
// modules (lib/data.ts); mutating it doesn't re-render React. Anything that mutates calls bumpGraph();
// client surfaces subscribe via useGraphVersion() (lib/use-graph-version). This module stays plain — no
// React import — so lib/api.ts (which server components import) can call bumpGraph() without dragging a
// client-only hook into the server graph. Real backend → this becomes query-cache invalidation.
let version = 0;
const listeners = new Set<() => void>();

export function bumpGraph(): void {
  version += 1;
  for (const l of listeners) l();
}

export function subscribeGraph(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function getGraphVersion(): number {
  return version;
}
