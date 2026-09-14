import { Suspense } from "react";
import { Explorer } from "@/components/explorer";
import { PageHeading } from "@/components/page-heading";
import { listPeople } from "@/lib/api";
import { PAGE_FRAME } from "@/lib/frame";

const HEADING = {
  title: "People",
  hint: "Who's behind the work. Pick a person to see their neighborhood — what they authored, where they're mentioned, and the topics they touch.",
};

export default function PeoplePage() {
  const entities = listPeople().map((p) => ({ id: p.id, name: p.name }));

  return (
    <div className={PAGE_FRAME.browse}>
      {/* the Explorer draws the heading itself, so the subject can share the h1's line ("People / …");
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
        <Explorer entities={entities} heading={HEADING} entityNoun="person" entityNounPlural="people" />
      </Suspense>
    </div>
  );
}
