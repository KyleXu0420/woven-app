"use client";

import * as React from "react";
import {
  Plus,
  ArrowUp,
  X,
  Check,
  ChevronDown,
  Sparkles,
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
      className="inline-flex items-center gap-1 rounded-full border bg-card px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-foreground/[0.04] hover:text-foreground"
    >
      {cite.href ? <ArrowUpRight className="size-2.5 shrink-0" /> : <CornerDownRight className="size-2.5 shrink-0" />}
      <span className="max-w-[10rem] truncate">{cite.label}</span>
    </button>
  );
}

// One turn of the conversation. The agent speaks in plain language about what it did (copilot grammar:
// "I tightened Cadence — 40 words, proposed in the doc"), so intent is never something you have to guess.
// A system line is a quiet verify receipt; the agent's utterance is inked, yours is plain.
function ThreadMsg({ m, onCite }: { m: Msg; onCite: (c: AskCite) => void }) {
  if (m.role === "system") {
    return (
      <p className="flex items-center gap-1.5 pl-8 text-xs text-muted-foreground">
        <Check className="size-3 shrink-0 text-primary" /> {m.text}
      </p>
    );
  }
  const agent = m.role === "agent";
  return (
    <div className="flex gap-2.5">
      {agent ? (
        <AgentAvatar size="sm" className="mt-0.5" />
      ) : (
        <PersonAvatar seed="pe_maya" name="Maya Chen" size="sm" className="mt-0.5" />
      )}
      <div className="min-w-0 flex-1">
        <p className={`text-sm leading-relaxed ${agent ? "text-foreground" : "text-foreground/80"}`}>{m.text}</p>
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
function actionGlyph(a: SelAction) {
  if (a.group === "graph") return a.id === "cite" ? Quote : Diamond;
  return Sparkles;
}

// when a proposal is open the composer's suggestions become these refine quick-actions — the bar is the ONE
// place you nudge the draft, so they live here, not duplicated on the inline proposal.
const REFINE_ACTIONS: SelAction[] = [
  { id: "tighten", label: "Tighten" },
  { id: "formal", label: "More formal" },
  { id: "source", label: "Add a source" },
];

// The edit copilot. Silent state = one clean composer line (a + that holds scope-aware suggestions +
// document extras, the scope chip, the input, and send). The moment a conversation starts or a proposal
// opens, it grows UPWARD into a full copilot: the agent speaks in plain language about what it did, the
// proposal lands as an inline diff in the body (Accept/Reject there), and refine actions ride above the
// composer. Intent is inferred — a question routes to a cited Ask, anything else is an edit instruction.
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
  const [collapsed, setCollapsed] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const actions = selectionActions(selection.kind);
  const { Icon, label } = contextChip(selection, blocks);
  const scoped = selection.kind !== "none";
  const hasConvo = thread.length > 0;
  const showConvo = hasConvo && !collapsed;
  // a selection is an intent — so the moment you scope something, the copilot surfaces that scope's suggestions
  // ON the bar (proactive), instead of leaving them in the + menu. Whole-doc idle stays a clean pill.
  const showSuggest = scoped && !hasConvo && !refining;

  // keep the newest turn in view as the conversation grows
  React.useEffect(() => {
    if (showConvo) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [thread.length, showConvo]);

  return (
    <div className="fixed bottom-6 left-1/2 z-40 w-[min(680px,92vw)] -translate-x-1/2 animate-in slide-in-from-bottom-4 duration-300">
      <div
        className={`overflow-hidden border bg-card shadow-xl ring-1 ring-foreground/5 transition-all focus-within:border-ring/40 focus-within:ring-ring/25 ${
          showConvo || refining || showSuggest ? "rounded-lg" : "rounded-full"
        }`}
      >
        {/* CONVERSATION — grows upward once there's a thread; the agent's turns read as plain copilot speech */}
        {showConvo ? (
          <div>
            <div className="flex items-center gap-2 px-4 pt-3 pb-1.5">
              <AgentAvatar size="xs" />
              <span className="text-sm font-medium">Woven</span>
              <span className="text-xs text-muted-foreground">· editing with you</span>
              <IconButton
                label="Collapse conversation"
                variant="ghost"
                size="icon-xs"
                className="ml-auto text-muted-foreground"
                onClick={() => setCollapsed(true)}
              >
                <ChevronDown />
              </IconButton>
            </div>
            <div ref={scrollRef} className="scrollbar-subtle flex max-h-64 flex-col gap-3 overflow-y-auto px-4 pb-3">
              {thread.map((m, i) => (
                <ThreadMsg key={i} m={m} onCite={onCite} />
              ))}
            </div>
          </div>
        ) : null}

        {/* collapsed → a quiet one-line handle back into the conversation */}
        {hasConvo && collapsed ? (
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            className="flex w-full items-center gap-2 border-b px-4 py-2 text-left transition-colors hover:bg-foreground/[0.02]"
          >
            <AgentAvatar size="xs" />
            <span className="text-sm font-medium">Woven</span>
            <span className="text-xs text-muted-foreground">
              {thread.length} message{thread.length === 1 ? "" : "s"}
            </span>
            <ChevronDown className="ml-auto size-4 rotate-180 text-muted-foreground" />
          </button>
        ) : null}

        {/* REFINING — a proposal is open in the body; refine actions ride here, Accept/Reject lives on the diff */}
        {refining ? (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 border-t bg-primary/[0.03] px-3 py-2.5">
            <span className="flex items-center gap-1.5 text-sm font-medium text-primary">
              <AgentAvatar size="xs" state="thinking" /> Refining the draft
            </span>
            <span className="text-xs text-muted-foreground">· Accept or Reject in the doc</span>
            <span className="ml-auto inline-flex flex-wrap items-center gap-1.5">
              {REFINE_ACTIONS.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => onAction(a)}
                  className="shrink-0 rounded-full border bg-card px-2.5 py-1 text-sm text-foreground/80 transition-colors hover:border-primary/30 hover:bg-primary/[0.05] hover:text-foreground"
                >
                  {a.label}
                </button>
              ))}
            </span>
          </div>
        ) : null}

        {/* COMPOSER — the anchor: always the input line. A conversation or an open proposal grows ABOVE it; a
            selection's suggestions ride BELOW it (input-first, by request). + folds in the document extras. */}
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
          className={`flex items-center gap-1.5 p-2 ${showConvo || refining ? "border-t" : ""}`}
        >
          {/* + — scope-aware suggestions fold in here instead of a permanent chip row; plus the doc extras */}
          <DropdownMenu>
            <DropdownMenuTrigger render={<IconButton label="Suggestions & tools" variant="ghost" size="icon-lg" type="button" />}>
              <Plus />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top" sideOffset={10} className="w-60">
              {!refining && !showSuggest && actions.length > 0 ? (
                <>
                  <DropdownMenuLabel className="flex items-center gap-1.5 text-muted-foreground">
                    <Icon className="size-3.5" /> Suggested · {label}
                  </DropdownMenuLabel>
                  {actions.map((a) => {
                    const G = actionGlyph(a);
                    return (
                      <DropdownMenuItem key={a.id} onClick={() => onAction(a)} className="gap-2">
                        <G className="size-4 text-muted-foreground" /> {a.label}
                      </DropdownMenuItem>
                    );
                  })}
                  <DropdownMenuSeparator />
                </>
              ) : null}
              <DropdownMenuItem onClick={onInsertNote} className="gap-2">
                <StickyNote className="size-4 text-muted-foreground" /> Insert note
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onAttach} className="gap-2">
                <Paperclip className="size-4 text-muted-foreground" /> Attach source
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* scope chip — what the agent will act on, mirrored from the selection; clear to widen to the doc */}
          {scoped ? (
            <span className="flex shrink-0 items-center gap-1.5 rounded-md bg-secondary py-1.5 pl-2 pr-1 text-sm font-medium text-muted-foreground">
              <Icon className="size-3.5 shrink-0" />
              <span className="max-w-[9rem] truncate">{label}</span>
              <button
                type="button"
                onClick={onClearScope}
                aria-label="Clear selection"
                className="flex size-4 items-center justify-center rounded-sm text-muted-foreground/70 transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
              >
                <X className="size-3" />
              </button>
            </span>
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
            className="min-w-0 flex-1 bg-transparent px-1.5 py-2.5 text-base outline-none placeholder:text-muted-foreground"
          />

          <IconButton label="Send" variant="default" size="icon-lg" type="submit" disabled={!input.trim()}>
            <ArrowUp />
          </IconButton>
        </form>

        {/* SUGGESTED — a selection is an intent; the copilot offers what it could do right on the bar (no +
            menu needed). By request this rides BELOW the composer (input-first). Whole-doc idle stays a pill. */}
        {showSuggest ? (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 border-t bg-primary/[0.03] px-3.5 py-2.5">
            <AgentAvatar size="xs" className="shrink-0" />
            <span className="inline-flex flex-wrap items-center gap-1.5">
              {actions.slice(0, 3).map((a) => {
                // only graph moves (Extract decision / Cite) carry a glyph, to mark them a distinct family — a
                // row of suggestions doesn't need a ✦ on every prose chip; the agent mark already says "from Woven".
                const isGraph = a.group === "graph";
                const G = actionGlyph(a);
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => onAction(a)}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-full border bg-card px-2.5 py-1 text-sm text-foreground/80 transition-colors hover:border-primary/30 hover:bg-primary/[0.05] hover:text-foreground"
                  >
                    {isGraph ? <G className="size-3.5 text-muted-foreground" /> : null}
                    {a.label}
                  </button>
                );
              })}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
