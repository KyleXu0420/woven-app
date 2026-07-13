// The identity system (P-1 / P-10). Two first-class kinds of actor:
//   • a PERSON  → a circle, a Geist monogram (sans) tinted by a deterministic per-identity
//                 hue (lib/identity → globals --chart-1..12), or a photo when present.
//   • the AGENT → a circle on a forest dish bearing the forest loom mark (never a letter).
// All avatars are circles; the DISH + GLYPH carry the human/non-human distinction (agent =
// forest dish + WovenMark), not the corner radius. (Reversed 2026-06-30 from an agent squircle.)

import * as React from "react";
import { ArrowUpRight } from "lucide-react";
import { initialsOf, tintVar } from "@/lib/identity";
import { AgentMark } from "./agent-mark";

type Size = "xs" | "sm" | "md" | "default" | "lg";

const BOX: Record<Size, string> = {
  xs: "size-5",
  sm: "size-6",
  md: "size-7",
  default: "size-8",
  lg: "size-10",
};
const TXT: Record<Size, string> = {
  xs: "text-[11px]",
  sm: "text-[12px]",
  md: "text-[14px]",
  default: "text-[14px]",
  lg: "text-[15px]",
};
const MARK: Record<Size, string> = {
  xs: "size-3",
  sm: "size-3.5",
  md: "size-4",
  default: "size-4",
  lg: "size-5",
};

export function PersonAvatar({
  seed,
  name,
  initials,
  src,
  size = "default",
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
  const tint = tintVar(seed);
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
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-sans font-semibold leading-none ${BOX[size]} ${TXT[size]} ${className}`}
      style={{
        backgroundColor: `color-mix(in srgb, ${tint} 18%, var(--card))`,
        color: `color-mix(in srgb, ${tint} 70%, var(--foreground))`,
        boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${tint} 30%, transparent)`,
      }}
    >
      {initials ?? initialsOf(name)}
    </span>
  );
}

export function AgentAvatar({
  size = "default",
  className = "",
  title = "Woven · agent",
  state = "idle",
}: {
  size?: Size;
  className?: string;
  title?: string;
  // "thinking" livens the weave — pass it when the agent is actually working (capture, Ask, gathering)
  state?: "idle" | "thinking";
}) {
  return (
    <span
      title={title}
      aria-label={title}
      className={`inline-flex shrink-0 items-center justify-center rounded-full ${BOX[size]} ${className}`}
      style={{
        backgroundColor: "color-mix(in srgb, var(--primary) 18%, var(--card))",
        boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--primary) 38%, transparent)",
      }}
    >
      <AgentMark
        state={state}
        className={MARK[size]}
        style={{ color: "color-mix(in srgb, var(--primary) 72%, var(--foreground))" }}
      />
    </span>
  );
}

// An anonymous / external reader — a quiet muted circle with an outward arrow. Not a
// person we can name, so no hue and no monogram: deliberately the calmest avatar.
export function AnonAvatar({
  size = "default",
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
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground ${BOX[size]} ${className}`}
    >
      <ArrowUpRight className={MARK[size]} />
    </span>
  );
}

// Convenience dispatcher when the kind is data-driven.
export function Identity({
  kind,
  seed,
  name,
  src,
  size = "default",
  className,
}: {
  kind: "person" | "agent";
  seed?: string;
  name?: string;
  src?: string;
  size?: Size;
  className?: string;
}) {
  if (kind === "agent") return <AgentAvatar size={size} className={className} />;
  return (
    <PersonAvatar
      seed={seed ?? name ?? "?"}
      name={name ?? "?"}
      src={src}
      size={size}
      className={className}
    />
  );
}

// Overlapping stack for readers / contributors. Each child gets a card-coloured ring
// so the avatars separate cleanly when they overlap.
export function IdentityGroup({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex -space-x-1.5 [&>*]:ring-2 [&>*]:ring-card ${className}`}>
      {children}
    </div>
  );
}
