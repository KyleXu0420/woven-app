import { InboxQueue } from "@/components/inbox-queue";
import { PageHeading } from "@/components/page-heading";

export default function InboxPage() {
  return (
    <div className="mx-auto w-full max-w-3xl p-8 sm:p-10">
      <PageHeading
        title="Inbox"
        hint="The agent's proposals, grouped by the doc they're about — confirm what's right to keep the graph trustworthy. Nothing enters the graph as fact until you say so."
      />

      <div className="mt-6">
        <InboxQueue />
      </div>

      <p className="mt-5 text-xs text-muted-foreground">
        Autopilot can auto-confirm high-confidence links from trusted sources; the rest land here.
      </p>
    </div>
  );
}
