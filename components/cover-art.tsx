import type { Artifact } from "@/lib/types";
import { NeighbourhoodCover } from "@/components/neighbourhood-cover";

// An artifact's cover, shared by Home's Continue hero and the Library grid card, so the two read as the same
// object in two placements. The API is the one those pages were written against; what it draws changed four
// times. It drew a blurred two-hue gradient with the title in white over black, which encoded nothing; then the
// document's confirmed links as a hub and spokes, which Kyle called ugly; then the document's contents page. It
// now draws a swatch of the document's own cloth, the Library band Kyle approved, mounted on a mat on the hero
// (components/neighbourhood-cover.tsx says what, why, and its limits).

// A deterministic number per artifact. The cloth needs none (the same document weaves the same cloth by
// construction), so the cover does not read it; it stays exported, unchanged, as part of this module's API.
export function coverSeed(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

export function CoverArt({
  a,
  label = true,
  large = false,
}: {
  a: Artifact;
  // label — the cover names its document. The name used to sit ON the art, white over a black wash, which in
  // dark fell below contrast. It now never touches the cloth: it is a caption on the ground under it. A caller
  // whose own text column already names the doc (Home's hero, the Library card) passes false.
  label?: boolean;
  // Words for a doc with no sections, kept so the callers written against it still compile. The cloth sets no
  // words, so nothing reads it; no caller passes one.
  excerpt?: string;
  large?: boolean; // the Continue hero: the swatch on a mat from sm, the band across the card on a phone
}) {
  // The name is handed to the cover rather than set here, so the caption and the cloth share one box and the
  // cloth ends above the caption, not under it (neighbourhood-cover.tsx).
  return <NeighbourhoodCover a={a} large={large} title={label ? a.title : undefined} />;
}
