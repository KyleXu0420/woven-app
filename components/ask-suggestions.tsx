"use client";

// The "Ask" zone — Woven's most differentiated action (a cited answer over everything the team has woven) is,
// everywhere else, a blank field in the sidebar. Here it is an invitation: questions this workspace can answer,
// each saying what its answer is made of, that open Ask PRE-FILLED. It wears the flat Section/Row grammar of the
// page (a question is a sentence-row, not a pill) and never adds a second input — the ⌘K field owns input.

import * as React from "react";
import { ArrowUpRight } from "lucide-react";
import { AgentMark } from "@/components/agent-mark";
import { Section, Row, RowList, SectionAction, ROW_REVEAL } from "@/components/today-ui";
import { useSearch } from "@/components/search";
import { askSuggestions, decisionById, getArtifact, listDecisionRecords } from "@/lib/api";
import { houseSeparators, lowerFirst } from "@/lib/text";
import { useGraphVersion } from "@/lib/use-graph-version";

// A decision-scoped question — the one row ⌘K's zero state can never offer, because it has no decision in view.
// Derived, never typed: the first decision on record that superseded an earlier one.
function decisionQuestion(): { q: string; sub: string } | null {
  const old = listDecisionRecords().find((r) => r.decision.superseded_by && decisionById(r.decision.superseded_by));
  if (!old) return null;
  const current = decisionById(old.decision.superseded_by!)!;
  return {
    q: `Why did we ${lowerFirst(current.text)}?`,
    sub: `Decided on ${getArtifact(current.artifact_id)?.title ?? "an artifact"}, supersedes “${old.decision.text}”`,
  };
}

export function AskSuggestions({ flush = false }: { flush?: boolean }) {
  const { openSearch } = useSearch();
  const version = useGraphVersion();
  // the SAME questions the ⌘K zero-state offers, with the grounding line the field's zero state prints and this
  // zone used to discard; computed once per graph change, not once per ⌘K open
  const rows = React.useMemo(() => {
    const out = askSuggestions().map((s) => ({ q: s.q, sub: houseSeparators(s.sub) }));
    const dq = decisionQuestion();
    if (dq) out.push(dq);
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the graph version is the dependency
  }, [version]);
  return (
    <Section
      label="Ask Woven"
      action={
        <SectionAction onClick={() => openSearch()}>
          Ask anything <kbd className="ml-1 font-sans text-xs tabular-nums text-muted-foreground">⌘K</kbd>
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
            trailing={<ArrowUpRight className={`size-4 text-muted-foreground ${ROW_REVEAL}`} />}
          >
            {/* the Interface body register every other row on the page uses (15/snug); 16 was a stray from the 08-14 scale collapse */}
            <span className="block text-base leading-snug text-foreground">{r.q}</span>
            <span className="mt-0.5 block text-sm text-muted-foreground max-sm:truncate">{r.sub}</span>
          </Row>
        ))}
      </RowList>
    </Section>
  );
}
