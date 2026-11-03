"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, FileQuestion, Link2, Video } from "lucide-react";
import { ArtifactReader } from "@/components/artifact-reader";
import { ExactEvidenceSnapshot } from "@/components/exact-evidence-snapshot";
import {
  artifactVersions,
  canView,
  getArtifact,
  getArtifactGraph,
  hydrateState,
  sourceById,
} from "@/lib/api";
import { PAGE_FRAME } from "@/lib/frame";
import { bumpGraph } from "@/lib/store";
import { useGraphVersion } from "@/lib/use-graph-version";
import type { Artifact, Source } from "@/lib/types";

function LoadingArtifact() {
  return (
    <main className="min-h-screen bg-background">
      <div className={PAGE_FRAME.focused}>
        <div className="h-4 w-28 animate-pulse rounded-md bg-muted" />
        <div className="mt-12 h-7 w-2/3 animate-pulse rounded-md bg-muted" />
        <div className="mt-5 h-4 w-full animate-pulse rounded-md bg-muted" />
        <div className="mt-3 h-4 w-4/5 animate-pulse rounded-md bg-muted" />
        <div className="mt-10 h-80 animate-pulse rounded-lg bg-card" />
      </div>
    </main>
  );
}

function MissingArtifact({ versionLabel }: { versionLabel?: string }) {
  return (
    <main className="min-h-screen bg-background">
      <div className={`${PAGE_FRAME.focused} flex min-h-[70vh] items-center justify-center`}>
        <div className="max-w-md text-center">
          <span className="mx-auto flex size-10 items-center justify-center rounded-md bg-tint-1 text-muted-foreground">
            <FileQuestion className="size-5" />
          </span>
          {/* "not available in the evidence stored in this browser" was the storage model talking. The words stay
              the same for a missing doc and one this viewer may not open, so the page still cannot tell them apart. */}
          <h1 className="mt-4 text-2xl font-medium">
            {versionLabel ? "Version not found" : "Artifact not found"}
          </h1>
          <p className="mt-2 text-base text-muted-foreground">
            {versionLabel
              ? "This version of the document is not saved in this browser."
              : "Nothing at this link is saved in this browser."}
          </p>
          <Link
            href="/library"
            className="mt-5 inline-flex min-h-11 items-center gap-1.5 rounded-md text-sm font-medium text-foreground underline-offset-4 outline-none transition-colors hover:underline focus-visible:ring-2 focus-visible:ring-focus md:min-h-0"
          >
            <ArrowLeft className="size-4" /> Back to Library
          </Link>
        </div>
      </div>
    </main>
  );
}

function ReferenceOnlyEvidence({ artifact, source }: { artifact: Artifact; source?: Source }) {
  const SourceIcon = source?.kind === "loom" ? Video : Link2;
  const timecode = source?.timecode_seconds;
  const timecodeLabel = timecode == null
    ? null
    : `${Math.floor(timecode / 60)}:${String(timecode % 60).padStart(2, "0")}`;
  return (
    <main className="min-h-screen bg-background">
      <header className="border-b bg-background">
        <div className="mx-auto flex h-[60px] w-full max-w-[900px] items-center gap-3 px-5 md:px-8">
          <Link
            href="/library"
            className="inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-focus"
          >
            <ArrowLeft className="size-4" /> Back to Library
          </Link>
          <span className="ml-auto rounded-full bg-tint-1 px-2.5 py-1 text-xs font-medium text-muted-foreground">
            Link only
          </span>
        </div>
      </header>
      <div className={`${PAGE_FRAME.focused} flex min-h-[70vh] items-center justify-center`}>
        {/* "Woven saved this locator … cannot be used as exact, settled evidence until a snapshot or transcript is
            supplied" was the capture model's vocabulary (locator, exact, settled); the same two facts in words */}
        <section className="w-full max-w-xl rounded-lg bg-card p-6 sm:p-8" aria-labelledby="reference-title">
          <span className="flex size-10 items-center justify-center rounded-md bg-tint-1 text-muted-foreground">
            <SourceIcon className="size-5" />
          </span>
          <p className="mt-5 text-xs font-medium text-muted-foreground">
            {source?.kind === "loom" ? "Loom video" : "External link"}
          </p>
          <h1 id="reference-title" className="mt-2 text-2xl font-medium">
            {artifact.title}
          </h1>
          <p className="mt-3 text-base text-muted-foreground">
            Woven kept the link, not what it points to. Add a snapshot or a transcript before you rely on it as
            evidence.
          </p>
          {source?.note ? <p className="mt-4 text-sm text-foreground-prose">{source.note}</p> : null}
          {timecodeLabel ? (
            <p className="mt-3 text-xs tabular-nums text-muted-foreground">Starts at {timecodeLabel}</p>
          ) : null}
          {source?.href ? (
            <a
              href={source.href}
              target="_blank"
              rel="noreferrer"
              className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full border bg-background px-4 text-sm font-medium outline-none transition-colors hover:bg-tint-1 focus-visible:ring-2 focus-visible:ring-focus"
            >
              Open original source <ArrowUpRight className="size-4" />
            </a>
          ) : null}
        </section>
      </div>
    </main>
  );
}

export function ArtifactPageClient({
  artifactId,
  versionLabel,
}: {
  artifactId: string;
  versionLabel?: string;
}) {
  const [hydrated, setHydrated] = React.useState(false);
  useGraphVersion();

  React.useEffect(() => {
    let cancelled = false;
    void hydrateState().then(() => {
      bumpGraph();
      if (!cancelled) setHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!hydrated) return <LoadingArtifact />;

  if (!canView(artifactId)) return <MissingArtifact versionLabel={versionLabel} />;

  const artifact = getArtifact(artifactId);
  if (!artifact) return <MissingArtifact versionLabel={versionLabel} />;

  if (!versionLabel) {
    const versions = artifactVersions(artifactId);
    if (!versions.length) {
      const sourceRef = getArtifactGraph(artifactId).sources[0];
      const source = sourceRef ? sourceById(sourceRef.id) : undefined;
      if (source?.capture_state === "reference_only" || source?.capture_state === "unavailable") {
        return <ReferenceOnlyEvidence artifact={artifact} source={source} />;
      }
    }
    return <ArtifactReader artifactId={artifactId} />;
  }

  const version = artifactVersions(artifactId).find(
    (item) => item.label === versionLabel || item.id === versionLabel,
  );
  if (!version) return <MissingArtifact versionLabel={versionLabel} />;

  if (version.snapshot?.format === "html") {
    return <ExactEvidenceSnapshot artifact={artifact} version={version} />;
  }

  return <ArtifactReader artifactId={artifactId} versionLabel={version.label} />;
}
