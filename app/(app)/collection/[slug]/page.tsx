"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Globe, Eye, EyeOff, Link2, ExternalLink, Plus, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { notify } from "@/lib/notifications";
import { TypeBadge } from "@/components/artifact-ui";
import { ShareCollectionDialog } from "@/components/share-collection-dialog";
import { ShareMenu } from "@/components/share-menu";
import { AddDocumentsDialog } from "@/components/add-documents";
import { CollectionMap } from "@/components/collection-map";
import { EmergentMark } from "@/components/emergent-mark";
import { ViewTabs, SegToggle } from "@/components/controls";
import {
  addArtifactsToCollection,
  collectionBySlug,
  collectionContents,
  collectionPublicMembers,
  getAnalytics,
  listCollectionCandidates,
  publishCollection,
  relationCount,
  resolveCollectionCandidate,
} from "@/lib/api";
import { bumpGraph } from "@/lib/store";
import { useCollectionDrop } from "@/lib/artifact-drag";
import type { ReaderRow, Stat } from "@/lib/types";
import { AgentAvatar, AnonAvatar, PersonAvatar } from "@/components/identity";

function RailLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
      {children}
    </p>
  );
}

function StatGrid({ stats }: { stats: Stat[] }) {
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-4">
      {stats.map((s) => (
        <div key={s.l} className="bg-card p-4">
          <div className="font-serif text-2xl tracking-[-0.01em] tabular-nums">{s.v}</div>
          <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {s.l}
          </div>
        </div>
      ))}
    </div>
  );
}

function Readers({ rows }: { rows: ReaderRow[] }) {
  return (
    <div className="flex flex-col gap-1">
      {rows.map((r) => (
        <div key={r.n + r.t} className="flex items-center gap-2 py-1 text-sm">
          {r.ext ? (
            <AnonAvatar size="sm" />
          ) : (
            <PersonAvatar seed={r.n} name={r.n} initials={r.i} size="sm" />
          )}
          <span className="flex-1 truncate text-foreground/80">{r.n}</span>
          <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">{r.t}</span>
        </div>
      ))}
    </div>
  );
}

