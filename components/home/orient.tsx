"use client";

import { AgentAvatar, PersonAvatar } from "@/components/identity";
import { Section, Row, RowList, SectionAction, EmptyRow } from "@/components/today-ui";
import { useLastSeen } from "@/components/home/use-last-seen";
import { agoMinutes, effectiveOwner, listOpenSuggestions, listPending, listRuns, personById, recentEpisodes, VIEWER } from "@/lib/api";
import { useGraphVersion } from "@/lib/use-graph-version";

const lowerFirst = (s: string) => (s ? s[0].toLowerCase() + s.slice(1) : s);
const firstName = (name: string) => name.split(" ")[0];
const joinNames = (names: string[], rest: number) => {
  if (!names.length) return rest ? `${rest} people` : "";
  if (rest > 0) return `${names.join(", ")} and ${rest} other${rest === 1 ? "" : "s"}`;
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
};

// ORIENT. Two rows, one per actor, inside the window since the viewer was last here: what Woven did (and is
// doing, and could not do) and what the team moved. The window is real (useLastSeen), so the digest reads
// differently after five minutes and after a week, and the byline says which. "On its own" is printed only
// when a run in the window carries a ruleId — the trust ladder made visible, the clause only this product can say.
export function Orient() {
  useGraphVersion();
  const { minutes, label } = useLastSeen();
  const runs = listRuns().filter((r) => agoMinutes(r.at) <= minutes);
  const done = runs.filter((r) => r.status === "done");
  const running = runs.filter((r) => r.status === "running");
  const failed = runs.filter((r) => r.status === "failed");
  const own = done.filter((r) => r.ruleId).length;

  const episodes = recentEpisodes(500, VIEWER).filter((e) => e.actor !== "agent" && agoMinutes(e.at) <= minutes);
  const actors = [...new Set(episodes.map((e) => e.actor))];
  const docs = new Set(episodes.map((e) => e.artifactId)).size;
  const names = actors.slice(0, 2).map((id) => firstName(personById(id)?.name ?? "someone"));
  // who the team is waiting on: every pending change routed to its current owner, as the Activity tab counts them
  const waiting = new Map<string, number>();
  for (const p of listPending()) {
    const o = effectiveOwner(p.edge_id, p.fromId);
    if (o !== VIEWER) waiting.set(o, (waiting.get(o) ?? 0) + 1);
  }
  for (const s of listOpenSuggestions()) {
    const o = effectiveOwner(s.id, s.artifactId);
    if (o !== VIEWER) waiting.set(o, (waiting.get(o) ?? 0) + 1);
  }
  const stuck = [...waiting.entries()].sort((a, b) => b[1] - a[1])[0];

  const ownClause = own ? ` — ${own === done.length ? (done.length === 1 ? "on its own" : "all on its own") : `${own} of them on its own`}` : "";
  const narrate = (n: number) =>
    `Woven ${done.slice(0, n).map((r) => lowerFirst(r.title)).join(", ")}${done.length > n ? ` and ${done.length - n} more` : ""}${ownClause}`;
  // two objects on a desktop line; one on a phone, so the autonomy clause is never what the clamp removes
  const agentLine = done.length === 0 ? null : narrate(2);
  const agentLineShort = done.length === 0 ? null : narrate(1);
  const nowLine = [
    ...running.map((r) => `${lowerFirst(r.title)} now`),
    ...failed.map((r) => `${lowerFirst(r.title)} ${r.at} ago, will retry`),
  ].join(", ");
  const teamLine = episodes.length
    ? `${joinNames(names, Math.max(0, actors.length - names.length))} made ${episodes.length} change${episodes.length === 1 ? "" : "s"} across ${docs} doc${docs === 1 ? "" : "s"}${stuck ? `, ${stuck[1]} ${stuck[1] === 1 ? "is" : "are"} waiting on ${firstName(personById(stuck[0])?.name ?? "someone")}` : ""}`
    : null;
  const lead = actors[0] ? personById(actors[0]) : undefined;

  return (
    <Section
      label="Since you were away"
      byline={label || undefined}
      action={<SectionAction href="/inbox?tab=activity">All activity</SectionAction>}
    >
      <RowList flush>
        {agentLine || nowLine ? (
          <Row href="/inbox?tab=activity" marker={<AgentAvatar size="sm" state={running.length ? "thinking" : "idle"} />}>
            {agentLine ? (
              <>
                <span className="block text-[15px] leading-snug max-md:hidden md:line-clamp-2">
                  <span className="font-medium">Woven</span>
                  {agentLine.slice("Woven".length)}
                </span>
                <span className="block text-[15px] leading-snug max-md:line-clamp-3 md:hidden">
                  <span className="font-medium">Woven</span>
                  {agentLineShort!.slice("Woven".length)}
                </span>
              </>
            ) : null}
            {nowLine ? (
              <span className="mt-0.5 flex items-baseline gap-1.5 text-[14px] leading-snug text-muted-foreground">
                {/* the agent in motion — the one breathing mark on the page, the StatusPill's own grammar */}
                <span className="mt-[1px] size-1.5 shrink-0 animate-pulse self-center rounded-full bg-primary" />
                <span className="min-w-0 max-md:line-clamp-2 md:truncate">{nowLine[0].toUpperCase() + nowLine.slice(1)}</span>
              </span>
            ) : null}
          </Row>
        ) : null}
        {teamLine ? (
          <Row
            href="/inbox?tab=activity"
            marker={lead ? <PersonAvatar seed={lead.id} name={lead.name} size="sm" /> : <AgentAvatar size="sm" />}
          >
            <span className="block text-[15px] leading-snug max-md:line-clamp-2">
              <span className="font-medium">{joinNames(names, Math.max(0, actors.length - names.length))}</span>
              {teamLine.slice(joinNames(names, Math.max(0, actors.length - names.length)).length)}
            </span>
          </Row>
        ) : null}
        {!agentLine && !nowLine && !teamLine ? <EmptyRow>Nothing moved while you were away</EmptyRow> : null}
      </RowList>
    </Section>
  );
}
