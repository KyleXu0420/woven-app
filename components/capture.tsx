"use client";

import * as React from "react";
import Link from "next/link";
import { Plus, Upload, ArrowRight, X, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { toasts } from "@/lib/notifications";

// ── ingest model ─────────────────────────────────────────────────────────────
// The dialog only handles INGEST (get it in, fast). The agent's PROCESS work — links, duplicates,
// naming, archiving — is async and lands in the Inbox (see woven/product/capture-workflow.md).
type QType = "HTML" | "MD" | "DOC";
type QItem = { id: number; name: string; type: QType; dest: string };
const DESTS = ["Q4 Roadmap", "Growth", "Research"];

function typeOf(name: string): QType {
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "html" || ext === "htm") return "HTML";
  if (ext === "md" || ext === "markdown" || ext === "mdx") return "MD";
  return "DOC";
}

// ── context — open the capture flow from anywhere (sidebar button / global drop) ──
const CaptureCtx = React.createContext<(files?: File[]) => void>(() => {});
export const useCapture = () => React.useContext(CaptureCtx);

export function CaptureProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const [step, setStep] = React.useState<"queue" | "ingesting" | "done">("queue");
  const [items, setItems] = React.useState<QItem[]>([]);
  const [doneN, setDoneN] = React.useState(0);
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
      dest: "Q4 Roadmap",
    }));

  const openCapture = React.useCallback((files?: File[]) => {
    clearTimers();
    setItems(files && files.length ? toItems(files) : []);
    setStep("queue");
    setDoneN(0);
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

  function weave() {
    setStep("ingesting");
    setDoneN(0);
    items.forEach((_, i) => {
      timers.current.push(setTimeout(() => setDoneN(i + 1), 420 * (i + 1)));
    });
    timers.current.push(setTimeout(() => setStep("done"), 420 * (items.length + 1)));
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
      setDoneN(0);
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
        doneN={doneN}
        onAdd={addFiles}
        onRemove={removeItem}
        onName={setName}
        onAllDest={setAllDest}
        onWeave={weave}
      />
    </CaptureCtx.Provider>
  );
}

// the sidebar's Drop CTA — opens the (empty) capture flow
export function DropButton() {
  const open = useCapture();
  return (
    <Button
      onClick={() => open()}
      className="h-11 w-full justify-start gap-2.5 px-2.5 hover:-translate-y-px active:translate-y-px active:brightness-95 group-data-[collapsible=icon]:size-11 group-data-[collapsible=icon]:w-11 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:px-0"
    >
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-white/15 transition-all duration-200 group-hover/button:bg-white/25 group-active/button:bg-white/10 group-data-[collapsible=icon]:bg-transparent">
        <Plus className="size-4" />
      </span>
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

function CaptureDialog({
  open,
  onOpenChange,
  step,
  items,
  doneN,
  onAdd,
  onRemove,
  onName,
  onAllDest,
  onWeave,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  step: "queue" | "ingesting" | "done";
  items: QItem[];
  doneN: number;
  onAdd: (files: File[]) => void;
  onRemove: (id: number) => void;
  onName: (id: number, name: string) => void;
  onAllDest: (dest: string) => void;
  onWeave: () => void;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = React.useState(false);

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
                Paste, upload, or pull from Claude — Woven weaves it into the graph.
              </DialogDescription>
            </DialogHeader>

            {/* dropzone — click or drag-drop onto it */}
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
              <div className="mt-1 flex gap-1.5">
                {["Paste", "Upload", "From Claude"].map((s) => (
                  <span
                    key={s}
                    className="rounded-full border bg-card px-2.5 py-0.5 text-[11px] text-muted-foreground"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </button>
            <input ref={inputRef} type="file" multiple className="hidden" onChange={onPick} />

            {/* the queue (1…N) */}
            {items.length ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    {items.length} queued
                  </p>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span>Into</span>
                    <select
                      value={items[0]?.dest}
                      onChange={(e) => onAllDest(e.target.value)}
                      className="rounded-md border bg-card px-2 py-1 text-foreground outline-none"
                    >
                      {DESTS.map((d) => (
                        <option key={d}>{d}</option>
                      ))}
                    </select>
                  </div>
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
                      <button
                        onClick={() => onRemove(it.id)}
                        aria-label="Remove"
                        className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <DialogFooter>
              <DialogClose render={<Button variant="ghost">Cancel</Button>} />
              <Button onClick={onWeave} disabled={!items.length}>
                Weave in {items.length || ""} <ArrowRight />
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "ingesting" && (
          <div className="flex flex-col items-center gap-4 py-5">
            <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
              <Loader2 className="size-6 animate-spin text-primary" />
            </div>
            <p className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
              <AgentAvatar size="xs" /> ingesting {doneN}/{items.length}…
            </p>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${(doneN / Math.max(items.length, 1)) * 100}%` }}
              />
            </div>
          </div>
        )}

        {step === "done" && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <span className="flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="size-3.5" />
                </span>
                <DialogTitle>
                  {items.length} {items.length === 1 ? "artifact" : "artifacts"} woven in
                </DialogTitle>
              </div>
              <DialogDescription>
                In the graph and processing — the agent&apos;s links, duplicates, and naming land in your
                Inbox to review.
              </DialogDescription>
            </DialogHeader>

            <div className="rounded-xl border bg-muted/40 p-3">
              <p className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
                <AgentAvatar size="xs" /> weaving {items.length} into the graph — review proposals in Inbox
              </p>
            </div>

            <DialogFooter>
              <DialogClose render={<Button variant="ghost">Done</Button>} />
              <DialogClose render={<Button render={<Link href="/inbox" />} />}>
                Go to Inbox <ArrowRight />
              </DialogClose>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
