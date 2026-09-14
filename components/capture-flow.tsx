"use client";

// The capture flow — the Capture row in the rail and everything after it. Line B's home for the
// redesign (2026-09-14): a copy of components/capture.tsx taken so the flow could be rebuilt without
// touching line A's file. The app shell and the rail import from here; activation-observation-dialog
// still imports the old module and gets its no-op default until line A swaps the import (one line)
// and deletes capture.tsx.
//
// Settled by Kyle after an eight-round blind judge loop (boards and verdicts in
// claude-woven-visual-review-2026-08-14/capture-2026-09-14/): the sheet is round 1's — one field that
// infers what it was given, open rows on hairlines, a footer only once there is a row — and the way in
// is round 8's named row in the rail. The in-rail composer rounds 3–8 built (the row becoming the
// field, the queue as rail rows) was dropped: in a 224px rail a title truncates at twelve characters
// and the queue shoves the nav, which is what the judge kept scoring.
//
// Round 1 (judge 5.5, hinge "the sheet explains itself four times and stacks two dashed containers").
// The sheet was a form assembled from templates: title, a description, a four-way chooser, a dashed
// drop-zone, a divider, a queue header with "0 items", a dashed empty box, a footer with a disabled
// pill — seven zones, and the user had to pick a KIND before doing anything. It is now one field that
// infers the kind from what lands in it (a file, an http link, a Loom share, a GitHub PR or commit),
// a list of open rows on hairlines beneath it, and a footer that does not exist until there is
// something to capture. The snapshot-vs-reference fact, stated four times before, is one muted word
// on each row.

