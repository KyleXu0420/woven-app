"use client";

import * as React from "react";
import { collectionBySlug, collectionGraph } from "@/lib/api";

// EmergentMark — the collection's KG-map rendered as a compact, label-free MARK: its members + the
// links among them, in the collection's own hue. The user never "designs" it — they curate members and
// the knowledge draws its own mark. For roomy slots (collection header, public-hub hero, share card),
// NOT tiny ones (that's the swatch's job).

type MarkNode = { id: string; depth: number };

// Composed, not settled. It used to borrow the Explorer's force layout, which is right for the
// Explorer — there the user reads structure and the shape is allowed to be whatever the springs
// make. A mark is looked at more than read, so its silhouette is decided in advance: the collection
// at the centre, its members on one ring at even intervals. The drawing still changes with the
// members — which chords cross, and how many — but it always closes into the same circle.
function markLayout(nodes: MarkNode[]) {
  const pos = new Map<string, { x: number; y: number }>();
  const centre = nodes.find((n) => n.depth === 0);
  if (centre) pos.set(centre.id, { x: 0, y: 0 });

  // one ring, 26px of arc each at minimum so a crowded collection widens rather than piles.
  // Starts at ten o'clock and runs clockwise, the order the list below reads in.
  const members = nodes.filter((n) => n.depth === 1);
  const R1 = Math.max(60, (members.length * 26) / (2 * Math.PI));
  members.forEach((m, i) => {
    // Steps of at most 120°. Two members spread over the full circle sit 180° apart and collinear
    // with the centre — three squares on a diagonal, which is a stray, not a mark. Stepping as if
    // there were at least three keeps two members and the centre a triangle.
    const a = -Math.PI * 0.75 + (i * 2 * Math.PI) / Math.max(members.length, 3);
    pos.set(m.id, { x: R1 * Math.cos(a), y: R1 * Math.sin(a) });
  });
  return pos;
}

export function EmergentMark({
  slug,
  className = "size-20",
  highlight,
}: {
  slug: string;
  className?: string;
  // The id of a member to light up. This is what turns the mark from an illustration into a
  // claim: hover a row below and its node answers, so the drawing is visibly made OF the rows.
  highlight?: string;
}) {
  const co = collectionBySlug(slug);
  // Members and the links among them — nothing else. The people and topics they touch belong to
  // the Map tab; here they were a halo of grey dots and long spokes around the ring, and that halo
  // is what read as a random constellation. The mark is the collection's OWN structure: the six
  // things in it and which of them cite which.
  const nb = React.useMemo(() => {
    const g = collectionGraph(slug);
    // The mark's only surface is the public hub. So it draws what is public: the published members,
    // and the ties a person has confirmed. It used to draw every member and every agent proposal at
    // full weight, on the one page where "nothing enters the graph as fact until someone says so"
    // matters most — a private document's structure, published as a picture.
    const pub = co.public ? new Set(co.public_member_ids ?? []) : null;
    const nodes = g.nodes.filter((n) => n.depth === 0 || (n.depth === 1 && (!pub || pub.has(n.id))));
    const ids = new Set(nodes.map((n) => n.id));
    return {
      nodes,
      edges: g.edges.filter((e) => ids.has(e.from) && ids.has(e.to) && e.prov !== "ai_generated"),
    };
  }, [slug]);
  const pos = React.useMemo(() => markLayout(nb.nodes), [nb]);

  const xs = [...pos.values()].map((p) => p.x);
  const ys = [...pos.values()].map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const pad = 14;
  const w = maxX - minX + 2 * pad;
  const h = maxY - minY + 2 * pad;
  const side = Math.max(w, h, 1); // square viewBox, the ring centred inside
  const vbX = minX - pad - (side - w) / 2;
  const vbY = minY - pad - (side - h) / 2;
  const at = (id: string) => pos.get(id) ?? { x: 0, y: 0 };

  return (
    <svg
      viewBox={`${vbX} ${vbY} ${side} ${side}`}
      className={className}
      role="img"
      aria-label={`${co.name} knowledge map`}
    >
      {/* threads. A spoke (collection → member) is scaffolding and stays light; a chord (member →
          member) is a real citation between two artifacts and carries the weight. */}
      {nb.edges.map((e) => {
        const a = at(e.from);
        const b = at(e.to);
        const spoke = e.type === "in_collection";
        return (
          <line
            key={e.id}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke={co.color}
            strokeOpacity={spoke ? 0.28 : 0.65}
            strokeWidth={2}
          />
        );
      })}
      {/* nodes — the collection + its members, all in its hue; no labels */}
      {nb.nodes.map((n) => {
        const p = at(n.id);
        const r = n.depth === 0 ? 13 : 9;
        const lit = highlight != null && n.id === highlight;
        const dimmed = highlight != null && !lit && n.depth !== 0;
        const op = lit ? 1 : dimmed ? 0.3 : n.depth === 0 ? 1 : 0.9;
        const rr = lit ? r * 1.35 : r;
        return (
          <rect
            key={n.id}
            x={p.x - rr}
            y={p.y - rr}
            width={2 * rr}
            height={2 * rr}
            rx={n.depth === 0 ? rr * 0.2 : rr * 0.5}
            fill={co.color}
            fillOpacity={op}
            stroke="var(--background)"
            strokeWidth={2}
            style={{ transition: "all 160ms ease-out" }}
          />
        );
      })}
    </svg>
  );
}
