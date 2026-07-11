"use client";

import * as React from "react";
import Link from "next/link";
import { Plus, X } from "lucide-react";
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

// CollectionsProperty — WHERE a doc is filed. Kept a distinct, labelled zone (not one of the read-only
// "peek" property rows above it) because it's editable membership, not a reference: a chip per collection
// you can FOLLOW (→ the collection page) or DROP (×), and an inline "+ Add" that finds or creates one.
export function CollectionsProperty({ artifactId }: { artifactId: string }) {
  useGraphVersion(); // re-render after any add / remove / create
  const [adding, setAdding] = React.useState(false);
  const [query, setQuery] = React.useState("");

  const memberIds = getArtifact(artifactId)?.collection_ids ?? [];
  const inIds = new Set(memberIds);
  const cols = memberIds.map(collectionById).filter((c): c is Collection => Boolean(c));

  const all = listCollections();
  const q = query.trim();
  const candidates = all
    .filter((c) => !inIds.has(c.id))
    .filter((c) => !q || c.name.toLowerCase().includes(q.toLowerCase()));
  const canCreate = q.length > 0 && !all.some((c) => c.name.toLowerCase() === q.toLowerCase());

  function close() {
    setAdding(false);
    setQuery("");
  }
  function add(id: string) {
    addArtifactsToCollection(id, [artifactId]);
    bumpGraph();
    close();
  }
  function remove(id: string) {
    removeArtifactFromCollection(id, artifactId);
    bumpGraph();
  }
  function create() {
    if (!q) return;
    const c = createCollection({ name: q, color: tintVar(q), kind: "simple" });
    addArtifactsToCollection(c.id, [artifactId]);
    bumpGraph();
    close();
  }

  return (
    <section>
      <p className="mb-1.5 text-[12px] font-medium text-muted-foreground">Collections</p>

      <div className="flex flex-wrap gap-1.5">
        {cols.map((c) => (
          <span
            key={c.id}
            className="inline-flex items-center rounded-full border bg-card text-[13px] transition-colors hover:bg-foreground/[0.03]"
          >
            <Link href={`/collection/${c.slug}`} className="flex items-center gap-1.5 py-0.5 pr-1 pl-2">
              <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: c.color }} />
              <span className="max-w-[130px] truncate text-foreground/85">{c.name}</span>
            </Link>
            <button
              type="button"
              onClick={() => remove(c.id)}
              aria-label={`Remove from ${c.name}`}
              className="mr-0.5 flex size-4 shrink-0 items-center justify-center rounded-full text-muted-foreground/60 transition-colors hover:bg-foreground/[0.08] hover:text-foreground"
            >
              <X className="size-3" />
            </button>
          </span>
        ))}

        <button
          type="button"
          onClick={() => (adding ? close() : setAdding(true))}
          aria-expanded={adding}
          className={cn(
            "inline-flex items-center gap-1 rounded-full border border-dashed px-2 py-0.5 text-[13px] transition-colors",
            adding
              ? "border-primary/40 bg-primary/[0.06] text-primary"
              : "border-border text-muted-foreground hover:border-primary/30 hover:text-primary",
          )}
        >
          <Plus className="size-3" /> Add
        </button>
      </div>

      {/* inline picker — find an existing collection or create one; right here, no popover */}
      {adding ? (
        <div className="mt-2 overflow-hidden rounded-lg border bg-card shadow-sm">
          {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                close();
              }
            }}
            placeholder="Find or create…"
            className="w-full border-b bg-transparent px-2.5 py-2 text-[13px] outline-none placeholder:text-muted-foreground"
          />
          <div className="scrollbar-subtle max-h-48 overflow-y-auto p-1">
            {candidates.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => add(c.id)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] transition-colors hover:bg-foreground/[0.04]"
              >
                <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: c.color }} />
                <span className="truncate">{c.name}</span>
              </button>
            ))}
            {canCreate ? (
              <button
                type="button"
                onClick={create}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-primary transition-colors hover:bg-primary/[0.05]"
              >
                <Plus className="size-3.5 shrink-0" />
                <span className="truncate">Create “{q}”</span>
              </button>
            ) : null}
            {candidates.length === 0 && !canCreate ? (
              <p className="px-2 py-1.5 text-[12px] text-muted-foreground">
                {inIds.size >= all.length ? "In every collection." : "No matches."}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
