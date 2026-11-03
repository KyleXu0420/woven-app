"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import * as React from "react";
import { ArrowRight } from "lucide-react";
import { TypeBadge } from "@/components/artifact-ui";
import { NodeMark } from "@/components/entity-profile";
import { LocalGraph, type GraphBox } from "@/components/local-graph";
import { PageBreadcrumb } from "@/components/page-heading";
import { WovenMark } from "@/components/woven-mark";
import { DIVIDED_FLUSH } from "@/components/controls";
import { agoMinutes, collectionById, collectionGraph, collectionPublicMembers, hydrateState, listCollections, spaceById } from "@/lib/api";
import { initialsOf } from "@/lib/identity";
import type { Artifact, Collection, Neighborhood } from "@/lib/types";

// The PUBLIC face of a collection — no app chrome (this route lives outside the (app) group, so it uses
// the root layout: no sidebar, no topbar). Client-rendered + localStorage-hydrated so a freshly published
// collection resolves here across reloads and new tabs (same browser), not just the seeded ones.
//
// It is set in the Are.na register, the same one the public artifact page (app/a/[slug]) was rebuilt in on
// 2026-10-02, so the two public pages are one register: the connection is the content, where the collection
// lives and what it is woven into are facts on hairlines above the work, in one face, with nothing boxed.
// What it replaced, and why each went (the 10-02 verdict, problem 7):
//   - a header of back arrow + forest disc + "Acme Product" with its seed dot + "published with Woven". The
//     forest disc held the brand wave and read as the AGENT's seal, and the agent did not publish this page;
//     the back arrow pointed into the app; "published with Woven" was said twice, top and foot. The eyebrow
//     now carries the publisher, as a monogram dish, and the foot says Woven once.
//   - a three-square glyph (EmergentMark) as the hero: the published members on one composed ring around the
//     collection, unnamed, without the people and topics, 112px. Two members always close into the same
//     triangle, so every two-document hub wore one logo of a graph, not its graph. The hero is now the
//     collection's own map, drawn by the renderer the Map tab uses, at reading size on the page plane. It
//     keeps the mark's one rule, that a public picture draws only published members and confirmed ties.
//   - a meta line of "2 artifacts", "living" and "updated weekly" run together with middle dots. "Updated
//     weekly" was typed, not read: no collection in the store has a cadence. Every item in the band below is
//     read from the store, and an item with nothing true to say is left out, never filled.
//   - the artifacts in a bordered, rounded card of bg-card rows, the one card on the public pages, against
//     minimize-cards; and each row linked to /artifact/<id>, the APP's route, so a public reader who clicked
//     a document was dropped into the sidebar shell. Rows are open rows on hairlines now and go to the
//     document's own public page.

// The seed names the space as org, middle dot, team. The dot is a separator the product does not print
// (the sidebar, /team and the public artifact page show this space as "Acme Product"), so it is a space.
// The same function app/a/[slug] holds; one copy each until the two pages share a module (line B's file).
const spaceLabel = (name: string) => name.replace(/\s*\u00b7\s*/g, " ");

// `updated` is the prototype's relative label: "17m", "2d" read as an age, "just now" already is a phrase.
// The public artifact page's wording, so the two bands say a time the same way.
const updatedPhrase = (u: string) => (/^\d/.test(u) ? `Updated ${u} ago` : `Updated ${u}`);
// minutes ago, to find the newest member: agoMinutes reads "17m" / "2h" / "3d" and not "just now"
const ageOf = (u: string) => (u === "just now" ? 0 : agoMinutes(u));

// The publisher's mark: a monogram dish on the identity system's 28px rung, neutral tint-1 — the dish the
// public artifact page wears, for the same reason. It was the forest disc with the brand wave, which inside
// the app is the agent's avatar; and this space hashes to moss in PersonAvatar's palette, one of the two
// identity rungs a reader cannot tell from forest, so a hashed hue would have put a green disc back in the
// seat it was taken out of. A space is the publisher (the hub is published from its boundary); no person is
// named, because the store records who owns the collection, not who pressed publish.
function PublisherDish({ name }: { name: string }) {
  return (
    <span
      aria-hidden="true"
      data-publisher=""
      className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-tint-1 font-sans text-xs font-medium leading-none text-foreground"
    >
      {initialsOf(name)}
    </span>
  );
}

