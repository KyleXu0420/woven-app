"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  Waypoints,
  Network,
  BookOpen,
  PencilLine,
  Share2,
  Download,
  MoreHorizontal,
  Check,
  History,
  Archive,
  Lightbulb,
  Info,
  AlertTriangle,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import { AgentAvatar, PersonAvatar } from "./identity";
import { Valve, provisional } from "./proposal";
import { SharePanel } from "./share-menu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EditChatBar, type Msg } from "./edit-chat-bar";
import { VersionHistory } from "./version-history";
import { SectionComments } from "./section-comments";
import { ArtifactGraphOverlay } from "./artifact-graph-overlay";
import { CollectionsProperty } from "./collections-property";
import { StoryStrip } from "./story-strip";
import { FormatBubble } from "./format-bubble";
import { SourcePeek, LinkPeek, PersonPeek, DecisionPeek } from "./entity-peek";
import { NodeMark } from "./entity-profile";
import { FoldChip } from "./local-graph";
import { undot } from "./inbox-agent-band";
import { PageBreadcrumb } from "./page-heading";
import { useSearch } from "./search";
import { useDocSelection, type DocSelection, type SelAction } from "@/lib/use-doc-selection";
import {
  archiveArtifacts,
  artifactVersions,
  askArtifact,
  getArtifact,
  getArtifactGraph,
  getBlocks,
  getFreshness,
  personById,
  primaryCollection,
  proposeBlockEdit,
  proposeCite,
  proposeDecision,
  proposeEdit,
  refineProposal,
  relationCount,
  restoreEdge,
  spaceById,
  verifyEdge,
  versionBlocks,
} from "@/lib/api";
import { notify, toasts } from "@/lib/notifications";
import { EXPORT_FORMATS, exportArtifacts } from "@/lib/export";
import type { ArtifactGraph, AskCite, Block, CalloutTone, Decision, Edge, Episode, EditProposal, EditProposalKind, Freshness, RefKind } from "@/lib/types";

const EMPTY_SEL: DocSelection = { kind: "none", text: "", blockId: null, imageId: null };

// ——————————————————————————————————————————— edit-loop helpers

function wordDiff(before: string, after: string) {
  const a = before.split(/(\s+)/);
  const b = after.split(/(\s+)/);
  let p = 0;
  while (p < a.length && p < b.length && a[p] === b[p]) p++;
  let sa = a.length - 1;
  let sb = b.length - 1;
  while (sa >= p && sb >= p && a[sa] === b[sb]) {
    sa--;
    sb--;
  }
  return {
    prefix: a.slice(0, p).join(""),
    removed: a.slice(p, sa + 1).join(""),
    added: b.slice(p, sb + 1).join(""),
    suffix: a.slice(sa + 1).join(""),
  };
}

function applyProposal(blocks: Block[], p: EditProposal, mode: "replace" | "insert" = "replace"): Block[] {
  if (p.kind === "add") {
    return [
      ...blocks,
      {
        id: `b_added_${blocks.length}`,
        artifact_id: p.artifact_id,
        anchor: p.block_id,
        heading: p.heading ?? "New section",
        text: p.after,
      },
    ];
  }
  if (mode === "insert") {
    // non-destructive: keep the original block, drop the agent's version in right after it
    const idx = blocks.findIndex((b) => b.id === p.block_id);
    const added: Block = {
      id: `b_ins_${blocks.length}`,
      artifact_id: p.artifact_id,
      anchor: p.block_id,
      heading: p.heading ?? "",
      text: p.after,
    };
    if (idx < 0) return [...blocks, added];
    const copy = blocks.slice();
    copy.splice(idx + 1, 0, added);
    return copy;
  }
  return blocks.map((b) => (b.id === p.block_id ? { ...b, text: p.after } : b));
}

// two sentences where there was a dash: the thread printed an em dash per message, and a session of edits stacked
// one under the other into a column of dashes (the house allows one per screen)
function agentMsg(p: EditProposal): string {
  return p.kind === "add"
    ? `Drafted a new “${p.heading}” section. Review it in the document.`
    : `Proposed an edit to ${p.heading ?? "a section"}. Review it in the document.`;
}

// ——————————————————————————————————————————— an embedded figure takes the theme
//
// What was wrong: a figure arrives as a self-contained SVG data URI drawn in the LIGHT theme's values — its
// backdrop is the light card, its words the light ink, its bars the old forest, all baked in as literals. An
// <img> cannot see the page's CSS variables, so in dark the figure stayed a near-white slab with charcoal words
// on a charcoal page, the brightest object on the screen.
// The fix: before the figure is drawn, each paint it declares is read for the ROLE it plays and replaced by the
// live theme's token for that role — a near-white backdrop is the card, a pale rule the border, a mid neutral the
// secondary ink, a dark neutral the ink, and a chromatic paint the one accent (--primary, which dark lifts to
// sage). Roles, not a table of the seed's hex values, so any figure drawn in the house palette follows the theme.
// It stays an <img>: inlining the SVG would follow the theme for free but would give up the image sandbox (no
// script, no page access) for markup that can come from a capture.
const SVG_URI = "data:image/svg+xml,";
const FIGURE_ROLES = ["--card", "--border", "--muted-foreground", "--foreground", "--primary"] as const;
type FigureRole = (typeof FIGURE_ROLES)[number];

