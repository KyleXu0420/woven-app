"use client";

import * as React from "react";
import { collectionBySlug, collectionGraph } from "@/lib/api";
import { layout } from "./local-graph";

// EmergentMark — the collection's KG-map rendered as a compact, label-free MARK: its members + the
// links among them, in the collection's own hue. The user never "designs" it — they curate members and
// the knowledge draws its own mark. For roomy slots (collection header, public-hub hero, share card),
// NOT tiny ones (that's the swatch's job). Reuses the Explorer's force layout, so it reflects real
// structure and every collection's mark is distinct.
export function EmergentMark({ slug, className = "size-20" }: { slug: string; className?: string }) {
  const co = collectionBySlug(slug);
  const nb = React.useMemo(() => collectionGraph(slug), [slug]);
  const pos = React.useMemo(() => layout(nb.nodes, nb.edges), [nb]);

  const xs = [...pos.values()].map((p) => p.x);
  const ys = [...pos.values()].map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const pad = 30;
  const w = maxX - minX + 2 * pad;
  const h = maxY - minY + 2 * pad;
  const side = Math.max(w, h, 1); // square viewBox, the cloud centred inside
  const vbX = minX - pad - (side - w) / 2;
  const vbY = minY - pad - (side - h) / 2;
  const at = (id: string) => pos.get(id) ?? { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };

  return (
    <svg
      viewBox={`${vbX} ${vbY} ${side} ${side}`}
      className={className}
      role="img"
      aria-label={`${co.name} knowledge map`}
    >
      {/* threads */}
      {nb.edges.map((e) => {
        const a = at(e.from);
        const b = at(e.to);
        return (
          <line
            key={e.id}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke="var(--muted-foreground)"
            strokeOpacity={0.28}
            strokeWidth={2.4}
          />
        );
      })}
      {/* nodes — the collection + its members in its hue; touched people/topics muted; no labels */}
      {nb.nodes.map((n) => {
        const p = at(n.id);
        const inHue = n.depth <= 1; // collection + members carry the hue; outer ring is muted
        const r = n.depth === 0 ? 13 : n.depth === 1 ? 9 : 5.5;
        const fill = inHue ? co.color : "var(--muted-foreground)";
        const op = n.depth === 0 ? 1 : n.depth === 1 ? 0.85 : 0.4;
        return inHue ? (
          <rect
            key={n.id}
            x={p.x - r}
            y={p.y - r}
            width={2 * r}
            height={2 * r}
            rx={r * 0.42}
            fill={fill}
            fillOpacity={op}
            stroke="var(--card)"
            strokeWidth={2}
          />
        ) : (
          <circle
            key={n.id}
            cx={p.x}
            cy={p.y}
            r={r}
            fill={fill}
            fillOpacity={op}
            stroke="var(--card)"
            strokeWidth={1.5}
          />
        );
      })}
    </svg>
  );
}
