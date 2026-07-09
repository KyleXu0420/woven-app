"use client";

import * as React from "react";
import { Check, X } from "lucide-react";
import type { GraphNode, Neighborhood, RefKind } from "@/lib/types";
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
export function GraphLegend({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground ${className}`}>
      <span className="inline-flex items-center gap-1.5">
        <span className="size-2 rounded-full" style={{ background: "var(--primary)" }} /> Focused
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block h-0 w-4 border-t border-muted-foreground/50" /> Confirmed
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block h-0 w-4 border-t border-dashed border-primary" /> Proposed
      </span>
      <span className="opacity-70">Shape = type</span>
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

function clip(label: string, n = 17): string {
  return label.length > n ? label.slice(0, n - 1) + "…" : label;
}

export function LocalGraph({
  data,
  onSelect,
  onVerifyEdge,
  spread,
  flow,
  renderPopover,
}: {
  data: Neighborhood;
  onSelect: (id: string) => void;
  // when provided, proposed (dashed) edges become resolvable in place — hover one, then ✓ / ✕
  onVerifyEdge?: (edgeId: string, action: "confirm" | "discard") => void;
  // spread layout — for a graph of disconnected pairs (the verify view), so they don't collapse inward
  spread?: boolean;
  // flow — send a slow particle down each confirmed edge, so the web reads as alive (immersive view only)
  flow?: boolean;
  // when provided, clicking a node opens a popover anchored AT the node — the parent renders its body;
  // api.select moves the peek to another node (e.g. a related chip), api.close dismisses it
  renderPopover?: (id: string, api: { close: () => void; select: (id: string) => void }) => React.ReactNode;
}) {
  // memoised so hovering (which re-renders) never re-runs the 340-iteration force settle
  const pos = React.useMemo(() => layout(data.nodes, data.edges, spread), [data, spread]);
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

  const [hovered, setHovered] = React.useState<string | null>(null);
  const [hoveredEdge, setHoveredEdge] = React.useState<string | null>(null);
  const [sel, setSel] = React.useState<string | null>(null); // the node whose popover is open (popover mode)
  React.useEffect(() => {
    if (!sel) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSel(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sel]);
  const active = hovered !== null;
  const lit = (id: string) => !active || id === hovered || (adj.get(hovered!)?.has(id) ?? false);

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
        const touches = active && (e.from === hovered || e.to === hovered);
        const faded = active && !touches;
        return (
          <line
            key={e.id}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke={ai ? "var(--primary)" : "var(--muted-foreground)"}
            strokeOpacity={faded ? 0.05 : touches ? (ai ? 0.75 : 0.5) : ai ? 0.4 : 0.15}
            strokeWidth={touches ? 1.75 : 1.25}
            strokeDasharray={ai ? "4 4" : 1}
            pathLength={ai ? undefined : 1}
            style={{
              transition: "stroke-opacity 0.25s, stroke-width 0.25s",
              animation: ai
                ? "node-in 0.5s ease-out both"
                : `edge-draw 0.7s ease-out ${(0.04 * idx).toFixed(2)}s both`,
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
            if (active && e.from !== hovered && e.to !== hovered) return null;
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
        const r = center ? 8.5 : n.depth === 2 ? 4 : 6;
        const fill = nodeFill(n);
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
                y={r + 13}
                textAnchor="middle"
                className="pointer-events-none select-none"
                fontSize={center ? 12 : 10.5}
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
                          onClick={() => onVerifyEdge(e.id, "confirm")}
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
      </svg>

      {/* the peek — an EntityProfile popover anchored AT the clicked node (above it, or below when the
          node sits high). Related chips inside move the peek via api.select; Esc / empty-space click closes. */}
      {renderPopover && sel
        ? (() => {
            const p = at(sel);
            const below = p.y / H < 0.42;
            return (
              <div
                className="absolute z-20 w-72"
                style={{
                  left: `${(p.x / W) * 100}%`,
                  top: `${(p.y / H) * 100}%`,
                  transform: below ? "translate(-50%, 22px)" : "translate(-50%, calc(-100% - 18px))",
                }}
              >
                {renderPopover(sel, { close: () => setSel(null), select: (id) => setSel(id) })}
              </div>
            );
          })()
        : null}
    </div>
  );
}