function figureRole(hex: string): FigureRole {
  const rgb =
    hex.length === 3
      ? hex.split("").map((c) => parseInt(c + c, 16))
      : [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const chroma = Math.max(...rgb) - Math.min(...rgb);
  if (chroma > 24) return "--primary";
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
  if (luminance > 0.85) return "--card";
  if (luminance > 0.55) return "--border";
  if (luminance > 0.15) return "--muted-foreground";
  return "--foreground";
}

function reinkFigure(src: string, inks: Record<FigureRole, string>): string {
  if (!src.startsWith(SVG_URI)) return src;
  let svg: string;
  try {
    svg = decodeURIComponent(src.slice(SVG_URI.length));
  } catch {
    return src;
  }
  const out = svg.replace(
    /\b(fill|stroke|stop-color)=(["'])\s*#([0-9a-f]{6}|[0-9a-f]{3})\s*\2/gi,
    (whole, attr: string, quote: string, hex: string) => {
      const ink = inks[figureRole(hex.toLowerCase())];
      return ink ? `${attr}=${quote}${ink}${quote}` : whole;
    },
  );
  return SVG_URI + encodeURIComponent(out);
}

// the theme flips by a class on <html> (theme-toggle.tsx), so the resolved token values are an external store:
// a figure re-inks the moment the class flips, with no reload. The snapshot is a string so React can compare it.
function subscribeTheme(onChange: () => void) {
  const mo = new MutationObserver(onChange);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style"] });
  return () => mo.disconnect();
}
function themeInks(): string {
  const cs = getComputedStyle(document.documentElement);
  return FIGURE_ROLES.map((r) => cs.getPropertyValue(r).trim()).join("|");
}

function ThemedFigureImg({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const key = React.useSyncExternalStore(subscribeTheme, themeInks, () => "");
  const themed = React.useMemo(() => {
    if (!key) return src;
    const vals = key.split("|");
    const inks = Object.fromEntries(FIGURE_ROLES.map((r, i) => [r, vals[i]])) as Record<FigureRole, string>;
    return reinkFigure(src, inks);
  }, [src, key]);
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={themed} alt={alt} className={className} />;
}

// ——————————————————————————————————————————— active-section tracking (TOC progress)

function useActiveSection(ids: string[]) {
  const [active, setActive] = React.useState(ids[0] ?? "");
  const key = ids.join(",");
  React.useEffect(() => {
    // the current section = the last one whose top has scrolled past the reading line (~30% down),
    // with a bottom guard so the final sections (which can't reach the line) still activate. More
    // reliable than a thin IntersectionObserver band on short docs, where sections skip the band.
    const compute = () => {
      const line = window.innerHeight * 0.3;
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      if (atBottom) {
        setActive(ids[ids.length - 1] ?? "");
        return;
      }
      let current = ids[0] ?? "";
      for (const id of ids) {
        const el = document.getElementById(id);
        if (!el) continue;
        if (el.getBoundingClientRect().top <= line) current = id;
        else break;
      }
      setActive(current);
    };
    compute();
    window.addEventListener("scroll", compute, { passive: true });
    window.addEventListener("resize", compute);
    return () => {
      window.removeEventListener("scroll", compute);
      window.removeEventListener("resize", compute);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return active;
}

// ——————————————————————————————————————————— reading column

function DiffText({ before, after }: { before: string; after: string }) {
  const d = wordDiff(before, after);
  return (
    <>
      {d.prefix}
      {d.removed ? (
        <span className="text-muted-foreground line-through decoration-line-stroke">{d.removed}</span>
      ) : null}
      {d.added ? <span className="rounded-sm bg-mark px-0.5 text-foreground">{d.added}</span> : null}
      {d.suffix}
    </>
  );
}

// the agent's proposed edit, reviewed inline: the diff is rendered in the block above; this bar is just the
// verdict — accept (replace / insert) or dismiss. Refining is deliberately NOT here — you nudge the draft by
// talking to the docked bar (the one AI surface), so the same "Tighten" never lives in two places at once.
function ProposalBar({
  kind,
  onApply,
  onReject,
}: {
  kind: EditProposalKind;
  onApply: (mode: "replace" | "insert") => void;
  onReject: () => void;
}) {
  const isAdd = kind === "add";
  return (
    // provisional = wash + its hairline (the alpha-ink family's named pair, not a hand-written forest alpha); the
    // label said "agent · proposed", engineer shorthand around a middle dot, and now says it in words
    <div className="mt-3 flex items-center gap-2 rounded-md border border-line-wash bg-wash px-2.5 py-2">
      <span className="flex flex-1 items-center gap-1.5 text-xs text-primary">
        <AgentAvatar size="xs" /> Proposed by Woven
      </span>
      <Button size="sm" onClick={() => onApply("replace")}>
        <Check /> {isAdd ? "Add section" : "Replace"}
      </Button>
      {!isAdd ? (
        <Button size="sm" variant="outline" onClick={() => onApply("insert")}>
          Insert below
        </Button>
      ) : null}
      <IconButton label="Dismiss" size="icon-sm" onClick={onReject} className="text-muted-foreground">
        <X className="size-4" />
      </IconButton>
    </div>
  );
}

// callout tones — the box tint + icon. Insight wears forest (an agent takeaway); note stays neutral
// (a human aside); warning is amber. Kept light — a tinted box, not a new editor surface.
const CALLOUT: Record<CalloutTone, { icon: LucideIcon; box: string; iconColor: string }> = {
  insight: { icon: Lightbulb, box: "border-line-wash bg-wash", iconColor: "text-primary" },
  note: { icon: Info, box: "border-border bg-tint-1", iconColor: "text-muted-foreground" },
  warning: { icon: AlertTriangle, box: "border-warn/30 bg-warn/[0.06]", iconColor: "text-warn" },
};

const Section = React.memo(function Section({
  block,
  artifactId,
  diff,
  editing,
  swapped,
  highlight,
  onApply,
  onReject,
  onEdited,
  onCommit,
  onApplySuggestion,
  readOnly = false,
}: {
  block: Block;
  artifactId: string;
  diff: EditProposal | null;
  editing: boolean;
  swapped: boolean;
  highlight: boolean;
  onApply: (mode: "replace" | "insert") => void;
  onReject: () => void;
  onEdited: () => void;
  onCommit: (blockId: string, field: "heading" | "text", value: string) => void;
  onApplySuggestion: (blockId: string, after: string) => void;
  readOnly?: boolean;
}) {
  // free editing (Google-Docs style) when in edit mode; the body locks while an agent diff is under review
  const editableBody = editing && !diff;

  // callout — a light structural block: a tinted box (icon + editable label + body), no image / no diff
  if (block.callout) {
    const c = CALLOUT[block.callout.tone];
    const Icon = c.icon;
    return (
      <section
        id={block.id}
        data-block-id={block.id}
        className={cn("group/sec -mx-4 mb-11 scroll-mt-24 rounded-lg px-4", highlight && "bg-tint-1")}
      >
        <div className={cn("rounded-lg border p-4 sm:p-5", c.box)}>
          <div className="mb-1.5 flex items-center gap-2">
            <Icon className={cn("size-4 shrink-0", c.iconColor)} />
            <span
              contentEditable={editableBody}
              suppressContentEditableWarning
              onInput={onEdited}
              onBlur={(e) => onCommit(block.id, "heading", e.currentTarget.textContent ?? "")}
              className={cn(
                "text-sm font-medium text-foreground",
                editing && "-mx-1 rounded-sm px-1 outline-none focus:bg-tint-1",
              )}
            >
              {block.heading}
            </span>
          </div>
          <p
            contentEditable={editableBody}
            suppressContentEditableWarning
            onInput={onEdited}
            onBlur={(e) => onCommit(block.id, "text", e.currentTarget.textContent ?? "")}
            className={cn(
              "text-read text-foreground-prose",
              editableBody && "-mx-1 cursor-text rounded-sm px-1 outline-none focus:bg-tint-1",
            )}
          >
            {block.text}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section
      id={block.id}
      data-block-id={block.id}
      className={cn(
        "group/sec -mx-4 mb-11 scroll-mt-24 rounded-lg px-4 transition-colors",
        highlight && "bg-tint-1",
      )}
    >
      <div className="flex items-start gap-2">
        <h2
          contentEditable={editableBody}
          suppressContentEditableWarning
          onInput={onEdited}
          onBlur={(e) => onCommit(block.id, "heading", e.currentTarget.textContent ?? "")}
          className={cn(
            "min-w-0 flex-1 text-read-heading font-medium",
            editing && "-mx-1.5 rounded-md px-1.5 outline-none focus:bg-tint-1",
          )}
        >
          {block.heading}
        </h2>
        {!readOnly ? (
          <span className="mt-2 shrink-0">
            <SectionComments artifactId={artifactId} blockId={block.id} onApplySuggestion={onApplySuggestion} />
          </span>
        ) : null}
      </div>
      <p
        contentEditable={editableBody}
        suppressContentEditableWarning
        onInput={onEdited}
        onBlur={(e) => onCommit(block.id, "text", e.currentTarget.textContent ?? "")}
        className={cn(
          "mt-3 text-read text-foreground-prose",
          editableBody && "-mx-1.5 cursor-text rounded-md px-1.5 outline-none focus:bg-tint-1",
        )}
      >
        {diff ? <DiffText before={diff.before ?? block.text} after={diff.after} /> : block.text}
      </p>
      {block.image ? (
        <figure
          data-image-id={block.id}
          tabIndex={editing ? 0 : -1}
          className={cn(
            "mt-6 overflow-hidden rounded-lg border bg-card",
            editing && "cursor-pointer outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-focus",
          )}
        >
          <ThemedFigureImg
            src={swapped ? block.image.altSrc ?? block.image.src : block.image.src}
            alt={block.image.alt}
            className="block w-full"
          />
          <figcaption className="border-t px-4 py-2.5 text-sm text-muted-foreground">
            {block.image.caption}
          </figcaption>
        </figure>
      ) : null}
      {diff ? <ProposalBar kind={diff.kind} onApply={onApply} onReject={onReject} /> : null}
    </section>
  );
});

function AddPreview({
  proposal,
  onApply,
  onReject,
}: {
  proposal: EditProposal;
  onApply: (mode: "replace" | "insert") => void;
  onReject: () => void;
}) {
  return (
    <section className={`${provisional} mb-11 p-4`}>
      <h2 className="text-read-heading font-medium">{proposal.heading}</h2>
      <p className="mt-3 rounded-sm bg-mark px-1 text-read text-foreground-prose">
        {proposal.after}
      </p>
      <ProposalBar kind={proposal.kind} onApply={onApply} onReject={onReject} />
    </section>
  );
}

// ——————————————————————————————————————————— calm header (eyebrow, title, lead, metadata band)

// The header is set in the public page's register (app/a/[slug]: line B's Are.na pass), so the reader and the
// page it publishes to are one document in two places. What it replaced, and why each went:
//   - the eyebrow was a bordered chip on a hand-written muted alpha. It is the breadcrumb now: the collection the
//     doc lives in, a link, in the house PageBreadcrumb — the reader is a detail page and that is its parent.
//   - the title, lead and body were set on hand-written px (30/32, 17, 21, 16) that sat on no rung. They take the
//     Reading register (read-display 40, read 19, read-heading 22), the one the public page already uses, so a
//     reader's measure and size are the published document's.
//   - the status line ran five facts through four middle dots, and the state wore a --chart-1 dot (an identity
//     hue used as a status, which the colour rule bans). It is the hairline-ruled metadata band: one fact per
//     item, parted by space, ruled above and below, no dot of either kind.
function ArtifactHeader({
  crumb,
  type,
  stateLabel,
  title,
  gist,
  draftedMark,
  draftedLabel,
  readMin,
  degree,
}: {
  crumb: { label: string; href: string };
  type: string;
  stateLabel: string;
  title: string;
  gist?: string;
  draftedMark: React.ReactNode;
  draftedLabel: string;
  readMin: number;
  degree: number;
}) {
  return (
    <header>
      <PageBreadcrumb className="mb-0" trail={[crumb]} />

      <h1 className="mt-4 text-read-display font-medium">{title}</h1>

      {gist ? <p className="mt-4 text-read text-foreground-prose">{gist}</p> : null}

      <ul
        aria-label="About this document"
        data-band="meta"
        className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-1.5 border-y py-3 text-sm text-muted-foreground"
      >
        <li className="inline-flex min-w-0 items-center gap-1.5">
          {draftedMark}
          <span className="truncate">{draftedLabel}</span>
        </li>
        <li>{type}</li>
        <li>{stateLabel}</li>
        <li className="tabular-nums">
          {degree} link{degree === 1 ? "" : "s"}
        </li>
        <li className="tabular-nums">{readMin} min read</li>
      </ul>
    </header>
  );
}

// ——————————————————————————————————————————— reading TOC (jump + progress)

function ReadingTOC({ blocks, active }: { blocks: Block[]; active: string }) {
  return (
    // a minimal, textless section index — one bar per section, the active one longer + inked. It sits just
    // left of the document with the bars right-anchored (hugging the page), so hovering expands each heading
    // leftward into the gutter — never over the page.
    <nav className="group/toc flex flex-col items-end gap-2.5" aria-label="Sections">
      {blocks.filter((b) => !b.callout).map((b) => {
        const on = active === b.id;
        return (
          <a
            key={b.id}
            href={`#${b.id}`}
            aria-current={on ? "true" : undefined}
            className="flex flex-row-reverse items-center outline-none focus-visible:opacity-100"
          >
            <span
              className={cn(
                "h-px shrink-0 rounded-full transition-all duration-200",
                // the alpha-ink family's named rungs for the same two values (muted/40 at rest, /60 on hover)
                on ? "w-5 bg-foreground" : "w-2.5 bg-line-stroke group-hover/toc:bg-foreground-hint",
              )}
            />
            <span
              className={cn(
                "max-w-0 overflow-hidden whitespace-nowrap text-right text-sm opacity-0 transition-all duration-200 group-hover/toc:mr-3 group-hover/toc:max-w-[220px] group-hover/toc:opacity-100",
                on ? "font-medium text-foreground" : "text-muted-foreground",
              )}
            >
              {b.heading}
            </span>
          </a>
        );
      })}
    </nav>
  );
}

// ——————————————————————————————————————————— context rail (suggestions, the "Woven into" band, collections, story)

// One thing this document is tied to, as the band draws it: its kind (which picks the mark's shape), its id (which
// picks the mark's hue), its name, and the card that opens toward the document when it is clicked.
type Tie = { id: string; kind: RefKind; label: string; peek: React.ReactNode };

// The band's groups, in reading order: what the doc was woven FROM, what it is linked with, who is in it, what it
// decided. A group is a KIND, the mark alphabet's own axis (shape = kind), so every row under one label wears the
// same shape and the label names the shape's meaning once.
const TIE_ORDER: RefKind[] = ["source", "artifact", "collection", "topic", "person", "decision"];
const TIE_LABEL: Record<RefKind, string> = {
  source: "Sources",
  artifact: "Documents",
  collection: "Collections",
  topic: "Topics",
  person: "People",
  decision: "Decisions",
};

// The group header: FeedHead's grammar — a 12/500 muted label, its count bare and muted (inventory: how many
// exist), then ONE line-edge hairline under it — set on the rail's own left edge. FeedHead `flush` insets its
// label 6px because the Team list hangs each 12px mark centred in a 24px lead column; the rail stands its marks on
// the column edge (the edge its section labels, the Collections chips and the Story already share), so the label
// stands there too and the rule runs edge to edge like the rail's section rules.
// The air is the rail's, not the list's. FeedHead's 24 above a group and 8 under the label are a full-page list's
// rhythm; in the rail they cost 48px a group, four groups put 192px of air in a 772px column, and with every tie
// drawn the band ran to 545px and pushed the Story and the graph door under a 900px fold.
// 8 above and 4 under to the hairline, 28px a group (20 for the first, which now opens the band: the visible
// "Woven into" over "Sources" was two 12/500 muted lines 4px apart, the double label). With the 2px a row's fill
// stops short of its box, a label has 10px of ground above it and 4 under it to its rule, and the rule is 4px over
// the first fill, so the label reads with the rows below it. Lit fills sit 4px apart inside a group, 34 across a
// kind head and 47 across a section rule: three gaps a reader can tell apart, where the first one used to be 0.
// The hairline is the divider token, the section rule's own: as line-edge (fg/10) it measured darker than the
// rule it sits under, so the sub-rule outranked its section's.
// On a coarse pointer the head makes room for its fold chip's 44px target: 14 above the label (pt-3.5) and 10 from
// the hairline to the first row (the list's pt-2.5), so the chip's 12px of hit margin a side ends where the rows'
// boxes begin. At 8 and 2 that margin took the right end of the first row under it (8px) and of the previous
// group's last row (6px, into its fill), and a tap there on a long name folded the group instead of opening the
// peek. The label stays 4 over its own rule. The first group keeps pt-0 (its chip's margin falls in the section
// seam above it, which holds no target).
// `fold` is the group's "+N" when it draws fewer rows than it has: it takes the head's trailing slot, the one the
// Suggestions' "Confirm all" and the Story's "All N" take on their heads, so every head in the rail ends in its
// one action at the column edge.
function TieHead({ label, count, fold }: { label: string; count: number; fold?: React.ReactNode }) {
  return (
    <div className="relative flex items-center gap-2 pb-1 pt-2 text-xs font-medium text-muted-foreground after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-border pointer-coarse:pt-3.5 group-first-of-type/tie:pt-0">
      <span className="min-w-0">{label}</span>
      <span className="shrink-0 font-normal tabular-nums">{count}</span>
      {fold}
    </div>
  );
}

// A row of the band: the thing's NodeMark, then its name. The 12px mark stands on the column edge in a lead slot
// one text line tall (a name may wrap, and a marker belongs to the line it starts, not the block's centre), 10px
// before the words. The name WRAPS: it is the only place the rail states it, and at 196px a truncated "Cap push
// notifications at t…" was a fact cut mid-word. The row is the peek trigger — the same card each relation opened
// before, toward the document; its hover fill bleeds 6px into the gutter so the mark is not flush to the fill.
// The row is two boxes, the rail's one row model (the suggestions and the Story's events are built the same way).
// The button is the HIT box: rows abut, so the pointer never falls through a seam, and the focus ring draws on it.
// The span is the PAINT box, the hit box less 2px top and bottom and nothing at the sides: two lit rows are parted
// by 4px of ground in every state (hover, press, peek open), where the fills used to run edge to edge and a hovered
// row and its neighbour read as one slab. 26 a row, fill 22, in the xl rail and the drawer alike (the xl-only 22 is
// gone). On a coarse pointer the row is a 44px target, fill 40, its text 12 from the top: it opens the peek, so it
// is a tap target, and the drawer that holds it scrolls anyway.
function TieRow({ tie }: { tie: Tie }) {
  return (
    <li>
      <Popover>
        <PopoverTrigger
          render={
            <button
              type="button"
              className="group/tierow -mx-1.5 flex w-[calc(100%_+_0.75rem)] rounded-md py-0.5 text-left text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-focus pointer-coarse:min-h-11"
            />
          }
        >
          <span className="flex min-w-0 flex-1 items-start gap-2.5 rounded-md px-1.5 py-0.5 transition-colors group-hover/tierow:bg-tint-1 group-active/tierow:bg-tint-2 group-data-popup-open/tierow:bg-tint-2 pointer-coarse:py-2.5">
            <span className="flex h-(--text-sm--line-height) w-3 shrink-0 items-center justify-center">
              <NodeMark node={{ id: tie.id, kind: tie.kind }} className="size-3" />
            </span>
            <span className="min-w-0 flex-1 text-pretty">{tie.label}</span>
          </span>
        </PopoverTrigger>
        <PopoverContent side="left" align="start" sideOffset={10} className="w-64">
          {tie.peek}
        </PopoverContent>
      </Popover>
    </li>
  );
}

// How many ties a kind draws before the rest fold. Drawing all eleven of a_notif's ties made the band 545px and
// put the Story at 900 and the graph door at 1235 in a 900px window, where all five rail sections had fit when the
// band only counted. Two a kind keeps every kind DRAWN — each group shows real names, never only its number — and
// with four kinds the band is 8 rows: at 1440x900 the rail ends at 878, 6px inside its box, with all five
// sections in view (measured, light and dark).
const TIES_AT_REST = 2;

// One kind's ties: its head, its first TIES_AT_REST rows, and the rest folded into the house fold chip ("+N":
// tint-1, muted 500, tabular; the people stack's and the explorer's own object, FoldChip). The chip sits in the
// head's trailing slot, not on a row of its own as the explorer list's FoldRow does: a fold row costs a tie row's
// 26px, so for a group of three it saves nothing, and across the folded groups it was what kept the rail over the
// fold. Clicked, the rest unfold IN PLACE under the drawn rows and the chip reads "−" without moving (it
// keeps its closed width), so the pointer is still on it to fold them back. Each group folds on its own.
function TieGroup({ kind, ties }: { kind: RefKind; ties: Tie[] }) {
  const [open, setOpen] = React.useState(false);
  const listId = React.useId();
  const folded = Math.max(0, ties.length - TIES_AT_REST);
  const drawn = open || folded === 0 ? ties : ties.slice(0, TIES_AT_REST);
  const noun = TIE_LABEL[kind].toLowerCase();
  return (
    <div role="group" aria-label={TIE_LABEL[kind]} className="group/tie">
      <TieHead
        label={TIE_LABEL[kind]}
        count={ties.length}
        fold={
          folded > 0 ? (
            // -my-0.5: the chip is 20 tall on the label's 16px line, and the head must not grow for it; the hit
            // area reaches 24 with the 2px ::after (the size the field's fold chip is hit at), and 44 on a coarse
            // pointer (12 a side, inside the room TieHead and the list make for it there). Keyed on the pointer,
            // not the width: the drawer serves a 1024 iPad and a 1024 laptop alike.
            <button
              type="button"
              aria-expanded={open}
              aria-controls={listId}
              aria-label={open ? `Show fewer ${noun}` : `Show ${folded} more ${noun}`}
              onClick={() => setOpen((o) => !o)}
              className="group/fold relative -my-0.5 ml-auto shrink-0 rounded-full outline-none after:absolute after:-inset-0.5 after:content-[''] focus-visible:ring-2 focus-visible:ring-focus pointer-coarse:after:-inset-3"
            >
              <FoldChip
                count={folded}
                open={open}
                className="group-hover/fold:bg-tint-2 group-hover/fold:text-foreground"
              />
            </button>
          ) : null
        }
      />
      <ul id={listId} className="flex flex-col pt-0.5 pointer-coarse:pt-2.5">
        {drawn.map((t) => (
          <TieRow key={t.id} tie={t} />
        ))}
      </ul>
    </div>
  );
}

// WovenInto — the doc's confirmed connections, DRAWN. It was four property rows that only counted them ("Sources
// 3 / Links 4 / People / Decisions 4"), each a click away from saying what it counted; the verdict's reference
// lock (Are.na, "this channel appears in") is that a connection is the content and is drawn, never only counted.
// So the ties are rows, grouped by kind under a label on a hairline with its count bare (FeedHead's grammar, the
// grouped-list header line B landed). Every kind draws its first two by name; the rest of a kind wait behind its
// "+N" (TieGroup).
// One exception, so a fact is drawn once: a collection the doc is FILED in is drawn by the editable Collections
// property directly below (with its remove and add), so a links-to edge to that same collection is not a second
// row here. A link to a collection the doc is not filed in still is.
function WovenInto({
  artifactId,
  graph,
  onJumpToBlock,
  onAskDecision,
}: {
  artifactId: string;
  graph: ArtifactGraph;
  onJumpToBlock?: (blockId: string) => void;
  onAskDecision?: (decision: Decision) => void;
}) {
  const filed = new Set(getArtifact(artifactId)?.collection_ids ?? []);
  const all: Tie[] = [
    ...graph.sources.map((r) => ({ id: r.id, kind: "source" as const, label: undot(r.label), peek: <SourcePeek srcRef={r} /> })),
    ...[...graph.linkedTo, ...graph.linkedFrom]
      .filter((r) => !(r.kind === "collection" && filed.has(r.id)))
      .map((r) => ({ id: r.id, kind: r.kind, label: undot(r.label), peek: <LinkPeek linkRef={r} /> })),
    ...graph.people.map((pe) => ({
      id: pe.id,
      kind: "person" as const,
      label: pe.name,
      peek: <PersonPeek person={pe} artifactId={artifactId} />,
    })),
    ...graph.decisions.map((d) => ({
      id: d.id,
      kind: "decision" as const,
      label: undot(d.text),
      peek: <DecisionPeek decision={d} onJump={onJumpToBlock} onAsk={onAskDecision} />,
    })),
  ];
  // a doc that links out to a thing that also links back is one tie, drawn once
  const seen = new Set<string>();
  const ties = all.filter((t) => (seen.has(t.id) ? false : (seen.add(t.id), true)));
  const groups = TIE_ORDER.map((kind) => ({ kind, ties: ties.filter((t) => t.kind === kind) })).filter(
    (g) => g.ties.length > 0,
  );
  if (groups.length === 0) return null;

  // No visible "Woven into" over the groups: "Sources 3 / Documents 2 / People 2 / Decisions 4" already name what
  // the band holds, so the caption added a word and no information, and it sat 4px over "Sources" in the same
  // 12/500 muted, a double label. Promoted to a 13/500 head with air under it, it cost 26px the 900px window does
  // not have. The section keeps the name for assistive tech, and the drawer's title says "Connections".
  return (
    <section aria-label="Woven into" data-band="woven-into">
      {groups.map((g) => (
        <TieGroup key={g.kind} kind={g.kind} ties={g.ties} />
      ))}
    </section>
  );
}

// ContextRail — the doc's context split by what needs a decision vs what's just reference. The agent's proposed
// links are the one task (a compact verify queue, gone when empty); the confirmed connections are the "Woven into"
// band; then where it is filed, its story, and the door to the whole neighbourhood on a canvas. Persistent in the
// right gutter (XL+) and the mobile drawer.
function ContextRail({
  artifactId,
  title,
  graph,
  proposed,
  onResolve,
  onConfirmAll,
  onExpand,
  onEpisodeSelect,
  onJumpToBlock,
  onAskDecision,
}: {
  artifactId: string;
  title?: string;
  graph: ArtifactGraph;
  proposed: ArtifactGraph["proposed"];
  onResolve: (edgeId: string, action: "confirm" | "discard") => void;
  onConfirmAll: () => void;
  onExpand?: () => void;
  onEpisodeSelect?: (e: Episode) => void;
  onJumpToBlock?: (blockId: string) => void;
  onAskDecision?: (decision: Decision) => void;
}) {
  const linkCount = graph.linkedTo.length + graph.linkedFrom.length;
  const hasContext =
    graph.sources.length > 0 || linkCount > 0 || graph.people.length > 0 || graph.decisions.length > 0;
  const empty = proposed.length === 0 && !hasContext;

  return (
    // one flat panel: sentence-case sub-labels, rows on a single left edge, sections parted by a hairline (never
    // cards), one accent (forest = the proposed mark's dash and the confirm only).
    // 8 under a section's last row, the hairline, 12 over the next head: 21 in all, as when it was 10 and 10 (the rail
    // has to hold five sections in the 772px a 900px window gives it). The smaller half is below the rows, whose
    // fills already stop 2px short of their boxes; the larger is above the head, so the head reads with its section
    // and not as the tail of the one before.
    <div className="flex flex-col [&>section]:border-t [&>section]:border-border [&>section]:pb-2 [&>section]:pt-3 [&>section:first-of-type]:border-t-0 [&>section:first-of-type]:pt-0 [&>section:last-of-type]:pb-0">
      {/* suggestions — the one thing to act on; flat rows (no card), the reason revealed on hover; gone when empty.
          The label's count is DEMAND (something waits on this person): a bare number in full ink, where it was
          "Suggestions · 2". Each row leads with the thing's own mark drawn PENDING — the dashed outline the graph
          gives an unconfirmed tie — where it led with a lucide link/diamond/file glyph, so a suggestion and the
          row it becomes once confirmed wear the same shape, and only the line (dashed, then solid) changes. */}
      {proposed.length > 0 ? (
        <section>
          {/* label + batch on one line in the 196 column: they measured 80 + 8 + 115 = 204 with the ✓✓ glyph, so the
              batch wrapped under its label. The batch is a WORD (forest-action rule: a labelled wash button with its
              count), the word says the verb, and without the glyph it is 97 (186 in all) — one line, with room for
              the 8px quiet scrollbar a classic-scrollbar browser takes. flex-wrap stays as the fallback.
              The button hangs 3px into the air above and below its label (-my-1), so the head is its 18px line.
              The head is a zone head, 13/500 in full ink like Story's and Collections' (that one is set in
              collections-property.tsx), where it was the 12/500 muted of the kind heads under it; 4px from it to the
              first row's box, 6 to that row's fill.
              On a coarse pointer the batch keeps its 24 face and is hit at 46: the ::after measures from inside the
              button's 1px border, so 12 a side on its 22px padding box. And there the head stands 12 over the first
              row, not 4: the first row's ✓/✕ are open at rest, and 4px under the head their hit margin took the
              bottom of the batch's own face, so a tap on "Confirm all" could dismiss one row. At 12 every face is
              its own button's to the pixel; between two faces, the row's single action wins over the batch. */}
          <div className="mb-1 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 pointer-coarse:mb-3">
            <span className="whitespace-nowrap text-sm font-medium text-foreground">
              Suggestions <span className="tabular-nums text-foreground">{proposed.length}</span>
            </span>
            {proposed.length > 1 ? (
              <Button
                size="xs"
                variant="confirm"
                onClick={onConfirmAll}
                className="-my-1 pointer-coarse:relative pointer-coarse:after:absolute pointer-coarse:after:-inset-3 pointer-coarse:after:content-['']"
              >
                Confirm all {proposed.length}
              </Button>
            ) : null}
          </div>
          <div className="flex flex-col">
            {proposed.map((p) => (
              // the rail's row model (TieRow): this div is the hit box, rows abutting; the one inside is the fill,
              // 2px short of it top and bottom, so a lit row is parted from the next by 4px of ground. 30 a row,
              // fill 26: the extra 4 over a tie row is what puts the 24px ✓/✕ inside the fill with 1px clear,
              // where they hung 1px outside it. Hovered, one fill covers the label and its reason.
              <div key={p.edge_id} className="group/vrow -mx-1.5 py-0.5">
                <div className="rounded-md px-1.5 py-1 transition-colors group-hover/vrow:bg-tint-1">
                  <div className="flex items-center gap-2.5">
                    <span className="flex w-3 shrink-0 items-center justify-center">
                      <NodeMark node={{ id: p.target_id, kind: p.kind ?? "artifact" }} pending className="size-3" />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{undot(p.label)}</span>
                    {/* the ✓/✕ stay out of the way until you engage the row — reveal on hover/focus, so at rest the
                        suggestion reads clean (mark + full label) and the valve never crowds or covers it.
                        -my-1: the hidden valve's 24px buttons set the row's height even at max-width 0, so a 13/18
                        label sat in a 32px row; hung into the fill's own 4px padding, the line stays 18.
                        A coarse pointer has no hover to reveal it, and a tap revealed nothing (the row holds no
                        focusable element until the valve shows), so there the valve and the reason are open at
                        rest. The valve is 28 a button, 16 apart, each hit at 46 (10 a side of its 26px padding box,
                        which is what an ::after measures from inside the 1px border; 8 a side made 42 with a 2px dead
                        seam between them). The two hit areas overlap by 2 and Dismiss is drawn last, so a tap between
                        them dismisses rather than confirms. The reveal's
                        cap is 72, that valve's width, where it was 64: a focused button would otherwise squeeze the
                        coarse valve 8px narrower than at rest (52 on a fine pointer, so the cap changes nothing there). */}
                    <div className="-my-1 flex shrink-0 items-center overflow-hidden opacity-0 transition-all duration-150 [max-width:0px] group-hover/vrow:ml-1 group-hover/vrow:opacity-100 group-hover/vrow:[max-width:72px] group-focus-within/vrow:ml-1 group-focus-within/vrow:opacity-100 group-focus-within/vrow:[max-width:72px] pointer-coarse:-my-1.5 pointer-coarse:ml-1 pointer-coarse:overflow-visible pointer-coarse:opacity-100 pointer-coarse:[max-width:72px]">
                      <Valve
                        size="icon-xs"
                        className="pointer-coarse:gap-4 pointer-coarse:[&>button]:relative pointer-coarse:[&>button]:size-7 pointer-coarse:[&>button]:after:absolute pointer-coarse:[&>button]:after:-inset-2.5 pointer-coarse:[&>button]:after:content-[''] pointer-coarse:[&>button_svg:not([class*='size-'])]:size-4"
                        onConfirm={() => onResolve(p.edge_id, "confirm")}
                        onDismiss={() => onResolve(p.edge_id, "discard")}
                      />
                    </div>
                  </div>
                  {p.rationale ? (
                    <div className="grid grid-rows-[0fr] transition-[grid-template-rows] duration-200 ease-out group-hover/vrow:grid-rows-[1fr] pointer-coarse:grid-rows-[1fr]">
                      <p className="overflow-hidden pl-5.5 text-xs text-muted-foreground">
                        <span className="block pt-1">{p.rationale}</span>
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <WovenInto artifactId={artifactId} graph={graph} onJumpToBlock={onJumpToBlock} onAskDecision={onAskDecision} />

      {/* collections — editable membership (a chip per collection + Add) */}
      <CollectionsProperty artifactId={artifactId} />

      {/* story — the doc's episodic timeline (who did what, when): the human-readable complement to the graph */}
      <StoryStrip artifactId={artifactId} title={title} onEpisodeSelect={onEpisodeSelect} />

      {/* the door — browse the whole neighbourhood on a canvas; a plain row (not a box), consistent with above */}
      {onExpand && hasContext ? (
        <section>
          <button
            onClick={onExpand}
            className="group/door -mx-1.5 flex w-[calc(100%_+_0.75rem)] items-center gap-2 rounded-md px-1.5 py-1 text-left outline-none transition-colors hover:bg-tint-1 focus-visible:ring-2 focus-visible:ring-focus"
          >
            <Network className="size-4 shrink-0 text-muted-foreground" />
            <span className="flex-1 text-sm text-foreground">Explore as a graph</span>
            <ArrowUpRight className="size-3.5 shrink-0 text-foreground-hint opacity-0 transition-opacity group-hover/door:opacity-100" />
          </button>
        </section>
      ) : null}

      {empty ? (
        <section>
          <p className="text-sm text-muted-foreground">
            No connections yet. As the agent weaves this artifact into your graph, its links show up here.
          </p>
        </section>
      ) : null}
    </div>
  );
}

function ContextDrawer({
  open,
  onClose,
  artifactId,
  title,
  graph,
  proposed,
  onResolve,
  onConfirmAll,
  onExpand,
  onEpisodeSelect,
  onAskDecision,
}: {
  open: boolean;
  onClose: () => void;
  artifactId: string;
  title?: string;
  graph: ArtifactGraph;
  proposed: ArtifactGraph["proposed"];
  onResolve: (edgeId: string, action: "confirm" | "discard") => void;
  onConfirmAll: () => void;
  onExpand: () => void;
  onEpisodeSelect?: (e: Episode) => void;
  onAskDecision?: (decision: Decision) => void;
}) {
  return (
    <>
      {/* the scrim is the house's one scrim value (/15); it was /20 */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-foreground/15 transition-opacity duration-200 lg:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onClose}
        aria-hidden
      />
      <aside
        className={cn(
          "fixed right-0 top-0 z-50 flex h-full w-[88vw] max-w-[360px] flex-col border-l bg-background shadow-xl transition-transform duration-300 ease-out",
          open ? "translate-x-0" : "translate-x-full",
        )}
        aria-hidden={!open}
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b px-4">
          <span className="inline-flex items-center gap-2 text-base font-medium">
            <Waypoints className="size-4 text-primary" /> Connections
          </span>
          {/* hand-rolled 32px squares on a hand-written hover alpha → the house icon button, its size and its hover */}
          <div className="flex items-center gap-0.5">
            <IconButton label="View as graph" onClick={onExpand} className="text-muted-foreground">
              <Network className="size-4" />
            </IconButton>
            <IconButton label="Close" side="left" onClick={onClose} className="text-muted-foreground">
              <X className="size-4" />
            </IconButton>
          </div>
        </div>
        <div className="scrollbar-subtle flex flex-1 flex-col gap-6 overflow-y-auto p-4">
          <ContextRail
            artifactId={artifactId}
            title={title}
            graph={graph}
            proposed={proposed}
            onResolve={onResolve}
            onConfirmAll={onConfirmAll}
            onEpisodeSelect={onEpisodeSelect}
            onAskDecision={onAskDecision}
          />
        </div>
      </aside>
    </>
  );
}

// ——————————————————————————————————————————— top-right control cluster

function ModeBtn({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: LucideIcon;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm font-medium transition-colors",
        active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {/* the glyph drops on a phone: at 390 the bar's controls ran 36px past the edge and pushed Share and More
          off-screen; the words alone name the two modes */}
      <Icon className="size-3.5 max-sm:hidden" /> {label}
    </button>
  );
}

// autosave status — driven imperatively (ping on each keystroke) so typing never re-renders the
// document tree (which would fight the contentEditable cursor). Mirrors a Google-Docs save chip.
type SaveHandle = { ping: () => void };
const SaveStatus = React.forwardRef<SaveHandle>(function SaveStatus(_props, ref) {
  const [status, setStatus] = React.useState<"saving" | "saved">("saved");
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useImperativeHandle(
    ref,
    () => ({
      ping() {
        setStatus("saving");
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setStatus("saved"), 900);
      },
    }),
    [],
  );
  React.useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  return (
    <span className="hidden shrink-0 items-center gap-1.5 text-xs sm:inline-flex">
      {status === "saving" ? (
        <>
          <span className="size-1.5 animate-pulse rounded-full bg-warn" />
          <span className="text-muted-foreground">Saving…</span>
        </>
      ) : (
        <>
          <Check className="size-3 text-primary" />
          <span className="text-muted-foreground">All changes saved</span>
        </>
      )}
    </span>
  );
});

// ——————————————————————————————————————————— living-artifact freshness banner

// a doc-level banner when this artifact is superseded (a newer version replaced it — go there) or may be
// stale (a source it was woven from has changed; the human confirms it's still current — the trust valve).
function FreshnessBanner({ freshness, onMarkCurrent }: { freshness: Freshness; onMarkCurrent: () => void }) {
  const [dismissed, setDismissed] = React.useState(false);
  if (freshness.state === "fresh" || dismissed) return null;
  if (freshness.state === "superseded") {
    return (
      <div className="mb-8 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border bg-tint-1 px-4 py-3 text-sm">
        <span className="inline-flex shrink-0 items-center gap-2 font-medium">
          <History className="size-4 text-muted-foreground" /> Superseded
        </span>
        <span className="min-w-0 text-muted-foreground">A newer version has replaced this artifact.</span>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <Link
            href={`/artifact/${freshness.by_id}`}
            className="inline-flex items-center gap-1 font-medium text-foreground underline-offset-4 transition-colors hover:underline"
          >
            {freshness.by_label} <ArrowUpRight className="size-3.5" />
          </Link>
          <IconButton
            label="Stay on this version"
            size="icon-sm"
            side="left"
            onClick={() => setDismissed(true)}
            className="text-muted-foreground"
          >
            <X className="size-4" />
          </IconButton>
        </div>
      </div>
    );
  }
  return (
    <div className="mb-8 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-warn/30 bg-warn/[0.06] px-4 py-3 text-sm">
      <span className="inline-flex shrink-0 items-center gap-2 font-medium">
        <span className="size-1.5 rounded-full bg-warn" /> May be out of date
      </span>
      {/* commas where an em-dash pair stood: the banner, the body's first paragraph and the figure caption put
          five dashes in the first viewport (the house allows one per screen, and the body's are the document's own) */}
      <span className="min-w-0 text-muted-foreground">
        <span className="font-medium text-foreground">{freshness.source_label}</span>, a source this was woven
        from, changed {freshness.since}.
      </span>
      <IconButton
        label="Mark current"
        size="icon-sm"
        onClick={onMarkCurrent}
        side="left"
        className="ml-auto text-primary"
      >
        <Check className="size-4" />
      </IconButton>
    </div>
  );
}

// ——————————————————————————————————————————— the reader (top-level)

export function ArtifactReader({ artifactId, versionLabel }: { artifactId: string; versionLabel?: string }) {
  const router = useRouter();
  const { openSearch } = useSearch();
  const artifact = getArtifact(artifactId)!;
  const graph = getArtifactGraph(artifactId);
  const availableVersions = artifactVersions(artifactId);
  const selectedVersion = versionLabel
    ? availableVersions.find((item) => item.label === versionLabel || item.id === versionLabel)
    : availableVersions.find((item) => item.current);
  const version = selectedVersion?.label ?? availableVersions.find((item) => item.current)?.label ?? "v1";
  const exactSnapshot = Boolean(versionLabel && selectedVersion);
  const seed = exactSnapshot ? versionBlocks(artifactId, version) : getBlocks(artifactId);
  const freshness = getFreshness(artifactId);

  const [mode, setMode] = React.useState<"read" | "edit">("read");
  const [ctxOpen, setCtxOpen] = React.useState(false);
  const [graphOpen, setGraphOpen] = React.useState(false);
  const [staleDismissed, setStaleDismissed] = React.useState(false);
  const [versionsOpen, setVersionsOpen] = React.useState(false);
  const [archiveOpen, setArchiveOpen] = React.useState(false);

  const [blocks, setBlocks] = React.useState<Block[]>(seed);
  const [proposed, setProposed] = React.useState(graph.proposed);
  const [active, setActive] = React.useState<EditProposal | null>(null);
  const [thread, setThread] = React.useState<Msg[]>([]);
  const [input, setInput] = React.useState("");
  const [swap, setSwap] = React.useState<Record<string, boolean>>({});
  const [zoom, setZoom] = React.useState<string | null>(null);

  const docRef = React.useRef<HTMLDivElement>(null);
  const editing = mode === "edit";
  const selection = useDocSelection(docRef, editing);
  const activeSection = useActiveSection(blocks.filter((b) => !b.callout).map((b) => b.id));
  const askDecision = React.useCallback(
    (decision: Decision) =>
      openSearch(`What is the current status of “${decision.text}”?`, {
        kind: "decision",
        id: decision.id,
        title: decision.text,
      }),
    [openSearch],
  );

  // sticky selection — the composer keeps acting on what you selected even after you focus it to type
  // (focusing an input collapses the live DOM selection). Cleared by the chip's × or a new selection.
  const [capturedSel, setCapturedSel] = React.useState<DocSelection>(EMPTY_SEL);
  React.useEffect(() => {
    if (selection.kind !== "none") setCapturedSel(selection);
  }, [selection]);
  React.useEffect(() => {
    if (!editing) setCapturedSel(EMPTY_SEL);
  }, [editing]);
  const clearSelection = React.useCallback(() => {
    setCapturedSel(EMPTY_SEL);
    window.getSelection()?.removeAllRanges();
  }, []);

  // jumping to a section from an inline citation briefly tints it, so you see where you landed
  const [highlight, setHighlight] = React.useState<string | null>(null);
  const scrollToBlock = React.useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);
  // follow something to a section — scroll it into view and flash it (a Story episode's block, a decision's anchor)
  const jumpToBlock = React.useCallback(
    (id: string) => {
      scrollToBlock(id);
      setHighlight(id);
      window.setTimeout(() => setHighlight(null), 1600);
    },
    [scrollToBlock],
  );

  // Google-Docs-style free editing: keystrokes only ping the save chip (no doc re-render); blur commits.
  const saveRef = React.useRef<SaveHandle>(null);
  const markEdited = React.useCallback(() => saveRef.current?.ping(), []);
  const commitBlock = React.useCallback(
    (blockId: string, field: "heading" | "text", value: string) =>
      setBlocks((bs) => bs.map((b) => (b.id === blockId ? { ...b, [field]: value } : b))),
    [],
  );
  // accept a teammate's suggested edit from a discussion thread — rewrite the block's body to the suggestion
  const applySuggestion = React.useCallback(
    (blockId: string, after: string) =>
      setBlocks((bs) => bs.map((b) => (b.id === blockId ? { ...b, text: after } : b))),
    [],
  );
  // follow a Story episode to its context — its block (scroll + flash), a version roll (diff), else the graph
  const selectEpisode = React.useCallback(
    (ep: Episode) => {
      if (ep.blockId) {
        jumpToBlock(ep.blockId);
      } else if (ep.kind === "superseded" || ep.kind === "edited") {
        setVersionsOpen(true);
      } else {
        setGraphOpen(true);
      }
    },
    [jumpToBlock],
  );

  // light editor — drop a callout the human owns (agent insights arrive prefilled; this is the user's aside)
  const insertNote = React.useCallback(() => {
    setBlocks((bs) => [
      ...bs,
      {
        id: `b_note_${bs.length}`,
        artifact_id: artifactId,
        anchor: `note-${bs.length}`,
        heading: "Note",
        text: "New note. Say what to capture, or ask the agent to fill it in.",
        callout: { tone: "note" },
      },
    ]);
    notify.success("Note added", { description: "A callout was added at the end of the document." });
  }, [artifactId]);

  // editable document name — click the title to rename (Google-Docs style); stays in sync with the doc h1
  const [docTitle, setDocTitle] = React.useState(artifact.title);
  const [renaming, setRenaming] = React.useState(false);
  const [titleDraft, setTitleDraft] = React.useState(artifact.title);
  function commitTitle() {
    setDocTitle(titleDraft.trim() || docTitle);
    setRenaming(false);
    markEdited();
  }

  // derived presentation
  const words = blocks.reduce((n, b) => n + b.text.trim().split(/\s+/).length, 0);
  const readMin = Math.max(1, Math.round(words / 200));
  const degree = relationCount(artifactId);
  const author = personById(artifact.author_id);
  const draftedByAgent = artifact.prov === "ai_generated";
  const draftedLabel = draftedByAgent ? "Woven agent" : author?.name ?? "You";
  const draftedMark = draftedByAgent ? (
    <AgentAvatar size="xs" />
  ) : (
    <PersonAvatar seed={author?.id ?? artifact.author_id} name={author?.name ?? "You"} size="xs" />
  );
  // the breadcrumb's one step: the collection the doc lives in, else its space. A space name is seeded as org,
  // middle dot, team; the product joins the two with a space (the sidebar and the public page already do).
  const home = primaryCollection(artifactId);
  const crumb = home
    ? { label: home.name, href: `/collection/${home.slug}` }
    : { label: (spaceById(artifact.space_id)?.name ?? "Library").replace(/\s*\u00b7\s*/g, " "), href: "/library" };
  const stateLabel =
    artifact.state === "living" ? "Living" : artifact.state === "processing" ? "Processing" : "Archived";
  const shareUrl = artifact.public
    ? `woven.dev/a/${artifact.hub_slug ?? artifact.id}`
    : `woven.dev/artifact/${artifact.id}`;

  function resolveProposed(edgeId: string, action: "confirm" | "discard") {
    const p = proposed.find((x) => x.edge_id === edgeId);
    const prev = verifyEdge(edgeId, action);
    setProposed((ps) => ps.filter((x) => x.edge_id !== edgeId));
    const undo = prev
      ? {
          label: "Undo",
          onClick: () => {
            restoreEdge(prev);
            if (p) setProposed((ps) => [p, ...ps]);
          },
        }
      : undefined;
    const desc = p ? `Link to ${p.label}` : undefined;
    if (action === "confirm") toasts.linkConfirmed(desc, undo);
    else toasts.proposalDismissed(desc, undo);
  }

  // batch-clear the verify queue — confirm every pending proposal at once, with one undo
  function confirmAllProposed() {
    const snapshot = proposed.slice();
    const prevs = snapshot
      .map((p) => verifyEdge(p.edge_id, "confirm"))
      .filter((e): e is Edge => Boolean(e));
    setProposed([]);
    toasts.linksConfirmed(snapshot.length, {
      label: "Undo",
      onClick: () => {
        prevs.forEach(restoreEdge);
        setProposed(snapshot);
      },
    });
  }

  function instruct(instruction: string, blockId?: string | null) {
    // one AI surface: while a proposal is open, the bar nudges THAT draft (refine) instead of spawning a
    // second one — so a chip or a typed instruction refines the open proposal, and "Tighten" lives in one place.
    if (active) {
      refine(instruction);
      return;
    }
    const p = blockId ? proposeBlockEdit(artifactId, instruction, blockId) : proposeEdit(artifactId, instruction);
    setActive(p);
    setThread((t) => [...t, { role: "user", text: instruction }, { role: "agent", text: agentMsg(p) }]);
  }

  // Ask over the doc + its bounded graph neighborhood — the answer's citations are live anchors
  // (a cited section scrolls into view; a cited artifact navigates).
  function askDoc(question: string) {
    const res = askArtifact(artifactId, question);
    setThread((t) => [
      ...t,
      { role: "user", text: question },
      { role: "agent", text: res.answer, cites: res.cites },
    ]);
  }
  const onCite = React.useCallback(
    (c: AskCite) => {
      if (c.block_id) {
        scrollToBlock(c.block_id);
        setHighlight(c.block_id);
        window.setTimeout(() => setHighlight(null), 1600);
      } else if (c.href) router.push(c.href);
    },
    [scrollToBlock, router],
  );

  // the selection-aware action router — text/block → scoped instruct; image → swap/zoom; doc → instruct
  function runAction(a: SelAction) {
    if (capturedSel.kind === "image" && capturedSel.imageId) {
      const b = blocks.find((x) => x.id === capturedSel.imageId);
      if (a.id === "replace") {
        setSwap((s) => ({ ...s, [capturedSel.imageId!]: !s[capturedSel.imageId!] }));
        notify.success("Image replaced", { description: "Swapped to the alternate figure." });
      } else if (a.id === "enlarge") {
        const src = b?.image ? (swap[capturedSel.imageId] ? b.image.altSrc ?? b.image.src : b.image.src) : null;
        if (src) setZoom(src);
      } else {
        notify.success(a.label, { description: "Handed to the agent." });
      }
      return;
    }
    // analysis actions (Summarize / Find gaps / Check vs. sources) answer in the thread — they don't edit
    if (a.ask) {
      askDoc(a.label);
      return;
    }
    // graph actions (Extract decision / Cite source) mine the selection into a PROPOSED edge → the Verify
    // queue, not an inline edit; confirming it in the rail runs the same verifyEdge → episode loop.
    if (a.group === "graph" && capturedSel.kind === "text" && capturedSel.text) {
      const p =
        a.id === "cite"
          ? proposeCite(artifactId, capturedSel.text, capturedSel.blockId)
          : proposeDecision(artifactId, capturedSel.text, capturedSel.blockId);
      setProposed((ps) => [p, ...ps]);
      setThread((t) => [
        ...t,
        {
          role: "agent",
          text: `Proposed ${a.id === "cite" ? "a source" : "a decision"} from the selection. Confirm it under Suggestions.`,
        },
      ]);
      notify.success(a.label, { description: "Proposed. Confirm it under Suggestions." });
      return;
    }
    if ((capturedSel.kind === "text" || capturedSel.kind === "block") && capturedSel.blockId) {
      instruct(a.label, capturedSel.blockId);
      return;
    }
    instruct(a.label);
  }

  const applyActive = React.useCallback(
    (mode: "replace" | "insert") => {
      if (!active) return;
      setBlocks((bs) => applyProposal(bs, active, mode));
      setThread((t) => [
        ...t,
        {
          role: "system",
          text: `${mode === "insert" ? "Inserted" : "Applied"} “${active.heading ?? "edit"}”. You verified it.`,
        },
      ]);
      toasts.editApplied(active.heading);
      setActive(null);
    },
    [active],
  );
  const refine = React.useCallback((instruction: string) => {
    setActive((a) => (a ? refineProposal(a, instruction) : a));
    setThread((t) => [
      ...t,
      { role: "user", text: instruction },
      { role: "agent", text: "Refined the draft. Review the update in the document." },
    ]);
  }, []);
  const reject = React.useCallback(() => {
    setThread((t) => [...t, { role: "system", text: "Dismissed the proposal" }]);
    toasts.editDismissed();
    setActive(null);
  }, []);

  const rewriteTarget = active && active.kind !== "add" ? active.block_id : null;

  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      {/* minimal top bar: back, title, version | connections, graph, read/edit, share, more */}
      <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur-md sm:px-6">
        {/* a hand-rolled 36px circle on a hand-written hover alpha → the house icon button at its 36 rung */}
        <IconButton label="Back" size="icon-lg" variant="outline" side="right" onClick={() => router.back()} className="text-muted-foreground">
          <ArrowLeft className="size-4" />
        </IconButton>
        {/* below sm the title had 17px left between Back and the controls (an invisible rename target); the h1 is
            the first thing on the page there, so the bar drops it */}
        <div className="flex min-w-0 items-center gap-2.5 max-sm:hidden">
          {renaming && !exactSnapshot ? (
            <input
              autoFocus
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitTitle();
                }
                if (e.key === "Escape") setRenaming(false);
              }}
              className="w-64 max-w-[60vw] rounded-md border bg-background px-2 py-0.5 text-base font-medium outline-none focus-visible:ring-2 focus-visible:ring-focus"
            />
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  if (exactSnapshot) return;
                  setTitleDraft(docTitle);
                  setRenaming(true);
                }}
                title={exactSnapshot ? `${version}, as it was captured` : "Rename"}
                className={cn(
                  "group/title -mx-1 flex min-w-0 items-center gap-1.5 rounded-md px-1 py-0.5 text-base font-medium",
                  exactSnapshot ? "cursor-default" : "transition-colors hover:bg-tint-1",
                )}
              >
                <span className="truncate">{docTitle}</span>
                {!exactSnapshot ? <PencilLine className="size-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/title:opacity-100" /> : null}
              </button>
              <span className="hidden h-3.5 w-px shrink-0 bg-border sm:block" />
              {editing ? (
                <SaveStatus ref={saveRef} />
              ) : (
                // an exact snapshot printed the LIVE doc's "updated 17m ago" beside an old version's label; it says
                // when that version was captured instead
                <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
                  {exactSnapshot && selectedVersion?.at
                    ? `${version}, captured ${selectedVersion.at}`
                    : `${version}, updated ${artifact.updated} ago`}
                </span>
              )}
            </>
          )}
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          {/* mode — the primary control; track-and-thumb (recessed track, raised active thumb), no border */}
          <div className="inline-flex items-center gap-0.5 rounded-lg bg-secondary p-0.5">
            <ModeBtn active={mode === "read"} onClick={() => setMode("read")} icon={BookOpen} label="Read" />
            {!exactSnapshot ? <ModeBtn active={mode === "edit"} onClick={() => setMode("edit")} icon={PencilLine} label="Edit" /> : null}
          </div>

          {/* connections list — the references + verify queue. On XL it's the persistent right rail, so this
              below-XL-only button opens it as a drawer. (Waypoints = the connections list, matching the drawer.) */}
          {!exactSnapshot ? (
            <>
              <IconButton
                label="Connections"
                size="icon-lg"
                aria-expanded={ctxOpen}
                onClick={() => setCtxOpen((o) => !o)}
                className="text-muted-foreground xl:hidden"
              >
                <Waypoints className="size-4" />
              </IconButton>

              {/* view as graph — the hero action, promoted out of the drawer onto the bar: the doc's neighborhood AS a
                  graph, one click at any width. Network (not a generic Maximize) = graph, matching the rail's door.
                  Carries the degree + a dot when links await verifying. */}
              <button
                onClick={() => setGraphOpen(true)}
                title="View as graph"
                aria-label="View as graph"
                className="relative flex h-9 items-center gap-1.5 rounded-full px-2.5 text-sm font-medium tabular-nums text-muted-foreground outline-none transition-colors hover:bg-tint-1 hover:text-foreground focus-visible:ring-2 focus-visible:ring-focus"
              >
                {proposed.length > 0 ? (
                  <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-primary ring-2 ring-background" />
                ) : null}
                <Network className="size-3.5" /> {degree}
              </button>

              <span className="mx-0.5 h-5 w-px bg-border max-sm:hidden" />

              <Popover>
                <PopoverTrigger render={<Button size="icon-lg" variant="ghost" aria-label="Share" />}>
                  <Share2 className="size-4" />
                </PopoverTrigger>
                <PopoverContent align="end" className="w-80">
                  <SharePanel title={docTitle} url={shareUrl} artifactId={artifactId} />
                </PopoverContent>
              </Popover>

              <DropdownMenu>
            <DropdownMenuTrigger render={<Button size="icon-lg" variant="ghost" aria-label="More" />}>
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="gap-2">
                  <Download /> Export
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-44">
                  {EXPORT_FORMATS.map((f) => (
                    <DropdownMenuItem
                      key={f.key}
                      className="gap-2"
                      onClick={() => {
                        const name = exportArtifacts([artifactId], f.key);
                        notify.success("Exported", { description: name });
                      }}
                    >
                      {f.label}
                      <span className="ml-auto text-xs tabular-nums text-muted-foreground">{f.hint}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuItem onClick={() => setVersionsOpen(true)}>
                <History /> Version history
              </DropdownMenuItem>
              <DropdownMenuSeparator className="mx-1.5" />
              <DropdownMenuItem variant="destructive" onClick={() => setArchiveOpen(true)}>
                <Archive /> Archive
              </DropdownMenuItem>
            </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : null}
        </div>
      </header>

      {/* outline — pinned to the left gutter so the document can sit dead-center on the page */}
      <aside className="fixed left-[calc(50%-620px)] top-28 z-20 hidden max-h-[calc(100vh-8rem)] w-44 overflow-y-auto [scrollbar-width:none] xl:block [&::-webkit-scrollbar]:hidden">
        <ReadingTOC blocks={blocks} active={activeSection} />
      </aside>

      {/* context rail — the doc's whole-doc connections pinned to the right gutter, read alongside the body
          (XL+): what it was woven from, what it links to, its people/decisions, and the agent's proposed links
          to verify. The document stays dead-center; below XL the same rail is the Connections drawer. */}
      {/* the rail fits a 900px window again (each kind draws two ties and folds the rest, the Story shows three), so
          at rest nothing is under the fold there; the quiet scrollbar stays for what can still run past it: a
          shorter window, a kind unfolded, a doc tied to all six kinds.
          top-27 + pt-1, where it was top-28: the scroll box clips at its padding edge, and the Suggestions' "Confirm
          all" now hangs 4px above its label line, so the box starts 4px higher with 4px of padding. The rail's
          content still starts at 112, and its bottom edge stays 16px above the window's (7.75rem = the 108 above it plus
          that 16). */}
      {!exactSnapshot ? <aside className="scrollbar-subtle fixed right-5 top-27 z-20 hidden max-h-[calc(100vh-7.75rem)] w-56 overflow-y-auto px-3.5 pt-1 xl:block">
        <ContextRail
          artifactId={artifactId}
          title={docTitle}
          graph={graph}
          proposed={proposed}
          onResolve={resolveProposed}
          onConfirmAll={confirmAllProposed}
          onExpand={() => setGraphOpen(true)}
          onEpisodeSelect={selectEpisode}
          onJumpToBlock={jumpToBlock}
          onAskDecision={askDecision}
        />
      </aside> : null}

      {/* scroll body — the document, centered on the page as a paper card on the warm canvas */}
      <div className="mx-auto w-full max-w-[800px] px-5 pb-36 pt-10 sm:px-6">
        <div className="rounded-lg border bg-card px-7 py-9 sm:px-14 sm:py-14">
              {exactSnapshot ? (
                // "Exact evidence snapshot · v3 · captured 2d" was the data model's name for the view, run through
                // two middle dots; it says what the reader is looking at in words now
                <div className="mb-8 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg bg-tint-1 px-4 py-3 text-sm">
                  <History className="size-4 text-muted-foreground" />
                  <span className="font-medium">
                    {version}, as it was captured{selectedVersion?.at ? ` ${selectedVersion.at}` : ""}
                  </span>
                  <span className="ml-auto text-muted-foreground">Read only</span>
                </div>
              ) : null}
              {!exactSnapshot ? (
                <FreshnessBanner
                  freshness={staleDismissed && freshness.state === "stale" ? { state: "fresh" } : freshness}
                  onMarkCurrent={() => {
                    setStaleDismissed(true);
                    notify.success("Marked current", {
                      description: "You confirmed this artifact is still up to date.",
                    });
                  }}
                />
              ) : null}
              <ArtifactHeader
                crumb={crumb}
                type={artifact.type}
                stateLabel={stateLabel}
                title={docTitle}
                gist={artifact.gist}
                draftedMark={draftedMark}
                draftedLabel={draftedLabel}
                readMin={readMin}
                degree={degree}
              />
              <article ref={docRef} className="mt-10">
                {blocks.map((b) => (
                  <Section
                    key={b.id}
                    block={b}
                    artifactId={artifactId}
                    diff={rewriteTarget === b.id ? active : null}
                    editing={editing}
                    swapped={!!swap[b.id]}
                    highlight={highlight === b.id}
                    onApply={applyActive}
                    onReject={reject}
                    onEdited={markEdited}
                    onCommit={commitBlock}
                    onApplySuggestion={applySuggestion}
                    readOnly={exactSnapshot}
                  />
                ))}
                {active?.kind === "add" ? (
                  <AddPreview proposal={active} onApply={applyActive} onReject={reject} />
                ) : null}
              </article>
        </div>
      </div>

      {!exactSnapshot ? <ContextDrawer
        open={ctxOpen}
        onClose={() => setCtxOpen(false)}
        artifactId={artifactId}
        title={docTitle}
        graph={graph}
        proposed={proposed}
        onResolve={resolveProposed}
        onConfirmAll={confirmAllProposed}
        onExpand={() => setGraphOpen(true)}
        onEpisodeSelect={selectEpisode}
        onAskDecision={askDecision}
      /> : null}
      {!exactSnapshot ? <ArtifactGraphOverlay
        artifactId={artifactId}
        title={docTitle}
        open={graphOpen}
        onClose={() => setGraphOpen(false)}
      /> : null}

      {/* the editing surfaces — EDIT only. Two layers: the manual-formatting bubble floats at the text
          selection (Cycle/Slite), the AI command+chat bar is docked below. */}
      {editing ? (
        <>
          <FormatBubble selection={selection} />
          <EditChatBar
            selection={capturedSel}
            blocks={blocks}
            thread={thread}
            input={input}
            setInput={setInput}
            onAction={runAction}
            onSubmit={(text) =>
              instruct(
                text,
                capturedSel.kind === "text" || capturedSel.kind === "block" ? capturedSel.blockId : undefined,
              )
            }
            onAsk={askDoc}
            onCite={onCite}
            onClearScope={clearSelection}
            onInsertNote={insertNote}
            onAttach={() => notify.success("Attach a source", { description: "Drag a file or pick from the graph." })}
            refining={!!active}
          />
        </>
      ) : null}

      {/* enlarge lightbox */}
      {zoom ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/15 p-8 backdrop-blur-xs animate-in fade-in-0 duration-200"
          onClick={() => setZoom(null)}
        >
          <IconButton
            label="Close"
            size="icon-lg"
            variant="outline"
            side="left"
            className="absolute right-5 top-5 shadow-md"
            onClick={() => setZoom(null)}
          >
            <X className="size-4" />
          </IconButton>
          <ThemedFigureImg src={zoom} alt="" className="max-h-full max-w-3xl rounded-lg border bg-card shadow-2xl" />
        </div>
      ) : null}

      <VersionHistory artifactId={artifactId} open={versionsOpen} onOpenChange={setVersionsOpen} />
      <ConfirmDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        title="Archive this artifact?"
        description={
          <>
            “{docTitle}” leaves your working Library and any collections it’s in. Its links stay in the graph.
          </>
        }
        confirmLabel="Archive"
        destructive
        icon={<Archive />}
        onConfirm={() => {
          archiveArtifacts([artifactId]);
          notify.success("Archived", { description: `“${docTitle}” moved to the archive.` });
          router.push("/library");
        }}
      />
    </div>
  );
}
