// The trust valve (P-4). One shared treatment for everything the agent has *proposed* and
// that is still pending a human's verify — the Inbox queue, the in-body edit bars, the
// artifact's structure rail. Two ideas:
//   • provisional → a SOLID forest hairline + faint tint-forest wash on a card (a dashed border on a
//     card reads like a dropzone); the graph renders the same "not yet committed" signal as a dashed
//     edge. It says "not yet committed." On confirm it drops.
//   • the valve → ONE primary Confirm + a quiet ghost Dismiss. Never two equal buttons. The agent's
//     *reason* is the primary, human-readable trust signal; confidence, when shown, is a WORD (Likely /
//     Unsure, silent when high; components/confidence.tsx), a triage aid that feeds the learning loop,
//     never a percentage shouting for attention. It was a 3-bar meter, a phone's signal glyph, until the
//     2026-09-12 panel; the meter and its ConfidenceTag alias are gone.

import { Check, X } from "lucide-react";
import { Button } from "./ui/button";
import { IconButton } from "./ui/icon-button";

// A faint tint-forest wash behind a soft hairline — the provisional (pending-verify) surface.
// The wash is the signal ("the agent touched this, not yet committed"); on a graph *edge* the same
// state is a dashed stroke, but on a card a dashed border just reads like a dropzone, so we don't.
// Written as the named pair the alpha-ink family cut from these exact values (wash 4%, line-wash 15%); it was
// the two literals, the hand-written alphas the family exists to retire.
export const provisional = "rounded-xl border border-line-wash bg-wash";

// ProposalMeta ("agent · proposed": the agent's 20px seal as a bullet, a middle dot in its default label, and
// two literal type sizes) had no caller left and is removed rather than fixed: the agent is credited once per
// surface by its byline, so a per-proposal seal-and-eyebrow is the pattern the house retired (2026-10-02).

// The commit valve — a ✓ Confirm and its neighbouring ✕ Dismiss, BOTH icon-only + tooltip (the
// tick/cancel rule: a checkmark action and the cancel beside it never carry a text label; the word
// moves to hover). Weight still reads as unequal — Confirm is the WASH mark (the confirm variant: forest
// alpha body, forest hairline, forest tick), Dismiss a quiet ghost — so the recommended path stays obvious
// while the proposal's own content owns the row. A solid forest disc per row was the loudest object in a
// list of them, and down a list a confirm takes the wash rung (the forest-action-weight rule).
export function Valve({
  onConfirm,
  onDismiss,
  confirmLabel = "Confirm",
  dismissLabel = "Dismiss",
  primary = true,
  size = "icon-sm",
  className = "",
}: {
  onConfirm?: () => void;
  onDismiss?: () => void;
  confirmLabel?: string;
  dismissLabel?: string;
  primary?: boolean;
  size?: "icon-xs" | "icon-sm";
  className?: string;
}) {
  return (
    <div className={`flex shrink-0 items-center gap-1 ${className}`}>
      <IconButton label={confirmLabel} size={size} variant={primary ? "confirm" : "outline"} onClick={onConfirm}>
        <Check />
      </IconButton>
      <IconButton
        label={dismissLabel}
        size={size}
        variant="ghost"
        onClick={onDismiss}
        className="text-muted-foreground"
      >
        <X />
      </IconButton>
    </div>
  );
}

// A multi-choice valve — for proposals with more than confirm/dismiss (a capture review: merge / keep
// both / replace, an approval beside its packet). The first action is the primary (the confirm variant, so it
// takes that variant's dark rung too); the rest are quiet outlines, so the recommended path still reads as one
// intent. Left-aligned — it lives in the row's footer action block, not squeezed against the right edge of
// the content row. A binary Confirm / Dismiss is never this: that is the Valve above.
export function ChoiceValve({
  actions,
  onChoose,
}: {
  actions: { id: string; label: string; primary?: boolean; ariaExpanded?: boolean; ariaControls?: string }[];
  onChoose: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {actions.map((a) => (
        <Button
          key={a.id}
          size="sm"
          onClick={() => onChoose(a.id)}
          aria-expanded={a.ariaExpanded}
          aria-controls={a.ariaControls}
          variant={a.primary ? "confirm" : "outline"}
          className={a.primary ? undefined : "text-muted-foreground hover:text-foreground"}
        >
          {a.label}
        </Button>
      ))}
    </div>
  );
}

// Confidence at rest is a WORD (ConfidenceWord, components/confidence.tsx; settled 2026-09-12). The alias
// that re-exported it here as ConfidenceTag kept the meter's name alive after the meter was gone; its one
// caller (the Inbox queue) now imports the word by its own name, so the alias is removed.