// THE PUBLISHED MAP — the Map tab's own drawing (collectionGraph), cut to what the hub publishes. The Map tab
// draws every member, and a collection publishes a subset: Q4 Roadmap's map holds "Internal budget", which is
// not in the hub, and a document left out of a published page must not reach it by its title on a mark. So
// the hub draws the collection, its PUBLIC members, the people and topics those members touch, and the ties
// among them, and nothing a private member alone brings in. A proposed tie is left out too: it is the
// agent's suggestion awaiting someone's confirm, an internal state, and the public reads the confirmed record
// (the cover drops proposed links for the same reason). Every node and tie drawn here is one the Map tab draws.
function publishedGraph(slug: string, members: Artifact[]): Neighborhood {
  const nb = collectionGraph(slug);
  const pub = new Set(members.map((a) => a.id));
  // a tie survives when it is confirmed and touches a published member (the hub's spoke to it included); its
  // far end is then drawn
  const edges = nb.edges.filter((e) => e.prov !== "ai_generated" && (pub.has(e.from) || pub.has(e.to)));
  const reached = new Set<string>([nb.centerId, ...pub]);
  for (const e of edges) {
    reached.add(e.from);
    reached.add(e.to);
  }
  // a member that is not published never comes in by a tie to a published one (member ↔ member)
  const nodes = nb.nodes.filter((n) => reached.has(n.id) && (n.depth !== 1 || pub.has(n.id)));
  const ids = new Set(nodes.map((n) => n.id));
  return { centerId: nb.centerId, nodes, edges: edges.filter((e) => ids.has(e.from) && ids.has(e.to)) };
}

// The renderer's unit. LocalGraph states its amplitude (names 13, ties 1.5 / 2.5, marks no smaller than 8)
// in CSS px at 1.25px per unit, the explorer's and the Map tab's unit; it does not export it. The field is
// measured and its box is the column's width in those units, so the names land on 13px, the reading size
// beside the 15 / 13 rows beneath. A fixed box scales the whole drawing with the column: the Map tab's 780
// units in this 624px column would have set the names at 10px, and at 390 at 6.
const UNIT = 1.25;
// The narrowest box the drawing is laid out in, in units. The radial ring has a floor radius (EGO.RX_MIN)
// and the names seated beside its outer marks need about 300 units across whatever the column, so under a
// 390px column the box stops narrowing and the drawing scales down instead (names at 11.4px at 390, 10.4 at
// 360). Measured at 390: at the column's own 274 units "Notification strategy v3" ran 27px past the screen's
// right edge; at 312 the ink ends on the column's edge.
const MIN_W = 312;

// The hero: the map on the page plane. No card, no well, no ⓘ; the page's ground under the names' knockout
// (--graph-ground); the textless hover key in its top-left corner (graphKey); the box as tall as its drawing
// (no H). The same renderer and data the Map tab draws, through the explorer's EGO lens rather than the Map
// tab's force settle: the settle is sized for a whole collection, and with the two published documents it
// drew a 200px cloud hung in the left third of the column with the people and topics unnamed and the first
// title clipped to "Notification st...". The ego lens is the one the explorer draws a subject with: the
// collection at the centre, its documents on the first ring, the people and topics each one touches fanned
// beyond it, every name written out (fullLabels, namedDepth 2, beside its mark), the far ring in full ink
// because the reader is shown it, not offered it. A node opens what it can: a published member with a page
// of its own goes to that page; everything else is a mark to point at (no peek: EntityProfile's links go
// into the app).
function HubMap({ nb, pages }: { nb: Neighborhood; pages: Map<string, string> }) {
  const router = useRouter();
  const ref = React.useRef<HTMLDivElement>(null);
  const [box, setBox] = React.useState<GraphBox | null>(null);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    // rounded to 1/100: the layout is, and a box that differs in the 14th digit relays it for nothing
    const fit = (width: number) => {
      if (width > 0) setBox({ W: Math.max(MIN_W, Math.round((width / UNIT) * 100) / 100) });
    };
    // the first box is read here, before paint, so the drawing is on the first frame the page shows and
    // nothing under the field moves when it arrives; the observer carries every later width
    fit(el.clientWidth);
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => fit(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    // not overflow-hidden: a name seated at the field's edge may stand past it, as on the Map tab
    <div
      ref={ref}
      data-graph-field=""
      role="figure"
      aria-label="Map of this collection"
      className="relative mt-10"
      style={{ "--graph-ground": "var(--background)" } as React.CSSProperties}
    >
      {box ? (
        <LocalGraph
          data={nb}
          box={box}
          graphKey
          layout="radial"
          fullLabels
          namedDepth={2}
          outerRing="full"
          labelRule="beside"
          className="max-w-none"
          onSelect={(id) => {
            const href = pages.get(id);
            if (href) router.push(href);
          }}
        />
      ) : null}
    </div>
  );
}

