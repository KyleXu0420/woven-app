"use client";

import * as React from "react";
import { MessageSquare, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { IconButton } from "@/components/ui/icon-button";
import { PersonAvatar } from "./identity";
import { blockComments, type BlockComment } from "@/lib/api";
import { notify } from "@/lib/notifications";

// Block-level comments — a quiet margin affordance: a count when a section has a thread, otherwise it
// fades in only on section hover (so the reading surface stays clean). Click opens the thread + a reply.
export function SectionComments({ blockId }: { blockId: string }) {
  const [comments, setComments] = React.useState<BlockComment[]>(() => blockComments(blockId));
  const [draft, setDraft] = React.useState("");
  const has = comments.length > 0;

  function add() {
    const text = draft.trim();
    if (!text) return;
    setComments((cs) => [...cs, { id: `local_${cs.length}`, by: "pe_maya", byName: "Maya Chen", text, at: "now" }]);
    setDraft("");
    notify.success("Comment added");
  }

  return (
    <Popover>
      <PopoverTrigger
        aria-label="Comments"
        className={cn(
          "inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium transition-colors outline-none",
          has
            ? "text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground"
            : "text-transparent group-hover/sec:text-muted-foreground/70 hover:bg-foreground/[0.06] hover:!text-foreground data-[popup-open]:text-foreground",
        )}
      >
        <MessageSquare className="size-3.5" />
        {has ? comments.length : null}
      </PopoverTrigger>
      <PopoverContent align="start" side="bottom" className="w-72 p-0">
        <div className="scrollbar-subtle max-h-64 overflow-y-auto p-3">
          {has ? (
            <div className="flex flex-col gap-3">
              {comments.map((c) => (
                <div key={c.id} className="flex gap-2">
                  <PersonAvatar seed={c.by} name={c.byName} size="xs" className="mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-[12px]">
                      <span className="font-medium">{c.byName}</span>{" "}
                      <span className="font-mono text-[10px] text-muted-foreground">{c.at}</span>
                    </p>
                    <p className="text-[13px] leading-snug text-foreground/85">{c.text}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-2 text-center text-[12px] text-muted-foreground">No comments yet.</p>
          )}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); add(); }} className="flex items-center gap-1.5 border-t p-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add a comment…"
            className="min-w-0 flex-1 bg-transparent px-1.5 text-[13px] outline-none placeholder:text-muted-foreground"
          />
          <IconButton label="Send" variant="default" size="icon-sm" type="submit" disabled={!draft.trim()}>
            <Send className="size-3.5" />
          </IconButton>
        </form>
      </PopoverContent>
    </Popover>
  );
}