import * as React from "react";
import Link from "next/link";
import { Paperclip, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { DIVIDED_FLUSH, FOCUS_RING } from "@/components/classes";
import { ROW_REVEAL } from "@/components/today-ui";
import { artifactVersions, ingestEvidenceBundle } from "@/lib/api";
import {
  assertCaptureSize,
  captureFormatForName,
  decodeUtf8Snapshot,
  MAX_CAPTURE_BYTES,
  normalizeHttpUrl,
  parseLoomUrl,
  type CaptureFormat,
} from "@/lib/capture-ingest";
import {
  parseGitHubCommitUrl,
  parseGitHubPullRequestUrl,
  type GitHubCommitSnapshot,
  type GitHubPullRequestSnapshot,
} from "@/lib/github-ingest";
import type { CaptureBatchResult, CaptureInput } from "@/lib/types";
import { cn } from "@/lib/utils";

type CaptureStep = "queue" | "capturing" | "done" | "failed";

type FileItem = {
  id: string;
  kind: "file";
  title: string;
  file: File;
  format: CaptureFormat;
};

type LinkItem = {
  id: string;
  kind: "link";
  title: string;
  href: string;
};

type LoomItem = {
  id: string;
  kind: "loom";
  title: string;
  href: string;
  externalId: string;
  transcript: string;
  timecodeSeconds?: number;
};

type GitHubItem = {
  id: string;
  kind: "github";
  title: string;
  href: string;
  raw: string;
} & (
  | { githubKind: "pull_request"; snapshot: GitHubPullRequestSnapshot }
  | { githubKind: "commit"; snapshot: GitHubCommitSnapshot }
);

type CaptureItem = FileItem | LinkItem | LoomItem | GitHubItem;

const CaptureCtx = React.createContext<(files?: File[], dest?: string) => void>(() => {});
export const useCapture = () => React.useContext(CaptureCtx);

const ACCEPTED_FILE_EXTENSION = /\.(?:html?|svg|md|markdown|txt)$/i;
const FILE_ACCEPT = ".html,.htm,.svg,.md,.markdown,.txt,text/html,image/svg+xml,text/markdown,text/plain";
// The format list is said ONCE, and only when a file has been refused. It was printed under the
// drop-zone before anyone had dropped anything, with a middle dot in it.
const FILE_RULE = "HTML, SVG, Markdown or text, up to 512 KB each.";

function clientId(prefix: string): string {
  const random = globalThis.crypto?.randomUUID?.();
  return `${prefix}_${random ?? `${Date.now()}_${Math.random().toString(36).slice(2)}`}`;
}

function fileTitle(name: string): string {
  const title = name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
  return title || name;
}

function linkTitle(href: string): string {
  const url = new URL(href);
  const segment = url.pathname.split("/").filter(Boolean).at(-1);
  if (!segment) return url.hostname.replace(/^www\./, "");
  try {
    return decodeURIComponent(segment).replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").slice(0, 80);
  } catch {
    return segment.replace(/[-_]+/g, " ").slice(0, 80);
  }
}

function hostOf(href: string): string {
  return new URL(href).hostname.replace(/^www\./, "");
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function parseTimecode(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parts = trimmed.split(":");
  if (parts.length > 3 || parts.some((part) => !/^\d+$/.test(part))) return undefined;
  const numbers = parts.map(Number);
  if (parts.length > 1 && numbers.slice(1).some((part) => part > 59)) return undefined;
  return numbers.reduce((total, part) => total * 60 + part, 0);
}

function formatTimecode(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  if (hours) return `${hours}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

// Size is checked HERE, at the door, not at capture time: an oversize file used to sail into the
// queue and fail the whole batch with a byte count in the failed step.
function queuedFiles(files: File[]): { items: FileItem[]; warning: string | null } {
  const accepted: FileItem[] = [];
  let rejected = 0;

  for (const file of files) {
    const format = ACCEPTED_FILE_EXTENSION.test(file.name) ? captureFormatForName(file.name) : null;
    if (!format || file.size > MAX_CAPTURE_BYTES) {
      rejected += 1;
      continue;
    }
    accepted.push({
      id: clientId("file"),
      kind: "file",
      title: fileTitle(file.name),
      file,
      format,
    });
  }

  return {
    items: accepted,
    warning: rejected ? `${rejected} file${rejected === 1 ? "" : "s"} skipped. ${FILE_RULE}` : null,
  };
}

// What one pasted line IS. The kind is read off the address, never chosen from a tab: a Loom share,
// a GitHub PR or commit (any PR sub-page — files, commits, checks — resolves to its PR), and every
// other http address is a reference. The one shape refused with a reason is a GitHub commit with a
// short SHA, because "reference" would be the wrong answer for it and silence would hide why.
type Inferred =
  | { kind: "loom"; item: LoomItem }
  | { kind: "link"; item: LinkItem }
  | { kind: "github"; route: "pr" | "commit"; href: string; label: string }
  | { kind: "error"; message: string };

function infer(text: string): Inferred {
  const loom = parseLoomUrl(text);
  if (loom) {
    return {
      kind: "loom",
      item: {
        id: clientId("loom"),
        kind: "loom",
        title: `Loom walkthrough ${loom.externalId.slice(0, 8)}`,
        href: loom.href,
        externalId: loom.externalId,
        transcript: "",
      },
    };
  }

  const href = normalizeHttpUrl(text);
  if (!href) return { kind: "error", message: "That is not a link. Paste an http or https address, or drop a file." };

  const url = new URL(href);
  if (url.hostname === "github.com") {
    const pull = url.pathname.match(/^\/([^/]+)\/([^/]+)\/pull\/(\d+)(?:\/|$)/);
    const pr = parseGitHubPullRequestUrl(pull ? `https://github.com/${pull[1]}/${pull[2]}/pull/${pull[3]}` : href);
    if (pr) return { kind: "github", route: "pr", href: pr.href, label: `${pr.owner}/${pr.repo}#${pr.number}` };
    const commit = parseGitHubCommitUrl(href);
    if (commit) return { kind: "github", route: "commit", href: commit.href, label: `${commit.owner}/${commit.repo}@${commit.sha.slice(0, 7)}` };
    if (/\/commit\/[0-9a-f]{4,39}\/?$/i.test(url.pathname)) {
      return { kind: "error", message: "A GitHub commit needs its full 40-character SHA." };
    }
  }

  return { kind: "link", item: { id: clientId("link"), kind: "link", title: linkTitle(href), href } };
}

async function fetchGitHub(route: "pr" | "commit", href: string): Promise<GitHubItem> {
  const response = await fetch(`/api/github/${route}?url=${encodeURIComponent(href)}`);
  const payload = await response.json().catch(() => null) as
    | { snapshot?: GitHubPullRequestSnapshot | GitHubCommitSnapshot; raw?: string; error?: string; message?: string }
    | null;
  if (!response.ok) {
    throw new Error(payload?.error ?? payload?.message ?? `GitHub did not answer (${response.status}).`);
  }
  if (!payload?.snapshot || typeof payload.raw !== "string" || !payload.raw.trim()) {
    throw new Error("GitHub returned an incomplete revision.");
  }
  if (route === "pr") {
    const snapshot = payload.snapshot as GitHubPullRequestSnapshot;
    return { id: clientId("github"), kind: "github", githubKind: "pull_request", title: snapshot.title, href: snapshot.htmlUrl, raw: payload.raw, snapshot };
  }
  const snapshot = payload.snapshot as GitHubCommitSnapshot;
  return {
    id: clientId("github"),
    kind: "github",
    githubKind: "commit",
    title: snapshot.message.split(/\r?\n/, 1)[0]?.trim() || `Commit ${snapshot.sha.slice(0, 12)}`,
    href: snapshot.htmlUrl,
    raw: payload.raw,
    snapshot,
  };
}

// The one fact each row carries about itself: is Woven keeping the bytes, or only the address.
function isSnapshot(item: CaptureItem): boolean {
  return item.kind === "file" || item.kind === "github" || (item.kind === "loom" && Boolean(item.transcript.trim()));
}

// One muted line under the title: where it came from, then the provenance word. Commas, not dots.
function rowMeta(item: CaptureItem): string {
  const word = isSnapshot(item) ? "snapshot" : "reference";
  if (item.kind === "file") return `${word}, ${formatBytes(item.file.size)}`;
  if (item.kind === "link") return `${hostOf(item.href)}, ${word}`;
  if (item.kind === "loom") {
    return item.timecodeSeconds === undefined
      ? `loom.com, ${word}`
      : `loom.com, ${formatTimecode(item.timecodeSeconds)}, ${word}`;
  }
  return item.githubKind === "pull_request"
    ? `${item.snapshot.repo}#${item.snapshot.number}, ${word}`
    : `${item.snapshot.repo}@${item.snapshot.sha.slice(0, 7)}, ${word}`;
}

async function captureInput(item: CaptureItem): Promise<CaptureInput> {
  if (item.kind === "file") {
    const raw = decodeUtf8Snapshot(await item.file.arrayBuffer());
    return {
      client_id: item.id,
      title: item.title,
      artifact_type: item.format === "html" ? "HTML" : item.format === "markdown" ? "MD" : "DOC",
      origin: "file",
      format: item.format,
      raw,
      source_label: item.file.name,
      source_capture_state: "snapshotted",
    };
  }

  if (item.kind === "link") {
    return {
      client_id: item.id,
      title: item.title,
      artifact_type: "HTML",
      origin: "link",
      href: item.href,
      source_label: new URL(item.href).hostname,
      source_capture_state: "reference_only",
    };
  }

  if (item.kind === "github") {
    assertCaptureSize(item.raw);
    return {
      client_id: item.id,
      title: item.title,
      artifact_type: "MD",
      origin: "github",
      format: "markdown",
      raw: item.raw,
      href: item.snapshot.htmlUrl,
      source_label: item.githubKind === "pull_request"
        ? `GitHub PR, ${item.snapshot.repo}#${item.snapshot.number}`
        : `GitHub commit, ${item.snapshot.repo}@${item.snapshot.sha.slice(0, 12)}`,
      source_external_id: item.githubKind === "pull_request"
        ? `${item.snapshot.repo}#${item.snapshot.number}@${item.snapshot.headSha}`
        : `${item.snapshot.repo}@${item.snapshot.sha}`,
      source_github_fact: item.githubKind === "pull_request"
        ? {
            kind: "pull_request",
            repo: item.snapshot.repo,
            sha: item.snapshot.headSha,
            merged_at: item.snapshot.mergedAt,
            merge_commit_sha: item.snapshot.mergeCommitSha,
          }
        : { kind: "commit", repo: item.snapshot.repo, sha: item.snapshot.sha },
      source_capture_state: "snapshotted",
    };
  }

  const transcript = item.transcript.trim();
  if (!transcript) {
    return {
      client_id: item.id,
      title: item.title,
      artifact_type: "HTML",
      origin: "loom",
      href: item.href,
      source_label: "Loom recording",
      source_external_id: item.externalId,
      source_capture_state: "reference_only",
      timecode_seconds: item.timecodeSeconds,
    };
  }

  assertCaptureSize(transcript);
  return {
    client_id: item.id,
    title: item.title,
    artifact_type: "MD",
    origin: "loom",
    format: "markdown",
    raw: transcript,
    href: item.href,
    source_label: "Loom recording, manual transcript",
    source_external_id: item.externalId,
    source_capture_state: "snapshotted",
    timecode_seconds: item.timecodeSeconds,
  };
}

// The key that opens the flow from anywhere, printed on the launcher row where the search field prints
// ⌘K. Bare, like the palette's "/": no modifier, and never from inside a field or while any dialog is up.
export const CAPTURE_SHORTCUT = "N";

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

export function CaptureProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const [step, setStep] = React.useState<CaptureStep>("queue");
  const [items, setItems] = React.useState<CaptureItem[]>([]);
  const [message, setMessage] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<CaptureBatchResult | null>(null);
  // read by the window drop handler, which is bound once and must not be re-bound per render
  const openRef = React.useRef(false);
  React.useEffect(() => {
    openRef.current = open && step === "queue";
  }, [open, step]);

  const openCapture = React.useCallback((files?: File[]) => {
    const next = queuedFiles(files ?? []);
    setItems(next.items);
    setMessage(next.warning);
    setResult(null);
    setStep("queue");
    setOpen(true);
  }, []);

  React.useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== CAPTURE_SHORTCUT.toLowerCase()) return;
      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      if (isEditable(event.target) || openRef.current || document.querySelector('[role="dialog"]')) return;
      event.preventDefault();
      openCapture();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openCapture]);

  const addFiles = React.useCallback((files: File[]) => {
    const next = queuedFiles(files);
    setItems((current) => [...current, ...next.items]);
    setMessage(next.warning);
  }, []);

  // A drop while the sheet is already open ADDS to the queue. It used to re-open the sheet, which
  // replaced whatever had been queued with the dropped files.
  const dropFiles = React.useCallback(
    (files: File[]) => (openRef.current ? addFiles(files) : openCapture(files)),
    [addFiles, openCapture],
  );

  const addItem = React.useCallback((item: CaptureItem) => {
    setItems((current) => [...current, item]);
    setMessage(null);
  }, []);

  const removeItem = React.useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  // One updater for the title and for a Loom row's transcript and start time; the patch is typed
  // against the row it lands on so a transcript can never be written onto a file.
  const updateItem = React.useCallback(<T extends CaptureItem>(id: string, patch: Partial<T>) => {
    setItems((current) => current.map((item) => (item.id === id ? ({ ...item, ...patch } as CaptureItem) : item)));
  }, []);

  async function capture() {
    if (!items.length || items.some((item) => !item.title.trim())) return;
    setMessage(null);
    setStep("capturing");
    try {
      const inputs = await Promise.all(items.map(captureInput));
      const nextResult = await ingestEvidenceBundle(inputs);
      setResult(nextResult);
      setStep("done");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The artifacts could not be captured.");
      setStep("failed");
    }
  }

  function onOpenChange(next: boolean) {
    if (!next && step === "capturing") return;
    setOpen(next);
    if (!next) {
      setItems([]);
      setMessage(null);
      setResult(null);
      setStep("queue");
    }
  }

  return (
    <CaptureCtx.Provider value={openCapture}>
      {children}
      <GlobalDropZone onFiles={dropFiles} />
      <CaptureDialog
        open={open}
        step={step}
        items={items}
        message={message}
        result={result}
        onOpenChange={onOpenChange}
        onAddFiles={addFiles}
        onAddItem={addItem}
        onRemoveItem={removeItem}
        onUpdateItem={updateItem}
        onMessage={setMessage}
        onCapture={capture}
        onBack={() => setStep("queue")}
      />
    </CaptureCtx.Provider>
  );
}

