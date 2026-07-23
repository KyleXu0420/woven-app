// The trust valve (P-4). One shared treatment for everything the agent has *proposed* and
// that is still pending a human's verify — the Inbox queue, the in-body edit bars, the
// artifact's structure rail. Two ideas:
//   • provisional → a SOLID forest hairline + faint tint-forest wash on a card (a dashed border on a
//     card reads like a dropzone); the graph renders the same "not yet committed" signal as a dashed
//     edge. It says "not yet committed." On confirm it drops.
//   • the valve → ONE primary Confirm + a quiet ghost Dismiss. Never two equal buttons. The agent's
//     *reason* is the primary, human-readable trust signal; confidence, when shown, rides as a CALM
//     3-bar meter (ConfidenceTag — no bare number, exact % on hover), a triage aid that feeds the
//     learning loop, never a percentage shouting for attention.

import { Check, X } from "lucide-react";
import { AgentAvatar } from "./identity";
import { Button } from "./ui/button";
import { IconButton } from "./ui/icon-button";
import { Popover, PopoverTrigger, PopoverContent } from "./ui/popover";

// A faint tint-forest wash behind a soft hairline — the provisional (pending-verify) surface.
// The wash is the signal ("the agent touched this, not yet committed"); on a graph *edge* the same
// state is a dashed stroke, but on a card a dashed border just reads like a dropzone, so we don't.
export const provisional =
  "rounded-xl border border-primary/15 bg-primary/[0.04]";

// "agent · proposed" — the agent's face + an attribution EYEBROW + an optional plain-language reason.
// The eyebrow is a role/state label, not the agent's voice, so it is Geist like any other label (mono is
// reserved for the agent's own utterance, code, paths and verbatim values); identity is carried by the
// AgentAvatar + the forest tint. The rationale is what the agent saw; it stands in for a confidence %.
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
        <p className="text-[12px] leading-tight text-primary">{label}</p>
        {rationale ? (
          <p className="mt-1 text-[13px] leading-snug text-muted-foreground">{rationale}</p>
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
      <IconButton label={confirmLabel} size={size} variant={primary ? "default" : "outline"} onClick={onConfirm}>
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
// both / replace, etc.). The first action is the primary (filled); the rest are quiet outlines, so the
// recommended path still reads as one intent. Left-aligned — it lives in a card's footer action block,
// not squeezed against the right edge of the content row.
export function ChoiceValve({
  actions,
  onChoose,
}: {
  actions: { id: string; label: string; primary?: boolean }[];
  onChoose: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {actions.map((a) => (
        <Button
          key={a.id}
          size="sm"
          variant="outline"
          onClick={() => onChoose(a.id)}
          className={
            a.primary
              ? "border-primary/40 bg-primary/[0.06] text-primary hover:bg-primary/[0.1] hover:text-primary"
              : "text-muted-foreground hover:text-foreground"
          }
        >
          {a.label}
        </Button>
      ))}
    </div>
  );
}

// How sure Woven is about a proposal — a calm 3-bar meter (no colour; exact % on hover). Lets you triage
// fast: clear the confident ones at a glance, slow down on the uncertain. Shared by the Inbox queue and the
// Team verify modal; it's also the axis the "learn from you" loop reasons over. Honours the P-4 "no loud
// percentage" rule by keeping the figure to hover — the meter is the calm at-rest signal.
export function ConfidenceTag({ value }: { value: number }) {
  const level = value >= 0.8 ? 3 : value >= 0.6 ? 2 : 1;
  const label = value >= 0.8 ? "High confidence" : value >= 0.6 ? "Likely" : "Less certain";
  const meaning =
    value >= 0.8
      ? "Woven is very sure — safe to confirm at a glance."
      : value >= 0.6
        ? "Fairly sure — a quick look is worth it."
        : "Woven isn't certain — worth a closer read before you confirm.";
  return (
    <Popover>
      <PopoverTrigger
        nativeButton={false}
        openOnHover
        delay={120}
        render={
          <span className="flex shrink-0 cursor-help items-center gap-[3px] outline-none" aria-label={label}>
            {[0, 1, 2].map((i) => (
              <span key={i} className={`h-2.5 w-[3px] rounded-full ${i < level ? "bg-foreground/45" : "bg-foreground/15"}`} />
            ))}
          </span>
        }
      />
      <PopoverContent side="top" align="end" sideOffset={8} className="w-60 p-3">
        <p className="flex items-center gap-2 text-[13px] font-medium">
          <span className="flex items-center gap-[3px]">
            {[0, 1, 2].map((i) => (
              <span key={i} className={`h-2.5 w-[3px] rounded-full ${i < level ? "bg-primary" : "bg-foreground/15"}`} />
            ))}
          </span>
          {label}
          <span className="ml-auto text-[12px] tabular-nums text-muted-foreground">
            {Math.round(value * 100)}%
          </span>
        </p>
        <p className="mt-1.5 text-[12.5px] leading-snug text-muted-foreground">{meaning}</p>
      </PopoverContent>
    </Popover>
  );
}
