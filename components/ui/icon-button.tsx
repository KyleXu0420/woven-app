"use client";

import * as React from "react";
import { Button } from "./button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

type IconButtonProps = React.ComponentProps<typeof Button> & {
  // The action's name. It never disappears — it becomes the aria-label AND a hover tooltip.
  // Icon-only never means label-less; the word just moves to hover.
  label: string;
  side?: "top" | "bottom" | "left" | "right";
};

// The one icon-only button. A circular ghost pill (size-8 default; icon-lg for prominent
// reading-surface controls, icon-sm for dense rows). The label is REQUIRED and is surfaced
// as both aria-label and a tooltip, so an icon button can never ship without an accessible name.
export function IconButton({
  label,
  side = "bottom",
  size = "icon",
  variant = "ghost",
  children,
  ...props
}: IconButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button size={size} variant={variant} aria-label={label} {...props}>
            {children}
          </Button>
        }
      />
      <TooltipContent side={side}>{label}</TooltipContent>
    </Tooltip>
  );
}
