import { Suspense } from "react";
import { Explorer } from "@/components/explorer";
import { PageHeading } from "@/components/page-heading";
import { listTopics } from "@/lib/api";
import { PAGE_FRAME } from "@/lib/frame";

export default function TopicsPage() {
  const entities = listTopics().map((t) => ({ id: t.id, name: t.name }));

  return (
    <div className={PAGE_FRAME.browse}>
      <PageHeading
        title="Topics"
        hint="The themes the knowledge base is organized around. Pick a topic to see everything woven into it — artifacts, the people involved, and the agent's proposed links awaiting verification."
      />
      {/* Explorer reads ?focus= via useSearchParams → must sit inside a Suspense boundary or next build
          can't prerender the page (the CSR-bailout error that was failing every Vercel deploy) */}
      <Suspense fallback={<div className="mt-6 h-[480px] rounded-2xl border bg-card" />}>
        <Explorer entities={entities} entityNoun="topic" entityNounPlural="topics" />
      </Suspense>
    </div>
  );
}
