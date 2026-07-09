"use client";

import * as React from "react";
import Link from "next/link";
import { Upload, ArrowRight, X, Check, Plus, Inbox, ClipboardPaste, Sparkles, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AgentAvatar } from "@/components/identity";
import { AgentMark } from "@/components/agent-mark";
import { toasts } from "@/lib/notifications";
import { listArtifacts, listCollections } from "@/lib/api";

// ── ingest model ─────────────────────────────────────────────────────────────
// The dialog only handles INGEST (get it in, fast). The agent's PROCESS work — links, duplicates,
// naming, archiving — is async and lands in the Inbox (see woven/product/capture-workflow.md).
type QType = "HTML" | "MD" | "DOC";
type QItem = { id: number; name: string; type: QType; dest: string };
const INBOX_DEST = "Inbox — let the agent file it";

function typeOf(name: string): QType {
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "html" || ext === "htm") return "HTML";
  if (ext === "md" || ext === "markdown" || ext === "mdx") return "MD";
  return "DOC";
}

// ── intake sources — three ways in, one queue out. Upload (files), Paste (a link → a page, or text → a
// note), and From Claude (import an artifact you made in Claude). All converge on the same QItem queue,
// so the weave → land flow downstream never has to care where a drop came from. ──
type Src = "upload" | "paste" | "claude";
const SOURCES: { key: Src; label: string; icon: typeof Upload }[] = [
  { key: "upload", label: "Upload", icon: Upload },
  { key: "paste", label: "Paste", icon: ClipboardPaste },
  { key: "claude", label: "From Claude", icon: Sparkles },
];

// recent artifacts made in Claude, importable into Woven (mocked for the prototype)
type ClaudeItem = { id: string; title: string; type: QType; meta: string };
const CLAUDE_ITEMS: ClaudeItem[] = [
  { id: "cl1", title: "Competitive teardown — Notion vs Coda", type: "DOC", meta: "2d ago" },
  { id: "cl2", title: "Q3 launch retro — synthesis", type: "MD", meta: "4d ago" },
  { id: "cl3", title: "Interview digest — 6 calls", type: "MD", meta: "1w ago" },
  { id: "cl4", title: "Positioning one-pager", type: "DOC", meta: "2w ago" },
];

// a pasted link becomes a readable page name; anything else is treated as a note
function urlToName(u: string): string {
  try {
    const url = new URL(/^https?:\/\//i.test(u) ? u : `https://${u}`);
    const seg = url.pathname.split("/").filter(Boolean).pop();
    const base = seg
      ? decodeURIComponent(seg).replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ")
      : url.hostname.replace(/^www\./, "");
    return base.slice(0, 72) || url.hostname;
  } catch {
    return u.slice(0, 72);
  }
}

// ── weave step — the agent's work, made visible (a live trace instead of a blank spinner) ──
const TRACE_N = 5;
function traceLines(items: QItem[]): string[] {
  const one = items[0]?.name ?? "the drop";
  const n = items.length;
  return [
    n > 1 ? `Reading ${n} files…` : `Reading “${one}”…`,
    n > 1 ? "Named them · set types" : "Named it · set the type",
    "Placed in the graph",
    "Found links to your existing work",
    "Checking for versions & duplicates",
  ];
}

// ── land step — the transparent result. Findings are mocked from the drop (this prototype's ingest is
// simulated): a possible supersede (name shares a word with an existing artifact) + a collection the drop
// fits (only when left for Woven to file) + a proposed-link count that defers to the Inbox. ──
type Findings = { supersede: { existingTitle: string } | null; collection: string | null; links: number };
function computeFindings(items: QItem[]): Findings {
  const arts = listArtifacts();
  let supersede: Findings["supersede"] = null;
  for (const it of items) {
    const words = it.name.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3);
    const hit = arts.find(
      (a) => a.title.toLowerCase() !== it.name.toLowerCase() && words.some((w) => a.title.toLowerCase().includes(w)),
    );
    if (hit) {
      supersede = { existingTitle: hit.title };
      break;
    }
  }
  let collection: string | null = null;
  if (items[0]?.dest === INBOX_DEST) {
    const words = items.flatMap((it) => it.name.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3));
    const hit = listCollections().find((c) => words.some((w) => (c.intro ?? c.name).toLowerCase().includes(w)));
    collection = hit?.name ?? null;
  }
  return { supersede, collection, links: items.length * 2 + 1 };
}

