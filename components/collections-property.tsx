"use client";

import * as React from "react";
import { FolderClosed, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  addArtifactsToCollection,
  collectionById,
  createCollection,
  getArtifact,
  listCollections,
  removeArtifactFromCollection,
} from "@/lib/api";
import { bumpGraph } from "@/lib/store";
import { useGraphVersion } from "@/lib/use-graph-version";
import { tintVar } from "@/lib/identity";
import type { Collection } from "@/lib/types";

// CollectionsProperty — the reader ContextRail's editable "Collections" property. Where the other rows
// peek their relations, a doc's collections are membership you can change in place: each is a removable
// chip, and an inline "+ Add" opens a mini-picker (find an existing collection or spin up a new one) —
// no buried ⋯ submenu. Reads membership straight off the artifact's collection_ids; every mutation
// bumps the graph so this row (and the sidebar counts) re-render live.
export function CollectionsProperty({ artifactId }: { artifactId: string }) {
  useGraphVersion(); // re-render after any add / remove / create

  const [adding, setAdding] = React.useState(false);
  const [query, setQuery] = React.useState("");

  const artifact = getArtifact(artifactId);
  const memberIds = artifact?.collection_ids ?? [];
  const inIds = new Set(memberIds);
  const cols = memberIds
    .map(collectionById)
    .filter((c): c is Collection => Boolean(c));

  const q = query.trim();
  const all = listCollections();
  // the picker's options: everything the doc isn't already in, narrowed by a name-contains match
  const candidates = all
    .filter((c) => !inIds.has(c.id))
    .filter((c) => !q || c.name.toLowerCase().includes(q.toLowerCase()));
  // offer "Create" once there's a query that isn't already the name of some collection
  const canCreate = q.length > 0 && !all.some((c) => c.name.toLowerCase() === q.toLowerCase());

  function closePicker() {
    setAdding(false);
    setQuery("");
  }

  function removeCol(id: string) {
    removeArtifactFromCollection(id, artifactId);
    bumpGraph();
  }

  function addCol(id: string) {
    addArtifactsToCollection(id, [artifactId]);
    bumpGraph();
    closePicker();
  }

  function createAndAdd() {
    const name = q;
    if (!name) return;
    // a plain (manual) collection — kind "simple", so it doesn't kick off the agent's gather like a typed one.
    // color auto-picks from the name, matching the New-collection flow.
    const c = createCollection({ name, color: tintVar(name), kind: "simple" });
    addArtifactsToCollection(c.id, [artifactId]);
    bumpGraph();
    closePicker();
  }

  return (
    <div>
      {/* header — mirrors the rail's other property rows (icon · label · glance count) */}
      <div className="flex items-center gap-2.5 py-2">
        <FolderClosed className="size-[18px] shrink-0 text-muted-foreground" />
        <span className="flex-1 text-[13px]">Collections</span>
        <span className="text-[13px] font-semibold tabular-nums text-foreground">{cols.length}</span>
        {/* trailing slot — mirrors PropRow's chevron gutter so this count lines up with the sibling rows' */}
        <span aria-hidden className="w-3.5 shrink-0" />
      </div>

      {/* chips — one per collection (swatch · name · remove), then the dashed "+ Add" */}
      <div className="flex flex-wrap gap-1.5">
        {cols.map((c) => (
          <span
            key={c.id}
            className="inline-flex items-center gap-1.5 rounded-full border bg-card py-0.5 pl-2 pr-1 text-[13px] text-foreground/85"
          >
            <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: c.color }} />
            <span className="max-w-[120px] truncate">{c.name}</span>
            <button
              type="button"
              onClick={() => removeCol(c.id)}
              aria-label={`Remove from ${c.name}`}
              className="flex size-4 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/[0.08] hover:text-foreground"
            >
              <X className="size-3" />
            </button>
          </span>
        ))}

        <button
          type="button"
          onClick={() => (adding ? closePicker() : setAdding(true))}
          className={cn(
            "inline-flex items-center gap-1 rounded-full border border-dashed px-2 py-0.5 text-[13px] transition-colors",
            adding
              ? "border-primary/40 bg-primary/[0.06] text-primary"
              : "border-primary/30 text-primary/90 hover:bg-primary/[0.05]",
          )}
        >
          <Plus className="size-3" /> Add
        </button>
      </div>

      {/* inline mini-picker — right here in the rail (not a popover): find an existing collection or create one */}
      {adding ? (
        <div className="mt-2 overflow-hidden rounded-lg border bg-card shadow-sm">
          <div className="border-b px-2.5 py-2">
            {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  closePicker();
                }
              }}
              placeholder="Find or create a collection…"
              className="w-full bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div className="max-h-52 overflow-y-auto p-1">
            {candidates.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => addCol(c.id)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] transition-colors hover:bg-foreground/[0.04]"
              >
                <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: c.color }} />
                <span className="truncate">{c.name}</span>
              </button>
            ))}
            {canCreate ? (
              <button
                type="button"
                onClick={createAndAdd}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-primary transition-colors hover:bg-primary/[0.05]"
              >
                <Plus className="size-3.5 shrink-0" />
                <span className="truncate">Create “{q}”</span>
              </button>
            ) : null}
            {candidates.length === 0 && !canCreate ? (
              <p className="px-2 py-1.5 text-[12px] text-muted-foreground">
                {inIds.size >= all.length ? "In every collection." : "No collections found."}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
