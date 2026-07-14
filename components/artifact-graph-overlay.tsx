"use client";

import * as React from "react";
import { Waypoints, X, Sparkles, ArrowRight } from "lucide-react";
import { LocalGraph, GraphLegend } from "./local-graph";
import { EntityProfile } from "./entity-profile";
import { WeaveBackdrop } from "./weave-backdrop";
import { getNeighborhood, askGraph, verifyEdge, edgeConfirmation } from "@/lib/api";
import { useGraphVersion } from "@/lib/use-graph-version";

// mode glyphs — the two icons ARE the difference in how each reads the web. Web = the whole radial web you
// browse (a hub with every spoke); Terminal = one traced path through it (a query picks a single route).
function WebGlyph({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="none" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round">
      <line x1="8" y1="8" x2="3.6" y2="3.6" />
      <line x1="8" y1="8" x2="12.4" y2="3.6" />
      <line x1="8" y1="8" x2="3.6" y2="12.4" />
      <line x1="8" y1="8" x2="12.4" y2="12.4" />
      <circle cx="3.6" cy="3.6" r="1.4" />
      <circle cx="12.4" cy="3.6" r="1.4" />
      <circle cx="3.6" cy="12.4" r="1.4" />
      <circle cx="12.4" cy="12.4" r="1.4" />
      <circle cx="8" cy="8" r="2.1" fill="currentColor" stroke="none" />
    </svg>
  );
}
function PathGlyph({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="none" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12.5 7.5 6.5 13 9.5" />
      <circle cx="3" cy="12.5" r="1.4" />
      <circle cx="7.5" cy="6.5" r="1.4" />
      <circle cx="13" cy="9.5" r="1.7" fill="currentColor" stroke="none" />
    </svg>
  );
}

type Mode = "web" | "terminal";
const MODES: { key: Mode; label: string; Glyph: React.ComponentType<{ className?: string }> }[] = [
  { key: "web", label: "Web", Glyph: WebGlyph },
  { key: "terminal", label: "Terminal", Glyph: PathGlyph },
];

// The full-canvas graph — the artifact's place in the knowledge web, given the whole screen. The graph IS
// the entity view, so nothing re-lists it: detail is on demand (click a node → its profile peeks in place).
// One bottom command bar carries both modes: browse the web, or query it. Esc exits.
export function ArtifactGraphOverlay({
  artifactId,
  title,
  open,
  onClose,
}: {
  artifactId: string;
  title: string;
  open: boolean;
  onClose: () => void;
}) {
  const gv = useGraphVersion(); // re-read the neighborhood after a verify so the confirmed edge inks solid + flows
  const nb = React.useMemo(() => getNeighborhood(artifactId, 1), [artifactId, gv]);
  const [mode, setMode] = React.useState<Mode>("web");
  const [query, setQuery] = React.useState("");
  const [answer, setAnswer] = React.useState<string | null>(null);
  const [highlight, setHighlight] = React.useState<string[]>([]);

  // each visit starts fresh — back to browsing, nothing asked or highlighted
  React.useEffect(() => {
    if (open) {
      setMode("web");
      setQuery("");
      setAnswer(null);
      setHighlight([]);
    }
  }, [open, artifactId]);
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  function switchMode(next: Mode) {
    setMode(next);
    if (next === "web") {
      setHighlight([]);
      setAnswer(null);
    }
  }
  function onAsk(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    const res = askGraph(artifactId, q);
    setAnswer(res.answer);
    setHighlight(res.path);
  }
  function clearAnswer() {
    setAnswer(null);
    setHighlight([]);
    setQuery("");
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-background animate-in fade-in-0 duration-200">
      <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b px-4 sm:px-6">
        <span className="inline-flex min-w-0 items-center gap-2 text-[15px] font-medium">
          <Waypoints className="size-4 shrink-0 text-primary" />
          Connections
          <span className="truncate text-muted-foreground">· {title}</span>
        </span>
        <button
          onClick={onClose}
          aria-label="Close"
          className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/[0.04] hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </header>

      <div className="relative flex-1 overflow-hidden">
        <WeaveBackdrop />

        {/* the web, given the whole canvas — click any node to peek its profile in place */}
        <div className="absolute inset-0 flex items-center justify-center p-6 sm:p-12">
          <div className="w-full max-w-5xl">
            <LocalGraph
              data={nb}
              flow
              dense
              highlight={highlight}
              onSelect={() => {}}
              onVerifyEdge={(id, action) => verifyEdge(id, action, "pe_maya")}
              verifiedBy={edgeConfirmation}
              renderPopover={(id, api) => {
                const n = nb.nodes.find((x) => x.id === id);
                return n ? <EntityProfile node={n} placement="popover" onSelect={api.select} /> : null;
              }}
            />
          </div>
        </div>

        {/* command bar — one component at the bottom: the mode toggle + the query, with any answer floating
            just above so it never runs off the bottom edge. */}
        <div className="pointer-events-none absolute bottom-5 left-1/2 z-20 flex w-full max-w-lg -translate-x-1/2 flex-col items-center gap-2 px-4">
          {mode === "terminal" && answer ? (
            <div className="pointer-events-auto flex w-full items-start gap-2 rounded-xl border bg-popover px-3 py-2 text-[14px] shadow-md">
              <Sparkles className="mt-0.5 size-3.5 shrink-0 text-primary" />
              <span className="flex-1 leading-snug">{answer}</span>
              <button
                onClick={clearAnswer}
                aria-label="Clear"
                className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ) : null}

          <div className="pointer-events-auto flex items-center gap-1 rounded-full border bg-card/95 p-1 shadow-md backdrop-blur-sm">
            {MODES.map((m) => {
              const on = mode === m.key;
              const Glyph = m.Glyph;
              return (
                <button
                  key={m.key}
                  onClick={() => switchMode(m.key)}
                  title={m.label}
                  aria-label={m.label}
                  aria-pressed={on}
                  className={`flex size-7 items-center justify-center rounded-full transition-colors ${
                    on ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Glyph className="size-4" />
                </button>
              );
            })}
            {mode === "terminal" ? (
              <>
                <span className="mx-0.5 h-5 w-px shrink-0 bg-border" />
                <form onSubmit={onAsk} className="relative flex items-center">
                  <input
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Ask this web…"
                    aria-label="Ask this web"
                    className="w-56 rounded-full bg-transparent py-1 pr-8 pl-3 text-[14px] outline-none placeholder:text-muted-foreground"
                  />
                  <button
                    type="submit"
                    aria-label="Ask"
                    disabled={!query.trim()}
                    className="absolute right-1 flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
                  >
                    <ArrowRight className="size-3.5" />
                  </button>
                </form>
              </>
            ) : null}
          </div>
        </div>

        {/* bottom corners — the key (left) · the size (right) */}
        <div className="pointer-events-none absolute bottom-4 left-6 z-20 flex h-[30px] items-center">
          <GraphLegend compact />
        </div>
        <div className="pointer-events-none absolute bottom-4 right-6 z-20 flex h-[30px] items-center text-[12px] text-muted-foreground">
          <span className="font-medium tabular-nums text-foreground/70">{nb.nodes.length}</span>
          <span className="ml-1">entities</span>
          <span className="mx-1.5 opacity-50">·</span>
          <span className="font-medium tabular-nums text-foreground/70">{nb.edges.length}</span>
          <span className="ml-1">relationships</span>
          <span className="mx-1.5 opacity-50">·</span>
          <kbd className="rounded border px-1 font-sans">Esc</kbd>
        </div>
      </div>
    </div>
  );
}
