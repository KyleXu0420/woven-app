"use client";

import * as React from "react";
import { ArrowRight, Check, GitMerge } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { TypeBadge } from "@/components/artifact-ui";
import { getArtifact, mergeArtifacts, relationCount } from "@/lib/api";

// a living canonical outranks a freshly-dropped/processing dupe when seeding the default survivor
const STATE_RANK: Record<string, number> = { living: 2, processing: 1, archived: 0 };

// Merge two duplicate artifacts. Pick which SURVIVES (canonical); the other is archived and its
// connections move onto the survivor. Confirm runs mergeArtifacts(survivor, loser); onMerged lets the
// caller clear the originating capture review + toast.
export function MergeSheet({
  aId,
  bId,
  open,
  onOpenChange,
  onMerged,
}: {
  aId: string;
  bId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMerged?: (survivorId: string, loserId: string) => void;
}) {
  const a = getArtifact(aId);
  const b = getArtifact(bId);

  // default survivor = the more "living" of the two, tie-broken by who carries more connections
  const defaultSurvivor = React.useMemo(() => {
    if (!a || !b) return aId;
    const ra = STATE_RANK[a.state] ?? 0;
    const rb = STATE_RANK[b.state] ?? 0;
    if (ra !== rb) return ra > rb ? aId : bId;
    return relationCount(aId) >= relationCount(bId) ? aId : bId;
  }, [a, b, aId, bId]);

  const [survivorId, setSurvivorId] = React.useState(defaultSurvivor);
  // re-seed the choice each time a fresh pair opens
  React.useEffect(() => {
    if (open) setSurvivorId(defaultSurvivor);
  }, [open, defaultSurvivor]);

  if (!a || !b) return null;

  const loserId = survivorId === aId ? bId : aId;
  const survivor = survivorId === aId ? a : b;
  const loser = survivorId === aId ? b : a;
  const moved = relationCount(loserId);

  function confirm() {
    mergeArtifacts(survivorId, loserId);
    onMerged?.(survivorId, loserId);
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 sm:max-w-md">
        <SheetHeader className="gap-1 p-5">
          <SheetTitle className="flex items-center gap-2">
            <GitMerge className="size-4 text-primary" />
            Merge duplicates
          </SheetTitle>
          <SheetDescription>
            Pick the one that survives as canonical. The other is archived and its connections move onto it.
          </SheetDescription>
        </SheetHeader>

        {/* the choice — two selectable cards acting as a radio group */}
        <div role="radiogroup" aria-label="Which artifact survives" className="flex flex-col gap-2.5 px-5">
          {[a, b].map((art) => {
            const on = survivorId === art.id;
            const n = relationCount(art.id);
            return (
              <button
                key={art.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setSurvivorId(art.id)}
                className={cn(
                  "flex items-start gap-3 rounded-2xl border p-4 text-left transition-colors",
                  on
                    ? "border-primary/40 bg-primary/[0.04]"
                    : "border-border hover:border-foreground/20 hover:bg-foreground/[0.03]",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex size-[18px] shrink-0 items-center justify-center rounded-full border transition-colors",
                    on ? "border-primary bg-primary text-primary-foreground" : "border-foreground/25",
                  )}
                >
                  {on ? <Check className="size-3" /> : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <TypeBadge type={art.type} />
                    <span className="truncate text-sm font-medium">{art.title}</span>
                  </span>
                  {art.gist ? (
                    <span className="mt-1 block truncate text-[12px] text-muted-foreground">{art.gist}</span>
                  ) : null}
                  <span className="mt-1.5 block font-mono text-[11px] text-muted-foreground">
                    {on ? "survives · canonical" : "will be archived"} · {n} connection{n === 1 ? "" : "s"} · {art.updated}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        {/* the effect — agent-tint, since a merge reconciles what the agent flagged */}
        <div className="mx-5 mt-4 flex items-center gap-2 rounded-xl border border-primary/15 bg-primary/[0.04] px-3.5 py-2.5 text-[12px] text-muted-foreground">
          <span className="max-w-[9rem] truncate font-medium text-foreground">{loser.title}</span>
          <ArrowRight className="size-3.5 shrink-0 text-primary" />
          <span className="max-w-[9rem] truncate font-medium text-foreground">{survivor.title}</span>
          <span className="ml-auto shrink-0 whitespace-nowrap">
            {moved} connection{moved === 1 ? "" : "s"} merged
          </span>
        </div>

        <SheetFooter className="flex-row justify-end gap-2 p-5">
          <SheetClose render={<Button variant="ghost">Cancel</Button>} />
          <Button onClick={confirm}>
            <GitMerge className="size-4" />
            Merge
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
