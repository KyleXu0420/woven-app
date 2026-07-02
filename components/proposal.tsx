// The trust valve (P-4). One shared treatment for everything the agent has *proposed* and
// that is still pending a human's verify — the Inbox queue, the in-body edit bars, the
// artifact's structure rail. Two ideas:
//   • provisional → the dashed forest hairline + faint tint-forest wash, the SAME signal as
//     the graph's dashed ai_generated edges. It says "not yet committed." On confirm it drops.
//   • the valve → ONE primary Confirm + a quiet ghost Dismiss. Never two equal buttons; never a
//     confidence percentage. The agent's *reason* (mono) is the trust signal, not a number.

import { Check, X } from "lucide-react";
import { AgentAvatar } from "./identity";
import { Button } from "./ui/button";
import { IconButton } from "./ui/icon-button";

// A faint tint-forest wash behind a soft hairline — the provisional (pending-verify) surface.
// The wash is the signal ("the agent touched this, not yet committed"); on a graph *edge* the same
// state is a dashed stroke, but on a card a dashed border just reads like a dropzone, so we don't.
export const provisional =
  "rounded-xl border border-primary/15 bg-primary/[0.04]";

// "agent · proposed" — the agent's face + its mono voice + an optional plain-language reason.
// The rationale is what the agent saw; it stands in for a meaningless confidence %.
export function ProposalMeta({
  rationale,
  label = "agent · proposed",
  className = "",
}: {
  rationale?: string;
  label?: string;
  className?: string;
}) {
  return (
    <div className={`flex items-start gap-2 ${className}`}>
      <AgentAvatar size="xs" className="mt-px" />
      <div className="min-w-0">
        <p className="font-mono text-[11px] leading-tight text-primary">{label}</p>
        {rationale ? (
          <p className="mt-1 text-[12px] leading-snug text-muted-foreground">{rationale}</p>
        ) : null}
      </div>
    </div>
  );
}

// The commit valve — a ✓ Confirm and its neighbouring ✕ Dismiss, BOTH icon-only + tooltip (the
// tick/cancel rule: a checkmark action and the cancel beside it never carry a text label; the word
// moves to hover). Weight still reads as unequal — Confirm is the filled/primary mark, Dismiss a quiet
// ghost — so the recommended path stays obvious while the proposal's own content owns the row.
export function Valve({
  onConfirm,
  onDismiss,
  confirmLabel = "Confirm",
  dismissLabel = "Dismiss",
  primary = true,
  className = "",
}: {
  onConfirm?: () => void;
  onDismiss?: () => void;
  confirmLabel?: string;
  dismissLabel?: string;
  primary?: boolean;
  className?: string;
}) {
  return (
    <div className={`flex shrink-0 items-center gap-1 ${className}`}>
      <IconButton label={confirmLabel} size="icon-sm" variant={primary ? "default" : "outline"} onClick={onConfirm}>
        <Check />
      </IconButton>
      <IconButton
        label={dismissLabel}
        size="icon-sm"
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
// both / replace, etc.). The first action is the primary (filled); the rest are quiet outlines, so the
// recommended path still reads as one intent.
export function ChoiceValve({
  actions,
  onChoose,
}: {
  actions: { id: string; label: string; primary?: boolean }[];
  onChoose: (id: string) => void;
}) {
  return (
    <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
      {actions.map((a) => (
        <Button
          key={a.id}
          size="sm"
          variant={a.primary ? "default" : "outline"}
          onClick={() => onChoose(a.id)}
        >
          {a.label}
        </Button>
      ))}
    </div>
  );
}
