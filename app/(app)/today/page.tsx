import Link from "next/link";
import { ArrowRight, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusPill, TypeBadge, Connections } from "@/components/artifact-ui";
import { AgentAvatar } from "@/components/identity";
import { CatchUp } from "@/components/catch-up";
import { AskSuggestions } from "@/components/ask-suggestions";
import { Section, Row, RowList, SectionAction } from "@/components/today-ui";
import { artifactConns, getArtifact, getPeek, listArtifacts, needsYou } from "@/lib/api";
import { PAGE_FRAME } from "@/lib/frame";
import type { Artifact, Conn } from "@/lib/types";

// ① PREVIEW cover — a generated cover IMAGE (full-bleed abstract artwork), shared

// deterministic per-artifact, so a card's cover is its own and stays stable across renders
function coverSeed(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

// A two-hue gradient mesh drawn from the identity palette, plus one soft composition (aurora / waves /
// orbits / facets) and a light sheen — real cover art, not gray bars. No two artifacts share a cover.
function CoverArt({
  a,
  label = true,
  excerpt,
  large = false,
}: {
  a: Artifact;
  label?: boolean;
  excerpt?: string;
  large?: boolean; // the hero cover — bigger text + roomier padding
}) {
  const seed = coverSeed(a.id);
  const i1 = seed % 12;
  const i2 = (i1 + 3 + ((seed >> 6) % 4)) % 12; // a related-but-distinct palette hue for depth
  const hue1 = `var(--chart-${i1 + 1})`;
  const hue2 = `var(--chart-${i2 + 1})`;
  const variant = (seed >> 2) % 4;
  const uid = a.id.replace(/[^a-zA-Z0-9]/g, "");
  const r = (n: number, lo: number, hi: number) => lo + (((seed >> n) % 1000) / 1000) * (hi - lo);

  return (
    <div className="relative h-full w-full overflow-hidden bg-card">
      <svg
        viewBox="0 0 400 260"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={`g-${uid}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={hue1} />
            <stop offset="100%" stopColor={hue2} />
          </linearGradient>
          {/* a whisper of light — kept low so it reads matte, not glossy */}
          <radialGradient id={`sheen-${uid}`} cx="28%" cy="22%" r="85%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.16" />
            <stop offset="60%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
          <filter id={`blur-${uid}`} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="30" />
          </filter>
        </defs>

        {/* two-hue base + a blurred hue blob for mesh depth */}
        <rect width="400" height="260" fill={`url(#g-${uid})`} />
        <circle cx={r(3, 70, 330)} cy={r(7, 40, 220)} r={135} fill={hue2} opacity="0.34" filter={`url(#blur-${uid})`} />

        {variant === 0 ? (
          <>
            <circle cx={r(9, 0, 150)} cy={r(11, 130, 260)} r={125} fill="#ffffff" opacity="0.09" filter={`url(#blur-${uid})`} />
            <circle cx={r(13, 250, 400)} cy={r(15, 0, 110)} r={110} fill="#000000" opacity="0.1" filter={`url(#blur-${uid})`} />
          </>
        ) : variant === 1 ? (
          <g fill="none">
            <path
              d={`M-20 ${r(9, 150, 190)} C 110 ${r(11, 110, 150)}, 300 ${r(13, 190, 230)}, 420 ${r(15, 140, 180)}`}
              stroke="#ffffff"
              strokeOpacity="0.12"
              strokeWidth="10"
            />
            <path
              d={`M-20 ${r(17, 195, 225)} C 130 ${r(19, 150, 190)}, 280 ${r(21, 220, 250)}, 420 ${r(8, 185, 215)}`}
              stroke="#000000"
              strokeOpacity="0.1"
              strokeWidth="14"
            />
          </g>
        ) : variant === 2 ? (
          <g fill="none" stroke="#ffffff" strokeOpacity="0.11">
            {[60, 112, 168, 228].map((rr, k) => (
              <circle key={k} cx={r(9, 300, 400)} cy={r(11, 0, 70)} r={rr} strokeWidth={k === 1 ? 3 : 1.5} />
            ))}
          </g>
        ) : (
          <g>
            <polygon points={`0,260 ${r(9, 130, 210)},260 0,${r(11, 60, 140)}`} fill="#000000" opacity="0.09" />
            <polygon points={`400,0 ${r(13, 200, 300)},0 400,${r(15, 120, 200)}`} fill="#ffffff" opacity="0.09" />
          </g>
        )}

        <rect width="400" height="260" fill={`url(#sheen-${uid})`} />
      </svg>

      {/* text set over the art — the excerpt (MD) or the title (HTML), so no cover is a bare gradient */}
      {excerpt ? (
        <div
          className={`absolute inset-0 flex items-center bg-gradient-to-t from-black/55 via-black/25 to-black/10 ${
            large ? "px-7" : "px-5"
          }`}
        >
          <p
            className={`line-clamp-4 font-serif text-white/95 [text-shadow:0_1px_5px_rgba(0,0,0,0.35)] ${
              large ? "text-base leading-[1.6]" : "text-[13px] leading-[1.55]"
            }`}
          >
            {excerpt}
          </p>
        </div>
      ) : label ? (
        <div
          className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/45 to-transparent ${
            large ? "p-6 pt-16" : "p-3.5 pt-10"
          }`}
        >
          <h4
            className={`line-clamp-2 font-serif font-medium leading-tight text-white [text-shadow:0_1px_5px_rgba(0,0,0,0.35)] ${
              large ? "text-2xl" : "text-[15px]"
            }`}
          >
            {a.title}
          </h4>
        </div>
      ) : null}
    </div>
  );
}

// the hero — SAME three zones as the grid card, laid out horizontally + with a peek list
function HeroCard({ a, conns, peek }: { a: Artifact; conns: Conn[]; peek: { t: string; s: string }[] }) {
  return (
    <Card className="group gap-0 overflow-hidden p-0 transition-all hover:-translate-y-px hover:border-ring/30">
      <div className="flex flex-col sm:flex-row">
        {/* ① preview — left, fills the card height */}
        <div className="h-40 border-b sm:h-auto sm:min-h-[150px] sm:w-[38%] sm:border-r sm:border-b-0">
          <CoverArt a={a} large />
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
            <p className="text-sm text-muted-foreground">{a.gist}</p>
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
  const needs = needsYou();
  const top = needs[0]; // the single most-urgent — the rest live in the Inbox
  const inFlight = listArtifacts().filter((a) => a.state === "processing").length;
  const total = listArtifacts().length;

  return (
    <div className={PAGE_FRAME.focused}>
      <h1 className="font-serif text-3xl font-medium tracking-[-0.01em]">Today</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        <span className="font-medium text-foreground tabular-nums">
          {inFlight} doc{inFlight === 1 ? "" : "s"} in flight
        </span>{" "}
        ·{" "}
        {needs.length ? (
          <>
            <span className="font-medium text-foreground tabular-nums">{needs.length}</span> need you ·{" "}
          </>
        ) : null}
        <span className="font-medium text-foreground tabular-nums">{total}</span> artifacts in your space
      </p>

      {/* RESUME — Continue leads with the ONE doc you were last in (the page's anchor). Browsing the rest is a
          hand-off to Library (All in Library →), not a secondary list that duplicates it and splits the block. */}
      <Section label="Continue" action={<SectionAction href="/library">All in Library</SectionAction>}>
        <Link href={`/artifact/${hero.id}`} className="block">
          <HeroCard a={hero} conns={artifactConns(hero.id)} peek={getPeek(hero.id)} />
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
                    className="size-4"
                    style={{ color: "color-mix(in srgb, var(--chart-2) 68%, var(--foreground))" }}
                  />
                ) : (
                  <AgentAvatar size="xs" />
                )
              }
              trailing={
                <Button
                  size="sm"
                  variant={top.kind === "stale" ? "outline" : "default"}
                  nativeButton={false}
                  render={<Link href={top.href} />}
                >
                  {top.action}
                </Button>
              }
            >
              <span className="block truncate text-[13px]">
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
