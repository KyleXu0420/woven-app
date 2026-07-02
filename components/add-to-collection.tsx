"use client";

import * as React from "react";
import { FolderPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
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

// The collection checklist — one toggle row per collection, a checkmark meaning every passed artifact is
// already filed there. Toggling a row files (or un-files) all of them at once. Shared by the submenu form
// (a card / reader ⋯) and the standalone dropdown button (the Library bulk-select toolbar).
function CollectionCheckItems({ artifactIds, onChanged }: { artifactIds: string[]; onChanged?: () => void }) {
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
    <>
      {cols.map((c) => (
        <DropdownMenuCheckboxItem key={c.id} checked={allIn(c.id)} onCheckedChange={() => toggle(c.id, c.name)}>
          <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: c.color }} />
          <span className="truncate">{c.name}</span>
        </DropdownMenuCheckboxItem>
      ))}
    </>
  );
}

// Submenu form — drops into an existing artifact menu (Library card ⋯, reader ⋯).
export function AddToCollectionSub({ artifactIds, onChanged }: { artifactIds: string[]; onChanged?: () => void }) {
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className="gap-2">
        <FolderPlus className="size-4 text-muted-foreground" /> Add to collection
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="max-h-72 w-56 overflow-y-auto">
        <CollectionCheckItems artifactIds={artifactIds} onChanged={onChanged} />
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

// Standalone form — its own dropdown button, for the Library bulk-select toolbar (opens upward).
export function AddToCollectionButton({ artifactIds, onChanged }: { artifactIds: string[]; onChanged?: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="sm" className="gap-2" />}>
        <FolderPlus className="size-4" /> Add to collection
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" side="top" sideOffset={8} className="max-h-72 w-56 overflow-y-auto">
        <CollectionCheckItems artifactIds={artifactIds} onChanged={onChanged} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