// The rail's launcher lives in app-sidebar.tsx (an IconButton). This is the labelled form for any
// surface that wants the word beside the glyph; it opens, so it is neutral, and it says what the
// sheet says.
export function DropButton() {
  const open = useCapture();
  return (
    <Button variant="secondary" onClick={() => open()}>
      <Plus /> Capture
    </Button>
  );
}

function GlobalDropZone({ onFiles }: { onFiles: (files: File[]) => void }) {
  const [active, setActive] = React.useState(false);
  const depth = React.useRef(0);

  React.useEffect(() => {
    const hasFiles = (event: DragEvent) => Array.from(event.dataTransfer?.types ?? []).includes("Files");
    function onEnter(event: DragEvent) {
      if (!hasFiles(event)) return;
      depth.current += 1;
      setActive(true);
    }
    function onLeave(event: DragEvent) {
      if (!hasFiles(event)) return;
      depth.current -= 1;
      if (depth.current <= 0) {
        depth.current = 0;
        setActive(false);
      }
    }
    function onOver(event: DragEvent) {
      if (hasFiles(event)) event.preventDefault();
    }
    function onDrop(event: DragEvent) {
      if (!hasFiles(event)) return;
      event.preventDefault();
      depth.current = 0;
      setActive(false);
      const files = Array.from(event.dataTransfer?.files ?? []);
      if (files.length) onFiles(files);
    }
    window.addEventListener("dragenter", onEnter);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("dragover", onOver);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onEnter);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("drop", onDrop);
    };
  }, [onFiles]);

  if (!active) return null;
  // Three words on one raised surface. It was a dashed card with an upload glyph, a sentence and the
  // format list; the formats are said when a file is refused, not while it is still in the air.
  return (
    <div className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center bg-background/90 p-5">
      <div className="rounded-lg border border-dashed border-line-stroke bg-card px-10 py-8 text-base font-medium shadow-lg">
        Drop to add
      </div>
    </div>
  );
}

