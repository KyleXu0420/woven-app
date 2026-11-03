"use client";

import * as React from "react";
import { AgentAvatar, PersonAvatar } from "@/components/identity";
import { Section, Row, RowList, SectionAction, EmptyRow } from "@/components/today-ui";
import { homeFacts } from "@/components/home/home-facts";
import { useLastSeenWindow } from "@/components/home/use-last-seen";
import { agoMinutes, personById, recentEpisodes, VIEWER } from "@/lib/api";
import { agentNowSentences, agentSentences, HOME_MEASURE, teamSentences, type Sentence } from "@/lib/home";
import { pendingByOwner } from "@/lib/pending";
import { firstName } from "@/lib/text";
import { cn } from "@/lib/utils";
import { useGraphVersion } from "@/lib/use-graph-version";
import type { AgentRun, Person } from "@/lib/types";

// ORIENT. Two rows, one per actor, inside the window since the viewer was last here: what Woven did (and is
// doing, and could not do) and what the team moved. The window is real (useLastSeenWindow), so the digest reads
// differently after five minutes and after a week, and the byline says which. "On its own" is printed only
// when a run in the window carried a ruleId — the trust ladder made visible, the clause only this product can say.
//
// Each row is a short stack of sentences, one fact each (lib/home.ts builds them, pure): the prose muted, the
// counts in full ink at 500, so the numbers are what a glance takes away. The rows used to be one ink run each,
// and the agent's ran 125 characters to the column's edge with an em-dash tail.
export function Orient() {
  const version = useGraphVersion();
  const { minutes, label } = useLastSeenWindow();
  const view = React.useMemo(() => {
    const { runs } = homeFacts(version);
    const done: AgentRun[] = [];
    const running: AgentRun[] = [];
    const failed: AgentRun[] = [];
    for (const r of runs) {
      if (agoMinutes(r.at) > minutes) continue;
      if (r.status === "done") done.push(r);
      else if (r.status === "running") running.push(r);
      else if (r.status === "failed") failed.push(r);
    }
    const actors: string[] = [];
    const docs = new Set<string>();
    let changes = 0;
    for (const e of recentEpisodes(500, VIEWER)) {
      if (e.actor === "agent" || agoMinutes(e.at) > minutes) continue;
      changes++;
      docs.add(e.artifactId);
      if (!actors.includes(e.actor)) actors.push(e.actor);
    }
    // who the team is waiting on: the same per-owner walk the Activity tab groups by
    let stuck: { id: string; n: number } | undefined;
    for (const [owner, list] of pendingByOwner()) if (owner !== VIEWER && list.length > (stuck?.n ?? 0)) stuck = { id: owner, n: list.length };
    const people = actors.slice(0, 2).map((id) => personById(id)).filter((p): p is Person => !!p);
    return {
      agent: agentSentences(done, 2),
      thinking: running.length > 0,
      now: agentNowSentences(running, failed),
      team: teamSentences(
        people.map((p) => firstName(p.name)),
        Math.max(0, actors.length - people.length),
        changes,
        docs.size,
        stuck ? { n: stuck.n, name: firstName(personById(stuck.id)?.name ?? "someone") } : undefined,
      ),
      lead: people[0],
    };
  }, [version, minutes]);

  const { agent, thinking, now, team, lead } = view;
  return (
    <Section label="Since you were away" byline={label} action={<SectionAction href="/inbox?tab=activity">All activity</SectionAction>}>
      <RowList flush>
        {agent.length || now.length ? (
          <Row href="/inbox?tab=activity" marker={<AgentAvatar size="sm" state={thinking ? "thinking" : "idle"} />}>
            {agent.length ? (
              // The counts lead and the named runs follow, so a clamp (a guard: two lines at 75ch hold the seed's
              // four sentences) can only ever take a named run, never a count or the autonomy sentence.
              <span className={cn("block text-base text-pretty text-muted-foreground line-clamp-3 max-md:line-clamp-6", HOME_MEASURE)}>
                <Sentences of={agent} />
              </span>
            ) : null}
            {now.length ? (
              <span className={cn("mt-0.5 flex gap-1.5 text-sm text-muted-foreground", HOME_MEASURE)}>
                {/* the agent in motion — the one breathing mark on the page, the StatusPill's own grammar. It sits
                    in a slot one 13px line tall, so on a wrapped line it marks the first line, not the middle. */}
                <span className="flex h-(--text-sm--line-height) shrink-0 items-center">
                  <span className="size-1.5 animate-pulse rounded-full bg-primary" />
                </span>
                {/* was md:truncate: the second fact (the run that failed) was the half the truncation cut */}
                <span className="min-w-0 text-pretty line-clamp-3">
                  <Sentences of={now} />
                </span>
              </span>
            ) : null}
          </Row>
        ) : null}
        {team.length ? (
          <Row href="/inbox?tab=activity" marker={lead ? <PersonAvatar seed={lead.id} name={lead.name} size="sm" /> : <AgentAvatar size="sm" />}>
            <span className={cn("block text-base text-pretty text-muted-foreground max-md:line-clamp-4", HOME_MEASURE)}>
              <Sentences of={team} />
            </span>
          </Row>
        ) : null}
        {!agent.length && !now.length && !team.length ? <EmptyRow marker={<AgentAvatar size="sm" />}>Nothing moved while you were away</EmptyRow> : null}
      </RowList>
    </Section>
  );
}

// A sentence's strings print in the row's muted ink; its numbers are counts and print in full ink at 500,
// tabular, the weight the section's own count wears. Sentences part with a space, never a separator glyph.
//
// Line breaks. The blocks set text-pretty, which keeps a paragraph's last line from being one word (at 390 the
// now line ended on "retry." alone). That does not reach a break INSIDE the paragraph: at 1440 the digest's first
// line ended on "It" and the second began "noted Maya Chen…", the pronoun cut from its verb at the end of a line.
// So each sentence's first gap is a no-break space and its first two words travel together. It is typesetting,
// not wording, so it is done here and lib/home.ts's sentences keep plain spaces.
function weldOpening(s: Sentence): Sentence {
  const i = typeof s[0] === "number" ? 1 : 0; // a sentence that opens on a count welds the count to its noun
  const part = s[i];
  if (typeof part !== "string") return s;
  const gap = i === 0 ? part.indexOf(" ") : part.startsWith(" ") ? 0 : -1;
  if (gap < 0) return s;
  const out = [...s];
  out[i] = `${part.slice(0, gap)}\u00a0${part.slice(gap + 1)}`;
  return out;
}

function Sentences({ of }: { of: Sentence[] }) {
  return of.map(weldOpening).map((s, i) => (
    <React.Fragment key={i}>
      {i > 0 ? " " : null}
      {s.map((part, j) =>
        typeof part === "number" ? (
          <span key={j} className="font-medium tabular-nums text-foreground">
            {part}
          </span>
        ) : (
          <React.Fragment key={j}>{part}</React.Fragment>
        ),
      )}
    </React.Fragment>
  ));
}
