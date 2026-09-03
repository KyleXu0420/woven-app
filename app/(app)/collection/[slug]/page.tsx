"use client";

import * as React from "react";
import Link from "next/link";
import { PAGE_FRAME } from "@/lib/frame";
import { DIVIDED } from "@/components/controls";
import { useParams } from "next/navigation";
import {
  Globe,
  Eye,
  EyeOff,
  Link2,
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
  Share2,
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
import { TypeBadge, PeopleStack, LinkCount } from "@/components/artifact-ui";
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
  getArtifactGraph,
  getFreshness,
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PageBreadcrumb } from "@/components/page-heading";

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
    <p className="mb-2 text-xs font-medium text-muted-foreground">
      {children}
    </p>
  );
}

// a period-over-period change — the ↑/↓ glyph carries direction, so the figure stays monochrome (ink up,
// muted down); no forest or alarm-red spent on a data figure
function Delta({ v }: { v: number }) {
  const up = v >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium tabular-nums ${up ? "text-foreground" : "text-muted-foreground"}`}>
      {up ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
      {Math.abs(v)}%
    </span>
  );
}

// format a chart point in its metric's OWN unit — so switching the KPI switches the tooltip's language too
function fmtPoint(v: number, unit?: Stat["unit"]) {
  if (unit === "pct") return `${v}%`;
  if (unit === "duration") return `${Math.floor(v / 60)}m ${String(Math.round(v % 60)).padStart(2, "0")}s`;
  return v.toLocaleString();
}

// the KPI row — open figures separated by hairline rules, NOT a bordered card grid (minimize cards). Each KPI
// that carries a series is SELECTABLE and drives the trend chart below (the Visitors / Dub pattern: the KPI row
// IS the chart's metric switcher); the active one carries a forest underline.
function KpiRow({ stats, selected, onSelect }: { stats: Stat[]; selected: number; onSelect: (i: number) => void }) {
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-4 sm:gap-0">
      {stats.map((s, i) => {
        const on = i === selected;
        const pickable = !!s.points?.length;
        return (
          <button
            key={s.l}
            type="button"
            aria-pressed={on}
            disabled={!pickable}
            onClick={() => onSelect(i)}
            className={`group/kpi relative pb-3 text-left outline-none sm:px-6 ${
              i === 0 ? "sm:pl-0" : "sm:border-l sm:border-border/60"
            } ${pickable ? "cursor-pointer" : "cursor-default"}`}
          >
            <div className="flex items-baseline gap-2">
              {/* design-system `title` token — Geist 28/500/1.15/-0.02em (all-sans is LOCKED; the legacy
                  font-serif class is dormant plumbing, not the design system) */}
              <span className="text-3xl font-medium leading-[1.15] tracking-[-0.02em] tabular-nums">{s.v}</span>
              {s.delta != null ? <Delta v={s.delta} /> : null}
            </div>
            <div
              className={`mt-1.5 text-sm font-medium transition-colors ${
                on ? "text-foreground" : "text-muted-foreground group-hover/kpi:text-foreground"
              }`}
            >
              {s.l}
            </div>
            {/* Active-metric indicator — the chart below is showing this one. It spans the whole
                column, the way a tab's underline does, because this row IS a selector and gets the
                selector's grammar. A 32px stub in one corner had to carry the state alongside a
                label that only shifted from muted to full ink, and between them you could not tell
                which of the four was live. The left inset still follows the column's own padding. */}
            <span
              className={`absolute right-0 bottom-0 h-0.5 rounded-full transition-colors ${
                i === 0 ? "left-0 sm:left-0" : "left-0 sm:left-6"
              } ${on ? "bg-primary" : "bg-transparent group-hover/kpi:bg-border"}`}
            />
          </button>
        );
      })}
    </div>
  );
}

// the hero trend chart — a big area + line (Visitors-style), the metric over the selected range. Stretched to
// full width (non-scaling stroke keeps the line crisp); a soft neutral-ink gradient grounds it. No axis chrome —
// the shape + the range label carry it. Leads the analytics view, so it reads as a real dashboard.
function TrendChart({ points, unit }: { points: number[]; unit?: Stat["unit"] }) {
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
  // a stale hover index can outlive a metric / range / scope switch (the new series may be shorter), which
  // would read points[hover] === undefined → "undefined" in the tooltip and a NaN position. Clamp it.
  const hi = hover != null && n > 0 ? Math.min(hover, n - 1) : null;
  const hx = hi != null ? (hi / Math.max(n - 1, 1)) * 100 : 0;
  const hy = hi != null ? (yOf(points[hi]) / H) * 100 : 0;
  return (
    <div className="relative" onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-40 w-full" role="img" aria-label="Trend">
        <defs>
          <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--foreground)" stopOpacity="0.10" />
            <stop offset="100%" stopColor="var(--foreground)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`${line} L${W} ${H} L0 ${H} Z`} fill="url(#trend-fill)" />
        <path
          d={line}
          fill="none"
          stroke="var(--foreground)"
          strokeOpacity={0.5}
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {hi != null ? (
        <>
          <div className="pointer-events-none absolute inset-y-0 w-px bg-foreground/20" style={{ left: `${hx}%` }} />
          <div
            className="pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-foreground bg-card"
            style={{ left: `${hx}%`, top: `${hy}%` }}
          />
          <div
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-md bg-foreground px-1.5 py-0.5 text-xs font-medium tabular-nums whitespace-nowrap text-background shadow-sm"
            style={{ left: `${Math.max(4, Math.min(96, hx))}%`, top: `calc(${hy}% - 6px)` }}
          >
            {fmtPoint(points[hi], unit)}
          </div>
        </>
      ) : null}
    </div>
  );
}

// A breakdown list — name, a proportional bar, and the figure. Three lanes, and the bar gets its own:
// it used to fill BEHIND the row, which cost twice. At 6% ink it was too faint to read as data, yet its
// edge still cut through the middle of a word, so the one thing it was strong enough to do was interfere
// with the label. A track plus a fill says more with less: the track shows the scale, the fill shows the
// share, and the name sits beside them instead of on top.
//
// `share` is what the bar draws and is always a fraction of the WHOLE, never of the largest row. The two
// callers used to disagree about this under identical visuals — read-through passed a real percentage
// while Sources passed value/max, so the biggest source always drew a full bar and read as "100% of
// traffic". Callers now say which they mean.
function BarList({
  rows,
  unit,
}: {
  rows: { name: string; value: number; share: number }[];
  // what the figure on the right IS — a percentage of readers, or a count of visitors
  unit: "percent" | "count";
}) {
  return (
    <div className="flex flex-col gap-0.5">
      {rows.map((r) => (
        <div key={r.name} className="rounded-md px-2 py-1.5 transition-colors hover:bg-foreground/[0.03]">
          <div className="flex items-baseline gap-3">
            <span className="min-w-0 flex-1 truncate text-sm">{r.name}</span>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {unit === "percent" ? `${r.value}%` : r.value.toLocaleString()}
            </span>
          </div>
          {/* the bar runs UNDER the line, full width. Three lists sit side by side at roughly 300px
              here, which is not enough for label + bar + figure in one row without shredding the
              names — so the bar takes the second line, where it is also longer and easier to read. */}
          <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-foreground/[0.07]" role="presentation">
            <span
              className="block h-full rounded-full bg-foreground/30"
              style={{ width: `${Math.max(r.share, 2)}%` }}
            />
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
        <div key={r.n + r.t} className="flex items-center gap-2 py-1 text-sm">
          {r.ext ? (
            <AnonAvatar size="sm" />
          ) : (
            <PersonAvatar seed={r.n} name={r.n} initials={r.i} size="sm" />
          )}
          <span className="flex-1 truncate text-foreground/80">{r.n}</span>
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{r.t}</span>
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
  // which KPI the trend chart is showing — the KPI row is the metric switcher; reset when the scope changes
  // (the two scopes expose different metrics)
  const [selKpi, setSelKpi] = React.useState(0);
  React.useEffect(() => setSelKpi(0), [aud]);
  const [dragIdx, setDragIdx] = React.useState<number | null>(null);
  const [litId, setLitId] = React.useState<string | null>(null); // hovered member → its node in the mark
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
        <div className="pointer-events-none absolute inset-3 z-30 flex items-center justify-center rounded-lg border-2 border-dashed border-primary bg-primary/[0.06] backdrop-blur-[1px] duration-150 animate-in fade-in-0">
          <span className="rounded-full bg-card px-4 py-2 text-base font-medium text-primary shadow-sm ring-1 ring-primary/20">
            Add to {meta.name}
          </span>
        </div>
      ) : null}

      {/* header */}
      {/* title on the left, actions right-aligned on its row; the title block shrinks (meta wraps) so the
          buttons stay pinned right instead of dropping below — stacks only on a genuinely narrow screen */}
      <PageBreadcrumb trail={[{ label: "Collections", href: "/library" }]} />
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-center gap-8">
          {/* The mark LEADS. It is the one thing on this page that only this product can draw: a
              collection's identity is not picked from a swatch palette, it is the shape its own
              members make. Six rows sit directly beneath it and those rows ARE this drawing, so the
              relationship is literal rather than decorative.
              It was 56px — small enough that five rounds of blind review read it as a disabled
              placeholder and told me to replace it with a plain coloured square. The critique of its
              INK was right; the prescription was to delete the idea and keep the default. */}
          <EmergentMark slug={meta.slug} highlight={litId ?? undefined} className="size-32 shrink-0 sm:size-40" />
          <div className="min-w-0">
            {/* A DETAIL page names one thing and yields to it, so its title sits a rung below an
                INDEX page's text-3xl (PageHeading). At 3xl beside a 64px mark the header outweighed
                the rows it introduces. */}
            <div className="flex min-w-0 items-center gap-2">
              <h1 className="truncate text-2xl font-medium tracking-[-0.01em]">{meta.name}</h1>
              {/* the count lives in the Contents tab, which is the thing it counts */}
            </div>
            {/* one line, two kinds of content: the count + published STATE are metadata (Geist), the hub URL
                is a real value the user reads verbatim (mono) — so the mono is scoped to the URL, not the line */}
            <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs tabular-nums text-muted-foreground">
              {meta.public ? (
                <a
                  href={`/c/${meta.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-primary hover:underline"
                >
                  <Globe className="size-3" /> Published
                  {/* not mono. It was the only monospace on the page, which made a URL read as code
                      inside an otherwise editorial surface — and the separator between it and the
                      state was a middle dot, the screen's most reliable AI tell. A gap does the job. */}
                  <span className="text-muted-foreground">{hubUrl}</span>
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
          {/* Add artifacts leads (filled) only while the collection is empty — the first job is to fill it.
              Once it has content, it steps back to outline so a single CTA carries the moment. */}
          <Button variant={contents.length === 0 ? "default" : "outline"} size="sm" onClick={() => setAddOpen(true)}>
            <Plus /> Add artifacts
          </Button>
          {/* No separate View-live button: the published URL in the meta line already links to the live hub,
              and Share's dialog carries a "View hub" action. Publishing / sharing / viewing is ONE thing here. */}
          <ShareCollectionDialog
            name={meta.name}
            slug={meta.slug}
            published={meta.public}
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
                          <span className="ml-auto text-xs tabular-nums text-muted-foreground">{f.hint}</span>
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
            { id: "contents", label: "Contents", count: contents.length },
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
              <div className="rounded-lg border bg-card p-5">
                <div className="mb-3 flex items-center gap-2.5">
                  <AgentAvatar size="sm" state="thinking" />
                  <div className="min-w-0">
                    <p className="text-base font-medium">Woven gathered {approvedCount} for you</p>
                    {meta.intro ? (
                      <p className="truncate text-sm text-muted-foreground">matching “{meta.intro}”</p>
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
                        className={`flex items-center gap-3 rounded-md border px-3 py-2 text-left transition-all ${
                          on
                            ? "border-foreground/20 bg-foreground/[0.03]"
                            : "border-transparent opacity-50 hover:opacity-100"
                        }`}
                      >
                        <span
                          className={`flex size-[18px] shrink-0 items-center justify-center rounded-sm border transition-colors ${
                            on ? "border-primary bg-primary text-primary-foreground" : "border-foreground/25"
                          }`}
                        >
                          {on ? <Check className="size-3" /> : null}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{c.artifactTitle}</span>
                          <span className="block truncate text-xs text-muted-foreground">{c.rationale}</span>
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
                    {approvedCount > 0 ? `Approve ${approvedCount}` : "Dismiss all"}
                  </Button>
                </div>
              </div>
            ) : null}

            {/* publish folds into the tail — one tap, right after approve */}
            {pendingPublish && !meta.public ? (
              <div className="flex items-center gap-3 rounded-lg border border-primary/15 bg-primary/[0.04] px-4 py-3">
                <Globe className="size-4 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="text-base font-medium">Ready to share?</p>
                  <p className="text-sm text-muted-foreground">
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
              <div className="rounded-lg border border-dashed bg-card/50 px-6 py-12 text-center">
                <p className="text-base font-medium">Nothing here yet</p>
                <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                  Add artifacts to fill this collection.
                </p>
                <Button className="mt-4" onClick={() => setAddOpen(true)}>
                  <Plus /> Add artifacts
                </Button>
              </div>
            ) : null}

            {/* the members */}
            {contents.length > 0 ? (
              <div className={DIVIDED}>
                {contents.map(({ artifact, pub }, i) => {
                  const fresh = getFreshness(artifact.id);
                  const people = getArtifactGraph(artifact.id).people;
                  return (
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
                    onMouseEnter={() => setLitId(artifact.id)}
                    onMouseLeave={() => setLitId(null)}
                    className={`group/mem relative flex items-center transition-colors hover:bg-foreground/[0.025] ${dragIdx === i ? "opacity-40" : ""}`}
                  >
                    {/* drop indicator — where the dragged member will land */}
                    {overIdx === i && dragIdx !== null && dragIdx !== i ? (
                      <span className="pointer-events-none absolute inset-x-0 top-0 z-10 h-0.5 bg-primary" />
                    ) : null}
                    {/* out of flow. It is invisible until hover but used to hold 28px in the row, and
                        that 28px is the whole reason the badge column could never sit on the divider's
                        left edge — an element nobody can see was setting the page's first indent. */}
                    <span
                      aria-hidden
                      className="absolute top-3.5 -left-6 flex w-6 cursor-grab items-center justify-center text-muted-foreground/40 opacity-0 transition-opacity group-hover/mem:opacity-100 active:cursor-grabbing"
                    >
                      <GripVertical className="size-4" />
                    </span>
                    {/* the SAME anatomy as the Library row — an artifact should read the same wherever it
                        appears. Line 1 = type · title (+ freshness) · state · updated; line 2 = the gist and
                        who's on it, indented under the title. The collection-scoped signals (Public/Private
                        in THIS hub, the link count) JOIN the artifact's own rather than replacing them. */}
                    <Link
                      href={`/artifact/${artifact.id}`}
                      draggable={false}
                      className="block min-w-0 flex-1 py-3"
                    >
                      <div className="flex items-center gap-6">
                        <span className="flex w-14 shrink-0">
                          <TypeBadge type={artifact.type} />
                        </span>
                        <div className="flex min-w-0 flex-1 items-center gap-1.5">
                          <span className="truncate text-base font-medium">{artifact.title}</span>
                          {fresh.state === "stale" ? (
                            <Tooltip>
                              <TooltipTrigger render={<span />} className="inline-flex size-1.5 shrink-0 rounded-full bg-warn" />
                              <TooltipContent side="top">A source changed since this was woven</TooltipContent>
                            </Tooltip>
                          ) : fresh.state === "superseded" ? (
                            <span className="shrink-0 rounded-full bg-secondary px-1.5 py-px text-xs font-medium text-muted-foreground">
                              Superseded
                            </span>
                          ) : null}
                        </div>
                        {/* ONE rail. People, links, visibility and time used to sit in two zones — half
                            of them bottom-left under the gist, half top-right — which left the middle of
                            every row empty and gave the list two competing metadata columns. */}
                        <span className="hidden w-14 shrink-0 justify-end sm:flex">
                          <PeopleStack people={people} />
                        </span>
                        <span className="hidden w-10 shrink-0 justify-end text-sm text-muted-foreground sm:flex">
                          <LinkCount count={relationCount(artifact.id)} />
                        </span>
                        {/* only the exception is marked. Inside a published collection "Public" is
                            the default state, so printing it on every row is a column of noise. */}
                        <span
                          className="hidden w-6 shrink-0 items-center justify-center text-muted-foreground sm:flex"
                          title={pub ? "Public in this hub" : "Private"}
                        >
                          {pub ? <Globe className="size-3.5 opacity-60" /> : <EyeOff className="size-3.5" />}
                        </span>
                        <span className="w-11 shrink-0 pr-1 text-right text-xs tabular-nums text-muted-foreground">
                          {artifact.updated}
                        </span>
                      </div>
                      {artifact.gist ? (
                        <p className="mt-1 truncate pl-20 text-sm text-muted-foreground">{artifact.gist}</p>
                      ) : null}
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
                  );
                })}
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
                <DropdownMenuTrigger className="inline-flex items-center gap-1.5 rounded-md bg-secondary px-3 py-1.5 text-sm font-medium text-foreground outline-none transition-colors hover:bg-foreground/[0.06] data-[popup-open]:bg-foreground/[0.08]">
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
              <span className="text-xs text-muted-foreground">
                {aud === "public" ? (
                  <>
                    <span className="tabular-nums">{liveCount}</span> artifacts in the hub
                  </>
                ) : (
                  <>
                    team space, <span className="tabular-nums">14</span> members
                  </>
                )}
              </span>
            </div>

            {analytics ? (
              <>
                <KpiRow stats={analytics.stats} selected={selKpi} onSelect={setSelKpi} />

                {analytics.stats[selKpi]?.points?.length ? (
                  <div className="mt-8">
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <p className="text-xs font-medium text-muted-foreground">{analytics.stats[selKpi].l}</p>
                      <div className="flex items-center gap-0.5 text-xs">
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
                    <TrendChart
                      points={(analytics.stats[selKpi].points ?? []).slice(-(RANGES.find((r) => r.id === range)?.n ?? 30))}
                      unit={analytics.stats[selKpi].unit}
                    />
                  </div>
                ) : null}

                <div className="mt-8 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <RailLabel>{aud === "public" ? "Most-read artifacts" : "Most-active artifacts"}</RailLabel>
                    <BarList
                      unit="percent"
                      rows={analytics.readthrough.map((a) => ({ name: a.h, value: a.pct, share: a.pct }))}
                    />
                  </div>
                  {analytics.sources ? (
                    <div>
                      <RailLabel>{aud === "public" ? "Sources" : "Channels"}</RailLabel>
                      <BarList
                        unit="count"
                        rows={(() => {
                          const total = analytics.sources.reduce((n, s) => n + s.visitors, 0) || 1;
                          return analytics.sources.map((s) => ({
                            name: s.name,
                            value: s.visitors,
                            share: (s.visitors / total) * 100,
                          }));
                        })()}
                      />
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
