"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { StatusPill, TypeBadge, PeopleStack, CollectionTag } from "@/components/artifact-ui";
import { CoverArt } from "@/components/cover-art";
import { FOCUS_RING } from "@/components/classes";
import { homeFacts } from "@/components/home/home-facts";
import { getArtifact, getArtifactGraph, getPeek } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useGraphVersion } from "@/lib/use-graph-version";

// RESUME. The page's one primary OBJECT — by size and by being the only bordered surface, never by colour.
// The doc is the one the viewer was last in (the shared snapshot's heroId), not a fixed id. Four things differ
// from the Today hero it descends from: the status slot tells the truth (a doc whose source moved is not
// "Living"); the verb is permanent and muted, not forest at opacity 0; the hover is tonal (the card's own edge
// deepens), not a 1px lift the rest of the app gave up; and the Link wears the house focus ring on the radius.
export function ContinueHero() {
  const { heroId } = homeFacts(useGraphVersion());
  const a = getArtifact(heroId);
  if (!a) return null;
  const peek = getPeek(a.id);
  const people = getArtifactGraph(a.id).people;
  const stale = a.staleness ?? null;
  return (
    <Link
      href={`/artifact/${a.id}`}
      className={cn("group block rounded-lg", FOCUS_RING)}
    >
      <Card className="gap-0 overflow-hidden p-0 transition-colors hover:ring-line-hover">
        <div className="flex flex-col sm:flex-row">
          {/* ① the doc's cloth: from sm a mat filling the card height on the left, the Library band's own
              swatch centred on it; a 112px strip on a phone, the band across the card's head as the Library
              card sets it. The title is the text column's, so the cover passes label off and never carries a
              name of its own. */}
          <div className="h-28 border-b sm:h-auto sm:min-h-[150px] sm:w-[38%] sm:border-r sm:border-b-0">
            <CoverArt a={a} large label={false} />
          </div>

          {/* ② identity (type, collection, status) → title and gist → peek → ③ faces */}
          <div className="flex flex-1 flex-col gap-3 p-4 sm:gap-3.5 sm:p-6">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                <TypeBadge type={a.type} />
                {a.collection_ids.length ? <CollectionTag ids={a.collection_ids} className="text-muted-foreground" /> : null}
                <StatusPill state={a.state} stale={stale} />
              </div>
              <span className="flex shrink-0 items-center gap-1 text-sm font-medium text-muted-foreground transition-colors group-hover:text-foreground group-focus-visible:text-foreground">
                {stale ? "Review" : "Continue"} <ArrowRight className="size-4" />
              </span>
            </div>

            {/* The document's name. It lived on the cover, white on the gradient, so the card's words never said which
                doc this was and in dark the one name on the card was the one thing that dropped below contrast. It
                sits over its gist as a pair, the heading rung over the body rung; below sm the gist sits on the
                Interface register and clamps, so the hero holds at ≤360px on a phone. */}
            <div className="flex flex-col gap-1">
              <h2 className="text-xl font-medium text-foreground">{a.title}</h2>
              <p className="text-base text-muted-foreground max-sm:line-clamp-2">{a.gist}</p>
            </div>

            {peek.length ? (
              <ul className="flex flex-col gap-2.5 border-t pt-3 sm:pt-3.5">
                {peek.map((p, i) => (
                  <li key={p.s} className={`flex items-baseline gap-3 text-sm ${i > 0 ? "max-sm:hidden" : ""}`}>
                    <span className="w-9 shrink-0 tabular-nums text-muted-foreground">{p.t}</span>
                    <span className="text-muted-foreground">{p.s}</span>
                  </li>
                ))}
              </ul>
            ) : null}

            <div className="flex items-center justify-between gap-2 border-t pt-3 sm:pt-3.5">
              <PeopleStack people={people} artifactId={a.id} />
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{a.updated}</span>
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}
