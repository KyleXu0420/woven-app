import * as React from "react";

// The selection-aware editor reads the live browser selection over the *static* rendered document
// (no contenteditable, no editor library) and classifies it, so the chat bar can offer scoped tools.
//   text  — a non-empty range of prose was selected (drag-select)
//   image — a figure (data-image-id) is focused/clicked
//   block — the caret sits inside a section but nothing is selected (a click in a paragraph)
//   none  — nothing in the doc has focus → the action set is document-level
export type SelKind = "text" | "image" | "block" | "none";

export type DocSelection = {
  kind: SelKind;
  text: string;
  blockId: string | null;
  imageId: string | null;
};

const EMPTY: DocSelection = { kind: "none", text: "", blockId: null, imageId: null };

function closestAttr(node: Node | null, attr: string): HTMLElement | null {
  const el = node && node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as HTMLElement | null);
  return el?.closest(`[${attr}]`) ?? null;
}

// Track the live selection inside `ref`. Disabled (returns none) unless `enabled` — so READ mode pays nothing.
export function useDocSelection(
  ref: React.RefObject<HTMLElement | null>,
  enabled: boolean,
): DocSelection {
  const [sel, setSel] = React.useState<DocSelection>(EMPTY);

  React.useEffect(() => {
    if (!enabled) {
      setSel(EMPTY);
      return;
    }
    const root = ref.current;
    if (!root) return;

    function compute() {
      const r = ref.current;
      if (!r) return;
      // 1) image focused?
      const active = document.activeElement as HTMLElement | null;
      if (active && r.contains(active)) {
        const fig = active.closest("[data-image-id]") as HTMLElement | null;
        if (fig) {
          setSel({
            kind: "image",
            text: "",
            blockId: fig.closest("[data-block-id]")?.getAttribute("data-block-id") ?? null,
            imageId: fig.getAttribute("data-image-id"),
          });
          return;
        }
      }

      const s = window.getSelection();
      if (s && s.rangeCount > 0) {
        const range = s.getRangeAt(0);
        const inDoc = r.contains(range.commonAncestorContainer);
        if (inDoc) {
          const text = s.toString().trim();
          // 2) text selected
          if (!s.isCollapsed && text) {
            setSel({
              kind: "text",
              text,
              blockId: closestAttr(range.commonAncestorContainer, "data-block-id")?.getAttribute("data-block-id") ?? null,
              imageId: null,
            });
            return;
          }
          // 3) collapsed caret inside a block
          const block = closestAttr(s.anchorNode, "data-block-id");
          if (block) {
            setSel({ kind: "block", text: "", blockId: block.getAttribute("data-block-id"), imageId: null });
            return;
          }
        }
      }
      // 4) nothing in the doc → document-level
      setSel(EMPTY);
    }

    document.addEventListener("selectionchange", compute);
    root.addEventListener("mouseup", compute);
    root.addEventListener("keyup", compute);
    root.addEventListener("focusin", compute);
    return () => {
      document.removeEventListener("selectionchange", compute);
      root.removeEventListener("mouseup", compute);
      root.removeEventListener("keyup", compute);
      root.removeEventListener("focusin", compute);
    };
  }, [ref, enabled]);

  return sel;
}

// group === "graph" marks an action that mines the prose into the knowledge graph (a proposed edge that
// lands in Verify), as opposed to a prose transform that lands as an inline diff. The bar renders the two
// as distinct families so you can see, before clicking, where the result goes.
// `ask` = an analysis action that answers in the thread (Summarize / Find gaps / …) rather than editing the
// doc; `group: "graph"` mines the prose into the knowledge graph. Everything else is an edit instruction.
export type SelAction = { id: string; label: string; group?: "graph"; ask?: boolean };

// the contextual tool set above the chat — adapts to what's selected (the heart of the chatdoc).
export function selectionActions(kind: SelKind): SelAction[] {
  switch (kind) {
    case "text":
      return [
        { id: "rewrite", label: "Rewrite" },
        { id: "tighten", label: "Tighten" },
        { id: "tone", label: "Change tone" },
        { id: "expand", label: "Expand" },
        { id: "list", label: "To list" },
        { id: "decision", label: "Extract decision", group: "graph" },
        { id: "cite", label: "Cite source", group: "graph" },
      ];
    case "image":
      return [
        { id: "replace", label: "Replace" },
        { id: "enlarge", label: "Enlarge" },
        { id: "caption", label: "Caption" },
        { id: "alt", label: "Alt text" },
      ];
    case "block":
      return [
        { id: "tighten", label: "Tighten" },
        { id: "continue", label: "Continue writing" },
        { id: "subsection", label: "Add subsection" },
      ];
    default:
      return [
        { id: "section", label: "Add a section" },
        { id: "summarize", label: "Summarize", ask: true },
        { id: "gaps", label: "Find gaps", ask: true },
        { id: "check", label: "Check vs. sources", ask: true },
      ];
  }
}
