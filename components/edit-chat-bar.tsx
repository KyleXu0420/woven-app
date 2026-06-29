"use client";

import * as React from "react";
import {
  Plus,
  Send,
  Check,
  ChevronDown,
  FileText,
  Image as ImageIcon,
  TextCursorInput,
  Pilcrow,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AgentAvatar, PersonAvatar } from "./identity";
import { selectionActions, type DocSelection, type SelAction } from "@/lib/use-doc-selection";
import type { Block } from "@/lib/types";

export type Msg = { role: "user" | "agent" | "system"; text: string };

function ThreadMsg({ m }: { m: Msg }) {
  if (m.role === "system") {
    return (
      <p className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
        <Check className="size-3 shrink-0 text-primary" /> {m.text}
      </p>
    );
  }
  const agent = m.role === "agent";
  return (
    <div className="flex gap-2">
      {agent ? (
        <AgentAvatar size="xs" className="mt-0.5" />
      ) : (
        <PersonAvatar seed="pe_maya" name="Maya Chen" size="xs" className="mt-0.5" />
      )}
      <p className={`text-[13px] leading-snug ${agent ? "text-foreground/80" : "text-foreground"}`}>{m.text}</p>
    </div>
  );
}

// the live context chip — what the agent will act on, read straight from the selection
function contextChip(sel: DocSelection, blocks: Block[]) {
  if (sel.kind === "image") return { Icon: ImageIcon, label: "Image selected" };
  if (sel.kind === "text") {
    const n = sel.text.split(/\s+/).filter(Boolean).length;
    return { Icon: TextCursorInput, label: `${n} word${n === 1 ? "" : "s"} selected` };
  }
  if (sel.kind === "block") {
    const b = blocks.find((x) => x.id === sel.blockId);
    return { Icon: Pilcrow, label: b ? `${b.heading} section` : "Section" };
  }
  return { Icon: FileText, label: "Whole document" };
}

// The chatdoc composer — a specially-designed bottom bar that reads the live selection and offers
// scoped edit tools above the input. The agent's change still lands inline in the doc (the trust valve);
// this is just the selection-aware input surface.
export function EditChatBar({
  selection,
  blocks,
  thread,
  input,
  setInput,
  onAction,
  onSubmit,
  onAttach,
}: {
  selection: DocSelection;
  blocks: Block[];
  thread: Msg[];
  input: string;
  setInput: (v: string) => void;
  onAction: (a: SelAction) => void;
  onSubmit: (text: string) => void;
  onAttach: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const actions = selectionActions(selection.kind);
  const { Icon, label } = contextChip(selection, blocks);

  return (
    <div className="fixed bottom-6 left-1/2 z-40 w-[min(720px,92vw)] -translate-x-1/2 animate-in slide-in-from-bottom-4 duration-300">
      <div className="overflow-hidden rounded-2xl border bg-card shadow-xl ring-1 ring-foreground/5">
        {/* thread (collapsible history) */}
        {open && thread.length > 0 ? (
          <div className="scrollbar-subtle flex max-h-52 flex-col gap-2.5 overflow-y-auto border-b px-4 py-3">
            {thread.map((m, i) => (
              <ThreadMsg key={i} m={m} />
            ))}
          </div>
        ) : null}

        {/* ── scope & tools — the quiet top zone: what the agent acts on, plus scoped shortcuts */}
        <div className="px-3.5 pt-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-muted-foreground">
              <Icon className="size-3.5" />
              {label}
            </span>
            {thread.length > 0 ? (
              <button
                onClick={() => setOpen((o) => !o)}
                className="ml-auto inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-muted-foreground/80 transition-colors hover:text-foreground"
              >
                {open ? "Hide" : `History · ${thread.length}`}
                <ChevronDown className={cn("size-3 transition-transform", open && "rotate-180")} />
              </button>
            ) : null}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {actions.map((a) => (
              <button
                key={a.id}
                onClick={() => onAction(a)}
                className="rounded-full border px-2.5 py-1 text-[12px] text-muted-foreground transition-colors hover:bg-foreground/[0.04] hover:text-foreground"
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── input — the primary action, the heaviest element in the bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (input.trim()) {
              onSubmit(input.trim());
              setInput("");
            }
          }}
          className="flex items-center gap-2 p-3"
        >
          <button
            type="button"
            onClick={onAttach}
            aria-label="Attach"
            className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-foreground/[0.05] hover:text-foreground"
          >
            <Plus className="size-4" />
          </button>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Tell the agent to edit…"
            className="min-w-0 flex-1 rounded-lg border bg-background px-3.5 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          />
          <Button type="submit" size="sm" className="px-3" aria-label="Send">
            <Send />
          </Button>
        </form>
      </div>
    </div>
  );
}
