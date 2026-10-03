import type { Artifact } from "@/lib/types";
import { NeighbourhoodCover } from "@/components/neighbourhood-cover";

// An artifact's cover — shared by Home's Continue hero, Today's hero and the Library grid card, so the three
// read as the same object in two densities. The API is the one those pages were written against; what it draws
// changed. It drew a generated two-hue gradient with the title in white over a black overlay — the product's
// one gradient, its one #000, and the only object in 26 frames that encoded nothing. It now draws the
// document's own confirmed links (components/neighbourhood-cover.tsx), or its first paragraph when it has none.

// deterministic per-artifact seed — still the cover's: it turns the neighbourhood's ring, so a document's
// drawing is the same on every render and on every page, and two docs with the same links do not stack alike
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
  // dark fell below contrast. It now never touches the drawing: it is a caption on the ground under it. A
  // caller whose own text column already names the doc (Home's hero, the Library card) passes false.
  label?: boolean;
  excerpt?: string; // the words for a doc with nothing to draw; its first paragraph by default
  large?: boolean; // the hero cover — bigger marks, more air
}) {
  // The name is handed to the cover rather than set here: the drawing's bottom air depends on whether a
  // caption follows it, so the two are laid out together (neighbourhood-cover.tsx).
  return (
    <NeighbourhoodCover
      a={a}
      seed={coverSeed(a.id)}
      large={large}
      excerpt={excerpt}
      title={label ? a.title : undefined}
    />
  );
}
