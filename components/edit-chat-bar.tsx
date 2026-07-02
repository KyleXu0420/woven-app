"use client";

import * as React from "react";
import {
  Plus,
  ArrowUp,
  X,
  Check,
  History,
  FileText,
  Image as ImageIcon,
  TextCursorInput,
  Pilcrow,
  ArrowUpRight,
  CornerDownRight,
  Paperclip,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { AgentAvatar, PersonAvatar } from "./identity";
import { selectionActions, type DocSelection, type SelAction } from "@/lib/use-doc-selection";
import type { AskCite, Block } from "@/lib/types";

export type Msg = { role: "user" | "agent" | "system"; text: string; cites?: AskCite[] };

// one box, intent inferred — a question routes to Ask (a cited answer); anything else is an edit
// instruction. The model tells them apart, so the composer isn't split into Edit / Ask modes.
function looksLikeQuestion(t: string): boolean {
  const s = t.trim().toLowerCase();
  if (s.endsWith("?")) return true;
  return /^(what|why|how|who|when|where|which|whose|is|are|do|does|did|can|could|should|would|will|summari|explain|describe|tell me|list |show me|find )/.test(s);
}

// a citation rendered as a live graph anchor — click to jump to the cited section, or out to the
// cited artifact. This is what makes the agent's answer inspectable + provenance-linked.
function CiteChip({ cite, onCite }: { cite: AskCite; onCite: (c: AskCite) => void }) {
  return (
    <button
      type="button"
      onClick={() => onCite(cite)}
      className="inline-flex items-center gap-1 rounded-full border bg-card px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-foreground/[0.04] hover:text-foreground"
    >
      {cite.href ? <ArrowUpRight className="size-2.5 shrink-0" /> : <CornerDownRight className="size-2.5 shrink-0" />}
      <span className="max-w-[10rem] truncate">{cite.label}</span>
    </button>
  );
}

function ThreadMsg({ m, onCite }: { m: Msg; onCite: (c: AskCite) => void }) {
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
      <div className="min-w-0">
        <p className={`text-[13px] leading-snug ${agent ? "text-foreground/80" : "text-foreground"}`}>{m.text}</p>
        {m.cites?.length ? (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {m.cites.map((c, i) => (
              <CiteChip key={i} cite={c} onCite={onCite} />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

// the live context chip — what the agent will act on, read straight from the selection
function contextChip(sel: DocSelection, blocks: Block[]) {
  if (sel.kind === "image") return { Icon: ImageIcon, label: "Image" };
  if (sel.kind === "text") {
    const n = sel.text.split(/\s+/).filter(Boolean).length;
    return { Icon: TextCursorInput, label: `${n} word${n === 1 ? "" : "s"}` };
  }
  if (sel.kind === "block") {
    const b = blocks.find((x) => x.id === sel.blockId);
    return { Icon: Pilcrow, label: b ? b.heading : "Section" };
  }
  return { Icon: FileText, label: "Whole document" };
}

// The chatdoc composer — input-first. One calm row: the field is the hero, the scoped quick-edits live
// in the + menu (contextual to the selection), and the selection rides inside the field as a chip.
// A question routes to a cited Ask; anything else is an edit instruction that lands inline (the valve).
export function EditChatBar({
  selection,
  blocks,
  thread,
  input,
  setInput,
  onAction,
  onSubmit,
  onAsk,
  onCite,
  onClearScope,
  onAttach,
}: {
  selection: DocSelection;
  blocks: Block[];
  thread: Msg[];
  input: string;
  setInput: (v: string) => void;
  onAction: (a: SelAction) => void;
  onSubmit: (text: string) => void;
  onAsk: (question: string) => void;
  onCite: (c: AskCite) => void;
  onClearScope: () => void;
  onAttach: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const actions = selectionActions(selection.kind);
  const { Icon, label } = contextChip(selection, blocks);
  const scoped = selection.kind !== "none";

  return (
    <div className="fixed bottom-6 left-1/2 z-40 w-[min(680px,92vw)] -translate-x-1/2 animate-in slide-in-from-bottom-4 duration-300">
      <div className="overflow-hidden rounded-2xl border bg-card shadow-xl ring-1 ring-foreground/5">
        {/* thread — collapsible history */}
        {open && thread.length > 0 ? (
          <div className="scrollbar-subtle flex max-h-52 flex-col gap-2.5 overflow-y-auto border-b px-4 py-3">
            {thread.map((m, i) => (
              <ThreadMsg key={i} m={m} onCite={onCite} />
            ))}
          </div>
        ) : null}

        {/* input row — the hero. Actions live in the + menu; history + the selection scope ride here too. */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const v = input.trim();
            if (!v) return;
            if (looksLikeQuestion(v)) onAsk(v);
            else onSubmit(v);
            setInput("");
          }}
          className="flex items-center gap-2 p-3"
        >
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button size="icon-lg" variant="ghost" type="button" aria-label="Actions" />}>
              <Plus />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top" sideOffset={10} className="w-56">
              <DropdownMenuLabel>{scoped ? label : "Quick actions"}</DropdownMenuLabel>
              {actions.map((a) => (
                <DropdownMenuItem key={a.id} onClick={() => onAction(a)}>
                  {a.label}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onAttach} className="gap-2">
                <Paperclip className="size-4 text-muted-foreground" /> Attach source
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {thread.length > 0 ? (
            <IconButton
              label={open ? "Hide history" : `History · ${thread.length}`}
              variant="ghost"
              size="icon-lg"
              type="button"
              onClick={() => setOpen((o) => !o)}
            >
              <History />
            </IconButton>
          ) : null}

          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border bg-background px-3 py-2 transition-shadow focus-within:ring-2 focus-within:ring-ring/40">
            {scoped ? (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-secondary py-0.5 pr-0.5 pl-1.5 text-[11px] font-medium text-muted-foreground">
                <Icon className="size-3 shrink-0" />
                <span className="max-w-[9rem] truncate">{label}</span>
                <button
                  type="button"
                  onClick={onClearScope}
                  aria-label="Clear selection"
                  className="flex size-4 items-center justify-center rounded text-muted-foreground/70 transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
                >
                  <X className="size-3" />
                </button>
              </span>
            ) : null}
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={scoped ? "Edit the selection, or ask a question…" : "Ask a question, or tell the agent to edit…"}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>

          <IconButton label="Send" variant="default" size="icon-lg" type="submit">
            <ArrowUp />
          </IconButton>
        </form>
      </div>
    </div>
  );
}
