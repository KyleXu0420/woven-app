"use client";

import * as React from "react";
import Link from "next/link";
import { PAGE_FRAME } from "@/lib/frame";
import { DIVIDED_FLUSH } from "@/components/controls";
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
  Lock,
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
import { TypeBadge, PeopleStack } from "@/components/artifact-ui";
import { ShareCollectionDialog } from "@/components/share-collection-dialog";
import { AddDocumentsDialog } from "@/components/add-documents";
import { CollectionMap } from "@/components/collection-map";
import { CollectionWeave, useRowAnchors } from "@/components/collection-weave";
import { ViewTabs } from "@/components/controls";
import {
  addArtifactsToCollection,
  collectionBySlug,
  collectionContents,
  collectionGraph,
  collectionMembers,
  collectionPublicMembers,
  getAnalytics,
  getArtifactGraph,
  getFreshness,
  listCollectionCandidates,
  publishCollection,
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

// the ranges that produce distinct slices of a series this long — one button per picture
function usableRanges(len: number) {
  const seen = new Set<number>();
  return RANGES.filter((r) => {
    const cut = Math.min(r.n, len);
    if (seen.has(cut)) return false;
    seen.add(cut);
    return true;
  });
}

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
              <span className="text-2xl font-medium tabular-nums">{s.v}</span>
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
              } ${on ? "bg-foreground" : "bg-transparent group-hover/kpi:bg-border"}`}
            />
          </button>
        );
      })}
    </div>
  );
}

// the hero trend chart — a big area + line (Visitors-style), the metric over the selected range. Stretched to
// full width (non-scaling stroke keeps the line crisp); a soft neutral-ink gradient grounds it.
//
// The scale starts at ZERO for a count and spans 0-100 for a percentage. It used to start at the data's
// own minimum, so a filled area always rose from the floor to the ceiling whatever the numbers did:
// "Hub views" 30 to 102 and "Completion" 54 to 64 drew the same triumphant ramp. A filled area that
// does not touch its own zero is a picture of a bigger change than happened. Duration keeps a
// data-relative floor — a read time has no zero worth drawing.
//
// The ends are labelled instead of an axis. On a 160px chart the first and last value IS the axis; a
// gridded y-scale would be more chrome than the shape it explains.
function TrendChart({ points, unit }: { points: number[]; unit?: Stat["unit"] }) {
  const [hover, setHover] = React.useState<number | null>(null);
  const W = 640, H = 150, PADY = 12;
  const floor = unit === "duration" ? Math.min(...points) : 0;
  const ceil = unit === "pct" ? 100 : Math.max(...points);
  const max = ceil, min = floor, range = max - min || 1;
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
      {/* the axis: where it started, where it ended */}
      <span className="pointer-events-none absolute top-0 left-0 text-xs tabular-nums text-muted-foreground">
        {fmtPoint(points[0], unit)}
      </span>
      <span className="pointer-events-none absolute top-0 right-0 text-xs tabular-nums text-muted-foreground">
        {fmtPoint(points[points.length - 1], unit)}
      </span>
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
  const [litId, setLitId] = React.useState<string | null>(null); // hovered member → its node + chords in the gutter
  // the weave: every row is a node; real citations between two members are chords. Spokes from the
  // collection are not drawn — the list IS the spoke. Measured against the list so a reorder or a
  // row without a gist keeps the chords on the right lines.
  const listRef = React.useRef<HTMLDivElement>(null);
  const { height: listHeight, anchors } = useRowAnchors(listRef, [contents]);
  const chords = React.useMemo(() => {
    const ids = new Set(contents.map(({ artifact }) => artifact.id));
    return collectionGraph(meta.slug)
      .edges.filter((e) => ids.has(e.from) && ids.has(e.to))
      .map((e) => ({ id: e.id, from: e.from, to: e.to, prov: e.prov }));
  }, [meta.slug, contents]);
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

      {/* header: the crumb alone on its line, then the title row carrying the actions that act on it.
          The actions used to sit on the crumb row, centred on 12px of grey text 50px above the title
          they belong to. That was right while a 160px mark filled the title row; it is not now. */}
      <PageBreadcrumb trail={[{ label: "Collections", href: "/library" }]} className="mb-3" />
      <div className="flex items-start justify-between gap-4">
        {/* The title, on the grid, at the one title size (PageHeading). The collection's mark used to
            stand beside it at 160px: the one drawing only this product can make, and sixteen blind
            verdicts read it as decoration, because a still image cannot see a row light its node.
            The idea did not go — it moved to where the rows are. See the weave beside the list. */}
        <div className="min-w-0">
              <h1 className="truncate text-2xl font-medium">{meta.name}</h1>
              {/* one line, two kinds of content: the count + published STATE are metadata (Geist), the hub URL
                  is a real value the user reads verbatim (mono) — so the mono is scoped to the URL, not the line */}
              <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs tabular-nums text-muted-foreground">
                {meta.public ? (
                  <a
                    href={`/c/${meta.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group/hub inline-flex items-center gap-1.5"
                  >
                    {/* one quiet line. The URL was set in title ink to say "this is the link", and it
                        became the darkest text on the page after the title; the arrow says it. */}
                    Published
                    {/* not mono. It was the only monospace on the page, which made a URL read as code
                        inside an otherwise editorial surface — and the separator between it and the
                        state was a middle dot, the screen's most reliable AI tell. A gap does the job. */}
                    <span className="group-hover/hub:underline">{hubUrl}</span>
                    <ArrowUpRight className="size-3 opacity-60" aria-hidden="true" />
                  </a>
                ) : (
                  <span>Not published</span>
                )}
              </p>
        </div>
        {/* -mr-1.5: the overflow ⋯ is a ghost, so its glyph, not its invisible box, hangs on the
            table's right rail — the same way the row's ⋯ overhangs into the margin. */}
        <div className="-mr-1.5 flex shrink-0 gap-2">
          {/* Outline, always. The comment here used to say this button "steps back to outline once the
              collection has content" and the code said variant="default" unconditionally — so on the two
              unpublished collections it stood as a second solid forest pill beside a solid Publish, in one
              corner. Forest is chrome, the agent and confirms; adding is none of those. The dialog beside
              it already does the state work: Publish is solid only when there is something to publish. */}
          <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}>
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
              <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="More actions" />}>
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
      <div className="mt-6">
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
            {/* A sentence. It was a dashed-bordered card holding a centred stack and a second copy of
                the header's own Add artifacts, 500px below the first — and the page is already a drop
                target whose dragover cue is another dashed rectangle, so at rest it drew a dashed box
                where a dashed box was about to appear. */}
            {contents.length === 0 && candidates.length === 0 ? (
              <p className="py-12 text-sm text-muted-foreground">
                Nothing here yet. Add artifacts, or drag them in from the Library.
              </p>
            ) : null}

            {/* the members */}
            {contents.length > 0 ? (
              <div className="relative">
              {/* the rail: the table's first column, inside its dividers. Rows and header pad left by
                  the rail's width (pl-12). A sibling of the divided list, not a child — a child would
                  be dealt a hairline and shift the header rule. */}
              <CollectionWeave
                anchors={anchors}
                height={listHeight}
                edges={chords}
                color={meta.color}
                lit={litId}
                className="pointer-events-none absolute top-0 left-0 hidden md:block"
              />
              <div ref={listRef} className={`${DIVIDED_FLUSH} border-b border-border [&>*:nth-child(2)]:before:bg-foreground/20`}>
                {/* One header row, so the four numbers to the right of every title have names. It is
                    the container's FIRST child on purpose: the divider rule draws above every child
                    but the first, so the header carries no rule and row one gets one — a header line. */}
                <div className="flex items-center pb-2 pl-12 text-xs text-muted-foreground">
                  {/* the inner flex mirrors a row's line one exactly — same five children, same
                      gap. Nothing trails it: the row's ⋯ menu lives out of flow in the right
                      margin, as the grip does in the left, so the last cell ends where the
                      hairline ends instead of 36px short of it. */}
                  {/* Cells are fitted to what they hold, not equalised: a stack of three avatars
                      needs 96, a relative time 80, a glyph 64. Four equal 64s left a 340px hole
                      between the gist and the rail, with the rail crushed at the edge. No Links
                      column: the gutter draws the links, and a total beside a drawing of a subset
                      read as the page contradicting itself (18 in the cell, 3 in the margin). */}
                  <div className="flex min-w-0 flex-1 items-center gap-4">
                    <span className="min-w-0 flex-1">Name</span>
                    <span className="hidden w-24 sm:block">People</span>
                    {meta.public ? <span className="hidden w-16 text-center sm:block">Access</span> : null}
                    <span className="w-20 text-right">Edited</span>
                  </div>
                </div>
                {contents.map(({ artifact, pub }, i) => {
                  const fresh = getFreshness(artifact.id);
                  const people = getArtifactGraph(artifact.id).people;
                  return (
                  <div
                    key={artifact.id}
                    data-member={artifact.id}
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
                      className="block min-w-0 flex-1 py-2.5 pl-12"
                    >
                      <div data-anchor className="flex items-center gap-4">
                        <div className="flex min-w-0 flex-1 items-center gap-1.5">
                          <span className="truncate text-base font-medium">{artifact.title}</span>
                          {/* the type trails the title, so titles land on the column's spine */}
                          <TypeBadge type={artifact.type} />
                          {/* after the type, not between title and type: those two are one pair */}
                          {fresh.state === "stale" ? (
                            <Tooltip>
                              <TooltipTrigger render={<span />} className="inline-flex size-2 shrink-0 rounded-full border border-warn" />
                              <TooltipContent side="top">A source changed since this was woven</TooltipContent>
                            </Tooltip>
                          ) : null}
                          {fresh.state === "superseded" ? (
                            <span className="shrink-0 rounded-full bg-foreground/[0.08] px-1.5 py-px text-xs font-medium text-muted-foreground">
                              Superseded
                            </span>
                          ) : null}
                        </div>
                        {/* ONE rail. People, links, visibility and time used to sit in two zones — half
                            of them bottom-left under the gist, half top-right — which left the middle of
                            every row empty and gave the list two competing metadata columns. */}
                        {/* anchored LEFT. A stack of one, two or three avatars has no fixed width,
                            and right-aligning it made the column's optical centre wander row to row. */}
                        <span className="hidden w-24 shrink-0 justify-start sm:flex">
                          {/* nothing for nobody. A dash is 13px wide in a column of 20px discs and stepped the
                              column's left edge; an empty cell under a header row is not a broken cell. */}
                          {people.length ? <PeopleStack people={people} /> : null}
                        </span>
                        {/* A globe means "this one is on the web". It appears only where that is true,
                            and the column only exists on a collection that has a hub at all. The comment
                            here used to claim only the exception was marked; the code drew a glyph on all
                            six rows of the published collection and four identical locks on the private
                            one, which is a column that says the same word four times. */}
                        {meta.public ? (
                          <span
                            className="hidden w-16 shrink-0 items-center justify-center text-muted-foreground sm:flex"
                            title={pub ? "Public in this hub" : undefined}
                          >
                            {pub ? <Globe className="size-3.5 opacity-60" /> : null}
                          </span>
                        ) : null}
                        <span className="w-20 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                          {artifact.updated}
                        </span>
                      </div>
                      {artifact.gist ? (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">{artifact.gist}</p>
                      ) : null}
                    </Link>
                    {/* row actions in a hover ⋯ menu (matches the Library row) — a destructive un-file
                        belongs behind a deliberate menu choice, not a bare one-click button */}
                    <DropdownMenu>
                      {/* the shared icon-sm button, not a hand-rolled copy of it: this page's header
                          ⋯ is size="icon-sm" (28px, round) and the row's was 28px and 10px-cornered,
                          so one page carried two shapes of the same glyph doing the same job. */}
                      <DropdownMenuTrigger
                        render={<Button variant="ghost" size="icon-sm" aria-label="More" />}
                        className="absolute top-2.5 -right-9 shrink-0 opacity-0 transition-opacity group-hover/mem:opacity-100 data-[popup-open]:opacity-100"
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
                  tabs competing with Contents / Map / Audience directly above it.
                  On an unpublished collection there is no hub to scope to, so there is nothing to choose:
                  the trigger was offering "Public hub" for a hub that does not exist, and reporting
                  0 artifacts in it. It becomes a plain label there. */}
              {!meta.public ? (
                <span className="text-sm font-medium">Inside Acme</span>
              ) : (
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
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
              )}
              <span className="text-xs text-muted-foreground">
                {meta.public && aud === "public" ? (
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

            {/* getAnalytics has nothing for most collections. The view used to render the scope row and
                then simply stop — a header over an empty page. */}
            {!analytics ? (
              <p className="py-12 text-sm text-muted-foreground">
                No reads yet. Publish the collection, or share it inside Acme, to start counting.
              </p>
            ) : null}
            {analytics ? (
              <>
                <KpiRow stats={analytics.stats} selected={selKpi} onSelect={setSelKpi} />

                {analytics.stats[selKpi]?.points?.length ? (
                  <div className="mt-8">
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <p className="text-xs font-medium text-muted-foreground">{analytics.stats[selKpi].l}</p>
                      {/* Only ranges that actually cut the series. It offered 7d / 30d / All against
                          series of 14 and 30 points, so slice(-30) and slice(-999) returned the same
                          array every time and two of the three buttons drew one chart. */}
                      <div className="flex items-center gap-0.5 text-xs">
                        {usableRanges(analytics.stats[selKpi].points?.length ?? 0).map((r) => (
                          <button
                            key={r.id}
                            onClick={() => setRange(r.id)}
                            className={`rounded-md px-2 py-0.5 font-medium transition-colors ${
                              range === r.id ? "bg-foreground/[0.08] text-foreground" : "text-muted-foreground hover:text-foreground"
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
