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
  StickyNote,
  Diamond,
  Quote,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
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

// graph actions carry a glyph so they read as a distinct family from the plain-text prose transforms
function graphGlyph(id: string) {
  return id === "cite" ? Quote : Diamond;
}

// when a proposal is open the bar's chip row becomes these refine quick-actions — the bar is the ONE place
// you nudge the draft, so they live here, not duplicated on the inline proposal.
const REFINE_ACTIONS: SelAction[] = [
  { id: "tighten", label: "Tighten" },
  { id: "formal", label: "More formal" },
  { id: "source", label: "Add a source" },
];

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
  onInsertNote,
  refining = false,
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
  onInsertNote: () => void;
  refining?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const actions = selectionActions(selection.kind);
  const prose = actions.filter((a) => a.group !== "graph");
  const graph = actions.filter((a) => a.group === "graph");
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

        {/* adaptive actions — surfaced from the selection so you recognize + click instead of composing prose.
            Prose transforms (→ inline diff) and graph actions (→ Verify) render as distinct families, and the
            row wraps rather than clipping so nothing is ever cut off. */}
        <div className="flex flex-wrap items-center gap-1.5 border-b px-3 py-2.5">
          {refining ? (
            // a proposal is open — the bar refines THAT draft; the chips become refine quick-actions, so
            // "the one place to nudge the AI" holds whether you're starting an edit or adjusting one.
            <>
              <span className="flex shrink-0 items-center gap-1.5 rounded-lg bg-primary/[0.08] px-2 py-1 text-[12px] font-medium text-primary">
                <AgentAvatar size="xs" /> Refining draft
              </span>
              <span className="h-4 w-px shrink-0 bg-border" />
              <span className="inline-flex items-center gap-1.5">
                {REFINE_ACTIONS.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => onAction(a)}
                    className="shrink-0 rounded-lg border bg-background px-2.5 py-1 text-[12px] text-foreground/80 transition-colors hover:border-primary/30 hover:bg-primary/[0.05] hover:text-foreground"
                  >
                    {a.label}
                  </button>
                ))}
              </span>
            </>
          ) : (
            <>
              {scoped ? (
                <>
                  <span className="flex shrink-0 items-center gap-1.5 rounded-lg bg-secondary py-1 pl-2 pr-1 text-[12px] font-medium text-muted-foreground">
                    <Icon className="size-3.5 shrink-0" />
                    <span className="max-w-[10rem] truncate">{label}</span>
                    <button
                      type="button"
                      onClick={onClearScope}
                      aria-label="Clear selection"
                      className="flex size-4 items-center justify-center rounded text-muted-foreground/70 transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                  <span className="h-4 w-px shrink-0 bg-border" />
                </>
              ) : null}

              {/* prose transforms → land as an inline diff */}
              <span className="inline-flex items-center gap-1.5">
                {prose.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => onAction(a)}
                    className="shrink-0 rounded-lg border bg-background px-2.5 py-1 text-[12px] text-foreground/80 transition-colors hover:border-primary/30 hover:bg-primary/[0.05] hover:text-foreground"
                  >
                    {a.label}
                  </button>
                ))}
              </span>

              {/* graph actions → mine the prose into the graph; the glyph marks them a distinct family */}
              {graph.length > 0 ? (
                <>
                  <span className="h-4 w-px shrink-0 bg-border" />
                  <span className="inline-flex items-center gap-1.5">
                    {graph.map((a) => {
                      const G = graphGlyph(a.id);
                      return (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => onAction(a)}
                          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border bg-background px-2.5 py-1 text-[12px] text-foreground/80 transition-colors hover:border-primary/30 hover:bg-primary/[0.05] hover:text-foreground"
                        >
                          <G className="size-3.5 text-muted-foreground" />
                          {a.label}
                        </button>
                      );
                    })}
                  </span>
                </>
              ) : null}
            </>
          )}
        </div>

        {/* input row — the escape hatch for anything the chips don't cover. + holds the document extras. */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const v = input.trim();
            if (!v) return;
            // the agent reads intent — a question routes to a cited Ask, anything else is an edit instruction.
            // A leading /ask or /edit is a hidden override for the rare miss; otherwise nothing to manage.
            const m = v.match(/^\/(ask|edit)\s+/i);
            const text = m ? v.slice(m[0].length) : v;
            const ask = m ? m[1].toLowerCase() === "ask" : looksLikeQuestion(text);
            if (ask) onAsk(text);
            else onSubmit(text);
            setInput("");
          }}
          className="flex items-center gap-2 p-2.5"
        >
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button size="icon-lg" variant="ghost" type="button" aria-label="More" />}>
              <Plus />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top" sideOffset={10} className="w-52">
              <DropdownMenuItem onClick={onInsertNote} className="gap-2">
                <StickyNote className="size-4 text-muted-foreground" /> Insert note
              </DropdownMenuItem>
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

          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              refining
                ? "Refine the draft, or ask a question…"
                : scoped
                  ? "Edit the selection, or ask a question…"
                  : "Ask a question, or tell the agent to edit…"
            }
            className="min-w-0 flex-1 rounded-lg border bg-background px-3 py-2 text-sm outline-none transition-shadow placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/40"
          />

          <IconButton label="Send" variant="default" size="icon-lg" type="submit">
            <ArrowUp />
          </IconButton>
        </form>
      </div>
    </div>
  );
}
