"use client";

// Inbox — the agent's CONSOLE. One surface, three lenses (a page-level ViewTabs switch): Decisions (the
// approve queue — what needs your call), Activity (a monitor of what the agent is running / has run), and
// Governance (how far the agent may act + the decision-points where it may intervene, with plain-language
// risk). Decisions is the default.

import * as React from "react";
import { useRouter } from "next/navigation";
import { PageHeading } from "@/components/page-heading";
import { PAGE_FRAME } from "@/lib/frame";
import { ViewTabs } from "@/components/controls";
import { InboxQueue } from "@/components/inbox-queue";
import { InboxActivity } from "@/components/inbox-activity";
import { InboxGovernance } from "@/components/inbox-governance";
import { decisionRecord, inboxDecisionCount, listDecisionActions, liveRunCount } from "@/lib/api";
import { useGraphVersion } from "@/lib/use-graph-version";

export default function InboxPage() {
  useGraphVersion();
  const router = useRouter();
  const [tab, setTab] = React.useState("decisions");
  const [focusDecisionId, setFocusDecisionId] = React.useState<string | null>(null);
  // deep-link support (?tab=activity) — Today's "All activity →" and the retired /activity route land here.
  // Read from window, NOT useSearchParams: the latter forces a client-render bailout that `next build` can't
  // prerender without a Suspense boundary (that exact thing broke the Vercel deploy once already).
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("tab");
    const decisionId = params.get("decision");
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      if (decisionId) {
        if (decisionRecord(decisionId) && !listDecisionActions().some((item) => item.decision_id === decisionId)) {
          router.replace(`/decision/${decisionId}`);
          return;
        }
        setTab("decisions");
        setFocusDecisionId(decisionId);
      } else if (t === "decisions" || t === "activity" || t === "governance") {
        setTab(t);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [router]);
  return (
    <div className={PAGE_FRAME.focused}>
      {/* the title alone: the explorer shell's header (no ⓘ, no hint sentence). PageHeading stopped rendering
          `hint` in line B's evolve pass and kept the prop only so this caller compiled; the sentence is gone
          from here too, so the page says nothing a reader cannot see. */}
      <PageHeading title="Inbox" />

      <div className="mt-5">
        <ViewTabs
          value={tab}
          onChange={setTab}
          options={[
            { id: "decisions", label: "Decisions", count: inboxDecisionCount() },
            { id: "activity", label: "Activity", count: liveRunCount() },
            { id: "governance", label: "Governance" },
          ]}
        />
      </div>

      <div className="mt-6">
        {tab === "decisions" ? (
          <InboxQueue
            key={focusDecisionId ?? "decision-queue"}
            initialDecisionId={focusDecisionId}
            onOpenGovernance={() => setTab("governance")}
          />
        ) : tab === "activity" ? (
          <InboxActivity onReviewDecisions={() => setTab("decisions")} onOpenGovernance={() => setTab("governance")} />
        ) : (
          <InboxGovernance />
        )}
      </div>
    </div>
  );
}
