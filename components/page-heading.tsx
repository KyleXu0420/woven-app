"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

// The page title, and nothing beside it. It carried an ⓘ whose tooltip held a sentence about the page ("Your
// agent's console — approve what it proposes…"): the explorer pages dropped both on 2026-09-14 (no ⓘ, no hint
// sentence — a page that needs its purpose explained in a tooltip has a title or a first row that is not doing
// its job), and Library and Inbox were the two pages still wearing them — two header families where there
// should be one. `hint` is still accepted so the callers (line A's Library and Inbox) compile unchanged; it is
// not rendered anywhere, not even for a screen reader, because the sentence is gone, not hidden.
export function PageHeading({ title }: { title: string; hint?: string }) {
  return <h1 className="text-2xl font-medium">{title}</h1>;
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
            className="rounded-sm outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-focus"
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
