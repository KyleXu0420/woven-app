"use client";

// The Today "Ask" zone — Woven's most differentiated action (a cited answer over your collective brain) is,
// everywhere else, just a blank field in the topbar. Here at the foot of Today it's an invitation: a few
// contextual questions that open Ask PRE-FILLED. It wears the same flat Section/Row grammar as the rest of
// Today (a question is a sentence-row, not a floating pill), with the sparkle + forest accent the only mark
// that it's the agent — not a second input (the topbar owns the field), just a lower barrier to firing it.

import { ArrowUpRight, Sparkles } from "lucide-react";
import { Section, Row, RowList } from "@/components/today-ui";
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
    <Section label="Ask your collective brain">
      <RowList>
        {QUESTIONS.map((q) => (
          <Row
            key={q}
            onClick={() => openSearch("ask", q)}
            marker={<Sparkles className="size-3.5 text-primary" />}
            trailing={
              <ArrowUpRight className="size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover/row:opacity-100" />
            }
          >
            <span className="block text-[13px] text-foreground/85">{q}</span>
          </Row>
        ))}
      </RowList>
    </Section>
  );
}
