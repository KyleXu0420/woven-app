"use client";

import * as React from "react";
import { LocalGraph, GraphLegend } from "./local-graph";
import { EntityProfile } from "./entity-profile";
import { collectionGraph } from "@/lib/api";

// CollectionMap — the collection's "Map" view: its members and the links among them, drawn with the
// SAME LocalGraph + EntityProfile as the Explorer, scoped to one collection. The collection sits at the
// centre; click any member to read its profile. This map is the seed of the collection's emergent KG-mark.
export function CollectionMap({ slug }: { slug: string }) {
  const nb = React.useMemo(() => collectionGraph(slug), [slug]);

  return (
    // not overflow-hidden — the node popover floats past the graph's edges
    <div className="relative rounded-2xl border bg-card">
      <div className="px-4 pt-8 pb-8 sm:px-6">
        <LocalGraph
          data={nb}
          onSelect={() => {}}
          renderPopover={(id, api) => {
            const n = nb.nodes.find((x) => x.id === id);
            return n ? <EntityProfile node={n} placement="popover" onSelect={api.select} /> : null;
          }}
        />
      </div>
      <GraphLegend className="absolute top-3 left-4 sm:left-6" />
    </div>
  );
}