export default function CollectionPage() {
  const { slug } = useParams<{ slug: string }>();
  const meta = collectionBySlug(slug);
  const hubUrl = `woven.dev/c/${meta.slug}`;
  const [addOpen, setAddOpen] = React.useState(false);
  const [ver, setVer] = React.useState(0);
  const contents = React.useMemo(() => collectionContents(meta.slug), [meta.slug, ver]);
  const liveCount = collectionPublicMembers(meta.slug).length;

  const [view, setView] = React.useState("contents");
  const [aud, setAud] = React.useState("public");

  // the whole page is a drop target — drag Library artifacts (or a desktop file) here to file them in
  const { isOver, dropProps } = useCollectionDrop({
    onArtifacts: (ids) => {
      addArtifactsToCollection(meta.id, ids);
      bumpGraph(); // refresh the sidebar counts (addArtifactsToCollection only persists)
      setVer((v) => v + 1);
      notify.success(`Added to ${meta.name}`, {
        description: `${ids.length} artifact${ids.length > 1 ? "s" : ""} filed.`,
      });
    },
    fileDest: meta.name,
  });

  const analytics = getAnalytics("collection", meta.slug, aud === "public" ? "public" : "internal");

  // the agent's gather for THIS collection — the review-&-approve landing (create → gather → approve)
  const candidates = React.useMemo(
    () => listCollectionCandidates().filter((c) => c.collectionId === meta.id),
    [meta.id, ver],
  );
  const [deselected, setDeselected] = React.useState<Set<string>>(new Set());
  const [pendingPublish, setPendingPublish] = React.useState(false);
  const approvedCount = candidates.length - deselected.size;

  function toggleCandidate(id: string) {
    setDeselected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }
  function approve() {
    candidates.forEach((c) => resolveCollectionCandidate(c.id, deselected.has(c.id) ? "skip" : "add"));
    const added = approvedCount;
    setDeselected(new Set());
    setVer((v) => v + 1);
    if (added > 0 && !meta.public) setPendingPublish(true);
    notify.success(added > 0 ? `Added ${added} to ${meta.name}` : "Suggestions dismissed");
  }
  function publishNow() {
    publishCollection(
      meta.slug,
      collectionContents(meta.slug).map(({ artifact }) => artifact.id),
      "public",
    );
    setVer((v) => v + 1);
    setPendingPublish(false);
    const shareUrl = `https://${hubUrl}`;
    notify.success("Published", {
      description: hubUrl,
      duration: 8000,
      action: {
        label: "Copy link",
        onClick: () => {
          void navigator.clipboard?.writeText(shareUrl);
          notify.success("Link copied", { description: "Share it anywhere." });
        },
      },
    });
  }

  return (
    <div {...dropProps} className="relative mx-auto w-full max-w-5xl p-8 sm:p-10">
      {/* drop cue — filing artifacts / a file into this collection by direct manipulation */}
      {isOver ? (
        <div className="pointer-events-none absolute inset-3 z-30 flex items-center justify-center rounded-2xl border-2 border-dashed border-primary bg-primary/[0.06] backdrop-blur-[1px] duration-150 animate-in fade-in-0">
          <span className="rounded-full bg-card px-4 py-2 text-sm font-medium text-primary shadow-sm ring-1 ring-primary/20">
            Add to {meta.name}
          </span>
        </div>
      ) : null}
      {/* breadcrumb */}
      <nav className="mb-6 flex items-center gap-1.5 text-xs text-muted-foreground">
        <span>Collections</span>
        <span className="opacity-50">/</span>
        <span className="text-foreground">{meta.name}</span>
      </nav>

      {/* header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <EmergentMark slug={meta.slug} className="mt-0.5 size-16 shrink-0" />
          <div>
            <h1 className="font-serif text-3xl font-medium tracking-[-0.01em]">{meta.name}</h1>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px] text-muted-foreground">
              <span>{contents.length} artifacts</span>
              <span className="opacity-50">·</span>
              {meta.public ? (
                <a
                  href={`/c/${meta.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-primary hover:underline"
                >
                  <Globe className="size-3" /> Published · {hubUrl}
                </a>
              ) : (
                <span className="inline-flex items-center gap-1.5">
                  <Globe className="size-3 opacity-60" /> Not published
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}>
            <Plus /> Add documents
          </Button>
          {meta.public ? (
            <Button
              variant="outline"
              size="icon"
              aria-label="View live"
              nativeButton={false}
              render={<a href={`/c/${meta.slug}`} target="_blank" rel="noopener noreferrer" />}
            >
              <ExternalLink />
            </Button>
          ) : null}
          {meta.public ? <ShareMenu title={meta.name} url={hubUrl} /> : null}
          <ShareCollectionDialog
            name={meta.name}
            slug={meta.slug}
            members={contents.map(({ artifact, pub }) => ({
              id: artifact.id,
              title: artifact.title,
              type: artifact.type,
              pub,
            }))}
            onPublished={() => setVer((v) => v + 1)}
          />
        </div>
      </div>

      {/* Contents | Audience */}
      <div className="mt-8">
        <ViewTabs
          options={[
            { id: "contents", label: "Contents" },
            { id: "map", label: "Map" },
            { id: "audience", label: "Audience" },
          ]}
          value={view}
          onChange={setView}
        />

        {view === "contents" ? (
          <div className="mt-4 space-y-4">
            {/* the agent's gather — review & approve (create → gather → approve) */}
            {candidates.length > 0 ? (
              <div className="rounded-xl border bg-card p-5">
                <div className="mb-3 flex items-center gap-2.5">
                  <AgentAvatar size="sm" state="thinking" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Woven gathered {approvedCount} for you</p>
                    {meta.intro ? (
                      <p className="truncate text-[12px] text-muted-foreground">matching “{meta.intro}”</p>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  {candidates.map((c) => {
                    const on = !deselected.has(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => toggleCandidate(c.id)}
                        className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-left transition-all ${
                          on
                            ? "border-foreground/20 bg-foreground/[0.03]"
                            : "border-transparent opacity-50 hover:opacity-100"
                        }`}
                      >
                        <span
                          className={`flex size-[18px] shrink-0 items-center justify-center rounded-[5px] border transition-colors ${
                            on ? "border-primary bg-primary text-primary-foreground" : "border-foreground/25"
                          }`}
                        >
                          {on ? <Check className="size-3" /> : null}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium">{c.artifactTitle}</span>
                          <span className="block truncate text-[11px] text-muted-foreground">{c.rationale}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <Button variant="ghost" size="sm" onClick={() => setAddOpen(true)}>
                    <Plus /> Add more
                  </Button>
                  <Button size="sm" onClick={approve}>
                    {approvedCount > 0 ? `Approve · ${approvedCount}` : "Dismiss all"}
                  </Button>
                </div>
              </div>
            ) : null}

            {/* publish folds into the tail — one tap, right after approve */}
            {pendingPublish && !meta.public ? (
              <div className="flex items-center gap-3 rounded-xl border border-primary/15 bg-primary/[0.04] px-4 py-3">
                <Globe className="size-4 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">Ready to share?</p>
                  <p className="text-[12px] text-muted-foreground">
                    Publish a public page for these {contents.length} artifact{contents.length === 1 ? "" : "s"}.
                  </p>
                </div>
                <Button size="sm" onClick={publishNow}>
                  Publish
                </Button>
                <IconButton label="Not now" size="icon-sm" onClick={() => setPendingPublish(false)}>
                  <X />
                </IconButton>
              </div>
            ) : null}

            {/* truly empty — no gather, no members */}
            {contents.length === 0 && candidates.length === 0 ? (
              <div className="rounded-xl border border-dashed bg-card/50 px-6 py-12 text-center">
                <p className="text-sm font-medium">Nothing here yet</p>
                <p className="mx-auto mt-1 max-w-sm text-[13px] text-muted-foreground">
                  Add documents to fill this collection.
                </p>
                <Button className="mt-4" onClick={() => setAddOpen(true)}>
                  <Plus /> Add artifacts
                </Button>
              </div>
            ) : null}

            {/* the members */}
            {contents.length > 0 ? (
              <div className="overflow-hidden rounded-xl border bg-card">
                {contents.map(({ artifact, pub }, i) => (
                  <Link
                    key={artifact.id}
                    href={`/artifact/${artifact.id}`}
                    className={`grid grid-cols-[3rem_1fr_auto] items-center gap-4 px-4 py-3.5 transition-colors hover:bg-foreground/[0.025] sm:grid-cols-[3.5rem_1fr_6rem_4rem_3rem] ${
                      i > 0 ? "border-t" : ""
                    }`}
                  >
                    <TypeBadge type={artifact.type} />
                    <span className="truncate text-sm font-medium">{artifact.title}</span>
                    <span
                      className={`hidden items-center gap-1 text-[11px] sm:flex ${
                        pub ? "text-primary" : "text-muted-foreground"
                      }`}
                    >
                      {pub ? <Eye className="size-3" /> : <EyeOff className="size-3" />}
                      {pub ? "Public" : "Private"}
                    </span>
                    <span className="hidden items-center gap-1 font-mono text-[11px] text-muted-foreground sm:flex">
                      <Link2 className="size-3 opacity-70" /> {relationCount(artifact.id)}
                    </span>
                    <span className="text-right font-mono text-[11px] tabular-nums text-muted-foreground">
                      {artifact.updated}
                    </span>
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        ) : view === "map" ? (
          <div className="mt-4">
            <CollectionMap slug={meta.slug} />
          </div>
        ) : (
          <div className="mt-4">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
              <SegToggle
                options={[
                  { id: "inside", label: "Inside Acme" },
                  { id: "public", label: "Public" },
                ]}
                value={aud}
                onChange={setAud}
              />
              <span className="text-[11px] text-muted-foreground">
                {aud === "public" ? (
                  <>
                    <span className="font-mono tabular-nums">{liveCount}</span> artifacts in the hub
                  </>
                ) : (
                  <>
                    team space · <span className="font-mono tabular-nums">14</span> members
                  </>
                )}
              </span>
            </div>

            {analytics ? (
              <>
                <StatGrid stats={analytics.stats} />

                <div className="mt-6 grid gap-x-8 gap-y-6 sm:grid-cols-[minmax(0,1fr)_220px]">
                  <div>
                    <RailLabel>{aud === "public" ? "Most-read artifacts" : "Most-active artifacts"}</RailLabel>
                    <div className="flex flex-col gap-2">
                      {analytics.readthrough.map((a) => (
                        <div key={a.h} className="flex items-center gap-3">
                          <span className="w-40 shrink-0 truncate text-sm">{a.h}</span>
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                            <div className="h-full rounded-full bg-primary/70" style={{ width: `${a.pct}%` }} />
                          </div>
                          <span className="w-9 shrink-0 text-right font-mono text-[11px] tabular-nums text-muted-foreground">
                            {a.pct}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <RailLabel>{aud === "public" ? "Recent readers" : "Active teammates"}</RailLabel>
                    <Readers rows={analytics.readers} />
                  </div>
                </div>
              </>
            ) : null}
          </div>
        )}
      </div>

      <AddDocumentsDialog
        collectionId={meta.id}
        collectionName={meta.name}
        open={addOpen}
        onOpenChange={setAddOpen}
        onAdded={() => setVer((v) => v + 1)}
      />
    </div>
  );
}
