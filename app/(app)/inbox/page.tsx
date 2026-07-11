import { InboxQueue } from "@/components/inbox-queue";
import { CatchUp } from "@/components/catch-up";
import { PageHeading } from "@/components/page-heading";

export default function InboxPage() {
  return (
    <div className="mx-auto w-full max-w-3xl p-8 sm:p-10">
      <PageHeading
        title="Inbox"
        hint="The agent's proposed links and capture reviews land here. Confirm what's right, discard what's not — every edge carries a trust state, and nothing enters the graph as fact until you say so."
      />
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        The agent proposes links as it weaves. Confirm what&apos;s right, discard what&apos;s not —
        every edge carries a trust state, and nothing enters the graph as fact until you say so.
      </p>

      <div className="mt-6">
        <CatchUp />
        <InboxQueue />
      </div>

      <p className="mt-5 text-xs text-muted-foreground">
        Autopilot can auto-confirm high-confidence links from trusted sources; the rest land here.
      </p>
    </div>
  );
}
