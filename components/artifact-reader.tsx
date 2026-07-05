"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  Maximize2,
  Waypoints,
  BookOpen,
  PencilLine,
  Share2,
  Download,
  MoreHorizontal,
  Globe,
  Copy,
  Check,
  History,
  Archive,
  CheckCheck,
  Link2,
  FileText,
  Lightbulb,
  Info,
  AlertTriangle,
  CornerUpLeft,
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
} from "@/components/ui/dropdown-menu";
import { AgentAvatar, PersonAvatar } from "./identity";
import { Valve, ProposalMeta, provisional } from "./proposal";
import { SharePanel } from "./share-menu";
import { PublishDialog } from "./publish-dialog";
import { EditChatBar, type Msg } from "./edit-chat-bar";
import { VersionHistory } from "./version-history";
import { SectionComments } from "./section-comments";
import { EvidenceRail } from "./evidence-rail";
import { ArtifactGraphOverlay } from "./artifact-graph-overlay";
import { AddToCollectionSub } from "./add-to-collection";
import { useDocSelection, type DocSelection, type SelAction } from "@/lib/use-doc-selection";
import {
  askArtifact,
  getArtifact,
  getArtifactGraph,
  getArtifactEvidence,
  getBlocks,
  getFreshness,
  personById,
  primaryCollection,
  proposeBlockEdit,
  proposeEdit,
  refineProposal,
  relationCount,
  restoreEdge,
  spaceById,
  verifyEdge,
} from "@/lib/api";
import { notify, toasts } from "@/lib/notifications";
import type { ArtifactGraph, AskCite, Block, CalloutTone, Edge, EditProposal, EditProposalKind, Freshness } from "@/lib/types";

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

function agentMsg(p: EditProposal): string {
  return p.kind === "add"
    ? `Drafted a new “${p.heading}” section — review it in the document.`
    : `Proposed an edit to ${p.heading ?? "a section"} — review it in the document.`;
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
        <span className="text-muted-foreground line-through decoration-foreground/30">{d.removed}</span>
      ) : null}
      {d.added ? <span className="rounded bg-primary/12 px-0.5 text-foreground">{d.added}</span> : null}
      {d.suffix}
    </>
  );
}

const REFINE = ["Tighten", "More formal", "Add a source"];
function ProposalBar({
  kind,
  onApply,
  onRefine,
  onReject,
}: {
  kind: EditProposalKind;
  onApply: (mode: "replace" | "insert") => void;
  onRefine: (instruction: string) => void;
  onReject: () => void;
}) {
  const isAdd = kind === "add";
  return (
    <div className="mt-3 rounded-lg border border-primary/15 bg-primary/[0.04] p-2.5">
      <span className="flex items-center gap-1.5 font-mono text-[11px] text-primary">
        <AgentAvatar size="xs" /> agent · proposed
      </span>
      {/* refine in-loop — retry the draft without dismissing it (tighten / reword / add a source) */}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {REFINE.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => onRefine(r)}
            className="rounded-full border border-primary/20 bg-card px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
          >
            {r}
          </button>
        ))}
      </div>
      <div className="mt-2.5 flex items-center gap-2">
        <Button size="sm" onClick={() => onApply("replace")}>
          <Check /> {isAdd ? "Add section" : "Replace"}
        </Button>
        {!isAdd ? (
          <Button size="sm" variant="outline" onClick={() => onApply("insert")}>
            Insert below
          </Button>
        ) : null}
        <button
          type="button"
          onClick={onReject}
          aria-label="Dismiss"
          className="ml-auto flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}

// callout tones — the box tint + icon. Insight wears forest (an agent takeaway); note stays neutral
// (a human aside); warning is amber. Kept light — a tinted box, not a new editor surface.
const CALLOUT: Record<CalloutTone, { icon: LucideIcon; box: string; iconColor: string }> = {
  insight: { icon: Lightbulb, box: "border-primary/20 bg-primary/[0.05]", iconColor: "text-primary" },
  note: { icon: Info, box: "border-border bg-secondary/50", iconColor: "text-muted-foreground" },
  warning: { icon: AlertTriangle, box: "border-amber-500/30 bg-amber-500/[0.06]", iconColor: "text-amber-600" },
};

