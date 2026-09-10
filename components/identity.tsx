// The identity system (P-1 / P-10). Two first-class kinds of actor:
//   • a PERSON  → a circle, a Geist monogram (sans) tinted by a deterministic per-identity
//                 hue (lib/identity → globals --chart-1..12), or a photo when present.
//   • the AGENT → a circle on a forest dish bearing the forest loom mark (never a letter).
// All avatars are circles; the DISH + GLYPH carry the human/non-human distinction (agent =
// forest dish + WovenMark), not the corner radius. (Reversed 2026-06-30 from an agent squircle.)

import * as React from "react";
import { ArrowUpRight } from "lucide-react";
import { initialsOf, personTintVar } from "@/lib/identity";
import { AgentMark } from "./agent-mark";

// Three rungs, and each one earns its place: xs leads inline text, sm leads a two-line list row,
// md leads a block header. A 32px and a 40px rung also existed — 40 was never called once, and 32
// was called once, by a header whose text block is the same pair the 28px rows already carry. md
// is pinned to 28 by ui/toast and timeline-view, which render an avatar and a hardcoded size-7
// circle as two branches of one conditional, so the merge goes toward 28, not away from it.
type Size = "xs" | "sm" | "md";

const BOX: Record<Size, string> = {
  xs: "size-5",
  sm: "size-6",
  md: "size-7",
};
// Monogram size ~0.42–0.45 of the circle so two capitals sit with breathing room, not
// flush to the ring. Small sizes were 0.50–0.55 (crowded); collapsed toward that band.
// xs holds a hair larger since 20px needs the legibility.
//
// The two sub-12px values below are DELIBERATE and exempt from the type ladder: a monogram is a
// MARK sized against a shape, the way an icon is — not text sized against the reading scale.
// Folding them onto text-xs would put xs at 0.60 of its circle and re-crowd exactly what the
// ratio above was set to fix. All real text in the product is on the ladder; these are not text.
const TXT: Record<Size, string> = {
  xs: "text-[10px]",
  sm: "text-[10px]",
  md: "text-xs",
};
const BOX_PX: Record<Size, number> = { xs: 20, sm: 24, md: 28 };
// the anonymous reader's arrow — a glyph sized against its circle, the way an icon is
const GLYPH: Record<Size, string> = { xs: "size-3", sm: "size-3.5", md: "size-4" };

export function PersonAvatar({
  seed,
  name,
  initials,
  src,
  size = "md",
  className = "",
  title,
}: {
  seed: string;
  name: string;
  initials?: string; // explicit monogram when the display name isn't a clean person name
  src?: string;
  size?: Size;
  className?: string;
  title?: string;
}) {
  const tint = personTintVar(seed);
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={src}
        alt={name}
        title={title ?? name}
        className={`${BOX[size]} shrink-0 rounded-full object-cover ring-1 ring-border ${className}`}
      />
    );
  }
  return (
    <span
      title={title ?? name}
      aria-label={name}
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-sans font-medium leading-none ${BOX[size]} ${TXT[size]} ${className}`}
      // No ring. The fill already separates the disc from its ground; the old inset ring sat far
      // below its own fill, so the edge was several times stronger than the separation it was there
      // to help with, and the avatar read as an outlined object rather than a tinted one.
      //
      // The fill is OPAQUE. An alpha fill looks equivalent on a flat row and is not: these discs
      // overlap by 6px inside IdentityGroup, and a translucent one lets the avatar behind it show
      // through at the seam. Mixed against --card, so the disc is a solid colour wherever it lands.
      style={{
        backgroundColor: `color-mix(in srgb, ${tint} 20%, var(--card))`,
        color: `color-mix(in srgb, ${tint} 36%, var(--foreground))`,
      }}
    >
      {initials ?? initialsOf(name)}
    </span>
  );
}

export function AgentAvatar({
  size = "md",
  className = "",
  title = "Woven agent",
  state = "idle",
}: {
  size?: Size;
  className?: string;
  title?: string;
  // "thinking" livens the wave — pass it when the agent is actually working (capture, Ask, gathering)
  state?: "idle" | "thinking";
}) {
  // The seal IS the dish: the forest disc with the wave cut out fills the avatar box, the way a person's tinted
  // disc fills it. No second circle, no ring, no tint behind it (2026-09-05).
  return (
    <span title={title} aria-label={title} className={`inline-flex shrink-0 items-center justify-center ${BOX[size]} ${className}`}>
      <AgentMark state={state} size={BOX_PX[size]} className="size-full text-primary" />
    </span>
  );
}

// An anonymous / external reader — a quiet muted circle with an outward arrow. Not a
// person we can name, so no hue and no monogram: deliberately the calmest avatar.
export function AnonAvatar({
  size = "md",
  className = "",
  title = "External reader",
}: {
  size?: Size;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      aria-label={title}
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-tint-1 text-muted-foreground ${BOX[size]} ${className}`}
    >
      <ArrowUpRight className={GLYPH[size]} />
    </span>
  );
}

// Overlapping stack for readers / contributors. No separator ring: the discs are opaque and
// each carries its own hue, so the front one simply covers the back one and the stack reads
// without an outline drawn around every member. <span>+inline-flex rather than <div>,
// because the stacks that need it sit inside phrasing content (artifact-ui's PeopleStack).
// The tail of a stack: "and N more people". A FOLD — "+N" standing in for objects not drawn — is the
// one number that takes a ground, because it sits in a row of grounded objects: the tint-1 rung, no
// border, muted ink at 500, at the size of the initials it stands among. That is the same statement the
// collection fold on a document row makes, so the two "+N"s are one object (settled 2026-09-10). It was
// an OUTLINED card-white disc — a ring on a disc brighter than the paper it sat on, which read as an
// empty slot or an add button, and near-invisible on charcoal.
//
// The fill is OPAQUE: tint-1 itself is an alpha, and at a 6px overlap a translucent disc lets the face
// behind it show through at the seam — so it is the tint-1 rung mixed over the PAGE ground (the stacks
// live on rows; mixed over --card it measured 1.05:1 on a row and vanished), and it resolves per theme
// instead of being a hand-written alpha. On a card it lands one hair darker than tint-1 would; fine.
export function OverflowAvatar({ count, size = "xs" }: { count: number; size?: Size }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-sans font-medium tabular-nums text-muted-foreground leading-none ${BOX[size]} ${TXT[size]}`}
      style={{ backgroundColor: "color-mix(in oklab, var(--foreground) 6%, var(--background))" }}
    >
      +{count}
    </span>
  );
}

export function IdentityGroup({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={`inline-flex -space-x-1.5 ${className}`}>
      {children}
    </span>
  );
}
