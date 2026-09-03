"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

// Page title with an info affordance — the descriptive blurb lives in a tooltip so the page stays
// clean, but the "what is this" is one hover away.
export function PageHeading({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex items-center gap-2">
      <h1 className="text-2xl font-medium tracking-[-0.01em]">{title}</h1>
      <Tooltip>
        <TooltipTrigger
          render={<button type="button" aria-label={`About ${title}`} />}
          className="flex size-6 items-center justify-center rounded-full text-muted-foreground/50 transition-colors hover:bg-foreground/[0.06] hover:text-muted-foreground"
        >
          <Info className="size-4" />
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-xs text-left leading-relaxed">
          {hint}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

// The one detail-page breadcrumb. A DETAIL page is reached from somewhere, and that somewhere is
// worth one line and one click — the sidebar shows the section but not the parent record.
//
// INDEX pages do not take one: their parent is the app, the sidebar already highlights them, and a
// crumb there was the third statement of the same fact (which is why the topbar's went away).
//
// The title above it is one size on every page. Hierarchy is this line's job, not the h1's — which
// is what lets the h1 stay quiet enough to let the content lead.
export function PageBreadcrumb({
  trail,
  current,
  className = "",
}: {
  className?: string;
  trail: { label: string; href: string }[];
  // Omit to render the trail alone. On a detail page the H1 directly below already names the
  // leaf; repeating it in the crumb is the page naming itself twice within 40px.
  current?: string;
}) {
  return (
    <nav aria-label="Breadcrumb" className={cn("mb-5 flex items-center gap-1.5 text-xs text-muted-foreground", className)}>
      {trail.map((t) => (
        <span key={t.href} className="flex items-center gap-1.5 [&:last-child>span]:hidden">
          <Link
            href={t.href}
            className="rounded-sm outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {t.label}
          </Link>
          <span className="opacity-50" aria-hidden="true">/</span>
        </span>
      ))}
      {current ? <span className="truncate text-foreground">{current}</span> : null}
    </nav>
  );
}