// The rows: the Contents row's grammar, open on hairlines. The kind mark leads (the evolve pass: a row
// leads with its subject's NodeMark, the shape saying "document" and the hue its collection), the title at
// the row-title rung with the type trailing it, the age at the trailing edge, the gist beneath at text-sm.
// A row with a public page is that page's link; a member published in the hub without a page of its own
// (a collection can publish a document that is not itself public) reads here and goes nowhere, rather than
// to a page that would 404 or into the app. Only a linked title may truncate: it has its fuller form one
// click away. The gist always wraps, on every width.
function HubRow({ a, href }: { a: Artifact; href: string | null }) {
  const body = (
    <>
      <span className="flex h-(--text-base--line-height) shrink-0 items-center">
        <NodeMark node={{ id: a.id, kind: "artifact" }} className="size-3" pending={a.state === "processing"} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start gap-4">
          <span className="flex min-w-0 flex-1 items-center gap-x-1.5 gap-y-1 max-sm:flex-wrap">
            <span className={href ? "truncate text-base font-medium" : "text-base font-medium"}>{a.title}</span>
            {/* the wrapper makes TypeBadge its first child, so its own sibling margin never applies */}
            <span className="inline-flex shrink-0 items-center">
              <TypeBadge type={a.type} />
            </span>
          </span>
          <span className="flex h-(--text-base--line-height) shrink-0 items-center text-xs tabular-nums text-muted-foreground">
            {a.updated}
          </span>
        </span>
        {a.gist ? <span className="mt-0.5 block text-sm text-pretty text-muted-foreground">{a.gist}</span> : null}
      </span>
    </>
  );
  const row = "relative flex items-start gap-3 py-3";
  return href ? (
    <Link
      href={href}
      data-row=""
      className={`${row} outline-none transition-colors hover:bg-tint-1 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus`}
    >
      {body}
    </Link>
  ) : (
    <div data-row="" className={row}>
      {body}
    </div>
  );
}

