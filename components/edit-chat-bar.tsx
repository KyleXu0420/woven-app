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
  Sparkles,
  PencilLine,
  ArrowUpRight,
  CornerDownRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { IconButton } from "@/components/ui/icon-button";
import { AgentAvatar, PersonAvatar } from "./identity";
import { selectionActions, type DocSelection, type SelAction } from "@/lib/use-doc-selection";
import type { AskCite, Block } from "@/lib/types";

export type Msg = { role: "user" | "agent" | "system"; text: string; cites?: AskCite[] };

// a few grounded starter questions — the presets exist so Ask is discoverable, not a blank box
const ASK_SUGGESTIONS = ["What are the open questions?", "Summarize the cadence rules", "What was this sourced from?"];

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

// The chatdoc composer — a bottom bar that either EDITS the doc (selection-aware, lands inline via the
// trust valve) or ASKS over it (a cited answer grounded in the doc + its graph neighborhood).
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
  onAttach: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [mode, setMode] = React.useState<"edit" | "ask">("edit");
  const asking = mode === "ask";
  const actions = selectionActions(selection.kind);
  const { Icon, label } = contextChip(selection, blocks);

  return (
    <div className="fixed bottom-6 left-1/2 z-40 w-[min(720px,92vw)] -translate-x-1/2 animate-in slide-in-from-bottom-4 duration-300">
      <div className="overflow-hidden rounded-2xl border bg-card shadow-xl ring-1 ring-foreground/5">
        {/* thread (collapsible history) */}
        {open && thread.length > 0 ? (
          <div className="scrollbar-subtle flex max-h-52 flex-col gap-2.5 overflow-y-auto border-b px-4 py-3">
            {thread.map((m, i) => (
              <ThreadMsg key={i} m={m} onCite={onCite} />
            ))}
          </div>
        ) : null}

        {/* ── mode & scope — Edit ｜ Ask, then what the agent acts on, plus scoped shortcuts */}
        <div className="px-3.5 pt-3">
          <div className="flex items-center gap-2">
            <div className="inline-flex shrink-0 items-center gap-0.5 rounded-full border bg-background p-0.5">
              <button
                type="button"
                onClick={() => setMode("edit")}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
                  !asking ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <PencilLine className="size-3" /> Edit
              </button>
              <button
                type="button"
                onClick={() => setMode("ask")}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
                  asking ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Sparkles className="size-3" /> Ask
              </button>
            </div>
            <span className="inline-flex min-w-0 items-center gap-1.5 text-[11.5px] font-medium text-muted-foreground">
              {asking ? <Sparkles className="size-3.5 shrink-0" /> : <Icon className="size-3.5 shrink-0" />}
              <span className="truncate">{asking ? "This doc + its graph" : label}</span>
            </span>
            {thread.length > 0 ? (
              <button
                onClick={() => setOpen((o) => !o)}
                className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-muted-foreground/80 transition-colors hover:text-foreground"
              >
                {open ? "Hide" : `History · ${thread.length}`}
                <ChevronDown className={cn("size-3 transition-transform", open && "rotate-180")} />
              </button>
            ) : null}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {asking
              ? ASK_SUGGESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => onAsk(q)}
                    className="rounded-full border px-2.5 py-1 text-[12px] text-muted-foreground transition-colors hover:bg-foreground/[0.04] hover:text-foreground"
                  >
                    {q}
                  </button>
                ))
              : actions.map((a) => (
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
            const v = input.trim();
            if (!v) return;
            if (asking) onAsk(v);
            else onSubmit(v);
            setInput("");
          }}
          className="flex items-center gap-2 p-3"
        >
          <IconButton label="Attach" size="icon-lg" type="button" onClick={onAttach}>
            <Plus />
          </IconButton>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={asking ? "Ask about this doc…" : "Tell the agent to edit…"}
            className="min-w-0 flex-1 rounded-lg border bg-background px-3.5 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          />
          <IconButton label={asking ? "Ask" : "Send"} variant="default" size="icon-lg" type="submit">
            <Send />
          </IconButton>
        </form>
      </div>
    </div>
  );
}
