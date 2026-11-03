"use client";

import * as React from "react";
import { AlertTriangle, Check, FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
// From capture-flow, the provider the app layout mounts. It imported the OLD components/capture.tsx, whose
// provider nothing mounts any more, so useCapture() returned that module's default no-op and "Capture
// evidence first" closed this dialog and opened nothing.
import { useCapture } from "@/components/capture-flow";
import { HashChip } from "@/components/exact-evidence-snapshot";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  activationConditionSatisfaction,
  activationEvidenceKindForObservation,
  activationSourceSupportsObservation,
} from "@/lib/activation";
import { normalizeHttpUrl } from "@/lib/capture-ingest";
import {
  artifactVersionById,
  exactEvidenceRefForArtifact,
  listArtifacts,
  recordActivationEvidence,
  sourceById,
} from "@/lib/api";
import type {
  ActivationAssertionOperator,
  ActivationConditionSatisfaction,
  ActivationEvidence,
  ActivationEnvironment,
  ActivationObservationType,
  ActivationRevision,
  Decision,
} from "@/lib/types";
import { upperFirst } from "@/lib/text";
import { cn } from "@/lib/utils";

const OBSERVATION_OPTIONS: Array<{ value: ActivationObservationType; label: string }> = [
  { value: "code_change", label: "Code change" },
  { value: "deployment_receipt", label: "Deployment receipt" },
  { value: "effective_config", label: "Effective configuration" },
  { value: "product_state", label: "Observed product state" },
  { value: "publication", label: "Publication" },
  { value: "policy_state", label: "Policy state" },
  { value: "customer_communication", label: "Customer communication" },
];

const ASSERTION_OPTIONS: Array<{ value: ActivationAssertionOperator; label: string }> = [
  { value: "eq", label: "Equals" },
  { value: "contains", label: "Contains" },
  { value: "exists", label: "Exists" },
  { value: "passes", label: "Passes" },
];

type RevisionField = "commit_sha" | "deployment_id" | "config_revision" | "artifact_digest";

const REVISION_OPTIONS: Array<{ value: RevisionField; label: string }> = [
  { value: "commit_sha", label: "Commit SHA" },
  { value: "deployment_id", label: "Deployment ID" },
  { value: "config_revision", label: "Config revision" },
  { value: "artifact_digest", label: "Artifact digest" },
];

const SATISFACTION_COPY: Record<ActivationConditionSatisfaction, { label: string; detail: string; className: string }> = {
  satisfied: {
    label: "Matches the activation requirement",
    detail: "This can become a confirmation candidate. It does not mark the decision active.",
    // a candidate is provisional, so it wears the provisional surface (wash + line-wash), not a hand-written
    // forest alpha (border-primary/20 bg-primary/[0.05])
    className: "border-line-wash bg-wash text-primary",
  },
  partial: {
    label: "Partially matches the requirement",
    detail: "Keep it as candidate evidence, then add a proof that closes the remaining requirement.",
    className: "border-warn/25 bg-warn/[0.05] text-warn",
  },
  contradicted: {
    label: "Conflicts with the requirement",
    detail: "The structured observation does not match the required target, environment, or assertion.",
    className: "border-destructive/25 bg-destructive/[0.05] text-destructive",
  },
  unknown: {
    label: "Not enough structured proof yet",
    detail: "Complete the observation, exact evidence, assertion, and revision fields to evaluate the match.",
    className: "border-border bg-tint-1 text-muted-foreground",
  },
};

const fieldClass =
  "mt-1.5 h-10 w-full min-w-0 rounded-lg border bg-background px-3 text-sm outline-none transition focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-focus disabled:opacity-60";

function defaultObservation(decision: Decision): ActivationObservationType {
  switch (decision.activation_requirement?.kind) {
    case "merge": return "code_change";
    case "deployment": return "deployment_receipt";
    case "publication": return "publication";
    case "policy_change": return "policy_state";
    case "customer_communication": return "customer_communication";
    default: return "product_state";
  }
}

function defaultRevision(decision: Decision): RevisionField {
  if (decision.activation_requirement?.kind === "policy_change") return "config_revision";
  if (decision.activation_requirement?.kind === "publication") return "artifact_digest";
  return "commit_sha";
}

