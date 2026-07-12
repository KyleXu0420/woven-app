import Link from "next/link";
import { cn } from "@/lib/utils";

// Today's shared grammar — the whole page is one system, not a stack of bespoke cards. A Section is a quiet
// zone (a sentence-case sub-label header + trailing action, over flat content); a Row is the one row model
// reused everywhere (marker · body · trailing, on one left edge, subtle hover, parted by an inset hairline).
// Cohesion comes from these + one accent + whitespace, never from per-widget chrome.

export function Section({
  label,
  count,
  action,
  className,
  children,
}: {
  label: string;
  count?: number;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("mt-7", className)}>
      <div className="mb-2 flex items-baseline justify-between gap-2 px-0.5">
        <span className="text-[14px] font-semibold tracking-[-0.01em] text-foreground">
          {label}
          {count != null ? (
            <span className="ml-1.5 font-mono text-[11px] font-medium text-primary">{count}</span>
          ) : null}
        </span>
        {action ?? null}
      </div>
      {children}
    </section>
  );
}

// place Rows inside this so they part with an inset hairline (Row uses first:border-t-0)
export function RowList({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex flex-col", className)}>{children}</div>;
}

export function Row({
  href,
  onClick,
  marker,
  trailing,
  children,
}: {
  href?: string;
  onClick?: () => void;
  marker?: React.ReactNode;
  trailing?: React.ReactNode;
  children: React.ReactNode;
}) {
  const cls =
    "group/row -mx-2 flex items-center gap-3 rounded-lg border-t border-border/60 px-2 py-2 text-left transition-colors first:border-t-0 hover:bg-foreground/[0.035]";
  const inner = (
    <>
      {marker != null ? <span className="flex w-5 shrink-0 items-center justify-center">{marker}</span> : null}
      <span className="min-w-0 flex-1">{children}</span>
      {trailing != null ? <span className="flex shrink-0 items-center gap-2">{trailing}</span> : null}
    </>
  );
  if (href)
    return (
      <Link href={href} className={cls}>
        {inner}
      </Link>
    );
  if (onClick)
    return (
      <button type="button" onClick={onClick} className={cn(cls, "w-full")}>
        {inner}
      </button>
    );
  return <div className={cls}>{inner}</div>;
}

// a Section header's trailing "→" link (All in Library · Open Inbox); accent = the one forest moment
export function SectionAction({
  href,
  accent,
  children,
}: {
  href: string;
  accent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-1 text-[12px] transition-opacity hover:opacity-80",
        accent ? "font-medium text-primary" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}
