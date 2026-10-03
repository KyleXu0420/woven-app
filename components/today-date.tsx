"use client";

import * as React from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { FOCUS_RING } from "@/components/classes";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

// The day anchor. The page is called Today but carried no day at all — this is the orienting first fact.
// Client-side on purpose: /today is statically prerendered, so a server-rendered date would freeze at build
// time and quietly go stale. suppressHydrationWarning covers the one-tick build-date → real-date correction.
//
// The status after the date is parted by a vertical hairline, the one FeedHead parts a state phrase with. It
// was " — ", the last em-dash separator on Home. A comma was the other house separator, and it set "October 2,
// 1 run going": two figures on one comma, which reads as a list of numbers. The hairline is welded to the
// status's first word, so a line can break before the hairline or inside the status, never right after the
// hairline. A screen reader, which does not see the hairline, hears a comma.
export function TodayDate({ after }: { after?: string }) {
  const gap = after ? after.indexOf(" ") : -1;
  const first = after && gap > 0 ? after.slice(0, gap) : after;
  const rest = after && gap > 0 ? after.slice(gap) : "";
  return (
    <>
      <span suppressHydrationWarning className="font-medium text-foreground">
        {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
      </span>
      {after ? (
        <span className="text-muted-foreground">
          <span className="sr-only">, </span>
          <span className="whitespace-nowrap">
            <span aria-hidden="true" className="mx-2 inline-block h-3 w-px bg-border align-[-1px]" />
            {first}
          </span>
          {rest}
        </span>
      ) : null}
    </>
  );
}

// Section's count with a sentence one hover away: the client half of Section (components/today-ui.tsx), which
// renders on the server for /today and /home and so cannot hold the open state. NeedsYou built this for the
// sort rule (fork 4, Kyle 2026-10-02: the rule used to print under the header at rest, and every judge read it
// as the UI explaining itself) and wrote out Section's whole header to reach the count. Section takes the hint
// now (countHint) and renders this, so there is one header markup again. It is the house tooltip (ink fill,
// 12px, no arrow), open on hover and on keyboard focus; a phone has no hover, so a tap toggles it, and a tap
// outside or Escape closes it (the tooltip's own dismiss). The count keeps the class Section gives every count
// (full ink at 500, a demand); the trigger adds no fill and no underline, so at rest the header reads as any
// other Section's.
export function SectionCount({ count, hint, className }: { count: number; hint: string; className: string }) {
  const [open, setOpen] = React.useState(false);
  const pointer = React.useRef("");
  const phone = useIsMobile();
  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger
        render={<span />}
        tabIndex={0}
        closeOnClick={false}
        aria-label={`${count}. ${hint}`}
        onPointerDown={(e) => (pointer.current = e.pointerType)}
        onClick={() => {
          if (pointer.current === "touch") setOpen((o) => !o);
        }}
        // The box hugs the digits, where Section puts its count, so the focus ring draws round "13" and not round
        // a padded slab touching the label. The target is bigger than the glyphs by an empty ::after (12px above
        // and below, 6px each side) that takes the pointer and moves nothing.
        className={cn(className, "relative cursor-default rounded-sm after:absolute after:-inset-x-1.5 after:-inset-y-3", FOCUS_RING)}
      >
        {count}
      </TooltipTrigger>
      {/* Beside the count on a wide screen: the header line is empty from the count to the section's action, so
          the label covers nothing, and at max-w-sm a sentence sets in two lines. Under it on a phone, where there
          is no room beside, hung from the digits. */}
      <TooltipContent side={phone ? "bottom" : "right"} align={phone ? "start" : "center"} className="text-left md:max-w-sm">
        {hint}
      </TooltipContent>
    </Tooltip>
  );
}