const Section = React.memo(function Section({
  block,
  diff,
  editing,
  swapped,
  highlight,
  onApply,
  onRefine,
  onReject,
  onEdited,
  onCommit,
}: {
  block: Block;
  diff: EditProposal | null;
  editing: boolean;
  swapped: boolean;
  highlight: boolean;
  onApply: (mode: "replace" | "insert") => void;
  onRefine: (instruction: string) => void;
  onReject: () => void;
  onEdited: () => void;
  onCommit: (blockId: string, field: "heading" | "text", value: string) => void;
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
        className={cn("group/sec -mx-4 mb-11 scroll-mt-24 rounded-lg px-4", highlight && "bg-foreground/[0.05]")}
      >
        <div className={cn("rounded-xl border p-4 sm:p-5", c.box)}>
          <div className="mb-1.5 flex items-center gap-2">
            <Icon className={cn("size-4 shrink-0", c.iconColor)} />
            <span
              contentEditable={editing}
              suppressContentEditableWarning
              onInput={onEdited}
              onBlur={(e) => onCommit(block.id, "heading", e.currentTarget.textContent ?? "")}
              className={cn(
                "text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground/70",
                editing && "-mx-1 rounded px-1 outline-none focus:bg-foreground/[0.06]",
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
              "font-serif text-[17px] leading-[1.55] text-foreground/85",
              editableBody && "-mx-1 cursor-text rounded px-1 outline-none focus:bg-foreground/[0.04]",
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
        highlight && "bg-foreground/[0.05]",
      )}
    >
      <div className="flex items-start gap-2">
        <h2
          contentEditable={editing}
          suppressContentEditableWarning
          onInput={onEdited}
          onBlur={(e) => onCommit(block.id, "heading", e.currentTarget.textContent ?? "")}
          className={cn(
            "min-w-0 flex-1 font-serif text-[1.4rem] font-medium leading-snug",
            editing && "-mx-1.5 rounded-md px-1.5 outline-none focus:bg-primary/[0.04]",
          )}
        >
          {block.heading}
        </h2>
        <span className="mt-2 shrink-0">
          <SectionComments blockId={block.id} />
        </span>
      </div>
      <p
        contentEditable={editableBody}
        suppressContentEditableWarning
        onInput={onEdited}
        onBlur={(e) => onCommit(block.id, "text", e.currentTarget.textContent ?? "")}
        className={cn(
          "mt-3 font-serif text-[19px] leading-[1.62] text-foreground/85",
          editableBody && "-mx-1.5 cursor-text rounded-md px-1.5 outline-none focus:bg-primary/[0.04]",
        )}
      >
        {diff ? <DiffText before={diff.before ?? block.text} after={diff.after} /> : block.text}
      </p>
      {block.image ? (
        <figure
          data-image-id={block.id}
          tabIndex={editing ? 0 : -1}
          className={cn(
            "mt-6 overflow-hidden rounded-xl border bg-card",
            editing && "cursor-pointer outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-primary/40",
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={swapped ? block.image.altSrc ?? block.image.src : block.image.src}
            alt={block.image.alt}
            className="block w-full"
          />
          <figcaption className="border-t px-4 py-2.5 text-[12px] text-muted-foreground">
            {block.image.caption}
          </figcaption>
        </figure>
      ) : null}
      {diff ? <ProposalBar kind={diff.kind} onApply={onApply} onRefine={onRefine} onReject={onReject} /> : null}
    </section>
  );
});

function AddPreview({
  proposal,
  onApply,
  onRefine,
  onReject,
}: {
  proposal: EditProposal;
  onApply: (mode: "replace" | "insert") => void;
  onRefine: (instruction: string) => void;
  onReject: () => void;
}) {
  return (
    <section className={`${provisional} mb-11 p-4`}>
      <h2 className="font-serif text-[1.4rem] font-medium leading-snug">{proposal.heading}</h2>
      <p className="mt-3 rounded bg-primary/10 px-1 font-serif text-[19px] leading-[1.62] text-foreground/90">
        {proposal.after}
      </p>
      <ProposalBar kind={proposal.kind} onApply={onApply} onRefine={onRefine} onReject={onReject} />
    </section>
  );
}

// ——————————————————————————————————————————— calm header (eyebrow · title · lead · meta strip)

function MetaCell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <div className="mt-1.5 truncate text-[13.5px] text-foreground/90">{children}</div>
    </div>
  );
}