function localDateTime(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function normalizedObservedAt(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

function locatorFields(value: string): { externalId?: string; href?: string } {
  const trimmed = value.trim();
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) {
    const href = normalizeHttpUrl(trimmed);
    return href ? { href } : {};
  }
  return trimmed ? { externalId: trimmed } : {};
}

function sourceCaptureMode(sourceKind?: string): ActivationEvidence["capture_mode"] {
  if (sourceKind === "github") return "connector";
  if (sourceKind === "file" || sourceKind === "doc" || sourceKind === "audit") return "manual_upload";
  return "manual_paste";
}

function sourceCanSubstantiate(
  source: ReturnType<typeof sourceById> | undefined,
  evidenceKind: ActivationEvidence["kind"],
  observationType: ActivationObservationType,
): boolean {
  if (!activationSourceSupportsObservation(source?.kind, evidenceKind, observationType)) return false;
  if (source?.kind !== "github") return true;
  return Boolean(
    evidenceKind === "merge" &&
    observationType === "code_change" &&
    source.github_fact?.kind === "pull_request" &&
    source.github_fact.merged_at &&
    source.github_fact.merge_commit_sha,
  );
}

// `capitalize` at the call sites made this title case ("Not Applicable"); sentence case is done here.
function readable(value?: string): string {
  return value ? upperFirst(value.replaceAll("_", " ")) : "Not specified";
}

// "Capture mode · manual paste" read a field name aloud; the line now says how the evidence arrived.
const CAPTURE_MODE: Record<NonNullable<ActivationEvidence["capture_mode"]>, string> = {
  connector: "Captured through a connector",
  manual_url: "Captured from a link",
  manual_upload: "Uploaded by hand",
  manual_paste: "Pasted by hand",
};

function githubRevision(externalId?: string): { repo: string; sha: string } | undefined {
  if (!externalId) return undefined;
  const separator = externalId.lastIndexOf("@");
  if (separator < 1) return undefined;
  const sha = externalId.slice(separator + 1).toLowerCase();
  const repo = externalId.slice(0, separator).replace(/#\d+$/, "");
  if (!repo.includes("/") || !/^[0-9a-f]{40}$/.test(sha)) return undefined;
  return { repo, sha };
}

export function ActivationObservationDialog({
  decision,
  open,
  onOpenChange,
  onRecorded,
}: {
  decision: Decision;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRecorded: (evidence: ActivationEvidence) => void;
}) {
  const openCapture = useCapture();
  const requirement = decision.activation_requirement;
  const exactOptions = React.useMemo(
    () => listArtifacts().flatMap((artifact) => {
      const ref = exactEvidenceRefForArtifact(artifact.id);
      if (!ref) return [];
      const source = ref.source_id ? sourceById(ref.source_id) : undefined;
      const version = artifactVersionById(ref.artifact_id, ref.version_id);
      if (source?.capture_state !== "snapshotted" || !version?.content_hash || !version.snapshot) return [];
      return [{ artifact, ref, source, version }];
    }),
    [],
  );
  const [observationType, setObservationType] = React.useState<ActivationObservationType>(() => defaultObservation(decision));
  const [system, setSystem] = React.useState("");
  const [locator, setLocator] = React.useState("");
  const [observedTarget, setObservedTarget] = React.useState("");
  const [observedEnvironment, setObservedEnvironment] = React.useState<ActivationEnvironment | "">("");
  const [evidenceRefId, setEvidenceRefId] = React.useState("");
  const [observedAt, setObservedAt] = React.useState(localDateTime);
  const [assertionSubject, setAssertionSubject] = React.useState("");
  const [assertionOperator, setAssertionOperator] = React.useState<ActivationAssertionOperator>("passes");
  const [assertionExpected, setAssertionExpected] = React.useState("");
  const [assertionActual, setAssertionActual] = React.useState("");
  const [revisionField, setRevisionField] = React.useState<RevisionField>(() => defaultRevision(decision));
  const [revisionValue, setRevisionValue] = React.useState("");
  const [repo, setRepo] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const selected = exactOptions.find((option) => option.ref.id === evidenceRefId);
  const evidenceKind = activationEvidenceKindForObservation(observationType, requirement?.kind);
  const compatibleOptionCount = exactOptions.filter((option) =>
    sourceCanSubstantiate(option.source, evidenceKind, observationType),
  ).length;
  const sourceCompatible = sourceCanSubstantiate(
    selected?.source,
    evidenceKind,
    observationType,
  );
  const captureMode = sourceCaptureMode(selected?.source?.kind);
  const assertion = {
    subject: assertionSubject.trim(),
    operator: assertionOperator,
    expected: assertionExpected.trim(),
    actual: assertionActual.trim(),
  };
  const revision: ActivationRevision | undefined = revisionValue.trim()
    ? { [revisionField]: revisionValue.trim(), ...(repo.trim() ? { repo: repo.trim() } : {}) }
    : undefined;
  const locatorData = locatorFields(locator);
  const locatorLooksLikeUrl = /^[a-z][a-z0-9+.-]*:\/\//i.test(locator.trim());
  const locatorValid = !locatorLooksLikeUrl || Boolean(locatorData.href);
  const preview: ActivationEvidence | undefined = requirement
    ? {
        id: "activation-preview",
        decision_id: decision.id,
        kind: evidenceKind,
        label: `${system.trim() || "Downstream system"}, ${readable(observationType).toLowerCase()}`,
        system: system.trim(),
        ...locatorData,
        at: "now",
        recorded_by: "agent",
        prov: "ai_generated",
        target: observedTarget.trim() || undefined,
        environment: observedEnvironment || undefined,
        evidence_ref_id: selected?.ref.id,
        observation_type: observationType,
        observed_at: observedAt ? normalizedObservedAt(observedAt) : undefined,
        assertion,
        revision,
        capture_mode: captureMode,
      }
    : undefined;
  const structuralSatisfaction = preview ? activationConditionSatisfaction(decision, preview) : "unknown";
  const satisfaction: ActivationConditionSatisfaction = selected && !sourceCompatible
    ? "partial"
    : structuralSatisfaction;
  const status = SATISFACTION_COPY[satisfaction];
  const expectedRequired = assertionOperator === "eq" || assertionOperator === "contains";
  const complete = Boolean(
    requirement &&
    system.trim() &&
    locator.trim() &&
    locatorValid &&
    observedTarget.trim() &&
    observedEnvironment &&
    selected &&
    sourceCompatible &&
    observedAt &&
    assertionSubject.trim() &&
    assertionActual.trim() &&
    (!expectedRequired || assertionExpected.trim()) &&
    revisionValue.trim(),
  );

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!complete || !requirement || !selected || !preview) {
      setError(locatorLooksLikeUrl && !locatorValid
        ? "Use an HTTP(S) URL without embedded credentials, or enter a stable external ID."
        : "Complete every required observation field and choose exact captured evidence.");
      return;
    }
    const recorded = recordActivationEvidence({
      decisionId: decision.id,
      kind: evidenceKind,
      label: preview.label,
      system: preview.system,
      externalId: preview.external_id,
      href: preview.href,
      target: observedTarget.trim(),
      environment: observedEnvironment || undefined,
      conditionNote: status.label,
      evidenceRefId: selected.ref.id,
      observationType,
      observedAt: normalizedObservedAt(observedAt),
      assertion,
      revision,
      captureMode,
    });
    if (!recorded) {
      setError("Woven could not save this candidate. Confirm the decision is still waiting for activation and the evidence is an exact snapshot.");
      return;
    }
    onRecorded(recorded);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-1rem)] max-w-2xl overflow-y-auto p-4 sm:p-6">
        <form onSubmit={submit} className="grid min-w-0 gap-4">
          <DialogHeader className="pr-8">
            <DialogTitle>Add downstream proof</DialogTitle>
            <DialogDescription>
              Record an exact downstream observation as a candidate. An authority still has to confirm it before this decision becomes active.
            </DialogDescription>
          </DialogHeader>

          {/* One bordered box, not a tinted box holding three more filled boxes: the three facts are open
              columns inside it (minimize cards; the fills were bg-muted/25 and bg-background/70 alphas). */}
          <section className="rounded-xl border p-3.5" aria-labelledby="activation-contract-title">
            <h3 id="activation-contract-title" className="text-sm font-medium">Activation contract</h3>
            <p className="mt-1 text-sm text-foreground-prose">
              {decision.activation_condition ?? "No activation condition is defined."}
            </p>
            <dl className="mt-3 grid gap-3 text-xs sm:grid-cols-3">
              <div className="min-w-0">
                <dt className="text-muted-foreground">Kind</dt>
                <dd className="mt-0.5 truncate font-medium">{readable(requirement?.kind)}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-muted-foreground">Target</dt>
                <dd className="mt-0.5 break-words font-medium">{requirement?.target ?? "Not specified"}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-muted-foreground">Environment</dt>
                <dd className="mt-0.5 truncate font-medium">{readable(requirement?.environment)}</dd>
              </div>
            </dl>
            {!requirement ? (
              <p className="mt-3 flex items-start gap-2 text-xs text-destructive">
                <AlertTriangle className="mt-px size-3.5 shrink-0" /> A structured activation requirement is required before proof can be added.
              </p>
            ) : null}
          </section>

          <section className="grid min-w-0 gap-3" aria-labelledby="observation-title">
            <h3 id="observation-title" className="text-sm font-medium">Observed downstream</h3>
            <div className="grid min-w-0 gap-3 sm:grid-cols-2">
              <label className="min-w-0 text-sm font-medium">
                Observation type
                <select className={fieldClass} value={observationType} onChange={(event) => setObservationType(event.target.value as ActivationObservationType)}>
                  {OBSERVATION_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <label className="min-w-0 text-sm font-medium">
                Observed at
                <input className={fieldClass} type="datetime-local" required value={observedAt} onChange={(event) => setObservedAt(event.target.value)} />
              </label>
              <label className="min-w-0 text-sm font-medium">
                System
                <input className={fieldClass} required value={system} onChange={(event) => setSystem(event.target.value)} placeholder="Vercel, GitHub, LaunchDarkly…" />
              </label>
              <label className="min-w-0 text-sm font-medium">
                Stable ID or URL
                <input className={fieldClass} required value={locator} onChange={(event) => setLocator(event.target.value)} placeholder="deploy_123 or https://…" />
              </label>
              <label className="min-w-0 text-sm font-medium">
                Observed target key
                <input className={fieldClass} required value={observedTarget} onChange={(event) => setObservedTarget(event.target.value)} placeholder={requirement?.target ?? "service-or-policy-key"} />
              </label>
              <label className="min-w-0 text-sm font-medium">
                Actual environment
                <select className={fieldClass} required value={observedEnvironment} onChange={(event) => setObservedEnvironment(event.target.value as ActivationEnvironment | "")}>
                  <option value="">Choose environment…</option>
                  <option value="production">Production</option>
                  <option value="staging">Staging</option>
                  <option value="preview">Preview</option>
                  <option value="not_applicable">Not applicable</option>
                </select>
              </label>
            </div>
          </section>

          <section className="min-w-0 border-t pt-4" aria-labelledby="exact-proof-title">
            <h3 id="exact-proof-title" className="text-sm font-medium">Exact captured evidence</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Required. Reference-only links cannot substantiate an activation observation.
            </p>
            <select
              className={fieldClass}
              required
              value={evidenceRefId}
              onChange={(event) => {
                const nextId = event.target.value;
                setEvidenceRefId(nextId);
                const option = exactOptions.find((item) => item.ref.id === nextId);
                if (option?.source?.kind !== "github") return;
                const revision = githubRevision(option.source.external_id);
                setSystem((current) => current || "GitHub");
                setLocator((current) => current || option.source?.href || option.source?.external_id || "");
                if (revision) {
                  setRevisionField("commit_sha");
                  setRevisionValue(revision.sha);
                  setRepo(revision.repo);
                }
              }}
              aria-label="Exact captured evidence"
            >
              <option value="">Choose an exact snapshot…</option>
              {exactOptions.map(({ artifact, ref, source, version }) => {
                // a native option holds only text, so the hash is the same seven characters the chip shows
                const hash = version?.content_hash ? `, hash ${version.content_hash.slice(0, 7)}` : "";
                const sourceKind = source?.kind ? `, ${source.kind} source` : "";
                const compatible = sourceCanSubstantiate(source, evidenceKind, observationType);
                return <option key={ref.id} value={ref.id} disabled={!compatible}>{artifact.title}{sourceKind}, version {version?.label ?? ref.version_id}{hash}{compatible ? "" : " (not valid for this observation)"}</option>;
              })}
            </select>
            {selected ? (
              <div className="mt-2 flex min-w-0 items-start gap-2 rounded-lg border px-3 py-2.5 text-xs">
                <FileText className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="font-medium">{selected.artifact.title}</p>
                  {/* the source line every evidence row now prints: kind, name, version, and the hash as a chip */}
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-1 break-words text-muted-foreground">
                    <span>
                      {selected.source
                        ? `${upperFirst(selected.source.kind)} source${selected.source.label !== selected.artifact.title ? ` “${selected.source.label}”` : ""}`
                        : "Source metadata unavailable"}
                      {`, version ${selected.version?.label ?? selected.ref.version_id}`}
                      {selected.version?.content_hash ? ", hash" : ""}
                    </span>
                    {selected.version?.content_hash ? <HashChip value={selected.version.content_hash} /> : null}
                  </p>
                  <p className="mt-0.5 text-muted-foreground">{captureMode ? CAPTURE_MODE[captureMode] : "Capture method not recorded"}</p>
                  {!sourceCompatible ? (
                    <p className="mt-1 text-destructive">This source type cannot substantiate the selected observation.</p>
                  ) : null}
                </div>
              </div>
            ) : compatibleOptionCount === 0 ? (
              <div className="mt-2 flex flex-col items-start gap-2 rounded-lg border border-warn/25 bg-warn/[0.05] px-3 py-2.5 text-xs text-muted-foreground">
                <p>No captured snapshot can substantiate this observation. Capture the actual deployment, config, product-state, publication, policy, or communication output first.</p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    onOpenChange(false);
                    queueMicrotask(() => openCapture());
                  }}
                >
                  Capture evidence first
                </Button>
              </div>
            ) : null}
          </section>

          <section className="grid min-w-0 gap-3 border-t pt-4" aria-labelledby="assertion-title">
            <h3 id="assertion-title" className="text-sm font-medium">Assertion</h3>
            <div className="grid min-w-0 gap-3 sm:grid-cols-2">
              <label className="min-w-0 text-sm font-medium sm:col-span-2">
                Subject
                <input className={fieldClass} required value={assertionSubject} onChange={(event) => setAssertionSubject(event.target.value)} placeholder="notifications.max_push_per_day" />
              </label>
              <label className="min-w-0 text-sm font-medium">
                Check
                <select className={fieldClass} value={assertionOperator} onChange={(event) => setAssertionOperator(event.target.value as ActivationAssertionOperator)}>
                  {ASSERTION_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <label className="min-w-0 text-sm font-medium">
                Expected {expectedRequired ? "" : "(optional)"}
                <input className={fieldClass} required={expectedRequired} value={assertionExpected} onChange={(event) => setAssertionExpected(event.target.value)} placeholder={expectedRequired ? "2" : "Not used for this check"} />
              </label>
              <label className="min-w-0 text-sm font-medium sm:col-span-2">
                Observed value
                <input className={fieldClass} required value={assertionActual} onChange={(event) => setAssertionActual(event.target.value)} placeholder="passed, 2, enabled…" />
              </label>
            </div>
          </section>

          <section className="grid min-w-0 gap-3 border-t pt-4" aria-labelledby="revision-title">
            <h3 id="revision-title" className="text-sm font-medium">Observed revision</h3>
            <div className="grid min-w-0 gap-3 sm:grid-cols-2">
              <label className="min-w-0 text-sm font-medium">
                Revision type
                <select className={fieldClass} value={revisionField} onChange={(event) => setRevisionField(event.target.value as RevisionField)}>
                  {REVISION_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <label className="min-w-0 text-sm font-medium">
                Revision value
                <input className={fieldClass} required value={revisionValue} onChange={(event) => setRevisionValue(event.target.value)} placeholder="Immutable revision or digest" />
              </label>
              <label className="min-w-0 text-sm font-medium sm:col-span-2">
                Repository <span className="font-normal text-muted-foreground">(optional)</span>
                <input className={fieldClass} value={repo} onChange={(event) => setRepo(event.target.value)} placeholder="org/repo" />
              </label>
            </div>
          </section>

          <div className={cn("rounded-lg border px-3 py-2.5 text-sm", status.className)} aria-live="polite">
            <p className="flex items-start gap-2 font-medium">
              {satisfaction === "satisfied" ? <Check className="mt-0.5 size-4 shrink-0" /> : <AlertTriangle className="mt-0.5 size-4 shrink-0" />}
              {status.label}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{status.detail}</p>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <DialogFooter>
            <DialogClose render={<Button variant="ghost" className="w-full sm:w-auto">Cancel</Button>} />
            <Button type="submit" className="w-full sm:w-auto" disabled={!complete}>
              Add proof candidate
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
