"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AgentAvatar } from "@/components/identity";
import { Section, Row, RowList, SectionAction, EmptyRow } from "@/components/today-ui";
import { heroArtifactId } from "@/components/home/continue-hero";
import { approveDecision, inboxBadgeCount, listRuns, needsYou } from "@/lib/api";
import { notify } from "@/lib/notifications";
import { useGraphVersion } from "@/lib/use-graph-version";
import type { NeedItem } from "@/lib/types";

// DECIDE. One ranked item and a counted hand-off — never the queue (that is the Inbox's job). The count is the
// sidebar's number, from the same selector; the rank is a printed rule the reader can check against the Inbox;
// the control on the row is real: a human decision approves through the accessor the Inbox uses, and the row
// re-renders from the store. The hero doc's own staleness is absorbed by the hero above and is never the nudge.
type Need = NeedItem | { id: string; kind: "run"; title: string; sub: string; href: string; action: string };

const WEIGHT: Record<Need["kind"], number> = {
  revalidation: 0, // an approved decision whose evidence moved
  stale: 1, // a living doc whose source moved
  candidate: 2, // a colleague's suggested edit
  approval: 2, // a decision waiting on your authority
  activation: 3, // proof to add
  run: 4, // an agent run blocked on you
  proposal: 5, // links to verify
  capture: 7, // a drop to review
};
const NOUN: Record<Need["kind"], [string, string]> = {
  revalidation: ["decision to re-check", "decisions to re-check"],
  stale: ["stale doc", "stale docs"],
  candidate: ["suggested edit", "suggested edits"],
  approval: ["approval", "approvals"],
  activation: ["proof to add", "proofs to add"],
  run: ["run blocked on you", "runs blocked on you"],
  proposal: ["link proposal to verify", "link proposals to verify"],
  capture: ["capture review", "capture reviews"],
};

function rankNeeds(heroId: string): { ranked: Need[]; absorbed: Need[] } {
  const all = needsYou();
  // the hero doc's own staleness is stated by the hero (ochre dot, Review →); it stays in the count and in
  // the hand-off — it is still in the Inbox — but it is never the nudge, so the page never says one fact twice
  const absorbed: Need[] = all.filter((n) => n.kind === "stale" && n.href.includes(heroId));
  const items: Need[] = [
    ...all.filter((n) => !absorbed.includes(n)),
    ...listRuns()
      .filter((r) => r.status === "needs_you")
      .map((r) => ({ id: r.id, kind: "run" as const, title: r.title, sub: r.result ?? "waiting on you", href: "/inbox?tab=activity", action: "Review" })),
  ];
  // stable: same weight keeps the queue's own order (the Inbox's), which is oldest-first where it knows
  return { ranked: items.map((n, i) => ({ n, i })).sort((a, b) => WEIGHT[a.n.kind] - WEIGHT[b.n.kind] || a.i - b.i).map((x) => x.n), absorbed };
}

export function NeedsYou() {
  useGraphVersion();
  const router = useRouter();
  const count = inboxBadgeCount();
  const { ranked, absorbed } = rankNeeds(heroArtifactId());
  const top = ranked[0];
  // "N more" is the selector's count minus the one shown, so 1 + N is always the sidebar's number; the
  // breakdown is printed only when the kinds this page can see add up to N — never a sum that disagrees
  const more = Math.max(0, count - (top ? 1 : 0));
  const rest = [...ranked.slice(1), ...absorbed];
  const tallies = new Map<Need["kind"], number>();
  for (const n of rest) tallies.set(n.kind, (tallies.get(n.kind) ?? 0) + 1);
  const tallied = [...tallies.values()].reduce((a, b) => a + b, 0);
  const breakdown = tallied === more ? [...tallies.entries()].sort((a, b) => WEIGHT[a[0]] - WEIGHT[b[0]]).map(([k, c]) => `${c} ${NOUN[k][c === 1 ? 0 : 1]}`).join(", ") : "";

  const approve = (n: Need) => {
    if (n.kind !== "approval" || !("decision_id" in n) || !n.decision_id) return;
    const rec = approveDecision(n.decision_id);
    if (!rec) return;
    notify.success(`Approved “${n.title}”`, {
      description: "It takes effect once its proof is added, in the Inbox.",
      action: { label: "Open Inbox", onClick: () => router.push("/inbox") },
    });
  };

  return (
    <Section
      label="Needs you"
      count={count || undefined}
      rule={count > 1 ? "Decisions whose evidence moved first, then stale docs, then people's edits and approvals, then the agent." : undefined}
      action={
        <SectionAction href="/inbox" accent>
          Open Inbox <ArrowRight className="size-3.5" />
        </SectionAction>
      }
    >
      <RowList flush>
        {top ? (
          <Row primary interactiveTrailing marker={<AgentAvatar size="sm" />} trailing={
            top.kind === "approval" ? (
              // the Inbox's own wash pill for a human decision — the same object the user meets there
              <Button
                variant="outline"
                size="sm"
                className="border-primary/40 bg-primary/[0.06] text-primary hover:bg-primary/[0.1] hover:text-primary max-md:min-h-11"
                onClick={() => approve(top)}
              >
                Approve
              </Button>
            ) : (
              <Button variant="outline" size="sm" nativeButton={false} render={<Link href={top.href} />}>
                {top.action}
              </Button>
            )
          }>
            <Link href={top.href} className="block rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/40 max-md:min-h-11">
              <span className="line-clamp-2 block text-[15px] leading-snug">
                <span className="font-medium">{top.title}</span>
                {/* the queue's detail strings still carry the middle dot (line A copy); the house separator is a comma */}
                <span className="text-muted-foreground"> — {top.sub.replace(/\s*·\s*/g, ", ")}</span>
              </span>
            </Link>
          </Row>
        ) : (
          <EmptyRow>Nothing needs you, the Inbox is clear</EmptyRow>
        )}
        {top && more > 0 ? (
          <Row
            href="/inbox"
            marker={<span className="text-xs tabular-nums text-muted-foreground">{more}</span>}
            trailing={<ArrowRight className="size-4 text-muted-foreground opacity-100 transition-opacity sm:opacity-0 sm:group-hover/row:opacity-100 group-focus-visible/row:opacity-100" />}
          >
            <span className="block text-[15px] leading-snug text-muted-foreground">
              more in the Inbox{breakdown ? <span className="max-md:hidden"> — {breakdown}</span> : null}
            </span>
          </Row>
        ) : null}
      </RowList>
    </Section>
  );
}
