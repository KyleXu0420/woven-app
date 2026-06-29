import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { StatusPill, TypeBadge, Connections } from "@/components/artifact-ui";
import { AgentAvatar, PersonAvatar } from "@/components/identity";
import { artifactConns, getArtifact, getPeek, listActivity, listArtifacts } from "@/lib/api";
import type { Artifact, Conn } from "@/lib/types";

function SectionEyebrow({ label, action }: { label: string; action?: string }) {
  return (
    <div className="mt-10 mb-4 flex items-center justify-between gap-3">
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
      {action ? (
        <button className="text-xs text-muted-foreground transition-colors hover:text-foreground">
          {action}
        </button>
      ) : null}
    </div>
  );
}

// ① PREVIEW covers — shared
function CoverHtml() {
  return (
    <div className="flex h-full w-full flex-col gap-2 bg-gradient-to-br from-muted/60 to-card p-4">
      <div className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-[3px] bg-primary/40" />
        <span className="h-2 w-1/3 rounded-full bg-foreground/20" />
      </div>
      <span className="h-1.5 w-full rounded-full bg-foreground/10" />
      <span className="h-1.5 w-4/5 rounded-full bg-foreground/10" />
      <div className="mt-auto flex gap-2">
        <span className="h-11 flex-1 rounded-md bg-primary/12" />
        <span className="h-11 w-12 rounded-md bg-foreground/[0.06]" />
      </div>
    </div>
  );
}

function CoverMd({ summary }: { summary: string }) {
  return (
    <div className="flex h-full w-full items-center bg-card px-5">
      <p className="line-clamp-4 border-l-2 border-primary/15 pl-3.5 font-serif text-[13px] leading-[1.55] text-foreground/55">
        {summary}
      </p>
    </div>
  );
}

// the grid artifact card — three zones: ① cover ② identity ③ connections
function ArtifactCard({ a, conns }: { a: Artifact; conns: Conn[] }) {
  const htmlCover = a.type === "HTML" || !a.summary;
  return (
    <Card className="group flex cursor-pointer flex-col gap-0 overflow-hidden p-0 transition-all hover:-translate-y-px hover:border-ring/40">
      <div className="h-36 w-full overflow-hidden border-b">
        {htmlCover ? <CoverHtml /> : <CoverMd summary={a.summary!} />}
      </div>
      <div className="flex flex-col gap-2.5 p-4">
        {/* MD + LIVING sit together (left), not split to opposite ends */}
        <div className="flex items-center gap-2">
          <TypeBadge type={a.type} />
          <StatusPill state={a.state} />
        </div>
        {/* title + sub-line are a tight pair (name + meta) */}
        <div>
          <h3 className="line-clamp-2 font-serif text-[17px] leading-[1.3] tracking-[-0.01em]">
            {a.title}
          </h3>
          <p className="mt-1 line-clamp-1 text-[13px] text-muted-foreground">
            {htmlCover ? a.gist : a.scale}
          </p>
        </div>
        <Connections items={conns} />
      </div>
    </Card>
  );
}

// the hero — SAME three zones as the grid card, laid out horizontally + with a peek list
function HeroCard({ a, conns, peek }: { a: Artifact; conns: Conn[]; peek: { t: string; s: string }[] }) {
  return (
    <Card className="group gap-0 overflow-hidden p-0 transition-all hover:-translate-y-px hover:border-ring/30">
      <div className="flex flex-col sm:flex-row">
        {/* ① preview — left, fills the card height */}
        <div className="min-h-[150px] border-b sm:w-[38%] sm:border-r sm:border-b-0">
          <CoverHtml />
        </div>

        {/* ② identity → peek → ③ connections */}
        <div className="flex flex-1 flex-col gap-3 p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TypeBadge type={a.type} />
              <StatusPill state={a.state} />
            </div>
            <span className="flex items-center gap-1 text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
              Continue <ArrowRight className="size-3.5" />
            </span>
          </div>

          <div>
            <h3 className="font-serif text-xl leading-snug">{a.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{a.gist}</p>
          </div>

          {/* hero extra — recent activity on this artifact */}
          <ul className="flex flex-col gap-2 border-t pt-3">
            {peek.map((p) => (
              <li key={p.s} className="flex items-baseline gap-3 text-xs">
                <span className="w-9 shrink-0 font-mono tabular-nums text-muted-foreground">{p.t}</span>
                <span className="text-foreground/75">{p.s}</span>
              </li>
            ))}
          </ul>

          <Connections items={conns} />
        </div>
      </div>
    </Card>
  );
}

export default function TodayPage() {
  const hero = getArtifact("a_notif")!;
  const recent = listArtifacts()
    .filter((a) => a.id !== hero.id)
    .slice(0, 3);
  const activity = listActivity();

  return (
    <div className="mx-auto w-full max-w-5xl p-8 sm:p-10">
      <h1 className="font-serif text-3xl font-medium tracking-[-0.01em]">Tuesday afternoon</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        <span className="font-medium text-foreground tabular-nums">1 doc in flight</span> · last
        touched <span className="font-mono text-xs">{hero.updated}</span> ago ·{" "}
        <span className="font-medium text-foreground tabular-nums">6</span> drops landed this week
      </p>

      <SectionEyebrow label="Continue" action="See all" />
      <Link href={`/artifact/${hero.id}`} className="block">
        <HeroCard a={hero} conns={artifactConns(hero.id)} peek={getPeek(hero.id)} />
      </Link>

      <SectionEyebrow label="Recent" action="Open Library" />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {recent.map((a) => (
          <Link key={a.id} href={`/artifact/${a.id}`} className="block">
            <ArtifactCard a={a} conns={artifactConns(a.id)} />
          </Link>
        ))}
      </div>

      <SectionEyebrow label="Activity" />
      <div className="grid gap-2.5 sm:grid-cols-2">
        {activity.map((a) => (
          <button
            key={a.id}
            className="flex items-center gap-3 rounded-xl border bg-transparent px-3.5 py-3 text-left transition-colors hover:bg-foreground/[0.025]"
          >
            {a.agent ? (
              <AgentAvatar />
            ) : (
              <PersonAvatar seed={a.actor ?? a.initial} name={a.initial} />
            )}
            <span className="flex-1 truncate text-sm text-foreground/80">{a.text}</span>
            <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
              {a.t}
            </span>
          </button>
        ))}
      </div>

      <p className="mt-12 text-center text-xs text-muted-foreground">
        Drop a file anywhere on this page to weave it in
      </p>
    </div>
  );
}