type CaptureDialogProps = {
  open: boolean;
  step: CaptureStep;
  items: CaptureItem[];
  message: string | null;
  result: CaptureBatchResult | null;
  onOpenChange: (open: boolean) => void;
  onAddFiles: (files: File[]) => void;
  onAddItem: (item: CaptureItem) => void;
  onRemoveItem: (id: string) => void;
  onUpdateItem: <T extends CaptureItem>(id: string, patch: Partial<T>) => void;
  onMessage: (message: string | null) => void;
  onCapture: () => void;
  onBack: () => void;
};

// Top-anchored, like the /team review panel: the sheet's height changes with every row that lands,
// and a centred dialog re-centres on each one, so the field the user is typing into would move
// under the cursor. Anchored at 10vh only the bottom edge moves.
function CaptureDialog(props: CaptureDialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent
        className="top-[10vh] flex max-h-[80vh] w-[min(92vw,560px)] max-w-none translate-y-0 flex-col gap-0 overflow-hidden p-0"
        showCloseButton={props.step !== "capturing"}
      >
        {props.step === "queue" && <QueueStep {...props} />}
        {props.step === "capturing" && <CapturingStep items={props.items} />}
        {props.step === "done" && props.result && <DoneStep result={props.result} />}
        {props.step === "failed" && <FailedStep message={props.message} onBack={props.onBack} />}
      </DialogContent>
    </Dialog>
  );
}