function ArtifactHeader({
  pill,
  type,
  stateLabel,
  title,
  gist,
  draftedMark,
  draftedLabel,
  updated,
  readMin,
  degree,
}: {
  pill: string;
  type: string;
  stateLabel: string;
  title: string;
  gist?: string;
  draftedMark: React.ReactNode;
  draftedLabel: string;
  updated: string;
  readMin: number;
  degree: number;
}) {
  return (
    <header>
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="rounded-md border bg-muted/40 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
          {pill}
        </span>
        <span className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground/75">
          {type} · {stateLabel} · <span className="font-mono">v1</span>
        </span>
      </div>

      <h1 className="mt-4 font-serif text-[2.1rem] font-medium leading-[1.12] tracking-[-0.015em] sm:text-[2.4rem]">
        {title}
      </h1>

      {gist ? <p className="mt-4 font-serif text-[19px] leading-[1.6] text-muted-foreground">{gist}</p> : null}

      <div className="mt-7 grid grid-cols-2 gap-x-6 gap-y-5 border-y py-5 sm:grid-cols-4">
        <MetaCell label="Drafted by">
          <span className="inline-flex items-center gap-1.5">
            {draftedMark}
            <span className="truncate">{draftedLabel}</span>
          </span>
        </MetaCell>
        <MetaCell label="Updated">{updated} ago</MetaCell>
        <MetaCell label="Reading time">{readMin} min</MetaCell>
        <MetaCell label="Connections">
          {degree} link{degree === 1 ? "" : "s"}
        </MetaCell>
      </div>
    </header>
  );
}

// ——————————————————————————————————————————— reading TOC (jump + progress)

function ReadingTOC({ blocks, active }: { blocks: Block[]; active: string }) {
  return (
    <nav className="flex flex-col border-l border-border">
      {blocks.filter((b) => !b.callout).map((b) => {
        const on = active === b.id;
        return (
          <a
            key={b.id}
            href={`#${b.id}`}
            className={cn(
              "-ml-px truncate border-l-2 py-1.5 pl-4 text-[13px] leading-snug transition-colors",
              on
                ? "border-foreground font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
            )}
          >
            {b.heading}
          </a>
        );
      })}
    </nav>
  );
}

// ——————————————————————————————————————————— context drawer (progressive disclosure of the graph)

function RailLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{children}</p>
  );
}

function RelRow({
  icon: Icon,
  label,
  href,
  avatar,
}: {
  icon?: LucideIcon;
  label: string;
  href?: string;
  avatar?: React.ReactNode;
}) {
  // one row grammar for every relation: a fixed marker slot (icon or avatar), the label, and a
  // hover chevron on the rows you can follow — so every group lines up on a single left edge.
  const inner = (
    <>
      <span className="flex w-5 shrink-0 items-center justify-center">
        {avatar ?? (Icon ? <Icon className="size-4 text-muted-foreground" /> : null)}
      </span>
      <span className="truncate text-foreground">{label}</span>
      {href ? (
        <ArrowUpRight className="ml-auto size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/rel:opacity-100" />
      ) : null}
    </>
  );
  const base = "group/rel flex items-center gap-2.5 py-1.5 text-sm leading-snug";
  if (href) {
    return (
      <Link href={href} className={cn(base, "-mx-2 rounded-md px-2 transition-colors hover:bg-foreground/[0.04]")}>
        {inner}
      </Link>
    );
  }
  return <div className={base}>{inner}</div>;
}

