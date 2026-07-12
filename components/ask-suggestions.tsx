"use client";

// The Today "Ask" zone — Woven's most differentiated action (a cited answer over your collective brain) is,
// everywhere else, just a blank field in the topbar. Here at the foot of Today it's a designed INVITATION: the
// agent's own mark, what it can do, and a few contextual questions that open Ask PRE-FILLED. Rows, not floating
// pills (a question is a sentence, not a tag) — and not a second input (the topbar owns the field); this just
// lowers the barrier to firing it.

import { ArrowUpRight } from "lucide-react";
import { AgentAvatar } from "@/components/identity";
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
    <div className="overflow-hidden rounded-2xl border bg-card">
      <div className="flex items-center gap-2.5 px-4 pb-3 pt-3.5">
        <AgentAvatar size="sm" />
        <div className="min-w-0">
          <p className="text-[13px] font-semibold leading-snug">Ask your collective brain</p>
          <p className="text-[12px] leading-snug text-muted-foreground">
            A cited answer, drawn from everything your team has woven.
          </p>
        </div>
      </div>
      <div className="flex flex-col border-t px-2 py-1.5">
        {QUESTIONS.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => openSearch("ask", q)}
            className="group/q flex items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-foreground/[0.04]"
          >
            <span className="min-w-0 flex-1 text-[13px] leading-snug text-foreground/85">{q}</span>
            <ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/q:opacity-100" />
          </button>
        ))}
      </div>
    </div>
  );
}