const ENTER = "animate-in fade-in-0 slide-in-from-top-1 duration-200 motion-reduce:animate-none";

function QueueStep({ items, message, onAddFiles, onAddItem, onRemoveItem, onUpdateItem, onMessage, onCapture }: CaptureDialogProps) {
  const [value, setValue] = React.useState("");
  const [fetching, setFetching] = React.useState<string | null>(null);
  // the field is only marked invalid for what the FIELD refused; a skipped file is the hint line's news
  const [invalid, setInvalid] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const hasBlankTitle = items.some((item) => !item.title.trim());
  const count = items.length;

  // One line of text becomes one row, or one reason. GitHub goes through the route first and the
  // field waits on it, with the fetch named in the hint line rather than in a button's label.
  async function addText(text: string): Promise<boolean> {
    const inferred = infer(text);
    if (inferred.kind === "error") {
      onMessage(inferred.message);
      setInvalid(true);
      return false;
    }
    if (inferred.kind === "github") {
      setFetching(inferred.label);
      onMessage(null);
      try {
        onAddItem(await fetchGitHub(inferred.route, inferred.href));
        return true;
      } catch (error) {
        onMessage(error instanceof Error ? error.message : "GitHub did not answer.");
        setInvalid(true);
        return false;
      } finally {
        setFetching(null);
      }
    }
    onAddItem(inferred.item);
    return true;
  }

  async function submit() {
    if (!value.trim() || fetching) return;
    if (await addText(value)) setValue("");
  }

  // Paste is the whole gesture: a link (or several, one per line) pasted into the empty field lands
  // as rows without an Enter. Anything that is not all links pastes as text and waits for Enter.
  async function onPaste(event: React.ClipboardEvent<HTMLInputElement>) {
    if (value.trim() || fetching) return;
    const lines = event.clipboardData.getData("text").split(/\s+/).filter(Boolean);
    if (!lines.length || !lines.every((line) => normalizeHttpUrl(line))) return;
    event.preventDefault();
    for (const line of lines) await addText(line);
  }

  return (
    <>
      {/* pt-4, not the field's pt-5: the title's 22px line then centres on the primitive's close
          button (top-3, 28px) to within a pixel */}
      <div className="px-5 pt-4 pr-14">
        {/* The same word the rail's row says. The title used to be "Capture evidence" under a
            launcher that said "New artifact" — two verbs for one door — and the footer repeated the
            title with an arrow; now the row, the sheet and the commit share one verb, and the commit
            carries the count. */}
        <DialogTitle>Capture</DialogTitle>
        <DialogDescription className="sr-only">
          Paste a link or drop a file. Each one becomes an artifact in the Library.
        </DialogDescription>
      </div>

      <div className="shrink-0 px-5 pt-3 pb-5">
        <div className="relative">
          <Input
            type="url"
            inputMode="url"
            autoFocus
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              setInvalid(false);
              if (message) onMessage(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void submit();
              }
            }}
            onPaste={(event) => void onPaste(event)}
            placeholder="Paste a link or drop a file"
            aria-label="Link or file"
            aria-invalid={invalid && Boolean(message)}
            // h-9 with the body rung: the field is the one object on the sheet before a row exists,
            // and the primitive's 32px / 13px is the size of a filter, not of the way in.
            className="h-9 pr-10 pl-3 text-base md:text-base"
          />
          {/* the file picker lives IN the field: a link is typed, a file is chosen, same place */}
          <IconButton
            label="Choose files"
            size="icon-sm"
            className="absolute top-1 right-1 text-muted-foreground hover:text-foreground"
            onClick={() => fileInputRef.current?.click()}
          >
            <Paperclip />
          </IconButton>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={FILE_ACCEPT}
            className="sr-only"
            tabIndex={-1}
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              if (files.length) onAddFiles(files);
              event.target.value = "";
            }}
          />
        </div>
        {/* One hint line, and only when there is something to say: a refusal, or the fetch in
            progress. Nothing is explained before it has happened. */}
        {fetching ? (
          <p className="mt-2 text-sm text-muted-foreground" aria-live="polite">Fetching {fetching} from GitHub</p>
        ) : message ? (
          <p className="mt-2 text-sm text-destructive" role="alert">{message}</p>
        ) : null}
      </div>

      {count > 0 && (
        <div className="scrollbar-subtle min-h-0 overflow-y-auto px-5">
          <div className={cn("flex flex-col border-t", DIVIDED_FLUSH)}>
            {items.map((item) => (
              <QueueRow key={item.id} item={item} onRemove={onRemoveItem} onUpdate={onUpdateItem} />
            ))}
          </div>
        </div>
      )}

      {/* The footer exists once there is a row. Before that there is nothing to commit and nothing
          to cancel that the close does not already do, and a disabled forest pill in the corner
          read as a tertiary control. SOLID: the sheet footer's one commit, paired with a ghost
          cancel; the count rides in the label. */}
      {count > 0 && (
        <div className={cn("flex shrink-0 items-center justify-end gap-2 px-5 pt-4 pb-5", ENTER)}>
          <DialogClose render={<Button variant="ghost">Cancel</Button>} />
          <Button disabled={hasBlankTitle} onClick={onCapture}>
            Capture {count} artifact{count === 1 ? "" : "s"}
          </Button>
        </div>
      )}
    </>
  );
}

