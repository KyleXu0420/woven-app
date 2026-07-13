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
      <Explorer entities={entities} />
    </div>
  );
}
