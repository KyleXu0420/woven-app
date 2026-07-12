"use client";

// FormatBubble — the manual-formatting layer, Cycle/Slite style. On a text selection in edit mode a compact
// toolbar floats just above the range with the instant, deterministic ops (bold / italic / strike / link /
// heading / list / quote) — separate from the AI command bar docked below, because formatting is muscle
// memory and belongs at the cursor, not in a bottom bar. It ends in "Ask AI", which hands the selection down
// to that bar. NB: the reader commits textContent, so inline marks are visual until the rich-text engine
// lands — the layer + interaction are real here; durable persistence is the follow-up.

import * as React from "react";
import {
  Bold,
  Italic,
  Strikethrough,
  Link2,
  Heading,
  List,
  ListOrdered,
  Quote,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import type { DocSelection } from "@/lib/use-doc-selection";

function exec(command: string, value?: string) {
  document.execCommand(command, false, value);
}

export function FormatBubble({ selection, onAskAI }: { selection: DocSelection; onAskAI: () => void }) {
  const [pos, setPos] = React.useState<{ top: number; left: number } | null>(null);

  React.useLayoutEffect(() => {
    if (selection.kind !== "text") {
      setPos(null);
      return;
    }
    const s = window.getSelection();
    if (!s || s.rangeCount === 0 || s.isCollapsed) {
      setPos(null);
      return;
    }
    const rect = s.getRangeAt(0).getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      setPos(null);
      return;
    }
    // centre above the selection, clamped so the bubble never runs off the viewport
    const half = 180;
    const left = Math.min(Math.max(rect.left + rect.width / 2, half + 8), window.innerWidth - half - 8);
    setPos({ top: Math.max(8, rect.top - 48), left });
  }, [selection]);

  if (!pos) return null;

  return (
    // preventDefault on mousedown keeps the doc selection alive so execCommand has a target to act on
    <div
      className="fixed z-50 -translate-x-1/2 animate-in fade-in-0 zoom-in-95 duration-100"
      style={{ top: pos.top, left: pos.left }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="flex items-center gap-0.5 rounded-xl border bg-card p-1 shadow-xl ring-1 ring-foreground/5">
        <FmtBtn icon={Bold} label="Bold" onClick={() => exec("bold")} />
        <FmtBtn icon={Italic} label="Italic" onClick={() => exec("italic")} />
        <FmtBtn icon={Strikethrough} label="Strikethrough" onClick={() => exec("strikeThrough")} />
        <Sep />
        <FmtBtn
          icon={Link2}
          label="Link"
          onClick={() => {
            const url = window.prompt("Link URL");
            if (url) exec("createLink", url);
          }}
        />
        <Sep />
        <FmtBtn icon={Heading} label="Heading" onClick={() => exec("formatBlock", "h2")} />
        <FmtBtn icon={List} label="Bulleted list" onClick={() => exec("insertUnorderedList")} />
        <FmtBtn icon={ListOrdered} label="Numbered list" onClick={() => exec("insertOrderedList")} />
        <FmtBtn icon={Quote} label="Quote" onClick={() => exec("formatBlock", "blockquote")} />
        <Sep />
        <button
          type="button"
          onClick={onAskAI}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] font-medium text-primary transition-colors hover:bg-primary/[0.08]"
        >
          <Sparkles className="size-3.5" /> Ask AI
        </button>
      </div>
    </div>
  );
}

function FmtBtn({ icon: Icon, label, onClick }: { icon: LucideIcon; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex size-8 items-center justify-center rounded-lg text-foreground/80 transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
    >
      <Icon className="size-[17px]" />
    </button>
  );
}

function Sep() {
  return <span className="mx-0.5 h-5 w-px shrink-0 bg-border" />;
}