// An open row on a hairline: the title (editable in place) over one muted line, the remove on hover.
// It was a bordered card with a circled kind icon, a "Link ·" prefix and a provenance chip, three
// codings for one fact. The Dense pairing, this being a list inside a dialog: 13/500 over 12/400.
function QueueRow({
  item,
  onRemove,
  onUpdate,
}: {
  item: CaptureItem;
  onRemove: (id: string) => void;
  onUpdate: <T extends CaptureItem>(id: string, patch: Partial<T>) => void;
}) {
  return (
    <div className={cn("group/row grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-2 py-2.5", ENTER)}>
      <div className="min-w-0">
        <input
          value={item.title}
          onChange={(event) => onUpdate(item.id, { title: event.target.value })}
          aria-label="Title"
          className={cn(
            "-mx-1 w-[calc(100%+0.5rem)] min-w-0 rounded-sm bg-transparent px-1 text-sm font-medium text-foreground",
            FOCUS_RING,
          )}
        />
        <p className="mt-0.5 text-xs text-muted-foreground">
          {rowMeta(item)}
          {item.kind === "loom" ? <LoomExtras item={item} onUpdate={onUpdate} /> : null}
        </p>
      </div>
      {/* a slot one title line tall, so the 28px button centres on the title, not on the row */}
      <span className="flex h-(--text-sm--line-height) items-center">
        <IconButton
          label="Remove"
          size="icon-sm"
          // ROW_REVEAL reads the group's own focus, and this group is a div: the button says so for
          // itself, and for a title being edited beside it
          className={cn("text-muted-foreground hover:text-foreground focus-visible:opacity-100 group-focus-within/row:opacity-100", ROW_REVEAL)}
          onClick={() => onRemove(item.id)}
        >
          <X />
        </IconButton>
      </span>
    </div>
  );
}

