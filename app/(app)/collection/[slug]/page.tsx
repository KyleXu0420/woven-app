"use client";

import * as React from "react";
import Link from "next/link";
import { PAGE_FRAME } from "@/lib/frame";
import { useParams } from "next/navigation";
import {
  Globe,
  Eye,
  EyeOff,
  Link2,
  ExternalLink,
  Plus,
  Check,
  X,
  Download,
  RefreshCw,
  GripVertical,
  FolderMinus,
  MoreHorizontal,
  ArrowUpRight,
  ArrowUp,
  ArrowDown,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import { EXPORT_FORMATS, exportArtifacts, type ExportFormat } from "@/lib/export";
import { notify } from "@/lib/notifications";
import { TypeBadge } from "@/components/artifact-ui";
import { ShareCollectionDialog } from "@/components/share-collection-dialog";
import { AddDocumentsDialog } from "@/components/add-documents";
import { CollectionMap } from "@/components/collection-map";
import { EmergentMark } from "@/components/emergent-mark";
import { ViewTabs } from "@/components/controls";
import {
  addArtifactsToCollection,
  collectionBySlug,
  collectionContents,
  collectionMembers,
  collectionPublicMembers,
  getAnalytics,
  listCollectionCandidates,
  publishCollection,
  relationCount,
  removeArtifactFromCollection,
  reorderCollectionMembers,
  rescanCollection,
  resolveCollectionCandidate,
} from "@/lib/api";
import { bumpGraph } from "@/lib/store";
import { useCollectionDrop } from "@/lib/artifact-drag";
import type { ReaderRow, Stat } from "@/lib/types";
import { AgentAvatar, AnonAvatar, PersonAvatar } from "@/components/identity";

// members drag to curate their order — a dedicated MIME type so the page's file/artifact drop
// (useCollectionDrop) ignores the reorder drag entirely (it only reacts to x-woven-artifacts / Files).
const REORDER_TYPE = "application/x-woven-member-reorder";

// date-range windows for the trend chart — slice the last N points of the daily series
const RANGES = [
  { id: "7d", label: "7d", n: 7 },
  { id: "30d", label: "30d", n: 30 },
  { id: "all", label: "All", n: 999 },
];

function RailLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 text-[13px] font-medium text-muted-foreground">
      {children}
    </p>
  );
}

