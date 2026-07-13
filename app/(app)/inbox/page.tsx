import { InboxQueue } from "@/components/inbox-queue";
import { PageHeading } from "@/components/page-heading";
import { PAGE_FRAME } from "@/lib/frame";

export default function InboxPage() {
  return (
    <div className={PAGE_FRAME.focused}>
      <PageHeading
        title="Inbox"
        hint="The agent's proposals, grouped by the doc they're about — confirm what's right to keep the graph trustworthy. Nothing enters the graph as fact until you say so."
      />

      <div className="mt-6">
        <InboxQueue />
      </div>

      <p className="mt-5 text-[13px] text-muted-foreground">
        Autopilot can auto-confirm high-confidence links from trusted sources; the rest land here.
      </p>
    </div>
  );
}
