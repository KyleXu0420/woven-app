"use client";

// The Today "Ask" zone — Woven's most differentiated action (a cited answer over your collective brain) is,
// everywhere else, just a blank field in the topbar. Here it's an INVITATION: a few contextual questions that
// open Ask pre-filled, so orienting ("what happened") flows into asking ("what can I find out"). Suggestions
// (chips), not a second search field — the topbar owns the input; this lowers the barrier to using it.

import { Sparkles } from "lucide-react";
import { useSearch } from "@/components/search";

// grounded in what's live in the space (Q4 planning · the migration · the launch); a real build would derive
// these from recent activity + the graph.
const QUESTIONS = [
  "What changed across Q4 planning this week?",
  "Who owns the migration?",
  "What's blocking the launch?",
];

export function AskSuggestions() {
  const { openSearch } = useSearch();
  return (
    <div className="mt-7">
      <p className="mb-2 flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground">
        <Sparkles className="size-3.5 text-primary" /> Ask your collective brain
      </p>
      <div className="flex flex-wrap gap-2">
        {QUESTIONS.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => openSearch("ask", q)}
            className="rounded-full border bg-card px-3.5 py-1.5 text-[13px] text-foreground/80 transition-colors hover:border-primary/30 hover:bg-primary/[0.05] hover:text-foreground"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}
