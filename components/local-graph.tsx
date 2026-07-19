"use client";

import * as React from "react";
import { Check, X } from "lucide-react";
import type { GraphEdge, GraphNode, Neighborhood, RefKind } from "@/lib/types";
import { tintVar } from "@/lib/identity";
import { collectionById, primaryCollection } from "@/lib/api";

function nodeFill(n: GraphNode): string {
  if (n.depth === 0) return "var(--primary)"; // focused — forest
  if (n.kind === "artifact") return primaryCollection(n.id)?.color ?? "var(--chart-1)"; // by collection
  if (n.kind === "collection") return collectionById(n.id)?.color ?? "var(--chart-1)"; // its own swatch
  return tintVar(n.id); // person / topic / source — own identity hue
}

// The one honest key for every LocalGraph surface. Shape carries the kind (the nodes draw it); only two
// colour rules are real — forest = the focused node, and solid vs dashed strokes = confirmed vs the
// agent's proposed links. (The old per-kind colour legend was wrong: nodes colour by collection/identity.)
export function GraphLegend({ className = "", compact = false }: { className?: string; compact?: boolean }) {
  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground ${className}`}>
      {compact ? null : (
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full" style={{ background: "var(--primary)" }} /> Focused
        </span>
      )}
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block h-0 w-4 border-t border-muted-foreground/50" /> Confirmed
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block h-0 w-4 border-t border-dashed border-primary" /> Proposed
      </span>
      {compact ? null : <span className="opacity-70">Shape = type</span>}
    </div>
  );
}

// node body by KIND — shape carries the category (colour carries identity); a soft drop-shadow
// lifts it off the paper for depth.
function NodeShape({
  kind,
  r,
  fill,
  processing,
}: {
  kind: RefKind;
  r: number;
  fill: string;
  processing?: boolean;
}) {
  const p = {
    stroke: "var(--card)",
    strokeWidth: 1.5,
    strokeDasharray: processing ? "3 2" : undefined,
    style: {
      fill,
      fillOpacity: processing ? 0.5 : 1,
      filter: "drop-shadow(0 1.5px 2px rgba(27,27,24,0.16))",
    },
  };
  if (kind === "artifact") return <rect x={-r} y={-r} width={2 * r} height={2 * r} rx={r * 0.5} {...p} />;
  if (kind === "collection")
    return <rect x={-r * 0.88} y={-r * 0.88} width={1.76 * r} height={1.76 * r} rx={r * 0.22} {...p} />;
  if (kind === "topic") {
    const pts = Array.from({ length: 6 }, (_, k) => {
      const a = Math.PI / 6 + (k * Math.PI) / 3;
      return `${(r * 1.06 * Math.cos(a)).toFixed(1)},${(r * 1.06 * Math.sin(a)).toFixed(1)}`;
    }).join(" ");
    return <polygon points={pts} {...p} />;
  }
  if (kind === "decision")
    return <polygon points={`0,${-r * 1.18} ${r * 1.18},0 0,${r * 1.18} ${-r * 1.18},0`} {...p} />;
  return <circle r={r} {...p} />; // person · source
}

const W = 520;
const H = 400;
const PAD_X = 48;
const PAD_BOT = 46; // labels sit below the node — keep the settled cloud inside the frame

// Force-directed settle (Fruchterman–Reingold) seeded from a deterministic radial layout: the result
// is stable across renders (no RNG, so SSR == client) yet nodes repel into an even, overlap-free
// spread. The focused node is pinned at centre; everything else relaxes under repulsion + edge springs.
export function layout(
  nodes: GraphNode[],
  edges: Neighborhood["edges"],
  spread = false,
): Map<string, { x: number; y: number }> {
  const cx = W / 2;
  const cy = H / 2;
  const n = nodes.length;
  const idx = new Map(nodes.map((nd, i) => [nd.id, i]));
  const centerI = Math.max(0, nodes.findIndex((nd) => nd.depth === 0));

  // spread — a graph of DISCONNECTED pairs (the verify view). A force settle flings the components to
  // the corners and the scale-to-fit then crushes each pair to a dot, so instead grid the components:
  // one connected group per cell, its nodes fanned around the cell centre. Bounded box, readable pairs.
  if (spread) {
    const adj = new Map<string, string[]>();
    for (const nd of nodes) adj.set(nd.id, []);
    for (const e of edges) {
      adj.get(e.from)?.push(e.to);
      adj.get(e.to)?.push(e.from);
    }
    const compOf = new Map<string, number>();
    let nc = 0;
    for (const nd of nodes) {
      if (compOf.has(nd.id)) continue;
      const stack = [nd.id];
      while (stack.length) {
        const u = stack.pop()!;
        if (compOf.has(u)) continue;
        compOf.set(u, nc);
        for (const v of adj.get(u) ?? []) if (!compOf.has(v)) stack.push(v);
      }
      nc++;
    }
    const comps: string[][] = Array.from({ length: nc }, () => []);
    for (const nd of nodes) comps[compOf.get(nd.id) ?? 0].push(nd.id);
    const cols = Math.ceil(Math.sqrt(nc));
    const rows = Math.max(1, Math.ceil(nc / cols));
    const px = 70;
    const py = 48;
    const cellW = (W - 2 * px) / cols;
    const cellH = (H - 2 * py) / rows;
    const out = new Map<string, { x: number; y: number }>();
    comps.forEach((ids, ci) => {
      const ccx = px + cellW * ((ci % cols) + 0.5);
      const ccy = py + cellH * (Math.floor(ci / cols) + 0.5);
      const r = ids.length === 1 ? 0 : Math.min(cellW, cellH) * 0.3;
      ids.forEach((id, k) => {
        const a = -Math.PI / 2 + (k / Math.max(ids.length, 1)) * 2 * Math.PI;
        out.set(id, { x: ccx + r * Math.cos(a), y: ccy + r * Math.sin(a) });
      });
    });
    return out;
  }

  // seed — radial rings (deterministic), the settle's starting frame
  const P = nodes.map((nd) => {
    if (nd.depth === 0) return { x: cx, y: cy };
    const ring = nodes.filter((m) => m.depth === nd.depth);
    const ri = ring.indexOf(nd);
    const R = nd.depth === 1 ? 118 : 170;
    const a =
      -Math.PI / 2 + (ri / Math.max(ring.length, 1)) * 2 * Math.PI + (nd.depth === 2 ? 0.5 : 0);
    return { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) };
  });

  const k = 0.95 * Math.sqrt((W * H) / Math.max(n, 1)); // ideal node separation
  let temp = W / 9;
  const ITER = 340;
  for (let it = 0; it < ITER; it++) {
    const disp = nodes.map(() => ({ x: 0, y: 0 }));
    // repulsion — every pair pushes apart (f = k²/d)
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dx = P[i].x - P[j].x;
        const dy = P[i].y - P[j].y;
        const d = Math.hypot(dx, dy) || 0.01;
        const f = (k * k) / d;
        const ux = dx / d;
        const uy = dy / d;
        disp[i].x += ux * f;
        disp[i].y += uy * f;
        disp[j].x -= ux * f;
        disp[j].y -= uy * f;
      }
    }
    // attraction — linked nodes pull together (f = d²/k)
    for (const e of edges) {
      const a = idx.get(e.from);
      const b = idx.get(e.to);
      if (a == null || b == null) continue;
      const dx = P[a].x - P[b].x;
      const dy = P[a].y - P[b].y;
      const d = Math.hypot(dx, dy) || 0.01;
      const f = (d * d) / k;
      const ux = dx / d;
      const uy = dy / d;
      disp[a].x -= ux * f;
      disp[a].y -= uy * f;
      disp[b].x += ux * f;
      disp[b].y += uy * f;
    }
    // integrate — pin centre, mild gravity on the rest, step-limit by temperature, clamp to frame
    for (let i = 0; i < n; i++) {
      if (i === centerI) continue;
      const g = spread ? 0.004 : 0.012;
      disp[i].x += (cx - P[i].x) * g;
      disp[i].y += (cy - P[i].y) * g;
      const dl = Math.hypot(disp[i].x, disp[i].y) || 0.01;
      const step = Math.min(dl, temp);
      P[i].x += (disp[i].x / dl) * step;
      P[i].y += (disp[i].y / dl) * step;
    }
    temp = Math.max(temp * 0.975, 1.5);
  }

  // normalise — scale the settled cloud around the pinned centre so it fits the frame without
  // clamping nodes onto the border (which would otherwise pile them along an edge in a line).
  let maxAbsX = 1;
  let maxAbsY = 1;
  for (let i = 0; i < n; i++) {
    if (i === centerI) continue;
    maxAbsX = Math.max(maxAbsX, Math.abs(P[i].x - cx));
    maxAbsY = Math.max(maxAbsY, Math.abs(P[i].y - cy));
  }
  const scale = Math.min((W / 2 - PAD_X) / maxAbsX, (H / 2 - PAD_BOT) / maxAbsY, 1.3);
  for (let i = 0; i < n; i++) {
    if (i === centerI) continue;
    P[i].x = cx + (P[i].x - cx) * scale;
    P[i].y = cy + (P[i].y - cy) * scale;
  }

  const pos = new Map<string, { x: number; y: number }>();
  nodes.forEach((nd, i) => pos.set(nd.id, P[i]));
  pos.set(nodes[centerI]?.id ?? "", { x: cx, y: cy });
  return pos;
}

// radial — a clean ego arrangement: the focused node pinned at centre, depth-1 fanned evenly by angle
// on an inner ring, depth-2 (if any) on an outer ring (offset half a slot so it doesn't hide behind the
// inner ring). Index-based angles → deterministic and stable across renders, no settle. (This is the
// force layout's seed geometry, frozen.)
function radialLayout(nodes: GraphNode[]): Map<string, { x: number; y: number }> {
  const cx = W / 2;
  const cy = H / 2;
  const pos = new Map<string, { x: number; y: number }>();
  for (const nd of nodes) {
    if (nd.depth === 0) {
      pos.set(nd.id, { x: cx, y: cy });
      continue;
    }
    const ring = nodes.filter((m) => m.depth === nd.depth);
    const ri = ring.indexOf(nd);
    const R = nd.depth === 1 ? 128 : 178;
    const a =
      -Math.PI / 2 + (ri / Math.max(ring.length, 1)) * 2 * Math.PI + (nd.depth === 2 ? 0.5 : 0);
    pos.set(nd.id, { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) });
  }
  return pos;
}

// arc — a provenance/timeline reading along X: "where it came from → where it goes". The focused doc
// sits dead centre; sources (and anything the focus was sourced_from / superseded by) go LEFT; outgoing
// links and artifacts derived from the focus go RIGHT. Each column spreads down Y so a depth-1
// neighborhood stays legible. Deterministic (stable node/edge order → stable rows).
function arcLayout(
  nodes: GraphNode[],
  edges: Neighborhood["edges"],
): Map<string, { x: number; y: number }> {
  const cx = W / 2;
  const cy = H / 2;
  const focusId = nodes.find((n) => n.depth === 0)?.id;

  // -1 = left (provenance / upstream), 0 = middle (the focus), 1 = right (derived / referenced)
  const sideOf = (n: GraphNode): -1 | 0 | 1 => {
    if (n.id === focusId) return 0;
    if (n.kind === "source") return -1; // an external origin — always upstream
    if (focusId != null) {
      for (const e of edges) {
        const other = e.from === focusId ? e.to : e.to === focusId ? e.from : null;
        if (other !== n.id) continue;
        // sourced_from / supersedes point from the derived/newer node back to the origin/older one, so
        // they read AGAINST the arrow; every other edge reads with it (focus → x means x is downstream).
        const reversed = e.type === "sourced_from" || e.type === "supersedes";
        return (e.from === focusId) !== reversed ? 1 : -1;
      }
    }
    return 1; // no direct edge to the focus (e.g. a depth-2 node) — read as downstream
  };

  const left: string[] = [];
  const mid: string[] = [];
  const right: string[] = [];
  for (const n of nodes) {
    const s = sideOf(n);
    (s < 0 ? left : s > 0 ? right : mid).push(n.id);
  }

  const out = new Map<string, { x: number; y: number }>();
  // fan each side into a gentle arc: nodes bow outward at mid-height, so a crowded column spreads in 2D
  // (varying x AND y) instead of a straight vertical line — that's what keeps the labels from stacking.
  const place = (ids: string[], baseX: number, dir: -1 | 0 | 1) => {
    const top = 52;
    const bot = H - 52;
    const n = ids.length;
    const bowMax = n > 4 ? 56 : n > 2 ? 26 : 0; // only bow columns crowded enough to need the room
    ids.forEach((id, k) => {
      const t = n <= 1 ? 0.5 : k / (n - 1);
      const y = n <= 1 ? cy : top + (bot - top) * t;
      const x = baseX + Math.sin(t * Math.PI) * bowMax * dir;
      out.set(id, { x, y });
    });
  };
  place(left, 104, -1);
  place(mid, cx, 0);
  place(right, W - 104, 1);
  return out;
}

// orbit — a deterministic two-ring layout for a hub-and-spoke SPACE graph (the Team field): the space pinned
// at centre, its collections on an inner ellipse, its people on an outer ellipse, each ring evenly spaced by
// angle. Even spacing → no overlaps and none of the force settle's clumping (a star where many people share a
// few collections — or a disconnected person the settle would gravity onto the centre — would otherwise pile
// up). People are ORDERED by the angle of the collection they most connect to, so the spoke edges stay short.
function orbitLayout(
  nodes: GraphNode[],
  edges: Neighborhood["edges"],
): Map<string, { x: number; y: number }> {
  const cx = W / 2;
  const cy = H / 2;
  const pos = new Map<string, { x: number; y: number }>();
  const center = nodes.find((n) => n.depth === 0);
  if (center) pos.set(center.id, { x: cx, y: cy });

  const rest = nodes.filter((n) => n.id !== center?.id);
  const inner = rest.filter((n) => n.kind === "collection");
  const outer = rest.filter((n) => n.kind !== "collection");

  // inner ring — collections, evenly by angle; remember each angle to anchor the people to it
  const innerAngle = new Map<string, number>();
  inner.forEach((n, i) => {
    const a = -Math.PI / 2 + (i / Math.max(inner.length, 1)) * 2 * Math.PI;
    innerAngle.set(n.id, a);
    pos.set(n.id, { x: cx + 108 * Math.cos(a), y: cy + 76 * Math.sin(a) });
  });

  // outer ring — people, sorted near the collection(s) they connect to (short spokes), then evenly spaced
  const adj = new Map<string, string[]>();
  for (const e of edges) {
    adj.set(e.from, [...(adj.get(e.from) ?? []), e.to]);
    adj.set(e.to, [...(adj.get(e.to) ?? []), e.from]);
  }
  const anchor = (id: string): number => {
    const cols = (adj.get(id) ?? []).filter((x) => innerAngle.has(x));
    if (!cols.length) return Math.PI; // no collection edge → park together on one side, not the centre
    const sx = cols.reduce((s, c) => s + Math.cos(innerAngle.get(c)!), 0);
    const sy = cols.reduce((s, c) => s + Math.sin(innerAngle.get(c)!), 0);
    return Math.atan2(sy, sx);
  };
  const sorted = [...outer].sort((a, b) => anchor(a.id) - anchor(b.id));
  sorted.forEach((n, i) => {
    const a = -Math.PI / 2 + (i / Math.max(sorted.length, 1)) * 2 * Math.PI;
    pos.set(n.id, { x: cx + 200 * Math.cos(a), y: cy + 134 * Math.sin(a) });
  });

  return pos;
}

function clip(label: string, n = 17): string {
  return label.length > n ? label.slice(0, n - 1) + "…" : label;
}

export function LocalGraph({
  data,
  onSelect,
  onVerifyEdge,
  verifiedBy,
  spread,
  flow,
  dense,
  renderPopover,
  layout: layoutMode = "force",
  highlight,
}: {
  data: Neighborhood;
  onSelect: (id: string) => void;
  // when provided, proposed (dashed) edges become resolvable in place — hover one, then ✓ / ✕
  onVerifyEdge?: (edgeId: string, action: "confirm" | "discard") => void;
  // a verified edge's durable record — WHO confirmed it, WHEN — surfaced as a stamp on the edge (the ledger).
  // Returns null for edges verified without a recorded gesture (seed data), so only real confirms carry one.
  verifiedBy?: (edgeId: string) => { name: string; seed: string; at: string } | null;
  // spread layout — for a graph of disconnected pairs (the verify view), so they don't collapse inward
  spread?: boolean;
  // flow — send a slow particle down each confirmed edge, so the web reads as alive (immersive view only)
  flow?: boolean;
  // dense — finer nodes, labels + strokes for the immersive full-screen view (which scales the graph ~2×)
  dense?: boolean;
  // when provided, clicking a node opens a popover anchored AT the node — the parent renders its body;
  // api.select moves the peek to another node (e.g. a related chip), api.close dismisses it
  renderPopover?: (id: string, api: { close: () => void; select: (id: string) => void }) => React.ReactNode;
  // layout lens — "force" (default) is the settle; "radial" is a concentric ego view by depth; "arc" is
  // a left→right provenance reading (sources ← focus → derived). Only swaps the position map.
  layout?: "force" | "radial" | "arc" | "orbit";
  // highlight — when non-empty, drives the SAME spotlight hover uses: these node ids (and the edges with
  // both ends inside the set) stay lit, everything else dims. Hover still works and takes precedence.
  highlight?: string[];
}) {
  // memoised so hovering (which re-renders) never re-runs the 340-iteration force settle; keyed on the
  // layout lens too, so switching mode recomputes once (radial/arc are cheap, deterministic placements)
  const pos = React.useMemo(() => {
    if (layoutMode === "radial") return radialLayout(data.nodes);
    if (layoutMode === "arc") return arcLayout(data.nodes, data.edges);
    if (layoutMode === "orbit") return orbitLayout(data.nodes, data.edges);
    return layout(data.nodes, data.edges, spread);
  }, [data, spread, layoutMode]);
  const at = (id: string) => pos.get(id) ?? { x: W / 2, y: H / 2 };

  // adjacency for the hover spotlight — who sits one edge away from whom
  const adj = React.useMemo(() => {
    const m = new Map<string, Set<string>>();
    const add = (a: string, b: string) => {
      if (!m.has(a)) m.set(a, new Set());
      m.get(a)!.add(b);
    };
    for (const e of data.edges) {
      add(e.from, e.to);
      add(e.to, e.from);
    }
    return m;
  }, [data]);

  // ── space-field styling (orbit only, i.e. the Team space graph): colour encodes the COLLECTION cluster,
  // node size encodes DEGREE, and edges carry their collection's hue — so the teams read at rest, not on hover
  // (grounded in Obsidian color-groups + node-size-by-references, Kumu decorate-by-field). Scoped to `orbit`
  // so the reader's ego graph (force / radial / arc) keeps its identity-hue palette untouched.
  const spaceField = layoutMode === "orbit";
  const field = React.useMemo(() => {
    const colIds = new Set(data.nodes.filter((n) => n.kind === "collection" && n.depth !== 0).map((n) => n.id));
    const degree = new Map<string, number>();
    for (const e of data.edges) {
      degree.set(e.from, (degree.get(e.from) ?? 0) + 1);
      degree.set(e.to, (degree.get(e.to) ?? 0) + 1);
    }
    // each person's cluster = the collection they contribute to MOST (highest tie weight = # shared artifacts),
    // not just the first team they touch → the muted hue the person inherits reflects their primary team.
    // weightSum = their TOTAL contribution across every team (Σ shared artifacts) → drives node SIZE, so a hub
    // who spans three teams reads bigger than a one-artifact-each three-edge person (raw degree can't separate
    // them: both are ~3 edges, but the hub's Σweight is far higher).
    const cluster = new Map<string, string>();
    const clusterW = new Map<string, number>();
    const weightSum = new Map<string, number>();
    for (const e of data.edges) {
      const person = colIds.has(e.to) ? e.from : colIds.has(e.from) ? e.to : null;
      const col = colIds.has(e.to) ? e.to : colIds.has(e.from) ? e.from : null;
      if (person && col && !colIds.has(person)) {
        const w = e.weight ?? 1;
        weightSum.set(person, (weightSum.get(person) ?? 0) + w);
        if (w > (clusterW.get(person) ?? 0)) {
          clusterW.set(person, w);
          cluster.set(person, col);
        }
      }
    }
    const rangeOf = (vals: number[]) => (vals.length ? ([Math.min(...vals), Math.max(...vals)] as const) : ([0, 1] as const));
    return {
      colIds,
      degree,
      cluster,
      weightSum,
      // people size by contribution weight; collections still by degree (member count)
      perRange: rangeOf(data.nodes.filter((n) => n.kind === "person").map((n) => weightSum.get(n.id) ?? 0)),
      colRange: rangeOf([...colIds].map((id) => degree.get(id) ?? 0)),
    };
  }, [data]);
  const colColorOf = (id: string) => collectionById(id)?.color ?? "var(--chart-1)";
  const norm = (v: number, [lo, hi]: readonly [number, number]) => (hi > lo ? (v - lo) / (hi - lo) : 0.5);

  const [hovered, setHovered] = React.useState<string | null>(null);
  const [hoveredEdge, setHoveredEdge] = React.useState<string | null>(null);
  const [sel, setSel] = React.useState<string | null>(null); // the node whose popover is open (popover mode)

  // THE WEAVE — confirming a proposed edge plays a one-shot cinematic beat: a bright signal races down the
  // edge and blooms at its target — the moment a proposal becomes trusted knowledge, the confirm made felt.
  // Endpoints are captured at confirm time so it plays even if the edge then leaves the graph (verify mode
  // drops it). Skipped under prefers-reduced-motion.
  const [weaves, setWeaves] = React.useState<{ key: string; a: { x: number; y: number }; b: { x: number; y: number } }[]>([]);
  const weaveSeq = React.useRef(0);
  const motionOK = React.useRef(true);
  React.useEffect(() => {
    motionOK.current = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);
  function playWeave(a: { x: number; y: number }, b: { x: number; y: number }) {
    if (!motionOK.current) return;
    const key = `w${weaveSeq.current++}`;
    setWeaves((w) => [...w, { key, a, b }]);
    window.setTimeout(() => setWeaves((w) => w.filter((x) => x.key !== key)), 1400);
  }

  // the durable ledger — a confirmed edge REMEMBERS who verified it and when. After a confirm the stamp rises
  // on the edge (the payoff — the gesture became a record), holds ~4.5s, then lives on as a hover reveal. We
  // key by edge id and read the midpoint from live positions at render, so it tracks the edge if the graph shifts.
  const [stamped, setStamped] = React.useState<string[]>([]);
  function stampEdge(id: string) {
    setStamped((s) => (s.includes(id) ? s : [...s, id]));
    window.setTimeout(() => setStamped((s) => s.filter((x) => x !== id)), 4500);
  }
  React.useEffect(() => {
    if (!sel) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSel(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sel]);
  // spotlight — hover takes precedence (most immediate intent); otherwise a non-empty `highlight` drives
  // it. Both feed the same lit()/edgeLit() so nodes AND edges dim identically whatever the source.
  const hlSet = React.useMemo(() => new Set(highlight ?? []), [highlight]);
  const active = hovered !== null || hlSet.size > 0;
  const lit = (id: string): boolean => {
    if (!active) return true;
    if (hovered !== null) return id === hovered || (adj.get(hovered)?.has(id) ?? false);
    return hlSet.has(id);
  };
  // an edge belongs to the spotlight when: on hover, it touches the hovered node; on highlight, BOTH
  // ends sit in the set. Nothing is specially lit when idle.
  const edgeLit = (e: GraphEdge): boolean => {
    if (!active) return false;
    if (hovered !== null) return e.from === hovered || e.to === hovered;
    return hlSet.has(e.from) && hlSet.has(e.to);
  };

  // label collision avoidance (idle state) — lay out focus + direct labels by priority (focus first,
  // then direct); hide any that would overlap one already placed. The hidden labels return on hover.
  const idleLabels = React.useMemo(() => {
    const set = new Set<string>();
    const boxes: { x: number; y: number; w: number; h: number }[] = [];
    const cand = data.nodes.filter((n) => n.depth <= 1).sort((a, b) => a.depth - b.depth);
    for (const n of cand) {
      const p = pos.get(n.id) ?? { x: W / 2, y: H / 2 };
      const txt = clip(n.label, n.depth === 0 ? 22 : 16);
      const fs = n.depth === 0 ? 12 : 10.5;
      const w = txt.length * fs * 0.55;
      const rr = n.depth === 0 ? 8.5 : 6;
      const box = { x: p.x - w / 2, y: p.y + rr + 5, w, h: 13 };
      const hit = boxes.some(
        (b) => box.x < b.x + b.w && box.x + box.w > b.x && box.y < b.y + b.h && box.y + box.h > b.y,
      );
      if (!hit) {
        boxes.push(box);
        set.add(n.id);
      }
    }
    return set;
  }, [data, pos]);

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ overflow: "visible" }} role="img">
        {/* click-away target — sits behind the graph; a click on empty space dismisses the popover
            (nodes render on top, so clicking another node moves the peek instead of closing it) */}
        {renderPopover && sel ? (
          <rect width={W} height={H} fill="transparent" onClick={() => setSel(null)} />
        ) : null}
      {/* edges — soft threads; on hover only the focused node's threads light up, the rest recede */}
      {data.edges.map((e, idx) => {
        const a = at(e.from);
        const b = at(e.to);
        const ai = e.prov === "ai_generated";
        const touches = edgeLit(e);
        const faded = active && !touches;
        // space-field: tint the thread by its collection endpoint + lift its resting opacity so the web reads at rest
        const colId = spaceField ? (field.colIds.has(e.from) ? e.from : field.colIds.has(e.to) ? e.to : null) : null;
        const rest = ai ? 0.4 : spaceField ? 0.3 : 0.15;
        return (
          <line
            key={e.id}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke={ai ? "var(--primary)" : colId ? colColorOf(colId) : "var(--muted-foreground)"}
            strokeOpacity={faded ? 0.05 : touches ? (ai ? 0.75 : spaceField ? 0.6 : 0.5) : rest}
            strokeWidth={(touches ? 1.75 : 1.25) * (dense ? 0.82 : 1)}
            strokeDasharray={ai ? "4 4" : 1}
            pathLength={ai ? undefined : 1}
            className={ai ? "thread-in" : undefined}
            style={{
              transition: "stroke-opacity 0.25s, stroke-width 0.25s",
              // confirmed threads draw on end-to-end (staggered); proposed threads weave in a beat later via
              // the .thread-in class, so the settled web reads first and the agent's proposals arrive after.
              animation: ai ? undefined : `edge-draw 0.7s ease-out ${(0.04 * idx).toFixed(2)}s both`,
            }}
          />
        );
      })}

      {/* flow — a slow particle glides down each confirmed edge (source → target), so the connections read
          as living conduits. Foreground motion (on the content), staggered so they never pulse in sync;
          on hover only the focused node's flows stay lit. */}
      {flow
        ? data.edges.map((e, idx) => {
            if (e.prov === "ai_generated") return null; // unconfirmed edges don't carry flow yet
            if (active && !edgeLit(e)) return null;
            const a = at(e.from);
            const b = at(e.to);
            const dur = `${(2.4 + (idx % 4) * 0.45).toFixed(2)}s`;
            const begin = `${((idx * 0.41) % 2.4).toFixed(2)}s`;
            return (
              <circle key={`flow-${e.id}`} r={1.5} fill="var(--primary)" opacity={0}>
                <animateMotion dur={dur} begin={begin} repeatCount="indefinite" path={`M${a.x} ${a.y} L${b.x} ${b.y}`} />
                <animate attributeName="opacity" values="0;0.6;0.6;0" dur={dur} begin={begin} repeatCount="indefinite" />
              </circle>
            );
          })
        : null}

      {/* nodes — shape by kind, colour by identity, size by distance (focus 8.5 / direct 6 / extended 4);
          on hover everything but the focused node + its neighbours dims to a whisper */}
      {data.nodes.map((n, i) => {
        const p = at(n.id);
        const center = n.depth === 0;
        // space-field: size collections by member count (degree), people by total contribution weight (Σ shared
        // artifacts) — so a cross-team connector reads bigger than a lightly-linked person, not the flat depth size
        let r = center ? 8.5 : n.depth === 2 ? 4 : 6;
        if (spaceField && !center) {
          r =
            n.kind === "collection"
              ? 6.5 + 1.8 * norm(field.degree.get(n.id) ?? 0, field.colRange)
              : 4.5 + 3 * norm(field.weightSum.get(n.id) ?? 0, field.perRange);
        }
        r *= dense ? 0.62 : 1;
        // space-field: colour people by their COLLECTION cluster (a muted tint); collections keep their own swatch
        let fill = nodeFill(n);
        if (spaceField && n.kind === "person") {
          const cid = field.cluster.get(n.id);
          // clustered → a muted tint of the team hue; unclustered (no collection tie) → a soft neutral, kept
          // QUIET so the least-connected people don't draw the eye
          fill = cid
            ? `color-mix(in srgb, ${colColorOf(cid)} 58%, var(--card))`
            : "color-mix(in srgb, var(--muted-foreground) 38%, var(--card))";
        }
        const isLit = lit(n.id);
        const nodeOpacity = active ? (isLit ? 1 : 0.1) : n.depth === 2 ? 0.4 : 1;
        // labels: on hover the spotlight shows the lit set; idle shows only the collision-free set
        const labelOpacity = active ? (isLit ? 1 : 0) : idleLabels.has(n.id) ? 1 : 0;
        return (
          <g
            key={n.id}
            className="cursor-pointer"
            style={{
              transform: `translate(${p.x}px, ${p.y}px)`,
              transition: "transform 0.55s cubic-bezier(0.22,1,0.36,1), opacity 0.25s",
              opacity: nodeOpacity,
            }}
            onClick={() => {
              onSelect(n.id);
              if (renderPopover) setSel(n.id);
            }}
            onMouseEnter={() => setHovered(n.id)}
            onMouseLeave={() => setHovered(null)}
          >
            <title>{n.label}</title>
            {/* entrance layer (scale in) — no idle drift; the graph stays still at rest */}
            <g
              style={{
                animation: `node-in 0.45s ease-out ${(0.03 * i).toFixed(2)}s both`,
                transformBox: "fill-box",
                transformOrigin: "center",
              }}
            >
              {/* focus ring — only on the node actually under the cursor */}
              <circle
                r={r + 5}
                fill="none"
                strokeWidth={1.5}
                style={{
                  stroke: fill,
                  opacity: hovered === n.id && !center ? 0.55 : 0,
                  transition: "opacity 0.2s",
                }}
              />
              {/* node body — shape encodes kind */}
              <NodeShape kind={n.kind} r={r} fill={fill} processing={n.state === "processing"} />
              {/* label */}
              <text
                y={r + (dense ? 10 : 13)}
                textAnchor="middle"
                className="pointer-events-none select-none"
                fontSize={dense ? (center ? 8.5 : 7.5) : center ? 12 : 10.5}
                fontWeight={center ? 600 : 400}
                fill="var(--foreground)"
                style={{ opacity: labelOpacity, transition: "opacity 0.2s" }}
              >
                {clip(n.label, center ? 22 : 16)}
              </text>
            </g>
          </g>
        );
      })}

      {/* verify layer — proposed (dashed) edges are resolvable IN PLACE: hover one, a ✓ / ✕ pops at its
          midpoint. Confirm re-strokes it solid on the next render; dismiss drops it. Sits above the nodes. */}
      {onVerifyEdge
        ? data.edges
            .filter((e) => e.prov === "ai_generated")
            .map((e) => {
              const a = at(e.from);
              const b = at(e.to);
              const mx = (a.x + b.x) / 2;
              const my = (a.y + b.y) / 2;
              const on = hoveredEdge === e.id;
              return (
                <g key={`v-${e.id}`} onMouseEnter={() => setHoveredEdge(e.id)} onMouseLeave={() => setHoveredEdge(null)}>
                  <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth={14} style={{ cursor: "pointer" }} />
                  {on ? (
                    <foreignObject x={mx - 24} y={my - 13} width={48} height={26} style={{ overflow: "visible" }}>
                      <div style={{ display: "flex", gap: "4px", alignItems: "center", justifyContent: "center" }}>
                        <button
                          aria-label="Confirm"
                          onClick={() => {
                            onVerifyEdge(e.id, "confirm"); // record the gesture first so its ledger stamp resolves
                            playWeave(a, b);
                            stampEdge(e.id);
                          }}
                          style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "22px", height: "22px", borderRadius: "9999px", border: "none", background: "var(--primary)", color: "var(--primary-foreground)", cursor: "pointer", boxShadow: "0 1px 5px rgba(0,0,0,0.2)" }}
                        >
                          <Check style={{ width: 13, height: 13 }} />
                        </button>
                        <button
                          aria-label="Dismiss"
                          onClick={() => onVerifyEdge(e.id, "discard")}
                          style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "22px", height: "22px", borderRadius: "9999px", border: "0.5px solid var(--border)", background: "var(--background)", color: "var(--muted-foreground)", cursor: "pointer", boxShadow: "0 1px 5px rgba(0,0,0,0.12)" }}
                        >
                          <X style={{ width: 13, height: 13 }} />
                        </button>
                      </div>
                    </foreignObject>
                  ) : null}
                </g>
              );
            })
        : null}

      {/* THE WEAVE — the confirm made cinematic. A bright signal races the just-confirmed edge and blooms at
          its target: the instant a proposal becomes trusted knowledge. One-shot; cleared after ~1.4s. */}
      {weaves.map((w) => (
        <g key={w.key} style={{ pointerEvents: "none" }}>
          {/* the edge flares bright, then settles to the confirmed weight */}
          <line x1={w.a.x} y1={w.a.y} x2={w.b.x} y2={w.b.y} stroke="var(--primary)" strokeLinecap="round" opacity={0}>
            <animate attributeName="opacity" values="0;0.9;0" dur="0.9s" begin="0s" fill="freeze" />
            <animate attributeName="stroke-width" values="3.5;1.75" dur="0.9s" begin="0s" fill="freeze" />
          </line>
          {/* the signal traveling the strand (rhymes with the woven-wave identity) */}
          <circle r={3.5} fill="var(--primary)" opacity={0}>
            <animateMotion dur="0.7s" begin="0s" fill="freeze" path={`M${w.a.x} ${w.a.y} L${w.b.x} ${w.b.y}`} />
            <animate attributeName="opacity" values="0;1;1;0" dur="0.7s" begin="0s" fill="freeze" />
          </circle>
          {/* the bloom at the target — the proposal lands as remembered knowledge */}
          <circle cx={w.b.x} cy={w.b.y} r={3} fill="none" stroke="var(--primary)" strokeWidth={1.75} opacity={0}>
            <animate attributeName="r" values="3;15" dur="0.6s" begin="0.45s" fill="freeze" />
            <animate attributeName="opacity" values="0.7;0" dur="0.6s" begin="0.45s" fill="freeze" />
          </circle>
          <circle cx={w.b.x} cy={w.b.y} r={4} fill="var(--primary)" opacity={0}>
            <animate attributeName="opacity" values="0;0.9;0" dur="0.5s" begin="0.5s" fill="freeze" />
          </circle>
        </g>
      ))}

      {/* the ledger, recallable — an edge that carries a real confirm-record gets a wider transparent hit-line,
          so its stamp can be summoned on hover at any time, not only in the instant it was verified. */}
      {verifiedBy
        ? data.edges
            .filter((e) => e.prov !== "ai_generated" && !!verifiedBy(e.id))
            .map((e) => {
              const a = at(e.from);
              const b = at(e.to);
              return (
                <line
                  key={`ph-${e.id}`}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke="transparent"
                  strokeWidth={12}
                  style={{ cursor: "default" }}
                  onMouseEnter={() => setHoveredEdge(e.id)}
                  onMouseLeave={() => setHoveredEdge(null)}
                />
              );
            })
        : null}

      {/* the stamp — ✓ WHO · WHEN riding the edge's midpoint. Auto-raised for ~4.5s the moment you confirm (the
          payoff: the gesture is now a record), and recalled on hover ever after — the durable, human-fingerprinted
          provenance no plain graph or notes tool keeps. Midpoint read live so it tracks the edge if things shift. */}
      {verifiedBy
        ? data.edges
            .filter((e) => e.prov !== "ai_generated" && (stamped.includes(e.id) || hoveredEdge === e.id))
            .map((e) => {
              const rec = verifiedBy(e.id);
              if (!rec) return null;
              const a = at(e.from);
              const b = at(e.to);
              const mx = (a.x + b.x) / 2;
              const my = (a.y + b.y) / 2;
              const justConfirmed = stamped.includes(e.id);
              return (
                <foreignObject
                  key={`stamp-${e.id}`}
                  x={mx - 80}
                  y={my - 15}
                  width={160}
                  height={30}
                  style={{ overflow: "visible", pointerEvents: "none" }}
                >
                  <div
                    style={{
                      display: "flex",
                      width: "fit-content",
                      margin: "0 auto",
                      alignItems: "center",
                      gap: "5px",
                      padding: "3px 9px 3px 3px",
                      borderRadius: "9999px",
                      background: "var(--popover)",
                      border: "0.5px solid var(--border)",
                      boxShadow: "0 2px 9px rgba(0,0,0,0.16)",
                      fontSize: "11px",
                      lineHeight: 1,
                      whiteSpace: "nowrap",
                      animation: justConfirmed
                        ? "node-in 0.4s ease-out 0.55s both"
                        : "node-in 0.18s ease-out both",
                    }}
                  >
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: "16px",
                        height: "16px",
                        borderRadius: "9999px",
                        background: "var(--primary)",
                        color: "var(--primary-foreground)",
                        flexShrink: 0,
                      }}
                    >
                      <Check style={{ width: 10, height: 10 }} />
                    </span>
                    <span style={{ color: "var(--foreground)", fontWeight: 500 }}>{rec.name}</span>
                    <span style={{ color: "var(--muted-foreground)" }}>· {rec.at}</span>
                  </div>
                </foreignObject>
              );
            })
        : null}
      </svg>

      {/* the peek — an EntityProfile popover anchored AT the clicked node (above it, or below when the
          node sits high). Related chips inside move the peek via api.select; Esc / empty-space click closes. */}
      {renderPopover && sel
        ? (() => {
            const p = at(sel);
            const below = p.y / H < 0.42;
            return (
              // key on sel so the peek re-mounts (and re-animates) each time it opens or hops to another
              // node; the outer div owns positioning (transform), the inner owns the enter animation so the
              // two transforms never fight. It grows from the anchor side (top when the peek sits below).
              <div
                key={sel}
                className="absolute z-20 w-72"
                style={{
                  left: `${(p.x / W) * 100}%`,
                  top: `${(p.y / H) * 100}%`,
                  transform: below ? "translate(-50%, 22px)" : "translate(-50%, calc(-100% - 18px))",
                }}
              >
                <div
                  className="animate-in fade-in-0 zoom-in-95 duration-150 ease-out"
                  style={{ transformOrigin: below ? "top center" : "bottom center" }}
                >
                  {renderPopover(sel, { close: () => setSel(null), select: (id) => setSel(id) })}
                </div>
              </div>
            );
          })()
        : null}
    </div>
  );
}
