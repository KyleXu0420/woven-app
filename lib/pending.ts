import { effectiveOwner, listOpenSuggestions, listPending } from "@/lib/api";

// a pending change waiting on some colleague's call — flattened from the agent's proposed edges + colleague
// suggestions, routed through effectiveOwner so a claimed one moves off its owner and onto you.
export type Pending = { id: string; subjectId: string; line: string; ownerId: string };

// every pending change, routed to whoever owns it right now (claims respected), grouped by that owner.
// Shared by the Activity tab (per-person groups) and the home's digest ("4 are waiting on Jordan").
export function pendingByOwner(): Map<string, Pending[]> {
  const all: Pending[] = [
    ...listPending().map((p) => ({
      id: p.edge_id,
      subjectId: p.fromId,
      line: `${p.fromLabel} → ${p.toLabel}`,
      ownerId: effectiveOwner(p.edge_id, p.fromId),
    })),
    ...listOpenSuggestions().map((s) => ({
      id: s.id,
      subjectId: s.artifactId,
      line: `Edit on ${s.artifactTitle} § ${s.blockHeading}`,
      ownerId: effectiveOwner(s.id, s.artifactId),
    })),
  ];
  const map = new Map<string, Pending[]>();
  for (const p of all) {
    const arr = map.get(p.ownerId) ?? [];
    arr.push(p);
    map.set(p.ownerId, arr);
  }
  return map;
}
