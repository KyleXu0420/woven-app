import Link from "next/link";
import { cn } from "@/lib/utils";
import { DIVIDED, DIVIDED_FLUSH, FOCUS_RING } from "./classes";

// Today's shared grammar — the whole page is one system, not a stack of bespoke cards. A Section is a quiet
// zone (a sentence-case sub-label header + trailing action, over flat content); a Row is the one row model
// reused everywhere (marker · body · trailing, on one left edge, subtle hover, parted by an inset hairline).
// Cohesion comes from these + one accent + whitespace, never from per-widget chrome.

export function Section({
  label,
  count,
  byline,
  action,
  className,
  children,
}: {
  label: string;
  count?: number;
  // the agent's byline for the zone — mono is the agent's voice (the window "since 18:40 yesterday")
  byline?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("mt-8", className)}>
      {/* no px-0.5: the label sat 2px right of every other left edge on the page, and the action 2px short
          of the right one — four left edges inside a 36px band. One edge, shared with the rows. */}
      <div className="mb-2.5 flex items-baseline justify-between gap-2">
        <span className="text-base font-medium text-foreground">
          {label}
          {/* a count is generic metadata, not the agent's voice — Inter tabular-nums, never mono */}
          {count != null ? (
            <span className="ml-1.5 text-sm font-medium tabular-nums text-muted-foreground">{count}</span>
          ) : null}
          {byline != null ? (
            <span className="ml-3 font-mono text-xs font-normal text-muted-foreground max-md:mt-0.5 max-md:ml-0 max-md:block">{byline}</span>
          ) : null}
        </span>
        {action ?? null}
      </div>
      {children}
    </section>
  );
}

// place Rows inside this so they part with a hairline (Row uses first:border-t-0). Inset by default (a list
// inside a contained surface); `flush` for a list that sits directly in the page column and shares its edges.
export function RowList({ children, className, flush = false }: { children: React.ReactNode; className?: string; flush?: boolean }) {
  return <div className={cn("flex flex-col", flush ? DIVIDED_FLUSH : DIVIDED, className)}>{children}</div>;
}

export function Row({
  href,
  onClick,
  marker,
  trailing,
  active = false,
  interactiveTrailing = false,
  className,
  children,
}: {
  href?: string;
  onClick?: () => void;
  marker?: React.ReactNode;
  trailing?: React.ReactNode;
  active?: boolean; // keyboard/cursor selection highlight (search); default off keeps Today/Inbox on hover-only
  interactiveTrailing?: boolean; // trailing holds its own buttons (a ✓/✕ Valve) → non-button container
  className?: string; // layout the caller owns (e.g. wrapping the trailing control under the body on a phone)
  children: React.ReactNode;
}) {
  // The focus ring is the house ring, the same one SectionAction wears — rows used to fall back to the
  // browser's 1px outline, two focus languages on one page. min-h-11 below md is the touch floor. A Row
  // always goes somewhere; a zone with nothing to show renders EmptyRow, which is not a Row.
  const cls = cn(
    "group/row -mx-2 flex items-center gap-3 rounded-md px-2 py-2.5 text-left transition-colors max-md:min-h-11",
    FOCUS_RING,
    // one wash ladder with SectionAction (5% hover, 8% pressed): the rows are the biggest targets on the page
    // and were the faintest
    active ? "bg-foreground/[0.05]" : "hover:bg-foreground/[0.05] active:bg-foreground/[0.08]",
    className,
  );
  // The marker sits on the body's FIRST line, not the row's middle: a slot one body line tall (15/snug =
  // 20.625px), self-start, the glyph centred inside it. Row-centring was invisible on one-line rows and put
  // the agent mark 32px below the title on a four-line phone row, and 12px below every two-line Ask row.
  const markerEl =
    marker != null ? <span className="flex h-[1.29rem] w-6 shrink-0 items-center justify-center self-start">{marker}</span> : null;
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
          className={cn("flex min-w-0 flex-1 items-center gap-3 rounded-md", FOCUS_RING)}
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
      // no w-full: it is a flex child of RowList and stretches; w-full made the button rows 16px narrower
      // than the link rows (976 against 992), so their wash and hairlines stopped short of the digest's.
      <button type="button" onClick={onClick} className={cls}>
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
    "-mr-2 inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm transition-colors max-md:min-h-11 max-md:py-2.5",
    "hover:bg-foreground/[0.05] hover:text-foreground active:bg-foreground/[0.08]",
    FOCUS_RING,
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

// A trailing glyph that shows on hover and focus on a desktop, and at rest on a phone (there is no hover).
// Row-specific: it reads Row's group name.
export const ROW_REVEAL = "opacity-100 transition-opacity sm:opacity-0 sm:group-hover/row:opacity-100 group-focus-visible/row:opacity-100";

// A zone that has nothing to show says so, in one quiet row, and keeps its header and its action: "clear"
// must never be mistaken for "failed to load". Static — not a Row: no wash, no ring, nowhere to go. The
// caller names the actor in the marker slot (the agent only where the agent is the subject).
export function EmptyRow({ marker, children }: { marker?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="-mx-2 flex items-center gap-3 px-2 py-2.5 max-md:min-h-11">
      <span className="flex h-[1.29rem] w-6 shrink-0 items-center justify-center self-start">{marker ?? <span className="size-1.5 rounded-full bg-foreground/25" />}</span>
      <span className="min-w-0 flex-1 text-base text-muted-foreground">{children}</span>
    </div>
  );
}
