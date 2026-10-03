import type { Artifact } from "@/lib/types";
import { NeighbourhoodCover } from "@/components/neighbourhood-cover";

// An artifact's cover, shared by Home's Continue hero and the Library grid card, so the two read as the same
// object in two densities. The API is the one those pages were written against; what it draws changed twice.
// It drew a blurred two-hue gradient with the title in white over black, which encoded nothing; then the
// document's confirmed links as a hub and spokes, which Kyle called ugly. It now sets the document's own contents
// page, its links after its headings and at its foot (components/neighbourhood-cover.tsx says what, why, and
// its limits).

// A deterministic number per artifact. The contents page needs none (the same document sets the same page by
// construction), so the cover no longer reads it; it stays exported, unchanged, as part of this module's API.
export function coverSeed(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

export function CoverArt({
  a,
  label = true,
  excerpt,
  large = false,
}: {
  a: Artifact;
  // label — the cover names its document. The name used to sit ON the art, white over a black wash, which in
  // dark fell below contrast. It now never touches the page: it is a caption on the ground under it. A caller
  // whose own text column already names the doc (Home's hero, the Library card) passes false.
  label?: boolean;
  excerpt?: string; // the words for a doc with no sections; its own opening line by default
  large?: boolean; // the Continue hero: the cover's foot is set on that card's footer rule
}) {
  // The name is handed to the cover rather than set here, so the caption and the page share one box and the
  // page's foot lands above the caption, not under it (neighbourhood-cover.tsx).
  return <NeighbourhoodCover a={a} large={large} excerpt={excerpt} title={label ? a.title : undefined} />;
}
