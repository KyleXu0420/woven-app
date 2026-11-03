"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FOCUS_RING } from "@/components/classes";
import { AgentAvatar } from "@/components/identity";
import { ChoiceValve } from "@/components/proposal";
import { Section, Row, RowList, SectionAction, EmptyRow, ROW_REVEAL } from "@/components/today-ui";
import { homeFacts } from "@/components/home/home-facts";
import { approveDecision } from "@/lib/api";
import { HOME_MEASURE, needsSummary } from "@/lib/home";
import { notify } from "@/lib/notifications";
import { houseSeparators } from "@/lib/text";
import { cn } from "@/lib/utils";
import { useGraphVersion } from "@/lib/use-graph-version";

// DECIDE. One ranked item and a counted hand-off — never the queue (that is the Inbox's job). The rank, the
// count reconciliation and the rule are lib/home.ts (pure, tested); this island fetches and renders.
// The control on the row is real: a human decision approves through the accessor the Inbox uses, rendered by
// the Inbox's own ChoiceValve, and the row re-renders from the store.
export function NeedsYou() {
  const version = useGraphVersion();
  const router = useRouter();
  const { top, more, breakdown, rule } = React.useMemo(() => {
    const { needs, runs, heroId, badge } = homeFacts(version);
    return needsSummary(needs, runs, heroId, badge);
  }, [version]);
  const count = homeFacts(version).badge;

  const openInbox = React.useCallback(() => router.push("/inbox"), [router]);
  const approve = React.useCallback(
    (decisionId: string, title: string) => {
      if (!approveDecision(decisionId)) return;
      notify.success(`Approved “${title}”`, {
        description: "It takes effect once its proof is added, in the Inbox.",
        action: { label: "Open Inbox", onClick: openInbox },
      });
    },
    [openInbox],
  );

  // The order the list is sorted in is one hover away, on the section's count (fork 4, Kyle 2026-10-02): the
  // rule used to print under the header at rest, and every judge read it as the UI explaining itself. It is still
  // the sentence lib/home.ts generates from the table that sorts the list, so it cannot describe a sort that
  // isn't running; one item has no order to explain (needsSummary returns no rule), and the count is then only
  // the count. This section wrote out Section's whole header to put the rule on its count; Section takes it as
  // countHint now, so the page has one header markup.
  return (
    <Section label="Needs you" count={count || undefined} countHint={rule} action={<SectionAction href="/inbox">Open Inbox</SectionAction>}>
      <RowList flush>
        {top ? (
          <Row
            interactiveTrailing
            marker={<AgentAvatar size="sm" />}
            // on a phone the control wraps under the body, right-aligned, at the touch floor
            className="max-md:flex-wrap [&>span:last-child]:max-md:basis-full [&>span:last-child]:max-md:justify-end"
            trailing={
              top.kind === "approval" && "decision_id" in top && top.decision_id ? (
                <span className="flex items-center max-md:min-h-11">
                  <ChoiceValve actions={[{ id: "approve", label: "Approve", primary: true }]} onChoose={() => approve(top.decision_id!, top.title)} />
                </span>
              ) : (
                <Button variant="outline" size="sm" nativeButton={false} render={<Link href={top.href} />}>
                  {top.action}
                </Button>
              )
            }
          >
            {/* The title, then what it is on a line of its own, the way the Ask rows below print a question over
                its grounding. They were one run parted by an em dash, one of six on the page. The measure sits on
                each line, not on the link: ch is the element's own, so 75ch on the 15px link let the 13px line
                under it run to 86ch. */}
            <Link href={top.href} className={cn("block rounded-md max-md:min-h-11", FOCUS_RING)}>
              <span className={cn("block text-base font-medium", HOME_MEASURE)}>{top.title}</span>
              {top.sub ? <span className={cn("mt-0.5 block text-sm text-muted-foreground line-clamp-2", HOME_MEASURE)}>{houseSeparators(top.sub)}</span> : null}
            </Link>
          </Row>
        ) : (
          <EmptyRow>Nothing needs you, the Inbox is clear</EmptyRow>
        )}
        {top && more > 0 ? (
          <Row
            href="/inbox"
            marker={<span className="text-xs tabular-nums text-muted-foreground">{more}</span>}
            trailing={<ArrowRight className={`size-4 text-muted-foreground ${ROW_REVEAL}`} />}
          >
            {/* a colon introduces the tally; it was this section's second em dash */}
            <span className={cn("block text-base text-muted-foreground", HOME_MEASURE)}>
              more in the Inbox{breakdown ? <span className="max-md:hidden">: {breakdown}</span> : null}
            </span>
          </Row>
        ) : null}
      </RowList>
    </Section>
  );
}