// A Loom row's transcript and start time are asked for AFTER the row exists, from the row itself, as
// a text-only disclosure on its meta line. They were a four-field form behind the "Loom" tab that
// every Loom link had to walk past. With a transcript the row's word turns from reference to snapshot.
function LoomExtras({
  item,
  onUpdate,
}: {
  item: LoomItem;
  onUpdate: <T extends CaptureItem>(id: string, patch: Partial<T>) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [timecode, setTimecode] = React.useState(item.timecodeSeconds === undefined ? "" : formatTimecode(item.timecodeSeconds));
  const badTimecode = Boolean(timecode.trim()) && parseTimecode(timecode) === undefined;
  const editorId = `${item.id}-transcript`;
  // the Input primitive's own classes, on a textarea as well: it sits inside the row's muted meta
  // line, so the ink is restated
  const field = "w-full min-w-0 rounded-md border border-input bg-transparent px-2.5 py-1.5 text-sm text-foreground transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-focus";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-controls={editorId}
        className={cn("ml-3 rounded-sm text-xs text-muted-foreground transition-colors hover:text-foreground", FOCUS_RING)}
      >
        {item.transcript.trim() ? "Edit transcript" : "Add transcript"}
      </button>
      {open ? (
        <span id={editorId} className={cn("mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_6rem]", ENTER)}>
          <textarea
            value={item.transcript}
            onChange={(event) => onUpdate<LoomItem>(item.id, { transcript: event.target.value })}
            rows={3}
            placeholder="Paste the transcript you have"
            aria-label="Transcript"
            className={cn(field, "resize-y")}
          />
          <span className="min-w-0">
            <input
              value={timecode}
              inputMode="numeric"
              onChange={(event) => {
                setTimecode(event.target.value);
                onUpdate<LoomItem>(item.id, { timecodeSeconds: parseTimecode(event.target.value) });
              }}
              placeholder="Start 3:14"
              aria-label="Start time"
              aria-invalid={badTimecode}
              className={cn(field, "h-8 py-1 aria-invalid:border-destructive")}
            />
            {badTimecode ? <span className="mt-1 block text-xs text-destructive">Seconds, mm:ss or hh:mm:ss</span> : null}
          </span>
        </span>
      ) : null}
    </>
  );
}

