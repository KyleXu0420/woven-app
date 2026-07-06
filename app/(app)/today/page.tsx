import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { StatusPill, TypeBadge, Connections } from "@/components/artifact-ui";
import { AgentAvatar, PersonAvatar } from "@/components/identity";
import { artifactConns, getArtifact, getPeek, listActivity, listArtifacts } from "@/lib/api";
import type { Artifact, Conn } from "@/lib/types";

function SectionEyebrow({ label, action, href }: { label: string; action?: string; href?: string }) {
  return (
    <div className="mt-10 mb-4 flex items-center justify-between gap-3">
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
      {action && href ? (
        <Link href={href} className="text-xs text-muted-foreground transition-colors hover:text-foreground">
          {action}
        </Link>
      ) : null}
    </div>
  );
}

// ① PREVIEW cover — a generated cover IMAGE (full-bleed abstract artwork), shared

// deterministic per-artifact, so a card's cover is its own and stays stable across renders
function coverSeed(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

// A two-hue gradient mesh drawn from the identity palette, plus one soft composition (aurora / waves /
// orbits / facets) and a light sheen — real cover art, not gray bars. No two artifacts share a cover.
function CoverArt({ a }: { a: Artifact }) {
  const seed = coverSeed(a.id);
  const i1 = seed % 12;
  const i2 = (i1 + 3 + ((seed >> 6) % 4)) % 12; // a related-but-distinct palette hue for depth
  const hue1 = `var(--chart-${i1 + 1})`;
  const hue2 = `var(--chart-${i2 + 1})`;
  const variant = (seed >> 2) % 4;
  const uid = a.id.replace(/[^a-zA-Z0-9]/g, "");
  const r = (n: number, lo: number, hi: number) => lo + (((seed >> n) % 1000) / 1000) * (hi - lo);

  return (
    <svg
      viewBox="0 0 400 260"
      preserveAspectRatio="xMidYMid slice"
      className="h-full w-full"
      role="img"
      aria-label={`${a.title} cover`}
    >
      <defs>
        <linearGradient id={`g-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={hue1} />
          <stop offset="100%" stopColor={hue2} />
        </linearGradient>
        <radialGradient id={`sheen-${uid}`} cx="26%" cy="18%" r="85%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.5" />
          <stop offset="55%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <filter id={`blur-${uid}`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="30" />
        </filter>
      </defs>

      {/* two-hue base + a blurred hue blob for mesh depth */}
      <rect width="400" height="260" fill={`url(#g-${uid})`} />
      <circle cx={r(3, 70, 330)} cy={r(7, 40, 220)} r={135} fill={hue2} opacity="0.5" filter={`url(#blur-${uid})`} />

      {variant === 0 ? (
        <>
          <circle cx={r(9, 0, 150)} cy={r(11, 130, 260)} r={125} fill="#ffffff" opacity="0.16" filter={`url(#blur-${uid})`} />
          <circle cx={r(13, 250, 400)} cy={r(15, 0, 110)} r={110} fill="#000000" opacity="0.14" filter={`url(#blur-${uid})`} />
        </>
      ) : variant === 1 ? (
        <g fill="none">
          <path
            d={`M-20 ${r(9, 150, 190)} C 110 ${r(11, 110, 150)}, 300 ${r(13, 190, 230)}, 420 ${r(15, 140, 180)}`}
            stroke="#ffffff"
            strokeOpacity="0.22"
            strokeWidth="10"
          />
          <path
            d={`M-20 ${r(17, 195, 225)} C 130 ${r(19, 150, 190)}, 280 ${r(21, 220, 250)}, 420 ${r(8, 185, 215)}`}
            stroke="#000000"
            strokeOpacity="0.13"
            strokeWidth="14"
          />
        </g>
      ) : variant === 2 ? (
        <g fill="none" stroke="#ffffff" strokeOpacity="0.18">
          {[60, 112, 168, 228].map((rr, k) => (
            <circle key={k} cx={r(9, 300, 400)} cy={r(11, 0, 70)} r={rr} strokeWidth={k === 1 ? 3 : 1.5} />
          ))}
        </g>
      ) : (
        <g>
          <polygon points={`0,260 ${r(9, 130, 210)},260 0,${r(11, 60, 140)}`} fill="#000000" opacity="0.12" />
          <polygon points={`400,0 ${r(13, 200, 300)},0 400,${r(15, 120, 200)}`} fill="#ffffff" opacity="0.16" />
        </g>
      )}

      {/* sheen + a bottom shade so the identity/type chips below stay legible */}
      <rect width="400" height="260" fill={`url(#sheen-${uid})`} />
      <rect y="160" width="400" height="100" fill="#000000" opacity="0.08" />
    </svg>
  );
}

// the grid artifact card — three zones: ① cover ② identity ③ connections
function ArtifactCard({ a, conns }: { a: Artifact; conns: Conn[] }) {
  const htmlCover = a.type === "HTML" || !a.summary;
  return (
    <Card className="group flex cursor-pointer flex-col gap-0 overflow-hidden p-0 transition-all hover:-translate-y-px hover:border-ring/40">
      <div className="h-36 w-full overflow-hidden border-b">
        <CoverArt a={a} />
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
          <CoverArt a={a} />
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
  const inFlight = listArtifacts().filter((a) => a.state === "processing").length;
  const total = listArtifacts().length;

  return (
    <div className="mx-auto w-full max-w-5xl p-8 sm:p-10">
      <h1 className="font-serif text-3xl font-medium tracking-[-0.01em]">Today</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        <span className="font-medium text-foreground tabular-nums">
          {inFlight} doc{inFlight === 1 ? "" : "s"} in flight
        </span>{" "}
        · last touched <span className="font-mono text-xs">{hero.updated}</span> ago ·{" "}
        <span className="font-medium text-foreground tabular-nums">{total}</span> artifacts in your space
      </p>

      <SectionEyebrow label="Continue" action="See all" href="/library" />
      <Link href={`/artifact/${hero.id}`} className="block">
        <HeroCard a={hero} conns={artifactConns(hero.id)} peek={getPeek(hero.id)} />
      </Link>

      <SectionEyebrow label="Recent" action="Open Library" href="/library" />
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
          <div
            key={a.id}
            className="flex items-center gap-3 rounded-xl border bg-transparent px-3.5 py-3"
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
          </div>
        ))}
      </div>

      <p className="mt-12 text-center text-xs text-muted-foreground">
        Drop a file anywhere on this page to weave it in
      </p>
    </div>
  );
}
