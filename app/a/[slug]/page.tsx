import { notFound } from "next/navigation";
import { artifactByHubSlug, collectionById, getBlocks, listArtifacts, spaceById } from "@/lib/api";
import { initialsOf } from "@/lib/identity";
import type { Collection } from "@/lib/types";
import { PageBreadcrumb } from "@/components/page-heading";
import { WovenMark } from "@/components/woven-mark";

// The PUBLIC face of a single artifact — no app chrome (this route lives outside the (app) group, so it
// uses the root layout). The read-only microsite a published/shared artifact link resolves to.
//
// It is set in the Are.na register (the reference lock for the public pages): the connection is the
// content, so where the document lives and what it is woven into are stated as facts above the text, on
// hairlines, in one face, with nothing boxed. What it replaced, and why each went:
//   - a header of back arrow + forest disc + space name + "published with Woven". The forest disc held
//     the brand wave and read as the AGENT's seal — inside the app that mark means "the agent did this",
//     and the agent did not publish this page. The back arrow pointed into the app; the space step of
//     the breadcrumb now goes to the same place. "Published with Woven" was said twice, top and foot.
//   - an eyebrow of "HTML, living" — two facts run together with a comma, and nothing about where the
//     document lives or what it is part of. They are separate items in the band now, beside the two
//     facts the page never stated: when it changed and how many collections it is woven into.
// Every value below is read from the store; an item with nothing true to say is left out, never filled.

export function generateStaticParams() {
  return listArtifacts()
    .filter((a) => a.public)
    .map((a) => ({ slug: a.hub_slug ?? a.id }));
}

const STATE_WORD = { living: "Living", processing: "Processing", archived: "Archived" } as const;

// The seed names the space as org, middle dot, team. The dot is a separator the product does not print
// (the sidebar and /team already show this space as "Acme Product"), so the page joins the two with a space.
const spaceLabel = (name: string) => name.replace(/\s*\u00b7\s*/g, " ");

// `updated` is the prototype's relative label: "17m", "2d" read as an age, "just now" already is a phrase.
const updatedPhrase = (u: string) => (/^\d/.test(u) ? `Updated ${u} ago` : `Updated ${u}`);

// The publisher's mark: a monogram dish, the identity system's 28px rung (size-7, 12px glyph — the 0.43
// ratio identity.tsx holds). Neutral tint-1, the avatar dish's rung, and deliberately NOT PersonAvatar's
// hashed hue: this space hashes to moss, one of the two identity rungs a reader cannot tell from forest,
// and a green disc in this seat is exactly the misreading being removed. The sidebar's space marks are
// neutral for the same reason. A space is the publisher (the page is published from its boundary); no
// person is named, because the store does not record who pressed publish.
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

export default async function ArtifactHub({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const artifact = artifactByHubSlug(slug);
  if (!artifact) notFound();
  const blocks = getBlocks(artifact.id);
  const space = spaceById(artifact.space_id);
  const publisher = space ? spaceLabel(space.name) : null;

  // The collection step names only a collection that is itself published WITH this document among its
  // public members, so the link resolves to a hub that lists it. A private collection's name never reaches
  // a public page; with none to show, the trail is the space alone.
  const collections = artifact.collection_ids.map(collectionById).filter((c): c is Collection => c !== undefined);
  const home = collections.find((c) => c.public && c.public_member_ids.includes(artifact.id));
  const trail = [
    ...(publisher ? [{ label: publisher, href: "/" }] : []),
    ...(home ? [{ label: home.name, href: `/c/${home.slug}` }] : []),
  ];

  // The band: one fact per item, in reading order — what it is, whether it moves, when it last did, and
  // what it is part of. Counts every collection (a number names nothing private); omitted at zero.
  const woven = collections.length;
  const band = [
    artifact.type,
    STATE_WORD[artifact.state],
    updatedPhrase(artifact.updated),
    woven ? `Woven into ${woven} ${woven === 1 ? "collection" : "collections"}` : null,
  ].filter((x): x is string => Boolean(x));

  return (
    <div className="min-h-svh bg-background">
      <main className="mx-auto max-w-2xl px-6 pt-12 pb-24">
        {/* The title is a breadcrumb: the earlier steps in muted ink, links, the document's own name the h1
            beneath them (the explorer's eyebrow → h1, the house PageBreadcrumb). The publisher's dish leads
            the first step, so who published it and where it lives are one statement, not two. */}
        {trail.length ? (
          <div className="flex min-w-0 items-center gap-2">
            {publisher ? <PublisherDish name={publisher} /> : null}
            <PageBreadcrumb className="mb-0 min-w-0 flex-wrap" trail={trail} />
          </div>
        ) : null}
        <h1 className="mt-5 text-read-display font-medium">{artifact.title}</h1>
        {artifact.gist ? <p className="mt-4 text-read text-foreground-prose">{artifact.gist}</p> : null}

        {/* The metadata band, ruled above and below by the divider hairline and nothing else — no fill, no
            side rules, no radius, so it is a seam in the column rather than a box on it. Items are parted by
            space; a dot between them is the separator the product does not print. Its lower rule is the
            line the article used to draw for itself, so the page still has one seam before the text. */}
        <ul
          aria-label="About this document"
          data-band="meta"
          className="mt-8 flex flex-wrap gap-x-6 gap-y-1 border-y py-3 text-sm text-muted-foreground"
        >
          {band.map((item) => (
            <li key={item} data-meta="" className="tabular-nums">
              {item}
            </li>
          ))}
        </ul>

        <article className="mt-10 flex flex-col gap-8">
          {blocks.map((b) => (
            <section key={b.id}>
              <h2 className="text-read-heading font-medium">{b.heading}</h2>
              <p className="mt-2 whitespace-pre-wrap text-read text-foreground-prose">{b.text}</p>
            </section>
          ))}
        </article>

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
