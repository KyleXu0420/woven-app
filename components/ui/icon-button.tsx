"use client";

import * as React from "react";
import { Button } from "./button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

type IconButtonProps = React.ComponentProps<typeof Button> & {
  // The action's name. It never disappears — it becomes the aria-label AND a hover tooltip.
  // Icon-only never means label-less; the word just moves to hover.
  label: string;
  side?: "top" | "bottom" | "left" | "right";
  // where the label sits along that side; "end" keeps a label inside the edge its button sits on
  align?: "start" | "center" | "end";
  // The key that also fires it, shown after the name in the tooltip ("Capture  N"). A shortcut the
  // tooltip does not print is a shortcut nobody learns; a tooltip that prints one that does not exist
  // is a lie, so pass it only from the surface that binds the key.
  shortcut?: string;
};

// The one icon-only button. A circular ghost pill (size-8 default; icon-lg for prominent
// reading-surface controls, icon-sm for dense rows). The label is REQUIRED and is surfaced
// as both aria-label and a tooltip, so an icon button can never ship without an accessible name.
export function IconButton({
  label,
  side = "bottom",
  align = "center",
  shortcut,
  size = "icon",
  variant = "ghost",
  children,
  ...props
}: IconButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button size={size} variant={variant} aria-label={label} aria-keyshortcuts={shortcut} {...props}>
            {children}
          </Button>
        }
      />
      <TooltipContent side={side} align={align}>
        {label}
        {/* A keycap, not a fourth word. Set in the label's own ink with one space between them, "New
            artifact N" read as a three-word phrase. The key sits in the surface's secondary ink
            (muted-on-ink: the tooltip is filled with the foreground, so its muted rung is the inverted
            theme's ink-2, 6.79:1 light / 5.92 dark) on a chip of the inverted tint (tint-on-ink), the
            MARK radius, parted from the label by the tooltip's gap. A chip, not an outline: a hairline
            box inside a filled pill drew a frame within a frame, and on paper a kbd is a tint chip. */}
        {shortcut ? (
          <kbd
            data-slot="kbd"
            className="inline-flex h-4 min-w-4 items-center justify-center rounded-sm bg-tint-on-ink px-1 font-sans text-muted-on-ink"
          >
            {shortcut}
          </kbd>
        ) : null}
      </TooltipContent>
    </Tooltip>
  );
}
