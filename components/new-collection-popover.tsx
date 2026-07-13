"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { tintVar } from "@/lib/identity";
import { createCollection } from "@/lib/api";
import { bumpGraph } from "@/lib/store";
import { notify } from "@/lib/notifications";
import type { CollectionMeta } from "@/lib/collections";

const TINTS = Array.from({ length: 12 }, (_, i) => `var(--chart-${i + 1})`);

// Create is one move now: describe what the collection is about → create. Every collection is
// intent-driven (the agent gathers matches on the next page), so there's no Simple/Smart fork. Color
// auto-picks from the words, with a shuffle to re-roll it. A Popover, not a Dialog — no modal focus trap.
export function NewCollectionPopover({
  trigger,
  onCreated,
}: {
  trigger: React.ReactElement;
  onCreated: (meta: CollectionMeta) => void;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [colorIdx, setColorIdx] = React.useState<number | null>(null);

  const effectiveColor = colorIdx != null ? TINTS[colorIdx] : tintVar(q || "collection");

  function reset() {
    setQ("");
    setColorIdx(null);
  }
  function change(next: boolean) {
    setOpen(next);
    if (!next) reset();
  }
  function reroll() {
    let n = Math.floor(Math.random() * 12);
    while (TINTS[n] === effectiveColor) n = Math.floor(Math.random() * 12);
    setColorIdx(n);
  }
  function create() {
    if (!q.trim()) return;
    const c = createCollection({ name: q.trim(), color: effectiveColor, kind: "typed", intro: q.trim() });
    onCreated({ slug: c.slug, name: c.name, color: c.color, count: 0 });
    bumpGraph();
    notify.success("Collection created", {
      description: "Woven is gathering matches — review them on the next page.",
    });
    change(false);
    router.push(`/collection/${c.slug}`);
  }

  return (
    <Popover open={open} onOpenChange={change}>
      <PopoverTrigger render={trigger} />
      <PopoverContent align="start" side="right" sideOffset={10} className="w-[320px] p-0">
        {/* one input — describe the collection's intent (a real field, so it reads distinct from the hint) */}
        <div className="p-3">
          <div className="flex items-center gap-2 rounded-lg border bg-card px-2.5 py-2 focus-within:ring-2 focus-within:ring-ring/40">
            <span className="size-5 shrink-0 rounded-md" style={{ background: effectiveColor }} />
            {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="What’s this collection about?"
              className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground"
              onKeyDown={(e) => {
                if (e.key === "Enter" && q.trim()) create();
              }}
            />
            <IconButton label="Shuffle color" size="icon-xs" onClick={reroll}>
              <Shuffle />
            </IconButton>
          </div>
          <p className="mt-2 px-0.5 text-[12px] leading-snug text-muted-foreground">
            A few words on what belongs — Woven gathers the matches for you.
          </p>
        </div>

        <div className="mx-3 border-t" />
        <div className="flex items-center justify-end gap-2 p-2">
          <Button variant="ghost" size="sm" onClick={() => change(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={create} disabled={!q.trim()}>
            Create
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
