import { Explorer } from "@/components/explorer";
import { PageHeading } from "@/components/page-heading";
import { listPeople } from "@/lib/api";

export default function PeoplePage() {
  const entities = listPeople().map((p) => ({ id: p.id, name: p.name }));

  return (
    <div className="mx-auto w-full max-w-5xl p-8 sm:p-10">
      <PageHeading
        title="People"
        hint="Who's behind the work. Pick a person to see their neighborhood — what they authored, where they're mentioned, and the topics they touch. The list is the truth; the graph is the “show me.”"
      />
      <Explorer entities={entities} />
    </div>
  );
}
