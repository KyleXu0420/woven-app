"use client";

import * as React from "react";
import { FolderPlus } from "lucide-react";
import {
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import {
  addArtifactsToCollection,
  getArtifact,
  listCollections,
  removeArtifactFromCollection,
} from "@/lib/api";
import { notify } from "@/lib/notifications";

// Reusable "file this into a collection" affordance — a submenu of toggle rows that drops into any
// artifact menu (a Library card's ⋯, the reader's ⋯, a bulk toolbar). Each row toggles membership for
// every passed artifact at once; a checkmark means all of them are already filed there. Mutates the
// in-memory graph and calls onChanged so the host can re-read the (now-updated) membership.
export function AddToCollectionSub({
  artifactIds,
  onChanged,
}: {
  artifactIds: string[];
  onChanged?: () => void;
}) {
  const cols = listCollections();
  const n = artifactIds.length;
  const allIn = (colId: string) =>
    n > 0 && artifactIds.every((id) => getArtifact(id)?.collection_ids.includes(colId));

  function toggle(colId: string, colName: string) {
    if (allIn(colId)) {
      artifactIds.forEach((id) => removeArtifactFromCollection(colId, id));
      notify.success(`Removed from ${colName}`, { description: `${n} artifact${n > 1 ? "s" : ""} unfiled.` });
    } else {
      addArtifactsToCollection(colId, artifactIds);
      notify.success(`Added to ${colName}`, { description: `${n} artifact${n > 1 ? "s" : ""} filed.` });
    }
    onChanged?.();
  }

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className="gap-2">
        <FolderPlus className="size-4 text-muted-foreground" /> Add to collection
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="max-h-72 w-56 overflow-y-auto">
        {cols.map((c) => (
          <DropdownMenuCheckboxItem key={c.id} checked={allIn(c.id)} onCheckedChange={() => toggle(c.id, c.name)}>
            <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: c.color }} />
            <span className="truncate">{c.name}</span>
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}
