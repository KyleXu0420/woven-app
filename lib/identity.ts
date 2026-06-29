// Deterministic identity → categorical tint + initials.
// The hue palette mirrors globals.css --chart-1..12 (the categorical identity palette);
// a stable hash maps any entity id/name to one of the 12 tints so a given person or
// topic always wears the same colour everywhere. React-free (lib stays pure).

export const TINT_COUNT = 12;

// FNV-1a + a MurmurHash3 fmix32 finalizer. FNV alone clusters short, common-prefix ids
// ("pe_dan", "pe_sara", …) in its low bits — exactly the bits `% TINT_COUNT` reads — so the
// finalizer avalanches the result. Stable, unsigned 32-bit.
function hashId(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

// Curated hues for the known cast, so every person/topic on screen is distinct and
// deliberately chosen — 6 people in 12 tints would otherwise collide by the birthday bound.
// Any id NOT listed falls back to the hash, which spreads evenly at scale.
const TINT_OVERRIDE: Record<string, number> = {
  pe_maya: 4, pe_dan: 8, pe_jordan: 10, pe_priya: 3, pe_lee: 12, pe_sara: 6,
  to_activation: 1, to_notifications: 2, to_launch: 5, to_pricing: 9, to_onboarding: 11,
};

// 1-based tint index (1..12), stable per seed.
export function tintIndex(seed: string): number {
  return TINT_OVERRIDE[seed] ?? ((hashId(seed) % TINT_COUNT) + 1);
}

// The CSS custom-property for a seed's tint, e.g. "var(--chart-7)".
export function tintVar(seed: string): string {
  return `var(--chart-${tintIndex(seed)})`;
}

// 1–2 letter monogram from a display name. "Maya Chen" → "MC", "Jordan" → "J".
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
