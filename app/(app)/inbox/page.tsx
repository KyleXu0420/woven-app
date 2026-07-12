import { InboxQueue } from "@/components/inbox-queue";
import { CatchUp } from "@/components/catch-up";
import { PageHeading } from "@/components/page-heading";

export default function InboxPage() {
  return (
    <div className="mx-auto w-full max-w-3xl p-8 sm:p-10">
      <PageHeading
        title="Inbox"
        hint="The agent proposes links and capture reviews as it weaves. Confirm what's right, discard what's not — every edge carries a trust state, and nothing enters the graph as fact until you say so."
      />

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
