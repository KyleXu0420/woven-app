import { Suspense } from "react";
import { Explorer } from "@/components/explorer";
import { PageBreadcrumb } from "@/components/page-heading";
import { listPeople } from "@/lib/api";
import { PAGE_FRAME } from "@/lib/frame";

// The section: the eyebrow over the person's name. The page had a heading of its own ("People", with a hint
// sentence) and the person stood beside it at the same size — two titles on one line. The person is the
// h1 now (the Explorer draws it), and the section is the crumb above it, as "Collections" is over a
// collection's name. No hint: the empty state explains the page the one time it needs explaining.
const SECTION = "People";

export default function PeoplePage() {
  const entities = listPeople().map((p) => ({ id: p.id, name: p.name }));

  return (
    <div className={PAGE_FRAME.browse}>
      {/* Explorer reads ?focus= via useSearchParams → must sit inside a Suspense boundary or next build
          can't prerender the page (the CSR-bailout error that was failing every Vercel deploy) */}
      {/* the fallback draws the same eyebrow so it never flashes in twice, and holds the height under it —
          the subject is only known once the explorer mounts, and the explorer draws on the page ground, so
          a card that flashed and vanished would be the one card on the page */}
      <Suspense
        fallback={
          <>
            <PageBreadcrumb trail={[{ label: SECTION, href: "/people" }]} className="mb-3" />
            <div className="h-[520px]" />
          </>
        }
      >
        <Explorer section={SECTION} switcher={{ entities, kind: "person", noun: "person", nounPlural: "people" }} />
      </Suspense>
    </div>
  );
}
