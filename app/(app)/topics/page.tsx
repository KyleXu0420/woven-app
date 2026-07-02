"use client";

import * as React from "react";
import { ArrowLeft } from "lucide-react";
import { Explorer } from "@/components/explorer";
import { EntityDirectory } from "@/components/entity-directory";
import { PageHeading } from "@/components/page-heading";
import { listTopics } from "@/lib/api";

export default function TopicsPage() {
  const entities = React.useMemo(() => listTopics().map((t) => ({ id: t.id, name: t.name })), []);
  const [focus, setFocus] = React.useState<string | null>(null);

  return (
    <div className="mx-auto w-full max-w-5xl p-8 sm:p-10">
      <PageHeading
        title="Topics"
        hint="The themes the knowledge base is organized around. Browse and filter them, then open a topic to see everything woven into it — artifacts, the people involved, and the agent's proposed links awaiting verification."
      />
      {focus === null ? (
        <EntityDirectory entities={entities} kind="topic" onOpen={setFocus} />
      ) : (
        <div>
          <button
            onClick={() => setFocus(null)}
            className="mt-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> All topics
          </button>
          <Explorer key={focus} entities={entities} initialFocus={focus} />
        </div>
      )}
    </div>
  );
}
