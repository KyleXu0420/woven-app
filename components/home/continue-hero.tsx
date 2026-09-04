"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { StatusPill, TypeBadge, PeopleStack, CollectionTag } from "@/components/artifact-ui";
import { CoverArt } from "@/components/cover-art";
import { getArtifact, getArtifactGraph, getPeek, viewerRecents, VIEWER } from "@/lib/api";
import { useGraphVersion } from "@/lib/use-graph-version";

// RESUME. The page's one primary OBJECT — by size and by being the only bordered surface, never by colour.
// The doc is the one the viewer was last in (viewerRecents), not a fixed id. Four things differ from the
// Today hero it descends from: the status slot tells the truth (a doc whose source moved is not "Living");
// the verb is permanent and muted, not forest at opacity 0; the hover is tonal (the card's own edge deepens),
// not a 1px lift the rest of the app gave up; and the Link wears the house focus ring on the card's radius.
export function heroArtifactId(): string {
  return viewerRecents(VIEWER, 6).find((r) => r.kind === "artifact")?.id ?? "a_notif";
}

export function ContinueHero() {
  useGraphVersion();
  const a = getArtifact(heroArtifactId());
  if (!a) return null;
  const peek = getPeek(a.id);
  const people = getArtifactGraph(a.id).people;
  const stale = a.staleness ?? null;
  return (
    <Link
      href={`/artifact/${a.id}`}
      className="group block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
    >
      <Card className="gap-0 overflow-hidden p-0 transition-colors hover:ring-foreground/20">
        <div className="flex flex-col sm:flex-row">
          {/* ① preview — left, fills the card height; a third of the height on a phone */}
          <div className="h-32 border-b sm:h-auto sm:min-h-[150px] sm:w-[38%] sm:border-r sm:border-b-0">
            <CoverArt a={a} large />
          </div>

          {/* ② identity (type · collection · status) → gist → peek → ③ faces */}
          <div className="flex flex-1 flex-col gap-3.5 p-5 sm:p-6">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
                <TypeBadge type={a.type} />
                {a.collection_ids.length ? <CollectionTag ids={a.collection_ids} className="text-muted-foreground" /> : null}
                <StatusPill state={a.state} stale={stale} />
              </div>
              <span className="flex shrink-0 items-center gap-1 text-[14px] font-medium text-muted-foreground transition-colors group-hover:text-foreground group-focus-visible:text-foreground">
                {stale ? "Review" : "Continue"} <ArrowRight className="size-4" />
              </span>
            </div>

            <p className="text-[16px] leading-relaxed text-muted-foreground">{a.gist}</p>

            {peek.length ? (
              <ul className="flex flex-col gap-2.5 border-t pt-3.5">
                {peek.map((p, i) => (
                  <li key={p.s} className={`flex items-baseline gap-3 text-[14px] ${i > 0 ? "max-sm:hidden" : ""}`}>
                    <span className="w-9 shrink-0 tabular-nums text-muted-foreground">{p.t}</span>
                    <span className="text-foreground/75">{p.s}</span>
                  </li>
                ))}
              </ul>
            ) : null}

            <div className="flex items-center justify-between gap-2 border-t pt-3.5">
              <PeopleStack people={people} />
              <span className="shrink-0 text-[12px] tabular-nums text-muted-foreground">{a.updated}</span>
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}