function ContextDrawer({
  open,
  onClose,
  graph,
  proposed,
  onResolve,
  onConfirmAll,
  onExpand,
}: {
  open: boolean;
  onClose: () => void;
  graph: ArtifactGraph;
  proposed: ArtifactGraph["proposed"];
  onResolve: (edgeId: string, action: "confirm" | "discard") => void;
  onConfirmAll: () => void;
  onExpand: () => void;
}) {
  const empty =
    proposed.length === 0 &&
    graph.sources.length === 0 &&
    graph.linkedTo.length === 0 &&
    graph.linkedFrom.length === 0 &&
    graph.people.length === 0 &&
    graph.decisions.length === 0;
  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-foreground/20 transition-opacity duration-200 lg:hidden",
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
          <span className="inline-flex items-center gap-2 text-sm font-medium">
            <Waypoints className="size-4 text-primary" /> Connections
          </span>
          <div className="flex items-center gap-0.5">
            <button
              onClick={onExpand}
              title="View as graph"
              aria-label="View as graph"
              className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/[0.04] hover:text-foreground"
            >
              <Maximize2 className="size-4" />
            </button>
            <button
              onClick={onClose}
              aria-label="Close"
              className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/[0.04] hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
        <div className="scrollbar-subtle flex flex-1 flex-col gap-6 overflow-y-auto p-4">
          {/* the whole-doc connection index — a scannable list grouped by relation, one row grammar on a
              single left edge. No graph picture here: a node-link map wants a full canvas, not a 360px gutter. */}
          <div className="flex flex-col gap-7">
          {proposed.length > 0 ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Proposed</p>
                {proposed.length > 1 ? (
                  <IconButton label="Confirm all" size="icon-sm" side="left" onClick={onConfirmAll} className="text-primary">
                    <CheckCheck />
                  </IconButton>
                ) : null}
              </div>
              {/* one frame bounds the verify queue — a raised card, items split by hairlines (matches the rail) */}
              <div className="overflow-hidden rounded-xl border bg-card [&>*+*]:border-t [&>*+*]:border-border">
                {proposed.map((p) => (
                  <div key={p.edge_id} className="flex flex-col p-3">
                    <p className="text-[13px] leading-snug">
                      Link to <span className="font-medium">{p.label}</span>
                    </p>
                    <ProposalMeta rationale={p.rationale} className="mt-1.5" />
                    <Valve
                      onConfirm={() => onResolve(p.edge_id, "confirm")}
                      onDismiss={() => onResolve(p.edge_id, "discard")}
                      className="mt-2"
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {graph.sources.length > 0 ? (
            <div>
              <RailLabel>Woven from</RailLabel>
              {graph.sources.map((r) => (
                <RelRow key={r.id} icon={FileText} label={r.label} />
              ))}
            </div>
          ) : null}
          {graph.linkedTo.length > 0 ? (
            <div>
              <RailLabel>Linked to</RailLabel>
              {graph.linkedTo.map((r) => (
                <RelRow key={r.id} icon={Link2} label={r.label} href={`/artifact/${r.id}`} />
              ))}
            </div>
          ) : null}
          {graph.linkedFrom.length > 0 ? (
            <div>
              <RailLabel>Linked from</RailLabel>
              {graph.linkedFrom.map((r) => (
                <RelRow key={r.id} icon={CornerUpLeft} label={r.label} href={`/artifact/${r.id}`} />
              ))}
            </div>
          ) : null}
          {graph.people.length > 0 ? (
            <div>
              <RailLabel>People</RailLabel>
              {graph.people.map((pe) => (
                <RelRow key={pe.id} label={pe.name} avatar={<PersonAvatar seed={pe.id} name={pe.name} size="xs" />} />
              ))}
            </div>
          ) : null}
          {graph.decisions.length > 0 ? (
            <div>
              <RailLabel>Decisions</RailLabel>
              {graph.decisions.map((d) => (
                <div key={d.id} className="flex items-start gap-2.5 py-1.5 text-[13px] leading-snug text-foreground/80">
                  <span className="flex w-5 shrink-0 items-center justify-center pt-1.5">
                    <span className="size-1.5 rotate-45 bg-primary/70" />
                  </span>
                  <span className="min-w-0">{d.text}</span>
                </div>
              ))}
            </div>
          ) : null}

          {empty ? (
            <p className="text-[13px] leading-snug text-muted-foreground">
              No connections yet — as the agent weaves this artifact into your graph, its links show up here.
            </p>
          ) : null}
          </div>
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
        "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors",
        active ? "bg-secondary text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="size-3.5" /> {label}
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
    <span className="hidden shrink-0 items-center gap-1.5 font-mono text-[11px] sm:inline-flex">
      {status === "saving" ? (
        <>
          <span className="size-1.5 animate-pulse rounded-full bg-amber-500" />
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
  if (freshness.state === "fresh") return null;
  if (freshness.state === "superseded") {
    return (
      <div className="mb-8 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border bg-secondary/60 px-4 py-3 text-[13px]">
        <span className="inline-flex shrink-0 items-center gap-2 font-medium">
          <History className="size-4 text-muted-foreground" /> Superseded
        </span>
        <span className="min-w-0 text-muted-foreground">A newer version has replaced this artifact.</span>
        <Link
          href={`/artifact/${freshness.by_id}`}
          className="ml-auto inline-flex shrink-0 items-center gap-1 font-medium text-primary transition-colors hover:text-primary/80"
        >
          {freshness.by_label} <ArrowUpRight className="size-3.5" />
        </Link>
      </div>
    );
  }
  return (
    <div className="mb-8 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-amber-500/30 bg-amber-500/[0.06] px-4 py-3 text-[13px]">
      <span className="inline-flex shrink-0 items-center gap-2 font-medium">
        <span className="size-1.5 rounded-full bg-amber-500" /> May be out of date
      </span>
      <span className="min-w-0 text-muted-foreground">
        <span className="font-medium text-foreground/80">{freshness.source_label}</span> — a source this was
        woven from — changed {freshness.since}.
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

export function ArtifactReader({ artifactId }: { artifactId: string }) {
  const router = useRouter();
  const artifact = getArtifact(artifactId)!;
  const graph = getArtifactGraph(artifactId);
  const seed = getBlocks(artifactId);
  const freshness = getFreshness(artifactId);

  const [mode, setMode] = React.useState<"read" | "edit">("read");
  const [ctxOpen, setCtxOpen] = React.useState(false);
  const [graphOpen, setGraphOpen] = React.useState(false);
  const [, bumpReader] = React.useReducer((x: number) => x + 1, 0);
  const [staleDismissed, setStaleDismissed] = React.useState(false);
  const [publishOpen, setPublishOpen] = React.useState(false);
  const [versionsOpen, setVersionsOpen] = React.useState(false);

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

  // the read-along evidence rail — provenance beside the body, section-scoped and bidirectionally
  // synced with the reading position (hovering a rail row highlights its source block).
  const evidence = React.useMemo(() => getArtifactEvidence(artifactId), [artifactId]);
  const [highlight, setHighlight] = React.useState<string | null>(null);
  const scrollToBlock = React.useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);
  // hide proposed rows once resolved (the evidence memo is static; `proposed` is the live queue)
  const railItems = React.useMemo(() => {
    const live = new Set(proposed.map((p) => p.edge_id));
    return evidence.filter((i) => i.group !== "proposed" || live.has(i.edge_id));
  }, [evidence, proposed]);

  // Google-Docs-style free editing: keystrokes only ping the save chip (no doc re-render); blur commits.
  const saveRef = React.useRef<SaveHandle>(null);
  const markEdited = React.useCallback(() => saveRef.current?.ping(), []);
  const commitBlock = React.useCallback(
    (blockId: string, field: "heading" | "text", value: string) =>
      setBlocks((bs) => bs.map((b) => (b.id === blockId ? { ...b, [field]: value } : b))),
    [],
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
        text: "New note — say what to capture, or ask the agent to fill it in.",
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
  const words = seed.reduce((n, b) => n + b.text.trim().split(/\s+/).length, 0);
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
  const pill = primaryCollection(artifactId)?.name ?? spaceById(artifact.space_id)?.name ?? "Workspace";
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
      if (c.block_id) scrollToBlock(c.block_id);
      else if (c.href) router.push(c.href);
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
          text: `${mode === "insert" ? "Inserted" : "Applied"} “${active.heading ?? "edit"}” · agent → human-verified`,
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
      { role: "agent", text: "Refined the draft — review the update in the document." },
    ]);
  }, []);
  const reject = React.useCallback(() => {
    setThread((t) => [...t, { role: "system", text: "Dismissed the proposal" }]);
    toasts.editDismissed();
    setActive(null);
  }, []);
  function copyLink() {
    navigator.clipboard?.writeText(`https://${shareUrl}`).catch(() => {});
    notify.success("Link copied", { description: shareUrl });
  }

  const rewriteTarget = active && active.kind !== "add" ? active.block_id : null;

  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      {/* minimal top bar — back · title · version | TOC · connections · READ｜EDIT · share · ⋯ */}
      <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur-md sm:px-6">
        <button
          onClick={() => router.back()}
          aria-label="Back"
          className="flex size-9 shrink-0 items-center justify-center rounded-full border text-muted-foreground transition-colors hover:bg-foreground/[0.04] hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
        </button>
        <div className="flex min-w-0 items-center gap-2.5">
          {renaming ? (
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
              className="w-64 max-w-[60vw] rounded-md border bg-background px-2 py-0.5 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            />
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  setTitleDraft(docTitle);
                  setRenaming(true);
                }}
                title="Rename"
                className="group/title -mx-1 flex min-w-0 items-center gap-1.5 rounded-md px-1 py-0.5 text-sm font-medium transition-colors hover:bg-foreground/[0.05]"
              >
                <span className="truncate">{docTitle}</span>
                <PencilLine className="size-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/title:opacity-100" />
              </button>
              <span className="hidden h-3.5 w-px shrink-0 bg-border sm:block" />
              {editing ? (
                <SaveStatus ref={saveRef} />
              ) : (
                <span className="hidden shrink-0 font-mono text-[11px] text-muted-foreground sm:inline">
                  v1 · {artifact.updated} ago
                </span>
              )}
            </>
          )}
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          <button
            onClick={() => setCtxOpen((o) => !o)}
            title={proposed.length > 0 ? `${proposed.length} to verify · Connections` : "Connections"}
            className={cn(
              "relative flex h-9 items-center gap-1.5 rounded-full border px-3 text-[12px] font-medium transition-colors",
              ctxOpen
                ? "border-primary/30 bg-primary/[0.06] text-primary"
                : "text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground",
            )}
          >
            {proposed.length > 0 ? (
              <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-primary ring-2 ring-background" />
            ) : null}
            <Waypoints className="size-3.5" /> {degree}
          </button>

          <span className="mx-0.5 h-5 w-px bg-border" />

          {/* READ ｜ EDIT — the mode switch (light, in the top bar) */}
          <div className="inline-flex items-center rounded-lg border bg-card p-0.5">
            <ModeBtn active={mode === "read"} onClick={() => setMode("read")} icon={BookOpen} label="Read" />
            <ModeBtn active={mode === "edit"} onClick={() => setMode("edit")} icon={PencilLine} label="Edit" />
          </div>

          <Popover>
            <PopoverTrigger render={<Button size="icon-lg" variant="ghost" aria-label="Share" />}>
              <Share2 className="size-4" />
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80">
              <SharePanel title={docTitle} url={shareUrl} />
            </PopoverContent>
          </Popover>

          <DropdownMenu>
            <DropdownMenuTrigger render={<Button size="icon-lg" variant="ghost" aria-label="More" />}>
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <AddToCollectionSub artifactIds={[artifactId]} onChanged={bumpReader} />
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => notify.success("Export started", { description: "Your file will be ready in a moment." })}
              >
                <Download /> Export
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setPublishOpen(true)}>
                <Globe /> Publish…
              </DropdownMenuItem>
              <DropdownMenuItem onClick={copyLink}>
                <Copy /> Copy link
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setVersionsOpen(true)}>
                <History /> Version history
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => notify.success("Archived", { description: `“${docTitle}” moved to the archive.` })}
              >
                <Archive /> Archive
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* outline — pinned to the left gutter so the document can sit dead-center on the page */}
      <aside className="fixed left-6 top-28 z-20 hidden max-h-[calc(100vh-8rem)] w-44 overflow-y-auto [scrollbar-width:none] xl:block [&::-webkit-scrollbar]:hidden">
        <ReadingTOC blocks={blocks} active={activeSection} />
      </aside>

      {/* evidence rail — provenance pinned to the right gutter, read alongside the body (XL+); the
          document stays dead-center. On smaller screens the Connections drawer is the fallback. */}
      <aside className="fixed right-5 top-28 z-20 hidden max-h-[calc(100vh-8rem)] w-52 overflow-y-auto [scrollbar-width:none] xl:block [&::-webkit-scrollbar]:hidden">
        <EvidenceRail
          items={railItems}
          active={activeSection}
          sectionLabel={blocks.find((b) => b.id === activeSection)?.heading ?? ""}
          onHover={setHighlight}
          onScrollTo={scrollToBlock}
          onResolve={resolveProposed}
          onConfirmAll={confirmAllProposed}
        />
      </aside>

      {/* scroll body — the document, centered on the page as a paper card on the warm canvas */}
      <div className="mx-auto w-full max-w-[800px] px-5 pb-36 pt-10 sm:px-6">
        <div className="rounded-2xl border bg-card px-7 py-9 sm:px-14 sm:py-14">
              <FreshnessBanner
                freshness={staleDismissed && freshness.state === "stale" ? { state: "fresh" } : freshness}
                onMarkCurrent={() => {
                  setStaleDismissed(true);
                  notify.success("Marked current", {
                    description: "You confirmed this artifact is still up to date.",
                  });
                }}
              />
              <ArtifactHeader
                pill={pill}
                type={artifact.type}
                stateLabel={stateLabel}
                title={docTitle}
                gist={artifact.gist}
                draftedMark={draftedMark}
                draftedLabel={draftedLabel}
                updated={artifact.updated}
                readMin={readMin}
                degree={degree}
              />
              <article ref={docRef} className="mt-10">
                {blocks.map((b) => (
                  <Section
                    key={b.id}
                    block={b}
                    diff={rewriteTarget === b.id ? active : null}
                    editing={editing}
                    swapped={!!swap[b.id]}
                    highlight={highlight === b.id}
                    onApply={applyActive}
                    onRefine={refine}
                    onReject={reject}
                    onEdited={markEdited}
                    onCommit={commitBlock}
                  />
                ))}
                {active?.kind === "add" ? (
                  <AddPreview proposal={active} onApply={applyActive} onRefine={refine} onReject={reject} />
                ) : null}
              </article>
        </div>
      </div>

      <ContextDrawer
        open={ctxOpen}
        onClose={() => setCtxOpen(false)}
        graph={graph}
        proposed={proposed}
        onResolve={resolveProposed}
        onConfirmAll={confirmAllProposed}
        onExpand={() => setGraphOpen(true)}
      />
      <ArtifactGraphOverlay
        artifactId={artifactId}
        title={docTitle}
        open={graphOpen}
        onClose={() => setGraphOpen(false)}
      />

      {/* the chatdoc bar — EDIT only, selection-aware */}
      {editing ? (
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
        />
      ) : null}

      {/* enlarge lightbox */}
      {zoom ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/70 p-8 animate-in fade-in-0 duration-200"
          onClick={() => setZoom(null)}
        >
          <button
            aria-label="Close"
            className="absolute right-5 top-5 flex size-9 items-center justify-center rounded-full bg-background/90 text-foreground shadow-md"
            onClick={() => setZoom(null)}
          >
            <X className="size-4" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoom} alt="" className="max-h-full max-w-3xl rounded-xl border bg-card shadow-2xl" />
        </div>
      ) : null}

      <PublishDialog open={publishOpen} onOpenChange={setPublishOpen} hideTrigger url={shareUrl} artifactId={artifactId} />
      <VersionHistory artifactId={artifactId} open={versionsOpen} onOpenChange={setVersionsOpen} />
    </div>
  );
}
