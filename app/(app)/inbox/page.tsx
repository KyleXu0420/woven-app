"use client";

// Inbox — the agent's CONSOLE. One surface, three lenses (a page-level ViewTabs switch): Decisions (the
// approve queue — what needs your call), Activity (a monitor of what the agent is running / has run), and
// Governance (how far the agent may act + the decision-points where it may intervene, with plain-language
// risk). Decisions is the default.

import * as React from "react";
import { PageHeading } from "@/components/page-heading";
import { PAGE_FRAME } from "@/lib/frame";
import { ViewTabs } from "@/components/controls";
import { InboxQueue } from "@/components/inbox-queue";
import { InboxActivity } from "@/components/inbox-activity";
import { InboxGovernance } from "@/components/inbox-governance";
import { pendingCount, liveRunCount } from "@/lib/api";
import { useGraphVersion } from "@/lib/use-graph-version";

export default function InboxPage() {
  useGraphVersion();
  const [tab, setTab] = React.useState("decisions");
  return (
    <div className={PAGE_FRAME.focused}>
      <PageHeading
        title="Inbox"
        hint="Your agent's console — approve what it proposes, watch what it's running, and set how far it may act. Nothing enters the graph as fact until you say so."
      />

      <div className="mt-5">
        <ViewTabs
          value={tab}
          onChange={setTab}
          options={[
            { id: "decisions", label: "Decisions", count: pendingCount() },
            { id: "activity", label: "Activity", count: liveRunCount() },
            { id: "governance", label: "Governance" },
          ]}
        />
      </div>

      <div className="mt-6">
        {tab === "decisions" ? (
          <InboxQueue />
        ) : tab === "activity" ? (
          <InboxActivity onReviewDecisions={() => setTab("decisions")} />
        ) : (
          <InboxGovernance />
        )}
      </div>
    </div>
  );
}