export default function PublicHub() {
  const { slug } = useParams<{ slug: string }>();
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    void hydrateState().then(() => setReady(true));
  }, []);

  const meta = ready ? listCollections().find((c) => c.slug === slug) : undefined;
  const live = Boolean(meta && meta.public);
  const artifacts = React.useMemo(() => (live && meta ? collectionPublicMembers(meta.slug) : []), [live, meta]);
  const nb = React.useMemo(() => (live && meta ? publishedGraph(meta.slug, artifacts) : null), [live, meta, artifacts]);

  // neutral shell during SSR + first paint (before localStorage is applied) — avoids a hydration mismatch
  if (!ready) return <div className="min-h-svh bg-background" />;

  if (!meta || !meta.public) {
    // The not-published face. It led with the forest disc (the agent's seal, see PublisherDish) and sent the
    // reader on with a forest underlined link: forest is the colour of assent, and a link assents to nothing.
    // The brand wave in ink, one sentence, and the trailing action's one form.
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-3 bg-background px-6 text-center">
        <WovenMark className="h-4 w-auto text-foreground" />
        <p className="text-base font-medium">This collection isn’t published</p>
        <Link
          href="/"
          className="inline-flex items-center gap-1 rounded-sm text-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-focus"
        >
          Go to Woven <ArrowRight className="size-3.5" />
        </Link>
      </div>
    );
  }

  const space = spaceById(meta.space_id);
  const publisher = space ? spaceLabel(space.name) : null;

  // where each published member can be opened in public: its own page, if it has one
  const pages = new Map(artifacts.filter((a) => a.public).map((a) => [a.id, `/a/${a.hub_slug ?? a.id}`]));

  // The band: one fact per item, in reading order — how much it holds, whether it moves, when it last did,
  // and what else it is part of. Read off the PUBLISHED members, the ones this page shows:
  //   - "Living" when one of them is living (the collection moves as they do); left out when none is.
  //   - the newest member's age, the public artifact page's phrase; left out when there is none.
  //   - the other collections they are also woven into, counted (a number names nothing private, the public
  //     artifact page's rule); left out at zero.
  const newest = artifacts.reduce<Artifact | null>((m, a) => (!m || ageOf(a.updated) < ageOf(m.updated) ? a : m), null);
  const others = new Set(
    artifacts
      .flatMap((a) => a.collection_ids)
      .filter((id) => id !== meta.id)
      .map(collectionById)
      .filter((c): c is Collection => c !== undefined)
      .map((c) => c.id),
  ).size;
  const band = [
    `${artifacts.length} ${artifacts.length === 1 ? "artifact" : "artifacts"}`,
    artifacts.some((a) => a.state === "living") ? "Living" : null,
    newest ? updatedPhrase(newest.updated) : null,
    others ? `Woven into ${others} other ${others === 1 ? "collection" : "collections"}` : null,
  ].filter((x): x is string => Boolean(x));

  return (
    <div className="min-h-svh bg-background">
      <main className="mx-auto max-w-2xl px-6 pt-12 pb-24">
        {/* The eyebrow: the publisher's dish and the space it is published from, one step and so no
            separator glyph (PageBreadcrumb hides the trailing one). The public artifact page's eyebrow,
            whose trail goes one step further, to the collection this page is. */}
        {publisher ? (
          <div className="flex min-w-0 items-center gap-2">
            <PublisherDish name={publisher} />
            <PageBreadcrumb className="mb-0 min-w-0 flex-wrap" trail={[{ label: publisher, href: "/" }]} />
          </div>
        ) : null}
        <h1 className="mt-5 text-read-display font-medium">{meta.name}</h1>
        {meta.intro ? <p className="mt-4 text-read text-pretty text-foreground-prose">{meta.intro}</p> : null}

        {/* The metadata band, ruled above and below by the divider hairline and nothing else — no fill, no
            side rules, no radius: a seam in the column, not a box on it. Items are parted by space; a dot
            between them is the separator the product does not print. The public artifact page's band. */}
        <ul
          aria-label="About this collection"
          data-band="meta"
          className="mt-8 flex flex-wrap gap-x-6 gap-y-1 border-y py-3 text-sm text-muted-foreground"
        >
          {band.map((item) => (
            <li key={item} data-meta="" className="tabular-nums">
              {item}
            </li>
          ))}
        </ul>

        {nb ? <HubMap nb={nb} pages={pages} /> : null}

        {/* the published artifacts — open rows, a hairline between each and one closing the list; its top
            rule is the first row's own, so the list starts on a line under the map */}
        {artifacts.length ? (
          <div data-list="artifacts" className={`mt-10 border-y ${DIVIDED_FLUSH}`}>
            {artifacts.map((a) => (
              <HubRow key={a.id} a={a} href={pages.get(a.id) ?? null} />
            ))}
          </div>
        ) : null}

        {/* the one place the product names itself, kept to the foot and the quietest ink on the page */}
        <footer className="mt-16 flex flex-wrap items-center justify-between gap-2 border-t pt-6 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <WovenMark className="h-2.5 w-auto" /> Published with Woven
          </span>
          <span>Privacy-friendly, no cookies</span>
        </footer>
      </main>
    </div>
  );
}
