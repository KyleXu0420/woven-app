"use client";

import * as React from "react";
import { AgentAvatar, PersonAvatar } from "@/components/identity";
import { Section, Row, RowList, SectionAction, EmptyRow } from "@/components/today-ui";
import { homeFacts } from "@/components/home/home-facts";
import { useLastSeenWindow } from "@/components/home/use-last-seen";
import { agoMinutes, personById, recentEpisodes, VIEWER } from "@/lib/api";
import { agentDigest } from "@/lib/home";
import { pendingByOwner } from "@/lib/pending";
import { firstName, lowerFirst, nameList, plural, upperFirst } from "@/lib/text";
import { useGraphVersion } from "@/lib/use-graph-version";
import type { AgentRun, Person } from "@/lib/types";

// ORIENT. Two rows, one per actor, inside the window since the viewer was last here: what Woven did (and is
// doing, and could not do) and what the team moved. The window is real (useLastSeenWindow), so the digest reads
// differently after five minutes and after a week, and the byline says which. "On its own" is printed only
// when a run in the window carried a ruleId — the trust ladder made visible, the clause only this product can say.
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
    const now = [...running.map((r) => `${lowerFirst(r.title)} now`), ...failed.map((r) => `${lowerFirst(r.title)} ${r.at} ago, will retry`)];
    return {
      agent: agentDigest(done, 2),
      thinking: running.length > 0,
      now: now.length ? upperFirst(now.join(", ")) : null,
      who: nameList(people.map((p) => firstName(p.name)), Math.max(0, actors.length - people.length)),
      team: changes
        ? ` made ${plural(changes, "change", "changes")} across ${plural(docs.size, "doc", "docs")}${stuck ? `, ${stuck.n} ${stuck.n === 1 ? "is" : "are"} waiting on ${firstName(personById(stuck.id)?.name ?? "someone")}` : ""}`
        : null,
      lead: people[0],
    };
  }, [version, minutes]);

  const { agent, thinking, now, who, team, lead } = view;
  return (
    <Section label="Since you were away" byline={label} action={<SectionAction href="/inbox?tab=activity">All activity</SectionAction>}>
      <RowList flush>
        {agent || now ? (
          <Row href="/inbox?tab=activity" marker={<AgentAvatar size="sm" state={thinking ? "thinking" : "idle"} />}>
            {agent ? (
              <span className="block text-[15px] leading-snug">
                {/* the objects may clamp; the autonomy clause is its own element, so a clamp never removes it */}
                <span className="line-clamp-2 max-md:line-clamp-3">
                  <span className="font-medium">Woven</span> {agent.objects}
                </span>
                {agent.own ? <span className="block text-muted-foreground">— {agent.own}</span> : null}
              </span>
            ) : null}
            {now ? (
              <span className="mt-0.5 flex items-baseline gap-1.5 text-[14px] leading-snug text-muted-foreground">
                {/* the agent in motion — the one breathing mark on the page, the StatusPill's own grammar */}
                <span className="size-1.5 shrink-0 animate-pulse self-center rounded-full bg-primary" />
                <span className="min-w-0 max-md:line-clamp-2 md:truncate">{now}</span>
              </span>
            ) : null}
          </Row>
        ) : null}
        {team ? (
          <Row href="/inbox?tab=activity" marker={lead ? <PersonAvatar seed={lead.id} name={lead.name} size="sm" /> : <AgentAvatar size="sm" />}>
            <span className="block text-[15px] leading-snug max-md:line-clamp-2">
              <span className="font-medium">{who}</span>
              {team}
            </span>
          </Row>
        ) : null}
        {!agent && !now && !team ? <EmptyRow marker={<AgentAvatar size="sm" />}>Nothing moved while you were away</EmptyRow> : null}
      </RowList>
    </Section>
  );
}