// ── context — open the capture flow from anywhere (sidebar button / global drop) ──
const CaptureCtx = React.createContext<(files?: File[]) => void>(() => {});
export const useCapture = () => React.useContext(CaptureCtx);

export function CaptureProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const [step, setStep] = React.useState<"queue" | "ingesting" | "done">("queue");
  const [items, setItems] = React.useState<QItem[]>([]);
  const [traceStep, setTraceStep] = React.useState(0);
  const idRef = React.useRef(0);
  const timers = React.useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  const toItems = (files: File[]): QItem[] =>
    files.map((f) => ({
      id: ++idRef.current,
      name: f.name.replace(/\.[^.]+$/, ""),
      type: typeOf(f.name),
      dest: INBOX_DEST,
    }));

  const openCapture = React.useCallback((files?: File[]) => {
    clearTimers();
    setItems(files && files.length ? toItems(files) : []);
    setStep("queue");
    setTraceStep(0);
    setOpen(true);
  }, []);

  const addFiles = (files: File[]) => {
    const next = toItems(files); // build outside the updater so it stays pure (no double-add in StrictMode)
    setItems((xs) => [...xs, ...next]);
  };
  const removeItem = (id: number) => setItems((xs) => xs.filter((x) => x.id !== id));
  const setName = (id: number, name: string) =>
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, name } : x)));
  const setAllDest = (dest: string) => setItems((xs) => xs.map((x) => ({ ...x, dest })));
  // paste / from-Claude intake → same queue as uploads
  const addRaw = (entries: { name: string; type: QType }[]) =>
    setItems((xs) => [
      ...xs,
      ...entries.map((e) => ({ id: ++idRef.current, name: e.name || "Untitled", type: e.type, dest: INBOX_DEST })),
    ]);

  function weave() {
    setStep("ingesting");
    setTraceStep(0);
    for (let i = 1; i <= TRACE_N; i++) {
      timers.current.push(setTimeout(() => setTraceStep(i), 470 * i));
    }
    timers.current.push(setTimeout(() => setStep("done"), 470 * (TRACE_N + 1)));
  }

  React.useEffect(() => {
    if (step === "done") {
      toasts.wovenIn(items.length === 1 ? items[0].name : `${items.length} artifacts`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);
  React.useEffect(() => clearTimers, []);

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      clearTimers();
      setStep("queue");
      setItems([]);
      setTraceStep(0);
    }
  }

  return (
    <CaptureCtx.Provider value={openCapture}>
      {children}
      <GlobalDropZone onFiles={openCapture} />
      <CaptureDialog
        open={open}
        onOpenChange={onOpenChange}
        step={step}
        items={items}
        traceStep={traceStep}
        onAdd={addFiles}
        onRemove={removeItem}
        onName={setName}
        onAllDest={setAllDest}
        onAddRaw={addRaw}
        onWeave={weave}
      />
    </CaptureCtx.Provider>
  );
}

// the sidebar's Drop CTA — opens the (empty) capture flow. A plain + reads unambiguously as "add"; the
// word "Drop" carries the gesture. (A tray glyph read as download; the woven mark read as a soundwave —
// both rejected. The mark stays the agent's avatar.) Button lifts + the + scales a touch on hover.
export function DropButton() {
  const open = useCapture();
  return (
    <Button
      onClick={() => open()}
      className="h-11 w-full justify-start gap-2.5 px-3 hover:-translate-y-px active:translate-y-px active:brightness-95 group-data-[collapsible=icon]:size-11 group-data-[collapsible=icon]:w-11 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:px-0"
    >
      <Plus
        aria-hidden="true"
        className="size-5 shrink-0 transition-transform duration-200 group-hover/button:scale-110"
        style={{ color: "color-mix(in srgb, var(--primary-foreground) 88%, var(--primary))" }}
      />
      <span className="font-medium group-data-[collapsible=icon]:hidden">Drop an artifact</span>
    </Button>
  );
}

