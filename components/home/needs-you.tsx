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
import { needsSummary } from "@/lib/home";
import { notify } from "@/lib/notifications";
import { houseSeparators } from "@/lib/text";
import { cn } from "@/lib/utils";
import { useGraphVersion } from "@/lib/use-graph-version";

// DECIDE. One ranked item and a counted hand-off — never the queue (that is the Inbox's job). The rank, the
// count reconciliation and the printed rule are lib/home.ts (pure, tested); this island fetches and renders.
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

  return (
    <Section
      label="Needs you"
      count={count || undefined}
      action={
        <SectionAction href="/inbox" accent>
          Open Inbox <ArrowRight className="size-3.5" />
        </SectionAction>
      }
    >
      {rule ? <p className="-mt-1 mb-2.5 text-sm leading-snug text-muted-foreground">{rule}</p> : null}
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
            <Link href={top.href} className={cn("block rounded-md max-md:min-h-11", FOCUS_RING)}>
              <span className="line-clamp-2 block text-base leading-snug">
                <span className="font-medium">{top.title}</span>
                {/* a no-break space after the dash: the line may break before "—", never after it */}
                <span className="text-muted-foreground"> —&nbsp;{houseSeparators(top.sub)}</span>
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
            trailing={<ArrowRight className={`size-4 text-muted-foreground ${ROW_REVEAL}`} />}
          >
            <span className="block text-base leading-snug text-muted-foreground">
              more in the Inbox{breakdown ? <span className="max-md:hidden"> — {breakdown}</span> : null}
            </span>
          </Row>
        ) : null}
      </RowList>
    </Section>
  );
}
