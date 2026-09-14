import { Suspense } from "react";
import { Explorer } from "@/components/explorer";
import { PageHeading } from "@/components/page-heading";
import { listTopics } from "@/lib/api";
import { PAGE_FRAME } from "@/lib/frame";

const HEADING = {
  title: "Topics",
  hint: "The themes the knowledge base is organized around. Pick a topic to see everything woven into it — artifacts, the people involved, and the agent's proposed links awaiting verification.",
};

export default function TopicsPage() {
  const entities = listTopics().map((t) => ({ id: t.id, name: t.name }));

  return (
    <div className={PAGE_FRAME.browse}>
      {/* the Explorer draws the heading itself, so the subject can share the h1's line ("Topics / …");
          the Suspense fallback draws the same heading so the title never flashes in twice */}
      {/* Explorer reads ?focus= via useSearchParams → must sit inside a Suspense boundary or next build
          can't prerender the page (the CSR-bailout error that was failing every Vercel deploy) */}
      {/* the fallback holds the height only — the explorer draws on the page ground now, so a card that
          flashed and vanished would be the one card on the page */}
      <Suspense
        fallback={
          <>
            <PageHeading title={HEADING.title} hint={HEADING.hint} />
            <div className="mt-6 h-[480px]" />
          </>
        }
      >
        <Explorer entities={entities} entityKind="topic" heading={HEADING} entityNoun="topic" entityNounPlural="topics" />
      </Suspense>
    </div>
  );
}
