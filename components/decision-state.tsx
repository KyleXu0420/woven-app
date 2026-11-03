import { AlertTriangle, CheckCircle2, CircleDashed, Clock3, History } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ActivationConditionSatisfaction, DecisionState, ProvState } from "@/lib/types";

export const DECISION_STATE_LABEL: Record<DecisionState, string> = {
  needs_approval: "Needs approval",
  // was "Approved · waiting for activation": the house prints no middle dot; the two facts join with a comma
  waiting_activation: "Approved, waiting for activation",
  in_effect: "In effect",
  needs_revalidation: "Needs revalidation",
  superseded: "Superseded",
};

const STATE_ICON = {
  needs_approval: CircleDashed,
  waiting_activation: Clock3,
  in_effect: CheckCircle2,
  needs_revalidation: AlertTriangle,
  superseded: History,
} satisfies Record<DecisionState, typeof CircleDashed>;

export function DecisionStateLabel({ state, className }: { state: DecisionState; className?: string }) {
  const Icon = STATE_ICON[state];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium",
        state === "in_effect"
          ? "text-primary"
          : state === "needs_revalidation"
            ? "text-warn"
            : "text-muted-foreground",
        className,
      )}
    >
      <Icon className="size-3.5" />
      {DECISION_STATE_LABEL[state]}
    </span>
  );
}

// The words the Decision page and the review brief both print about an activation observation, kept in one
// place so the two surfaces cannot drift. They were written twice as "Candidate · not confirmed" and
// "Requirement match · satisfied" — a middle dot standing in for a sentence, and a status-field label read
// aloud. Each is now a short clause a reader would say.
export function activationTrustLabel(prov: ProvState, authority?: string, proofUnavailable = false): string {
  if (prov === "human_verified") {
    const who = authority ?? "the authority";
    return proofUnavailable ? `Confirmed by ${who}, proof unavailable` : `Confirmed by ${who}`;
  }
  if (prov === "user_created") return proofUnavailable ? "Added by hand, proof unavailable" : "Added by hand";
  return proofUnavailable ? "Candidate, proof unavailable" : "Candidate, not yet confirmed";
}

// "unverified" is the page's own fifth case: the observation exists but its exact proof is out of reach.
export const ACTIVATION_MATCH: Record<ActivationConditionSatisfaction | "unverified", string> = {
  satisfied: "Matches the requirement",
  partial: "Partly matches the requirement",
  contradicted: "Conflicts with the requirement",
  unknown: "Not enough proof to check the requirement",
  unverified: "Can't be checked without the proof",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad = (n: number) => String(n).padStart(2, "0");

// An observation's time was printed as the raw ISO string ("2026-08-10T18:00:00Z"). Read in UTC, by hand
// rather than through Intl, so the server render and the browser render produce the same characters.
export function observedAtLabel(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T/.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}, ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())} UTC`;
}
