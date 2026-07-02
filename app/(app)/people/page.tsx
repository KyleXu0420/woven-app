"use client";

import * as React from "react";
import { ArrowLeft } from "lucide-react";
import { Explorer } from "@/components/explorer";
import { EntityDirectory } from "@/components/entity-directory";
import { PageHeading } from "@/components/page-heading";
import { listPeople } from "@/lib/api";

export default function PeoplePage() {
  const entities = React.useMemo(() => listPeople().map((p) => ({ id: p.id, name: p.name })), []);
  const [focus, setFocus] = React.useState<string | null>(null);

  return (
    <div className="mx-auto w-full max-w-5xl p-8 sm:p-10">
      <PageHeading
        title="People"
        hint="Who's behind the work. Browse and filter everyone, then open a person to see their neighborhood — what they authored, where they're mentioned, and the topics they touch."
      />
      {focus === null ? (
        <EntityDirectory entities={entities} kind="person" onOpen={setFocus} />
      ) : (
        <div>
          <button
            onClick={() => setFocus(null)}
            className="mt-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> All people
          </button>
          <Explorer key={focus} entities={entities} initialFocus={focus} />
        </div>
      )}
    </div>
  );
}
