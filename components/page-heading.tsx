"use client";

import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

// Page title with an info affordance — the descriptive blurb lives in a tooltip so the page stays
// clean, but the "what is this" is one hover away.
export function PageHeading({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex items-center gap-2">
      <h1 className="text-3xl font-medium tracking-[-0.01em]">{title}</h1>
      <Tooltip>
        <TooltipTrigger
          render={<button type="button" aria-label={`About ${title}`} />}
          className="flex size-6 items-center justify-center rounded-full text-muted-foreground/50 transition-colors hover:bg-foreground/[0.06] hover:text-muted-foreground"
        >
          <Info className="size-[18px]" />
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-xs text-left leading-relaxed">
          {hint}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
