import { Suspense } from "react";
import { Explorer } from "@/components/explorer";
import { PageHeading } from "@/components/page-heading";
import { listPeople } from "@/lib/api";
import { PAGE_FRAME } from "@/lib/frame";

export default function PeoplePage() {
  const entities = listPeople().map((p) => ({ id: p.id, name: p.name }));

  return (
    <div className={PAGE_FRAME.browse}>
      <PageHeading
        title="People"
        hint="Who's behind the work. Pick a person to see their neighborhood — what they authored, where they're mentioned, and the topics they touch."
      />
      {/* Explorer reads ?focus= via useSearchParams → must sit inside a Suspense boundary or next build
          can't prerender the page (the CSR-bailout error that was failing every Vercel deploy) */}
      <Suspense fallback={<div className="mt-6 h-[480px] rounded-2xl border bg-card" />}>
        <Explorer entities={entities} entityNoun="person" entityNounPlural="people" />
      </Suspense>
    </div>
  );
}