// ── full-window dropzone — dragging files anywhere arms it; release opens capture ──
function GlobalDropZone({ onFiles }: { onFiles: (files: File[]) => void }) {
  const [active, setActive] = React.useState(false);
  const depth = React.useRef(0);

  React.useEffect(() => {
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files");
    function onEnter(e: DragEvent) {
      if (!hasFiles(e)) return;
      depth.current++;
      setActive(true);
    }
    function onLeave(e: DragEvent) {
      if (!hasFiles(e)) return;
      depth.current--;
      if (depth.current <= 0) setActive(false);
    }
    function onOver(e: DragEvent) {
      if (hasFiles(e)) e.preventDefault();
    }
    function onDrop(e: DragEvent) {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth.current = 0;
      setActive(false);
      const fs = Array.from(e.dataTransfer?.files ?? []);
      if (fs.length) onFiles(fs);
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
  return (
    <div className="pointer-events-none fixed inset-0 z-[60] flex animate-in items-center justify-center bg-background/70 fade-in-0 backdrop-blur-sm duration-150">
      <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-primary/50 bg-card/80 px-16 py-12 text-center">
        <Upload className="size-8 text-primary" />
        <p className="text-base font-medium">Drop to weave into Woven</p>
        <p className="text-sm text-muted-foreground">Release anywhere — single or multiple files</p>
      </div>
    </div>
  );
}

// ── the capture dialog — one queue of 1…N files ──
function TypeTag({ type }: { type: QType }) {
  return (
    <span className="shrink-0 rounded border px-1.5 py-0.5 font-mono text-[9px] font-medium tracking-wider text-muted-foreground">
      {type}
    </span>
  );
}

// destination for the whole queue — a design-system dropdown (not a raw <select>). The trigger stays a
// short, self-describing label ("Let Woven file it" for the agent default, else the collection name); the
// explanation lives in the menu, where the default gets a muted second line and the collections sit under
// a quiet "Or file it directly". Each carries its sidebar color swatch + a check on the current pick.
function DestPicker({ dest, onChange }: { dest: string; onChange: (d: string) => void }) {
  const cols = listCollections();
  const isInbox = dest === INBOX_DEST;
  const current = cols.find((c) => c.name === dest);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="group/dest flex max-w-[15rem] items-center gap-1.5 rounded-lg border bg-card px-2.5 py-1.5 text-[13px] text-foreground outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/40 data-[popup-open]:bg-muted/50">
        {isInbox ? (
          <Inbox className="size-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <span className="size-3 shrink-0 rounded-[4px]" style={{ background: current?.color }} />
        )}
        <span className="truncate">{isInbox ? "Let Woven file it" : dest}</span>
        <ChevronDown className="size-3.5 shrink-0 text-muted-foreground transition-transform group-data-[popup-open]/dest:rotate-180" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuItem onClick={() => onChange(INBOX_DEST)} className="items-start gap-2">
          <Inbox className="size-4 shrink-0 translate-y-0.5 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <span>Let Woven file it</span>
            <p className="text-[11px] leading-snug text-muted-foreground">
              Woven sorts it into the right place — you confirm in your Inbox.
            </p>
          </div>
          {isInbox ? <Check className="size-4 shrink-0 translate-y-0.5 text-primary" /> : null}
        </DropdownMenuItem>
        {cols.length ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-[11px] font-normal text-muted-foreground">
                Or file it directly
              </DropdownMenuLabel>
              {cols.map((c) => (
                <DropdownMenuItem key={c.slug} onClick={() => onChange(c.name)}>
                  <span className="size-3.5 shrink-0 rounded-[4px]" style={{ background: c.color }} />
                  <span className="flex-1 truncate">{c.name}</span>
                  {dest === c.name ? <Check className="size-4 text-primary" /> : null}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function CaptureDialog({
  open,
  onOpenChange,
  step,
  items,
  traceStep,
  onAdd,
  onRemove,
  onName,
  onAllDest,
  onAddRaw,
  onWeave,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  step: "queue" | "ingesting" | "done";
  items: QItem[];
  traceStep: number;
  onAdd: (files: File[]) => void;
  onRemove: (id: number) => void;
  onName: (id: number, name: string) => void;
  onAllDest: (dest: string) => void;
  onAddRaw: (entries: { name: string; type: QType }[]) => void;
  onWeave: () => void;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = React.useState(false);
  const [src, setSrc] = React.useState<Src>("upload");
  const [pasteVal, setPasteVal] = React.useState("");
  const [claudePick, setClaudePick] = React.useState<string[]>([]);

  // reset the intake picker each time the dialog closes
  React.useEffect(() => {
    if (!open) {
      setSrc("upload");
      setPasteVal("");
      setClaudePick([]);
    }
  }, [open]);

  function addPasted() {
    const text = pasteVal.trim();
    if (!text) return;
    const isUrl = /^(https?:\/\/|www\.)\S+$/i.test(text);
    onAddRaw([isUrl ? { name: urlToName(text), type: "HTML" } : { name: text.split("\n").map((s) => s.trim()).find(Boolean)?.slice(0, 72) ?? "Pasted note", type: "MD" }]);
    setPasteVal("");
  }
  function addClaude() {
    const picked = CLAUDE_ITEMS.filter((c) => claudePick.includes(c.id));
    if (!picked.length) return;
    onAddRaw(picked.map((c) => ({ name: c.title, type: c.type })));
    setClaudePick([]);
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const fs = Array.from(e.target.files ?? []);
    if (fs.length) onAdd(fs);
    e.target.value = "";
  }
  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const fs = Array.from(e.dataTransfer.files ?? []);
    if (fs.length) onAdd(fs);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" showCloseButton={step !== "ingesting"}>
        {step === "queue" && (
          <>
            <DialogHeader>
              <DialogTitle>Drop an artifact</DialogTitle>
              <DialogDescription>
                Upload, paste, or pull from Claude — Woven weaves it into the graph.
              </DialogDescription>
            </DialogHeader>

            {/* source picker — three ways in, one queue out */}
            <div className="flex gap-1 rounded-xl bg-muted p-1">
              {SOURCES.map((s) => {
                const on = src === s.key;
                const Icon = s.icon;
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setSrc(s.key)}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[13px] font-medium transition-colors ${
                      on
                        ? "bg-card text-foreground shadow-sm ring-1 ring-border"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icon className="size-3.5" />
                    {s.label}
                  </button>
                );
              })}
            </div>

            {/* upload — click or drag-drop onto it */}
            {src === "upload" ? (
              <>
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={onDrop}
                  className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors ${
                    dragOver
                      ? "border-primary bg-primary/[0.06]"
                      : "border-primary/30 bg-primary/[0.03] hover:bg-primary/[0.05]"
                  }`}
                >
                  <Upload className="size-5 text-primary" />
                  <p className="text-sm font-medium">
                    {items.length ? "Drop more, or click to add" : "Drag files here, or click to add"}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">HTML · Markdown · docs</p>
                </button>
                <input ref={inputRef} type="file" multiple className="hidden" onChange={onPick} />
              </>
            ) : null}

            {/* paste — a link becomes a page, text becomes a note */}
            {src === "paste" ? (
              <div className="flex flex-col gap-2">
                <textarea
                  autoFocus
                  value={pasteVal}
                  onChange={(e) => setPasteVal(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      addPasted();
                    }
                  }}
                  rows={3}
                  placeholder="Paste a link, or type text to weave in…"
                  className="w-full resize-none rounded-xl border bg-card px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
                />
                <div className="flex items-center justify-between">
                  <p className="text-[11px] text-muted-foreground">A link becomes a page · text becomes a note</p>
                  <Button size="sm" variant="outline" onClick={addPasted} disabled={!pasteVal.trim()}>
                    Add
                  </Button>
                </div>
              </div>
            ) : null}

            {/* from Claude — import an artifact you made in Claude */}
            {src === "claude" ? (
              <div className="flex flex-col gap-1.5">
                {CLAUDE_ITEMS.map((it) => {
                  const on = claudePick.includes(it.id);
                  return (
                    <button
                      key={it.id}
                      type="button"
                      onClick={() =>
                        setClaudePick((xs) => (on ? xs.filter((x) => x !== it.id) : [...xs, it.id]))
                      }
                      className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors ${
                        on ? "border-primary/40 bg-primary/[0.05]" : "hover:bg-muted/50"
                      }`}
                    >
                      <span
                        className={`flex size-4 shrink-0 items-center justify-center rounded-[5px] border ${
                          on ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40"
                        }`}
                      >
                        {on ? <Check className="size-3" /> : null}
                      </span>
                      <TypeTag type={it.type} />
                      <span className="min-w-0 flex-1 truncate text-[13px]">{it.title}</span>
                      <span className="shrink-0 text-[11px] text-muted-foreground">{it.meta}</span>
                    </button>
                  );
                })}
                <div className="flex items-center justify-between pt-0.5">
                  <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Sparkles className="size-3" /> Recent from Claude
                  </p>
                  <Button size="sm" variant="outline" onClick={addClaude} disabled={!claudePick.length}>
                    Add {claudePick.length || ""}
                  </Button>
                </div>
              </div>
            ) : null}

            {/* the queue (1…N) */}
            {items.length ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    {items.length} queued
                  </p>
                  <DestPicker dest={items[0]?.dest ?? INBOX_DEST} onChange={onAllDest} />
                </div>
                <div className="scrollbar-subtle flex max-h-56 flex-col gap-1.5 overflow-y-auto">
                  {items.map((it) => (
                    <div
                      key={it.id}
                      className="flex items-center gap-2.5 rounded-lg border bg-card px-2.5 py-2"
                    >
                      <TypeTag type={it.type} />
                      <input
                        value={it.name}
                        onChange={(e) => onName(it.id, e.target.value)}
                        className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                      />
                      <IconButton label="Remove" size="icon-sm" onClick={() => onRemove(it.id)}>
                        <X className="size-3.5" />
                      </IconButton>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <DialogFooter>
              <DialogClose render={<Button variant="ghost">Cancel</Button>} />
              <Button onClick={onWeave} disabled={!items.length}>
                {items.length ? `Weave in ${items.length} artifact${items.length === 1 ? "" : "s"}` : "Weave in"}{" "}
                <ArrowRight />
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "ingesting" && (
          <div className="flex flex-col gap-4 py-2">
            {/* the agent, working — visible, not a blank spinner */}
            <div className="flex items-center gap-3">
              <span
                className="flex size-10 shrink-0 items-center justify-center rounded-full text-primary"
                style={{ background: "color-mix(in srgb, var(--primary) 12%, var(--card))" }}
              >
                <AgentMark state="thinking" className="size-6" />
              </span>
              <div>
                <p className="text-sm font-medium">Weaving in…</p>
                <p className="text-[12px] text-muted-foreground">Woven is reading and connecting your drop.</p>
              </div>
            </div>
            {/* live trace — the reversible work, step by step */}
            <div className="flex flex-col gap-1.5 pl-1">
              {traceLines(items).map((line, i) => {
                const done = i < traceStep;
                const active = i === traceStep;
                return (
                  <div
                    key={i}
                    className={`flex items-center gap-2.5 text-[13px] transition-opacity duration-300 ${
                      done ? "text-foreground/80" : active ? "text-foreground" : "text-muted-foreground/40"
                    }`}
                  >
                    <span className="flex size-4 shrink-0 items-center justify-center">
                      {done ? (
                        <Check className="size-3.5 text-primary" />
                      ) : active ? (
                        <span className="size-1.5 animate-pulse rounded-full bg-primary" />
                      ) : (
                        <span className="size-1.5 rounded-full bg-muted-foreground/25" />
                      )}
                    </span>
                    {line}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {step === "done" && <DoneStep items={items} />}
      </DialogContent>
    </Dialog>
  );
}

// ── the Land step — a transparent result in three tiers: what the agent did automatically (reversible),
// the 1–2 high-stakes calls that are yours (inline), and the bulk that waits in your Inbox (deferred). ──
function DoneStep({ items }: { items: QItem[] }) {
  const findings = React.useMemo(() => computeFindings(items), [items]);
  const [sup, setSup] = React.useState<null | "superseded" | "kept">(null);
  const [col, setCol] = React.useState<null | "filed" | "skipped">(null);
  const n = items.length;
  const showSup = findings.supersede && sup === null;
  const showCol = findings.collection && col === null;

  return (
    <>
      <DialogHeader>
        <div className="flex items-center gap-2">
          <span className="flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Check className="size-3.5" />
          </span>
          <DialogTitle>
            {n} {n === 1 ? "artifact" : "artifacts"} woven in
          </DialogTitle>
        </div>
        <DialogDescription>
          The reversible work is done. A couple of calls are yours; the rest waits in your Inbox.
        </DialogDescription>
      </DialogHeader>

      {/* the result — flat rows on one surface, no pile of framed boxes. A single divider fences the
          deferred (Inbox) tier from the immediate ones; the valve buttons alone mark the rows that are
          yours to decide. Uniform row rhythm (py-2) + one type size keep the spacing consistent. */}
      <div className="-my-1 flex flex-col">
        {/* tier 1 — done automatically (quiet receipt, no action) */}
        <div className="flex items-center gap-2.5 py-2">
          <AgentAvatar size="sm" />
          <span className="text-[13px] text-muted-foreground">
            Named, typed &amp; placed in the graph{n > 1 ? ` · ${n} artifacts` : ""}.
          </span>
        </div>

        {/* tier 2 — the 1–2 calls that are yours (inline valves) */}
        {showSup ? (
          <div className="flex items-center gap-2.5 py-2">
            <AgentAvatar size="sm" />
            <span className="min-w-0 flex-1 text-[13px]">
              Looks like a new version of{" "}
              <span className="font-medium">{findings.supersede!.existingTitle}</span>.
            </span>
            <Button size="sm" onClick={() => setSup("superseded")}>
              Supersede
            </Button>
            <Button size="sm" variant="outline" onClick={() => setSup("kept")}>
              Keep both
            </Button>
          </div>
        ) : null}
        {showCol ? (
          <div className="flex items-center gap-2.5 py-2">
            <AgentAvatar size="sm" />
            <span className="min-w-0 flex-1 text-[13px]">
              Fits the <span className="font-medium">{findings.collection}</span> collection.
            </span>
            <Button size="sm" onClick={() => setCol("filed")}>
              File it
            </Button>
            <Button size="sm" variant="outline" onClick={() => setCol("skipped")}>
              Skip
            </Button>
          </div>
        ) : null}

        {/* one divider — everything below waits in the Inbox */}
        <div className="my-1.5 border-t" />

        {/* tier 3 — waiting in the Inbox (deferred) */}
        <div className="flex items-center gap-2.5 py-2">
          <span className="flex size-6 shrink-0 items-center justify-center">
            <Inbox className="size-4 text-muted-foreground" />
          </span>
          <span className="flex-1 text-[13px] text-muted-foreground">
            <span className="font-medium text-foreground">{findings.links}</span> proposed links waiting to verify.
          </span>
          <DialogClose
            render={
              <Link
                href="/inbox"
                className="shrink-0 text-[13px] font-medium text-primary transition-opacity hover:opacity-80"
              />
            }
          >
            Review
          </DialogClose>
        </div>
      </div>

      <DialogFooter>
        <DialogClose render={<Button variant="ghost">Done</Button>} />
        <DialogClose render={<Button nativeButton={false} render={<Link href="/inbox" />} />}>
          Go to Inbox <ArrowRight />
        </DialogClose>
      </DialogFooter>
    </>
  );
}
