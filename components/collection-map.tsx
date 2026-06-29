"use client";

import * as React from "react";
import { LocalGraph } from "./local-graph";
import { EntityProfile } from "./entity-profile";
import { collectionGraph } from "@/lib/api";

// CollectionMap — the collection's "Map" view: its members and the links among them, drawn with the
// SAME LocalGraph + EntityProfile as the Explorer, scoped to one collection. The collection sits at the
// centre; click any member to read its profile. This map is the seed of the collection's emergent KG-mark.
export function CollectionMap({ slug }: { slug: string }) {
  const nb = React.useMemo(() => collectionGraph(slug), [slug]);
  const [selected, setSelected] = React.useState<string | null>(null);
  const node = nb.nodes.find((n) => n.id === selected) ?? nb.nodes.find((n) => n.depth === 0);

  return (
    <div className="space-y-3">
      {/* the collection's field — members + their links */}
      <div className="relative overflow-hidden rounded-2xl border bg-card">
        <div className="px-4 pt-8 pb-8 sm:px-6">
          <LocalGraph data={nb} onSelect={setSelected} />
        </div>
      </div>

      {/* profile of whatever's selected (the collection itself by default) */}
      {node ? <EntityProfile node={node} placement="inline" onSelect={setSelected} /> : null}
    </div>
  );
}
