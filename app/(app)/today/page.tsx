import Link from "next/link";
import { ArrowRight, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusPill, TypeBadge, PeopleStack, CollectionTag } from "@/components/artifact-ui";
import { CoverArt } from "@/components/cover-art";
import { AgentAvatar } from "@/components/identity";
import { CatchUp } from "@/components/catch-up";
import { AskSuggestions } from "@/components/ask-suggestions";
import { Section, Row, RowList, SectionAction } from "@/components/today-ui";
import { TodayDate } from "@/components/today-date";
import { getArtifact, getArtifactGraph, getPeek, listArtifacts, needsYou } from "@/lib/api";
import { PAGE_FRAME } from "@/lib/frame";
import type { Artifact } from "@/lib/types";

// the hero — SAME three zones as the Library grid card, laid out horizontally + with a peek list. Zone ③ tracks
// the Library card's "faces, not stats" update: participant faces + updated, not the old mono graph-stats line.
function HeroCard({ a, peek }: { a: Artifact; peek: { t: string; s: string }[] }) {
  const people = getArtifactGraph(a.id).people;
  return (
    <Card className="group gap-0 overflow-hidden p-0 transition-all hover:-translate-y-px hover:border-ring/30">
      <div className="flex flex-col sm:flex-row">
        {/* ① preview — left, fills the card height */}
        <div className="h-40 border-b sm:h-auto sm:min-h-[150px] sm:w-[38%] sm:border-r sm:border-b-0">
          <CoverArt a={a} large />
        </div>

        {/* ② identity (type · collection · status) → peek → ③ faces */}
        <div className="flex flex-1 flex-col gap-3.5 p-6">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2 text-[13px]">
              <TypeBadge type={a.type} />
              {a.collection_ids.length ? <CollectionTag ids={a.collection_ids} className="text-muted-foreground" /> : null}
              <StatusPill state={a.state} />
            </div>
            <span className="flex shrink-0 items-center gap-1 text-[14px] font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
              Continue <ArrowRight className="size-4" />
            </span>
          </div>

          <div>
            <p className="text-[16px] leading-relaxed text-muted-foreground">{a.gist}</p>
          </div>

          {/* hero extra — recent activity on this artifact */}
          <ul className="flex flex-col gap-2.5 border-t pt-3.5">
            {peek.map((p) => (
              <li key={p.s} className="flex items-baseline gap-3 text-[14px]">
                <span className="w-9 shrink-0 font-mono tabular-nums text-muted-foreground">{p.t}</span>
                <span className="text-foreground/75">{p.s}</span>
              </li>
            ))}
          </ul>

          {/* ③ faces, not stats — the same footer signal the Library card kept */}
          <div className="flex items-center justify-between gap-2 border-t pt-3.5">
            <PeopleStack people={people} />
            <span className="shrink-0 font-mono text-[12px] tabular-nums text-muted-foreground">{a.updated}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}

export default function TodayPage() {
  const hero = getArtifact("a_notif")!;
  const needs = needsYou();
  const top = needs[0]; // the single most-urgent — the rest live in the Inbox
  const inFlight = listArtifacts().filter((a) => a.state === "processing").length;

  return (
    <div className={PAGE_FRAME.focused}>
      <h1 className="text-3xl font-medium tracking-[-0.01em]">Today</h1>
      {/* the day anchor + only what's genuinely in motion. Dropped "N artifacts in your space" (a vanity count
          that drives nothing) and "N need you" (the Needs-you section states it directly below). */}
      <p className="mt-2 text-[15px] text-muted-foreground">
        <TodayDate />
        {inFlight ? (
          <>
            {" · "}
            <span className="font-medium text-foreground tabular-nums">{inFlight}</span> doc
            {inFlight === 1 ? "" : "s"} in flight
          </>
        ) : null}
      </p>

      {/* RESUME — Continue leads with the ONE doc you were last in (the page's anchor). Browsing the rest is a
          hand-off to Library (All in Library →), not a secondary list that duplicates it and splits the block. */}
      <Section label="Continue" action={<SectionAction href="/library">All in Library</SectionAction>}>
        <Link href={`/artifact/${hero.id}`} className="block">
          <HeroCard a={hero} peek={getPeek(hero.id)} />
        </Link>
      </Section>

      {/* ORIENT — one catch-up digest (what happened while you were away; awareness, not decisions) */}
      <CatchUp />

      {/* DECIDE — a nudge to the Inbox (the decision queue): only the most-urgent, then hand off; not a copy */}
      {top ? (
        <Section
          label="Needs you"
          count={needs.length}
          action={
            <SectionAction href="/inbox" accent>
              Open Inbox <ArrowRight className="size-3.5" />
            </SectionAction>
          }
        >
          <RowList>
            <Row
              marker={
                top.kind === "stale" ? (
                  <AlertTriangle
                    className="size-[18px]"
                    style={{ color: "color-mix(in srgb, var(--chart-2) 68%, var(--foreground))" }}
                  />
                ) : (
                  <AgentAvatar size="sm" />
                )
              }
              trailing={
                <Button
                  size="default"
                  variant={top.kind === "stale" ? "outline" : "default"}
                  nativeButton={false}
                  render={<Link href={top.href} />}
                >
                  {top.action}
                </Button>
              }
            >
              <span className="block truncate text-[15px]">
                <span className="font-medium">{top.title}</span>
                <span className="text-muted-foreground">
                  {" · "}
                  {top.sub}
                  {needs.length > 1 ? ` · the most urgent of ${needs.length}` : ""}
                </span>
              </span>
            </Row>
          </RowList>
        </Section>
      ) : null}

      {/* ASK — at the foot: the differentiated action, invited with contextual questions (topbar owns input) */}
      <AskSuggestions />
    </div>
  );
}
