"use client";

// FormatBubble — the manual-formatting layer, Cycle/Slite style. On a text selection in edit mode a compact
// toolbar floats just above the range with the instant, deterministic inline marks — bold / italic / strike
// / link. It's kept pure: the AI lives in the command bar docked below, already scoped to the same selection,
// so a bubble "Ask AI" would just be a redundant second entry. Manual formatting is muscle memory and belongs
// at the cursor; the AI is a conversation and stays docked.
// NB: block transforms (heading / list / quote) are intentionally NOT here — the reader is a per-block
// contentEditable that commits textContent, so execCommand's block ops are no-ops or emit invalid nesting
// (a <ul> inside a <p>). Those, plus durable persistence of the inline marks, wait on the rich-text engine.

import * as React from "react";
import { Bold, Italic, Strikethrough, Link2, type LucideIcon } from "lucide-react";
import type { DocSelection } from "@/lib/use-doc-selection";

function exec(command: string, value?: string) {
  document.execCommand(command, false, value);
}

export function FormatBubble({ selection }: { selection: DocSelection }) {
  const [pos, setPos] = React.useState<{ top: number; left: number } | null>(null);

  React.useLayoutEffect(() => {
    if (selection.kind !== "text") {
      setPos(null);
      return;
    }
    const place = () => {
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
      const half = 80;
      const left = Math.min(Math.max(rect.left + rect.width / 2, half + 8), window.innerWidth - half - 8);
      setPos({ top: Math.max(8, rect.top - 48), left });
    };
    place();
    // keep the bubble pinned to the range as the page scrolls or the window resizes
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
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