function CapturingStep({ items }: { items: CaptureItem[] }) {
  const count = items.length;
  return (
    <div className="px-5 py-5" aria-live="polite">
      <DialogTitle>Capturing {count} artifact{count === 1 ? "" : "s"}</DialogTitle>
      <DialogDescription className="mt-1">Reading and hashing. This stays open until it is done.</DialogDescription>
    </div>
  );
}

function DoneStep({ result }: { result: CaptureBatchResult }) {
  const firstArtifact = result.artifact_ids[0];
  const firstVersion = result.version_ids[0];
  const exactArtifact = firstVersion
    ? result.artifact_ids.find((artifactId) =>
        artifactVersions(artifactId).some((version) => version.id === firstVersion),
      )
    : undefined;
  const evidenceHref = exactArtifact && firstVersion
    ? `/artifact/${exactArtifact}/version/${firstVersion}`
    : firstArtifact
      ? `/artifact/${firstArtifact}`
      : undefined;
  const total = result.exact_snapshot_count + result.reference_only_count;
  const parts = [
    result.exact_snapshot_count ? `${result.exact_snapshot_count} snapshot${result.exact_snapshot_count === 1 ? "" : "s"}` : null,
    result.reference_only_count ? `${result.reference_only_count} reference${result.reference_only_count === 1 ? "" : "s"}` : null,
  ].filter(Boolean);
  // The two stat cells said "2" and "1" on the title rung; the sentence says the same in one line.
  return (
    <>
      <div className="px-5 pt-5 pr-14">
        <DialogTitle>{total} artifact{total === 1 ? "" : "s"} captured</DialogTitle>
        <DialogDescription className="mt-1">
          {parts.join(" and ")}
          {parts.length ? ", " : ""}
          {result.persisted ? "saved in this browser." : "not kept past this session."}
        </DialogDescription>
        {result.warnings.length > 0 && (
          <ul className="mt-3 flex flex-col gap-1 text-sm text-muted-foreground">
            {result.warnings.map((warning) => <li key={warning}>{warning}</li>)}
          </ul>
        )}
      </div>
      {/* Open navigates, so it is neutral: it was the solid forest button, with an arrow. */}
      <div className="flex items-center justify-end gap-2 px-5 pt-5 pb-5">
        <DialogClose render={<Button variant="ghost">Done</Button>} />
        {evidenceHref && (
          <DialogClose
            render={<Button variant="outline" nativeButton={false} render={<Link href={evidenceHref} />}>Open artifact</Button>}
          />
        )}
      </div>
    </>
  );
}

function FailedStep({ message, onBack }: { message: string | null; onBack: () => void }) {
  return (
    <>
      <div className="px-5 pt-5 pr-14">
        <DialogTitle>Capture failed</DialogTitle>
        <DialogDescription className="mt-1">{message ?? "The artifacts could not be captured."}</DialogDescription>
      </div>
      <div className="flex items-center justify-end gap-2 px-5 pt-5 pb-5">
        <DialogClose render={<Button variant="ghost">Close</Button>} />
        <Button variant="outline" onClick={onBack}>Back to the list</Button>
      </div>
    </>
  );
}
