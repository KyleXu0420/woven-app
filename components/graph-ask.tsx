"use client";

import * as React from "react";
import { Sparkles, ArrowRight, X } from "lucide-react";
import { askGraph } from "@/lib/api";
import { cn } from "@/lib/utils";

// ── Ask this web — the immersive graph's Q&A affordance. A compact input; Enter runs a mock,
// deterministic graph query (lib/api.askGraph) and hands the parent { answer, path }. The parent lights
// the returned `path` on the graph — this component never touches the graph itself, it only asks and
// echoes the one-line answer beneath the field, with a ✕ that clears both the field and the highlight. ──
export function GraphAsk({
  centerId,
  onAnswer,
  className,
}: {
  centerId: string;
  onAnswer: (res: { answer: string; path: string[] } | null) => void; // null = cleared
  className?: string;
}) {
  const [q, setQ] = React.useState("");
  const [answer, setAnswer] = React.useState<string | null>(null);

  // keep a stable handle on the latest onAnswer so the re-center reset can fire without re-subscribing
  const onAnswerRef = React.useRef(onAnswer);
  React.useEffect(() => {
    onAnswerRef.current = onAnswer;
  });

  // a new focus node means any prior answer/highlight is stale — clear both
  React.useEffect(() => {
    setQ("");
    setAnswer(null);
    onAnswerRef.current(null);
  }, [centerId]);

  function submit() {
    const question = q.trim();
    if (!question) return;
    const res = askGraph(centerId, question);
    setAnswer(res.answer);
    onAnswer(res);
  }

  function clear() {
    setQ("");
    setAnswer(null);
    onAnswer(null);
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="relative"
      >
        <Sparkles className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-primary" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ask this web…"
          aria-label="Ask this web"
          className="w-full rounded-lg border bg-card py-2 pr-9 pl-8 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
        />
        <button
          type="submit"
          aria-label="Ask"
          disabled={!q.trim()}
          className="absolute top-1/2 right-1.5 flex size-6 -translate-y-1/2 items-center justify-center rounded-md bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-40"
        >
          <ArrowRight className="size-3.5" />
        </button>
      </form>

      {answer ? (
        <div className="flex animate-in items-start gap-2 rounded-lg border bg-card px-3 py-2 text-[13px] fade-in-0 slide-in-from-top-1 duration-200">
          <Sparkles className="mt-0.5 size-3.5 shrink-0 text-primary" />
          <p className="min-w-0 flex-1 leading-snug text-foreground">{answer}</p>
          <button
            type="button"
            onClick={clear}
            aria-label="Clear answer"
            className="-mt-0.5 -mr-1 flex size-5 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
