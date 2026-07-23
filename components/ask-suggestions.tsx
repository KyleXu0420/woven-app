"use client";

// The Today "Ask" zone — Woven's most differentiated action (a cited answer over your collective brain) is,
// everywhere else, just a blank field in the topbar. Here at the foot of Today it's an invitation: a few
// contextual questions that open Ask PRE-FILLED. It wears the same flat Section/Row grammar as the rest of
// Today (a question is a sentence-row, not a floating pill), with the sparkle + forest accent the only mark
// that it's the agent — not a second input (the topbar owns the field), just a lower barrier to firing it.

import { ArrowUpRight, Sparkles } from "lucide-react";
import { Section, Row, RowList, SectionAction } from "@/components/today-ui";
import { useSearch } from "@/components/search";
import { ASK_SUGGESTIONS } from "@/lib/api";

// the SAME showcase questions the ⌘K zero-state offers — each lands on a distinct honest answer behavior
// (cited single-doc · owner lookup · graph neighborhood), verified against the real engine. A real build would
// derive these from recent activity + the graph; sharing the constant keeps the invitation from drifting.
const QUESTIONS = ASK_SUGGESTIONS;

export function AskSuggestions() {
  const { openSearch } = useSearch();
  // Ask was the only section with no trailing action — odd for the page's most differentiated capability. It
  // opens the topbar's OWN overlay (empty), so this invites the full field without adding a second input.
  return (
    <Section
      label="Ask your collective brain"
      action={<SectionAction onClick={() => openSearch()}>Ask anything</SectionAction>}
    >
      <RowList>
        {QUESTIONS.map((q) => (
          <Row
            key={q}
            onClick={() => openSearch(q)}
            marker={<Sparkles className="size-4 text-primary" />}
            trailing={
              <ArrowUpRight className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover/row:opacity-100" />
            }
          >
            <span className="block text-[15px] text-foreground/85">{q}</span>
          </Row>
        ))}
      </RowList>
    </Section>
  );
}
