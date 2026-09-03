import Link from "next/link";
import { cn } from "@/lib/utils";
import { DIVIDED } from "./controls";

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
    <section className={cn("mt-8", className)}>
      <div className="mb-2.5 flex items-baseline justify-between gap-2 px-0.5">
        <span className="text-base font-medium tracking-[-0.01em] text-foreground">
          {label}
          {/* a count is generic metadata, not the agent's voice — Inter tabular-nums, never mono */}
          {count != null ? (
            <span className="ml-1.5 text-sm font-medium tabular-nums text-muted-foreground">{count}</span>
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
  return <div className={cn("flex flex-col", DIVIDED, className)}>{children}</div>;
}

export function Row({
  href,
  onClick,
  marker,
  trailing,
  active = false,
  interactiveTrailing = false,
  children,
}: {
  href?: string;
  onClick?: () => void;
  marker?: React.ReactNode;
  trailing?: React.ReactNode;
  active?: boolean; // keyboard/cursor selection highlight (search); default off keeps Today/Inbox on hover-only
  interactiveTrailing?: boolean; // trailing holds its own buttons (a ✓/✕ Valve) → non-button container
  children: React.ReactNode;
}) {
  const cls = cn(
    "group/row -mx-2 flex items-center gap-3 rounded-md px-2 py-2.5 text-left transition-colors",
    active ? "bg-foreground/[0.05]" : "hover:bg-foreground/[0.035]",
  );
  const markerEl =
    marker != null ? <span className="flex w-6 shrink-0 items-center justify-center">{marker}</span> : null;
  const bodyEl = <span className="min-w-0 flex-1">{children}</span>;
  const trailingEl = trailing != null ? <span className="flex shrink-0 items-center gap-2">{trailing}</span> : null;

  // interactive trailing (a ✓/✕ Valve = two <button>s) can't nest inside a <button>/<Link>; render a plain
  // div whose BODY span carries the click/keyboard target, with the trailing as a sibling (never a descendant).
  if (interactiveTrailing) {
    return (
      <div className={cls}>
        <span
          role={onClick ? "button" : undefined}
          tabIndex={onClick ? 0 : undefined}
          onClick={onClick}
          onKeyDown={
            onClick
              ? (e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onClick();
                  }
                }
              : undefined
          }
          className="flex min-w-0 flex-1 items-center gap-3 outline-none"
        >
          {markerEl}
          {bodyEl}
        </span>
        {trailingEl}
      </div>
    );
  }
  const inner = (
    <>
      {markerEl}
      {bodyEl}
      {trailingEl}
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

// a Section header's trailing action (All in Library / Open Inbox / Ask anything). A quiet link, not
// a button: it navigates or opens an overlay, and the heading beside it is the heavier object.
export function SectionAction({
  href,
  onClick,
  accent,
  children,
}: {
  href?: string;
  onClick?: () => void;
  // there is something waiting behind this link. ONE step of ink, nothing else — see below.
  accent?: boolean;
  children: React.ReactNode;
}) {
  // No fill at rest. It used to carry ink/5%, which made it the only washed control on the page and
  // put the object on the LIGHTER of the two things in the header — a 14/400 link had a shape while
  // the 16/500 heading beside it did not. The wash also did no work: ink 5% -> 9% on hover is a
  // 1.08:1 change, so the state was actually being carried by the text going muted -> ink the whole
  // time. What was the rest state is now the hover state, which is the register every other quiet
  // action in the app already uses (Row, the reader's graph door, the activity row's link).
  //
  // px-2 rather than px-2.5: with -mr-2 the glyphs now land 2px inside the content column instead of
  // 4px short of it, and the hover wash overhangs by 8px the way Row's -mx-2 wash does. The old
  // comment claimed this alignment; the numbers were 4px and 6px out.
  const cls = cn(
    "-mr-2 inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm transition-colors",
    "outline-none hover:bg-foreground/[0.05] hover:text-foreground active:bg-foreground/[0.08]",
    "focus-visible:ring-2 focus-visible:ring-ring/40",
    // ACCENT = one step of ink, and that is all. It was forest wash + forest ink + weight 500 + the
    // caller's arrow: four signals for one fact, and the loudest of them was a colour reserved for
    // chrome, the agent and confirms. This link is none of those — it goes to another page. It also
    // sat 20px above a solid-forest Approve, and tinted-above-solid is the universal grammar for a
    // secondary paired with a primary, so it read as that decision's other button. The arrow the
    // call site supplies is the second signal, and it is a structural one: it says "go there".
    accent ? "text-foreground" : "text-muted-foreground",
  );
  if (onClick)
    return (
      <button type="button" onClick={onClick} className={cls}>
        {children}
      </button>
    );
  return (
    <Link href={href ?? "#"} className={cls}>
      {children}
    </Link>
  );
}
