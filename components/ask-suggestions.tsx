"use client";

// The "Ask" zone — Woven's most differentiated action (a cited answer over everything the team has woven) is,
// everywhere else, a blank field in the sidebar. Here it is an invitation: questions this workspace can answer,
// each saying what its answer is made of, that open Ask PRE-FILLED. It wears the flat Section/Row grammar of the
// page (a question is a sentence-row, not a pill) and never adds a second input — the ⌘K field owns input.

import { ArrowUpRight } from "lucide-react";
import { AgentMark } from "@/components/agent-mark";
import { Section, Row, RowList, SectionAction } from "@/components/today-ui";
import { useSearch } from "@/components/search";
import { askSuggestions, decisionById, getArtifact, listDecisionRecords } from "@/lib/api";

const lowerFirst = (s: string) => (s ? s[0].toLowerCase() + s.slice(1) : s);

// A decision-scoped question — the one row ⌘K's zero state can never offer, because it has no decision in view.
// Derived, never typed: the most recent decision in effect that superseded an earlier one.
function decisionQuestion(): { q: string; sub: string } | null {
  const records = listDecisionRecords();
  const superseded = records.filter((r) => r.decision.superseded_by);
  for (const old of superseded) {
    const current = decisionById(old.decision.superseded_by!);
    if (!current) continue;
    const art = getArtifact(current.artifact_id);
    return {
      q: `Why did we ${lowerFirst(current.text)}?`,
      sub: `Decided on ${art?.title ?? "an artifact"}, supersedes “${old.decision.text}”`,
    };
  }
  return null;
}

export function AskSuggestions({ flush = false }: { flush?: boolean }) {
  const { openSearch } = useSearch();
  // the SAME questions the ⌘K zero-state offers, with the grounding line the field's zero state prints and this
  // zone used to discard (the middle dot in the engine's copy becomes a comma — the house separator)
  const rows = [...askSuggestions().map((s) => ({ q: s.q, sub: s.sub.replace(/\s*·\s*/g, ", ") }))];
  const dq = decisionQuestion();
  if (dq) rows.push(dq);
  return (
    <Section
      label="Ask your collective brain"
      action={
        <SectionAction onClick={() => openSearch()} kbd="⌘K">
          Ask anything
        </SectionAction>
      }
    >
      <RowList flush={flush}>
        {rows.map((r) => (
          <Row
            key={r.q}
            onClick={() => openSearch(r.q)}
            // the agent's own mark, not a generic sparkle: this zone IS the agent
            marker={<AgentMark state="still" className="size-4 text-primary" />}
            trailing={
              // visible at rest on a phone (there is no hover), on hover and on focus elsewhere
              <ArrowUpRight className="size-4 text-muted-foreground opacity-100 transition-opacity sm:opacity-0 sm:group-hover/row:opacity-100 group-focus-visible/row:opacity-100" />
            }
          >
            <span className="block text-base text-foreground/85">{r.q}</span>
            <span className="mt-0.5 block text-[13px] text-muted-foreground max-sm:truncate">{r.sub}</span>
          </Row>
        ))}
      </RowList>
    </Section>
  );
}
