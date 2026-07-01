"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Globe, Eye, EyeOff, Link2, ExternalLink, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TypeBadge } from "@/components/artifact-ui";
import { PublishCollectionDialog } from "@/components/publish-collection-dialog";
import { ShareMenu } from "@/components/share-menu";
import { AddDocumentsDialog } from "@/components/add-documents";
import { CollectionMap } from "@/components/collection-map";
import { EmergentMark } from "@/components/emergent-mark";
import { ViewTabs, SegToggle } from "@/components/controls";
import {
  collectionBySlug,
  collectionContents,
  collectionPublicMembers,
  getAnalytics,
  relationCount,
} from "@/lib/api";
import type { ReaderRow, Stat } from "@/lib/types";
import { AnonAvatar, PersonAvatar } from "@/components/identity";

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
          <div className="mt-1 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
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

  const analytics = getAnalytics("collection", meta.slug, aud === "public" ? "public" : "internal");

  return (
    <div className="mx-auto w-full max-w-5xl p-8 sm:p-10">
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
              <a
                href={`/c/${meta.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-primary hover:underline"
              >
                <Globe className="size-3" /> Published · {hubUrl}
              </a>
            </p>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}>
            <Plus /> Add documents
          </Button>
          <a href={`/c/${meta.slug}`} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm">
              <ExternalLink /> View live
            </Button>
          </a>
          <ShareMenu title={meta.name} url={hubUrl} />
          <PublishCollectionDialog name={meta.name} slug={meta.slug} />
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
          <div className="mt-4 overflow-hidden rounded-xl border bg-primary/[0.06]">
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
              <span className="font-mono text-[11px] text-muted-foreground">
                {aud === "public" ? `${liveCount} artifacts in the hub` : "team space · 14 members"}
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
