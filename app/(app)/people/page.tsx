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
      <Explorer entities={entities} entityNoun="person" entityNounPlural="people" />
    </div>
  );
}