// a period-over-period change — forest when up (good), muted when down; the ↑/↓ carries direction so the
// colour stays calm (no alarm-red on a dip)
function Delta({ v }: { v: number }) {
  const up = v >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[12px] font-medium tabular-nums ${up ? "text-primary" : "text-muted-foreground"}`}>
      {up ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
      {Math.abs(v)}%
    </span>
  );
}

// the KPI row — open figures separated by hairline rules, NOT a bordered card grid (minimize cards). Serif
// display for the hero number, Inter tabular-nums for the delta; each number carries its trend.
function KpiRow({ stats }: { stats: Stat[] }) {
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-4 sm:gap-0">
      {stats.map((s, i) => (
        <div key={s.l} className={`sm:px-6 sm:first:pl-0 ${i > 0 ? "sm:border-l sm:border-border/60" : ""}`}>
          <div className="flex items-baseline gap-2">
            <span className="font-serif text-[26px] leading-none tracking-[-0.01em] tabular-nums">{s.v}</span>
            {s.delta != null ? <Delta v={s.delta} /> : null}
          </div>
          <div className="mt-1.5 text-[13px] font-medium text-muted-foreground">{s.l}</div>
        </div>
      ))}
    </div>
  );
}

// the hero trend chart — a big area + line (Visitors-style), the metric over the selected range. Stretched to
// full width (non-scaling stroke keeps the line crisp); a soft forest gradient grounds it. No axis chrome —
// the shape + the range label carry it. Leads the analytics view, so it reads as a real dashboard.
function TrendChart({ points }: { points: number[] }) {
  const [hover, setHover] = React.useState<number | null>(null);
  const W = 640, H = 150, PADY = 12;
  const max = Math.max(...points), min = Math.min(...points), range = max - min || 1;
  const n = points.length;
  const step = W / Math.max(n - 1, 1);
  const yOf = (p: number) => PADY + (H - PADY * 2) * (1 - (p - min) / range);
  const line = points.map((p, i) => `${i ? "L" : "M"}${(i * step).toFixed(1)} ${yOf(p).toFixed(1)}`).join(" ");
  // hover reads the nearest day off the pointer's x-fraction; overlays are positioned in % so they track the
  // stretched (preserveAspectRatio=none) svg without a width measurement
  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    setHover(Math.max(0, Math.min(n - 1, Math.round(((e.clientX - r.left) / r.width) * (n - 1)))));
  }
  const hx = hover != null ? (hover / Math.max(n - 1, 1)) * 100 : 0;
  const hy = hover != null ? (yOf(points[hover]) / H) * 100 : 0;
  return (
    <div className="relative" onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-40 w-full" role="img" aria-label="Trend">
        <defs>
          <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.16" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`${line} L${W} ${H} L0 ${H} Z`} fill="url(#trend-fill)" />
        <path
          d={line}
          fill="none"
          stroke="var(--primary)"
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {hover != null ? (
        <>
          <div className="pointer-events-none absolute inset-y-0 w-px bg-primary/25" style={{ left: `${hx}%` }} />
          <div
            className="pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary bg-card"
            style={{ left: `${hx}%`, top: `${hy}%` }}
          />
          <div
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-md bg-foreground px-1.5 py-0.5 text-[11px] font-medium tabular-nums whitespace-nowrap text-background shadow-sm"
            style={{ left: `${Math.max(4, Math.min(96, hx))}%`, top: `calc(${hy}% - 6px)` }}
          >
            {points[hover].toLocaleString()}
          </div>
        </>
      ) : null}
    </div>
  );
}

// a breakdown list — a name (referrer / channel / most-read artifact) + a proportional bar + its figure. The
// Visitors "Top Sources / Pages / Countries" drill, as a calm open list (no card). pct? → shows a %, else a count.
function BarList({ rows }: { rows: { name: string; value: number; pct?: number }[] }) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <div className="flex flex-col gap-2.5">
      {rows.map((r) => (
        <div key={r.name} className="flex items-center gap-3">
          <span className="w-32 shrink-0 truncate text-[14px]">{r.name}</span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary/70" style={{ width: `${r.pct ?? (r.value / max) * 100}%` }} />
          </div>
          <span className="w-9 shrink-0 text-right text-[12px] tabular-nums text-muted-foreground">
            {r.pct != null ? `${r.pct}%` : r.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function Readers({ rows }: { rows: ReaderRow[] }) {
  return (
    <div className="flex flex-col gap-1">
      {rows.map((r) => (
        <div key={r.n + r.t} className="flex items-center gap-2 py-1 text-[15px]">
          {r.ext ? (
            <AnonAvatar size="sm" />
          ) : (
            <PersonAvatar seed={r.n} name={r.n} initials={r.i} size="sm" />
          )}
          <span className="flex-1 truncate text-foreground/80">{r.n}</span>
          <span className="shrink-0 text-[12px] tabular-nums text-muted-foreground">{r.t}</span>
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
  const [range, setRange] = React.useState("30d");
  const [dragIdx, setDragIdx] = React.useState<number | null>(null);
  const [overIdx, setOverIdx] = React.useState<number | null>(null);

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

  // rescan (smart collections) — re-run the agent's gather; new matches appear as candidates above
  function rescan() {
    const n = rescanCollection(meta.slug);
    setVer((v) => v + 1);
    notify.success(n > 0 ? `Found ${n} new match${n === 1 ? "" : "es"}` : "No new matches", {
      description: n > 0 ? "Review the suggestions below." : "Everything matching is already here.",
    });
  }
  // export the whole collection — reuses the artifact export builders (MD / HTML / JSON-with-graph)
  function exportCollection(format: ExportFormat) {
    const ids = collectionMembers(meta.slug).map((a) => a.id);
    if (ids.length === 0) return;
    const name = exportArtifacts(ids, format);
    notify.success(`Exported ${ids.length} artifact${ids.length === 1 ? "" : "s"}`, { description: name });
  }
  // member management — un-file and drag-to-reorder
  function removeMember(id: string, title: string) {
    const idx = contents.findIndex(({ artifact }) => artifact.id === id); // remember the slot for undo
    removeArtifactFromCollection(meta.id, id);
    bumpGraph(); // refresh the sidebar counts (removeArtifactFromCollection only persists)
    setVer((v) => v + 1);
    notify.success("Removed from collection", {
      description: title,
      // un-filing is reversible — re-add and restore the original position (not just append to the end)
      action: {
        label: "Undo",
        onClick: () => {
          addArtifactsToCollection(meta.id, [id]);
          const order = collectionContents(meta.slug)
            .map(({ artifact }) => artifact.id)
            .filter((x) => x !== id);
          order.splice(idx < 0 ? order.length : idx, 0, id);
          reorderCollectionMembers(meta.slug, order);
          bumpGraph();
          setVer((v) => v + 1);
        },
      },
    });
  }
  function moveMember(from: number, to: number) {
    if (from === to) return;
    const ids = contents.map(({ artifact }) => artifact.id);
    const [moved] = ids.splice(from, 1);
    // the drop indicator sits above row `to` ("insert before it"); after removing `from`, a downward move
    // shifts the target left by one, so insert at to-1 to actually land before the original target row.
    ids.splice(from < to ? to - 1 : to, 0, moved);
    reorderCollectionMembers(meta.slug, ids);
    setVer((v) => v + 1);
  }
  const showMenu = meta.kind === "typed" || contents.length > 0;

  return (
    <div {...dropProps} className={`${PAGE_FRAME.browse} relative`}>
      {/* drop cue — filing artifacts / a file into this collection by direct manipulation */}
      {isOver ? (
        <div className="pointer-events-none absolute inset-3 z-30 flex items-center justify-center rounded-2xl border-2 border-dashed border-primary bg-primary/[0.06] backdrop-blur-[1px] duration-150 animate-in fade-in-0">
          <span className="rounded-full bg-card px-4 py-2 text-[15px] font-medium text-primary shadow-sm ring-1 ring-primary/20">
            Add to {meta.name}
          </span>
        </div>
      ) : null}
      {/* breadcrumb */}
      <nav className="mb-6 flex items-center gap-1.5 text-[13px] text-muted-foreground">
        <span>Collections</span>
        <span className="opacity-50">/</span>
        <span className="text-foreground">{meta.name}</span>
      </nav>

      {/* header */}
      {/* title on the left, actions right-aligned on its row; the title block shrinks (meta wraps) so the
          buttons stay pinned right instead of dropping below — stacks only on a genuinely narrow screen */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-3.5">
          <EmergentMark slug={meta.slug} className="mt-0.5 size-16 shrink-0" />
          <div className="min-w-0">
            <h1 className="truncate font-serif text-3xl font-medium tracking-[-0.01em]">{meta.name}</h1>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[12px] text-muted-foreground">
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
          {/* View live — open the published hub the Audience data is about; kept as an explicit button (the
              meta-line URL links there too, but this is the deliberate "go see my live page" affordance) */}
          {meta.public ? (
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="View live"
              nativeButton={false}
              render={<a href={`/c/${meta.slug}`} target="_blank" rel="noopener noreferrer" />}
            >
              <ExternalLink />
            </Button>
          ) : null}
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
          {showMenu ? (
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="outline" size="icon-sm" aria-label="More actions" />}>
                <MoreHorizontal />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {meta.kind === "typed" ? (
                  <DropdownMenuItem onClick={rescan} className="gap-2">
                    <RefreshCw /> Rescan for matches
                  </DropdownMenuItem>
                ) : null}
                {meta.kind === "typed" && contents.length > 0 ? <DropdownMenuSeparator /> : null}
                {contents.length > 0 ? (
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger className="gap-2">
                      <Download /> Export collection
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="w-44">
                      {EXPORT_FORMATS.map((f) => (
                        <DropdownMenuItem key={f.key} className="gap-2" onClick={() => exportCollection(f.key)}>
                          {f.label}
                          <span className="ml-auto text-[12px] tabular-nums text-muted-foreground">{f.hint}</span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
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
                    <p className="text-[15px] font-medium">Woven gathered {approvedCount} for you</p>
                    {meta.intro ? (
                      <p className="truncate text-[13px] text-muted-foreground">matching “{meta.intro}”</p>
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
                          <span className="block truncate text-[14px] font-medium">{c.artifactTitle}</span>
                          <span className="block truncate text-[12px] text-muted-foreground">{c.rationale}</span>
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
                  <p className="text-[15px] font-medium">Ready to share?</p>
                  <p className="text-[13px] text-muted-foreground">
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
                <p className="text-[15px] font-medium">Nothing here yet</p>
                <p className="mx-auto mt-1 max-w-sm text-[14px] text-muted-foreground">
                  Add documents to fill this collection.
                </p>
                <Button className="mt-4" onClick={() => setAddOpen(true)}>
                  <Plus /> Add artifacts
                </Button>
              </div>
            ) : null}

            {/* the members */}
            {contents.length > 0 ? (
              <div>
                {contents.map(({ artifact, pub }, i) => (
                  <div
                    key={artifact.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData(REORDER_TYPE, String(i));
                      e.dataTransfer.effectAllowed = "move";
                      setDragIdx(i);
                    }}
                    onDragOver={(e) => {
                      if (!e.dataTransfer.types.includes(REORDER_TYPE)) return;
                      e.preventDefault();
                      e.stopPropagation(); // the reorder drag is ours — keep the page's file/artifact drop out
                      e.dataTransfer.dropEffect = "move";
                      if (overIdx !== i) setOverIdx(i);
                    }}
                    onDrop={(e) => {
                      if (!e.dataTransfer.types.includes(REORDER_TYPE)) return;
                      e.preventDefault();
                      e.stopPropagation();
                      if (dragIdx !== null) moveMember(dragIdx, i);
                      setDragIdx(null);
                      setOverIdx(null);
                    }}
                    onDragEnd={() => {
                      setDragIdx(null);
                      setOverIdx(null);
                    }}
                    className={`group/mem relative flex items-center transition-colors hover:bg-foreground/[0.025] ${
                      i > 0 ? "border-t" : ""
                    } ${dragIdx === i ? "opacity-40" : ""}`}
                  >
                    {/* drop indicator — where the dragged member will land */}
                    {overIdx === i && dragIdx !== null && dragIdx !== i ? (
                      <span className="pointer-events-none absolute inset-x-0 top-0 z-10 h-0.5 bg-primary" />
                    ) : null}
                    <span
                      aria-hidden
                      className="flex w-7 shrink-0 cursor-grab items-center justify-center text-muted-foreground/40 opacity-0 transition-opacity group-hover/mem:opacity-100 active:cursor-grabbing"
                    >
                      <GripVertical className="size-4" />
                    </span>
                    <Link
                      href={`/artifact/${artifact.id}`}
                      draggable={false}
                      className="grid min-w-0 flex-1 grid-cols-[3rem_1fr_auto] items-center gap-4 py-3.5 pr-1 sm:grid-cols-[3.5rem_1fr_6rem_4rem_3rem]"
                    >
                      <TypeBadge type={artifact.type} />
                      <span className="truncate text-[15px] font-medium">{artifact.title}</span>
                      <span
                        className={`hidden items-center gap-1 text-[12px] sm:flex ${
                          pub ? "text-primary" : "text-muted-foreground"
                        }`}
                      >
                        {pub ? <Eye className="size-3" /> : <EyeOff className="size-3" />}
                        {pub ? "Public" : "Private"}
                      </span>
                      <span className="hidden items-center gap-1 font-mono text-[12px] text-muted-foreground sm:flex">
                        <Link2 className="size-3 opacity-70" /> {relationCount(artifact.id)}
                      </span>
                      <span className="text-right font-mono text-[12px] tabular-nums text-muted-foreground">
                        {artifact.updated}
                      </span>
                    </Link>
                    {/* row actions in a hover ⋯ menu (matches the Library row) — a destructive un-file
                        belongs behind a deliberate menu choice, not a bare one-click button */}
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        aria-label="More"
                        className="mx-1 flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 outline-none transition-all hover:bg-foreground/[0.06] hover:text-foreground group-hover/mem:opacity-100 data-[popup-open]:bg-foreground/[0.06] data-[popup-open]:text-foreground data-[popup-open]:opacity-100"
                      >
                        <MoreHorizontal className="size-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" sideOffset={4} className="w-56">
                        <DropdownMenuItem render={<Link href={`/artifact/${artifact.id}`} />} className="gap-2">
                          <ArrowUpRight className="size-4 text-muted-foreground" /> Open artifact
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="gap-2"
                          onClick={() => {
                            navigator.clipboard
                              ?.writeText(
                                artifact.public
                                  ? `woven.dev/a/${artifact.hub_slug ?? artifact.id}`
                                  : `woven.dev/artifact/${artifact.id}`,
                              )
                              .catch(() => {});
                            notify.success("Link copied", { description: artifact.title });
                          }}
                        >
                          <Link2 className="size-4 text-muted-foreground" /> Copy link
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="gap-2" onClick={() => removeMember(artifact.id, artifact.title)}>
                          <FolderMinus className="size-4 text-muted-foreground" /> Remove from collection
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
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
              {/* audience scope — a DROPDOWN, not a segmented toggle, so it doesn't read as a second row of
                  tabs competing with Contents / Map / Audience directly above it */}
              <DropdownMenu>
                <DropdownMenuTrigger className="inline-flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-1.5 text-[13px] font-medium text-foreground outline-none transition-colors hover:bg-foreground/[0.06] data-[popup-open]:bg-foreground/[0.08]">
                  {aud === "public" ? "Public hub" : "Inside Acme"}
                  <ChevronDown className="size-3.5 text-muted-foreground" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-44">
                  <DropdownMenuItem className="gap-2" onClick={() => setAud("public")}>
                    <Check className={`size-4 ${aud === "public" ? "text-primary" : "opacity-0"}`} /> Public hub
                  </DropdownMenuItem>
                  <DropdownMenuItem className="gap-2" onClick={() => setAud("inside")}>
                    <Check className={`size-4 ${aud === "inside" ? "text-primary" : "opacity-0"}`} /> Inside Acme
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <span className="text-[12px] text-muted-foreground">
                {aud === "public" ? (
                  <>
                    <span className="tabular-nums">{liveCount}</span> artifacts in the hub
                  </>
                ) : (
                  <>
                    team space · <span className="tabular-nums">14</span> members
                  </>
                )}
              </span>
            </div>

            {analytics ? (
              <>
                <KpiRow stats={analytics.stats} />

                {analytics.trend ? (
                  <div className="mt-8">
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <p className="text-[13px] font-medium text-muted-foreground">{analytics.trend.label}</p>
                      <div className="flex items-center gap-0.5 text-[13px]">
                        {RANGES.map((r) => (
                          <button
                            key={r.id}
                            onClick={() => setRange(r.id)}
                            className={`rounded-md px-2 py-0.5 font-medium transition-colors ${
                              range === r.id ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {r.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <TrendChart points={analytics.trend.points.slice(-(RANGES.find((r) => r.id === range)?.n ?? 30))} />
                  </div>
                ) : null}

                <div className="mt-8 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <RailLabel>{aud === "public" ? "Most-read artifacts" : "Most-active artifacts"}</RailLabel>
                    <BarList rows={analytics.readthrough.map((a) => ({ name: a.h, value: a.pct, pct: a.pct }))} />
                  </div>
                  {analytics.sources ? (
                    <div>
                      <RailLabel>{aud === "public" ? "Sources" : "Channels"}</RailLabel>
                      <BarList rows={analytics.sources.map((s) => ({ name: s.name, value: s.visitors }))} />
                    </div>
                  ) : null}
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
