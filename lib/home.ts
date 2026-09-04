// The home page's decisions as pure functions — no React, no store — the way components/orbit-layout.ts
// keeps the field's geometry pure: so the page's load-bearing promises (1 shown + N more = the sidebar's
// number; the printed rule is the sort; the hero doc's own staleness is never the nudge) run under
// node --test (tests/home.test.mjs) and cannot drift from what renders.
import type { AgentRun, NeedItem } from "@/lib/types";
import { lowerFirst, plural, upperFirst } from "./text.ts"; // relative, with the extension: node --test runs this file without the @/ alias

export type Need = NeedItem | { id: string; kind: "run"; title: string; sub: string; href: string; action: string };

// weight = urgency (lower first); one/many = the noun in the hand-off breakdown; rule = the clause in the
// printed sentence. One table, so a new kind is added in one place and the sentence cannot disagree with the sort.
export const KIND: Record<Need["kind"], { weight: number; one: string; many: string; rule: string }> = {
  revalidation: { weight: 0, one: "decision to re-check", many: "decisions to re-check", rule: "re-checks" },
  stale: { weight: 1, one: "stale doc", many: "stale docs", rule: "stale docs" },
  candidate: { weight: 2, one: "suggested edit", many: "suggested edits", rule: "people's edits" },
  approval: { weight: 2, one: "approval", many: "approvals", rule: "approvals" },
  activation: { weight: 3, one: "proof to add", many: "proofs to add", rule: "proofs to add" },
  run: { weight: 4, one: "run blocked on you", many: "runs blocked on you", rule: "the agent" },
  proposal: { weight: 5, one: "link proposal to verify", many: "link proposals to verify", rule: "the agent" },
  capture: { weight: 7, one: "capture review", many: "capture reviews", rule: "drops to review" },
};
const KINDS_BY_WEIGHT = (Object.keys(KIND) as Need["kind"][]).sort((a, b) => KIND[a].weight - KIND[b].weight);

// the doc the viewer was last in — the first artifact in their recents, else the seed's
export function pickHeroId(recents: { id: string; kind: string }[], fallback = "a_notif"): string {
  return recents.find((r) => r.kind === "artifact")?.id ?? fallback;
}

// Agent runs blocked on the viewer join the queue as a kind of their own.
export function runNeeds(runs: AgentRun[]): Need[] {
  return runs
    .filter((r) => r.status === "needs_you")
    .map((r) => ({ id: r.id, kind: "run" as const, title: r.title, sub: r.result ?? "waiting on you", href: "/inbox?tab=activity", action: "Review" }));
}

// The hero doc's own staleness is stated by the hero (ochre dot, Review →): it stays in the count and in the
// hand-off — it is still in the Inbox — but it is never the nudge, so the page never says one fact twice.
export function rankNeeds(needs: NeedItem[], runs: AgentRun[], heroId: string): { ranked: Need[]; absorbed: Need[] } {
  const ranked: Need[] = [];
  const absorbed: Need[] = [];
  for (const n of needs) (n.kind === "stale" && n.href.includes(heroId) ? absorbed : ranked).push(n);
  ranked.push(...runNeeds(runs));
  // Array.prototype.sort is stable: equal weights keep the queue's own order
  ranked.sort((a, b) => KIND[a.kind].weight - KIND[b.kind].weight);
  return { ranked, absorbed };
}

// The sentence under the header is generated from the table, so it is the sort, not a description of it.
export function ruleSentence(): string {
  const clauses: string[] = [];
  let lastWeight = -1;
  for (const k of KINDS_BY_WEIGHT) {
    const rule = KIND[k].rule;
    if (clauses.length && clauses[clauses.length - 1].split(" and ").includes(rule)) continue; // two kinds, one clause
    if (KIND[k].weight === lastWeight) clauses[clauses.length - 1] += ` and ${rule}`;
    else clauses.push(rule);
    lastWeight = KIND[k].weight;
  }
  return `${upperFirst(clauses[0])} first, then ${clauses.slice(1).join(", then ")}.`;
}

export type NeedsSummary = { top: Need | undefined; more: number; breakdown: string; rule: string | undefined };

// badgeCount is the sidebar's selector (inboxBadgeCount): "N more" is that number minus the one shown, so
// 1 + N is always the badge; the breakdown is printed only when the kinds this page can see add up to N.
export function needsSummary(needs: NeedItem[], runs: AgentRun[], heroId: string, badgeCount: number): NeedsSummary {
  const { ranked, absorbed } = rankNeeds(needs, runs, heroId);
  const top = ranked[0];
  const more = Math.max(0, badgeCount - (top ? 1 : 0));
  const rest = [...ranked.slice(1), ...absorbed];
  const tallies = new Map<Need["kind"], number>();
  for (const n of rest) tallies.set(n.kind, (tallies.get(n.kind) ?? 0) + 1);
  const breakdown =
    rest.length === more
      ? KINDS_BY_WEIGHT.filter((k) => tallies.has(k)).map((k) => plural(tallies.get(k)!, KIND[k].one, KIND[k].many)).join(", ")
      : "";
  return { top, more, breakdown, rule: badgeCount > 1 ? ruleSentence() : undefined };
}

// "Woven wove …, noted … and 4 more — 2 of them on its own": the object clause names up to `n` runs.
export function agentDigest(done: AgentRun[], n: number): { objects: string; own: string } | null {
  if (!done.length) return null;
  const objects = `${done.slice(0, n).map((r) => lowerFirst(r.title)).join(", ")}${done.length > n ? ` and ${done.length - n} more` : ""}`;
  const own = done.filter((r) => r.ruleId).length;
  const ownClause = !own ? "" : own === done.length ? (done.length === 1 ? "on its own" : "all on its own") : `${own} of them on its own`;
  return { objects, own: ownClause };
}
