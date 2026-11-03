"use client";

// EntityPeek — the popover shown when you click a leaf in a property row (a source, a link, a person, a
// decision). Each is a compact card that resolves what the graph already knows about that entity — an
// artifact's gist, a person's role + what they touched here, a decision's provenance — so the rail stays a
// scannable summary and the detail is one click away. Four focused cards, one shared grammar
// (icon/avatar · title · meta · body · optional action).

import Link from "next/link";
import {
  ArrowUpRight,
  CalendarDays,
  Check,
  ClipboardCheck,
  Diamond,
  FileText,
  Hash,
  GitPullRequest,
  Link2,
  Mic,
  Paperclip,
  Sparkles,
  Video,
  type LucideIcon,
} from "lucide-react";
import { PersonAvatar } from "./identity";
import { DecisionStateLabel } from "./decision-state";
import { cn } from "@/lib/utils";
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { artifactEpisodes, collectionById, decisionMeta, getArtifact, listPeople, personById, personEpisodes, sourceById } from "@/lib/api";
import type { Decision, Person, Ref, Source } from "@/lib/types";

// shared card chrome — a small icon slot + a title/meta stack
function PeekHead({ icon: Icon, avatar, title, meta }: { icon?: LucideIcon; avatar?: React.ReactNode; title: string; meta?: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-px flex size-7 shrink-0 items-center justify-center rounded-md bg-foreground/[0.05] text-muted-foreground">
        {avatar ?? (Icon ? <Icon className="size-4" /> : null)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-medium leading-snug text-foreground">{title}</p>
        {meta ? <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">{meta}</p> : null}
      </div>
    </div>
  );
}

function personName(id: string): string {
  return id === "agent" ? "Woven" : personById(id)?.name ?? "Someone";
}

// ——————————————————————————————————————————— source

const SOURCE_KIND: Record<Source["kind"], { icon: LucideIcon; label: string }> = {
  transcript: { icon: Mic, label: "Transcript" },
  meeting: { icon: CalendarDays, label: "Meeting" },
  audit: { icon: ClipboardCheck, label: "Audit" },
  doc: { icon: FileText, label: "Doc" },
  file: { icon: Paperclip, label: "File" },
  link: { icon: Link2, label: "Link" },
  loom: { icon: Video, label: "Loom" },
  github: { icon: GitPullRequest, label: "GitHub PR" },
};

export function SourcePeek({ srcRef }: { srcRef: Ref }) {
  const s = sourceById(srcRef.id);
  const kind = SOURCE_KIND[s?.kind ?? "doc"];
  const state = s?.capture_state === "snapshotted"
    ? "Snapshot captured"
    : s?.capture_state === "reference_only"
      ? "Reference only"
      : s?.capture_state === "unavailable"
        ? "Unavailable"
        : null;
  const meta = [kind.label, state, s?.timecode_seconds != null ? `at ${Math.floor(s.timecode_seconds / 60)}:${String(s.timecode_seconds % 60).padStart(2, "0")}` : null, s?.at ? `captured ${s.at} ago` : null]
    .filter(Boolean)
    .join(" · ");
  return (
    <div>
      <PeekHead icon={kind.icon} title={srcRef.label} meta={meta} />
      {s?.note ? <p className="mt-2.5 text-[13px] leading-relaxed text-foreground/80">{s.note}</p> : null}
      {s?.href ? (
        <a
          href={s.href}
          target="_blank"
          rel="noreferrer"
          className="mt-2.5 flex items-center gap-1.5 border-t pt-2 text-[12px] font-medium text-primary hover:opacity-80"
        >
          <ArrowUpRight className="size-3 shrink-0" /> Open original source
        </a>
      ) : (
        <p className="mt-2.5 flex items-center gap-1.5 border-t pt-2 text-[12px] text-muted-foreground">
          <ArrowUpRight className="size-3 shrink-0" /> External source — woven into this artifact
        </p>
      )}
    </div>
  );
}

// ——————————————————————————————————————————— link (to another node)

export function LinkPeek({ linkRef }: { linkRef: Ref }) {
  if (linkRef.kind === "artifact") {
    const a = getArtifact(linkRef.id);
    if (a) {
      return (
        <div>
          <PeekHead icon={FileText} title={a.title} meta={`${personName(a.author_id)} · updated ${a.updated} ago`} />
          {a.gist ? <p className="mt-2.5 line-clamp-3 text-[13px] leading-relaxed text-foreground/80">{a.gist}</p> : null}
          <Link
            href={`/artifact/${a.id}`}
            className="mt-2.5 inline-flex items-center gap-1 text-[13px] font-medium text-primary transition-opacity hover:opacity-80"
          >
            Open artifact <ArrowUpRight className="size-3.5" />
          </Link>
        </div>
      );
    }
  }
  if (linkRef.kind === "collection") {
    const c = collectionById(linkRef.id);
    if (c) {
      return (
        <div>
          <PeekHead
            avatar={<span className="size-3 rounded-[3px]" style={{ background: c.color }} />}
            title={c.name}
            meta="Collection"
          />
          {c.intro ? <p className="mt-2.5 line-clamp-3 text-[13px] leading-relaxed text-foreground/80">{c.intro}</p> : null}
          <Link
            href={`/collection/${c.slug}`}
            className="mt-2.5 inline-flex items-center gap-1 text-[13px] font-medium text-primary transition-opacity hover:opacity-80"
          >
            Open collection <ArrowUpRight className="size-3.5" />
          </Link>
        </div>
      );
    }
  }
  // topic or an unresolved ref — the bare label is all the graph carries
  return <PeekHead icon={Hash} title={linkRef.label} meta={linkRef.kind === "topic" ? "Topic" : "Linked"} />;
}

// ——————————————————————————————————————————— person

// artifactId present → what they did HERE (rail leaf). Absent → context-free (a Find result): their recent
// activity across ALL artifacts, so a standalone person result still previews.
export function PersonPeek({ person, artifactId }: { person: Person; artifactId?: string }) {
  const here = artifactId ? artifactEpisodes(artifactId).filter((e) => e.actor === person.id) : [];
  const recentHere = [...here].reverse().slice(0, 3);
  const across = artifactId ? [] : personEpisodes(person.id, 3);
  return (
    <div>
      <PeekHead
        avatar={<PersonAvatar seed={person.id} name={person.name} size="sm" />}
        title={person.name}
        meta={person.role}
      />
      <div className="mt-2.5 border-t pt-2">
        {artifactId ? (
          recentHere.length > 0 ? (
            <>
              <p className="text-[12px] font-medium text-muted-foreground">In this artifact</p>
              <ul className="mt-1 flex flex-col gap-1">
                {recentHere.map((e) => (
                  <li key={e.id} className="flex items-baseline gap-2 text-[13px] leading-snug text-foreground/80">
                    <span className="min-w-0 flex-1 truncate">{e.summary}</span>
                    <span className="shrink-0 text-[12px] tabular-nums text-muted-foreground">{e.at}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-[13px] text-muted-foreground">Mentioned in this artifact.</p>
          )
        ) : across.length > 0 ? (
          <>
            <p className="text-[12px] font-medium text-muted-foreground">Recent activity</p>
            <ul className="mt-1 flex flex-col gap-1">
              {across.map((e, i) => (
                <li key={i} className="flex items-baseline gap-2 text-[13px] leading-snug text-foreground/80">
                  <span className="min-w-0 flex-1 truncate">
                    {e.summary} <span className="text-muted-foreground">· {e.artifactTitle}</span>
                  </span>
                  <span className="shrink-0 text-[12px] tabular-nums text-muted-foreground">{e.at}</span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-[13px] text-muted-foreground">{person.role}.</p>
        )}
      </div>
    </div>
  );
}

// ——————————————————————————————————————————— decision

export function DecisionPeek({
  decision,
  onJump,
  onAsk,
}: {
  decision: Decision;
  onJump?: (blockId: string) => void;
  onAsk?: (decision: Decision) => void;
}) {
  const m = decisionMeta(decision.id);
  const record = m.record;
  const by = m.by?.name;
  const activation = record?.activation.find((item) => item.prov === "human_verified");
  const candidate = record?.activation.find((item) => item.prov === "ai_generated");
  const changedEvidence = record?.evidence.find((item) => item.state !== "current");
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground">
        <Diamond className="size-3.5" /> Decision
        {record ? <DecisionStateLabel state={record.state} className="ml-auto" /> : null}
      </div>
      <p className="mt-1.5 text-[14px] font-medium leading-snug text-foreground">{decision.text}</p>
      <div className="mt-2.5 grid gap-1.5 border-t pt-2.5 text-[13px] leading-snug">
        {m.verified ? (
          <p className="text-muted-foreground">
            Extracted record verified{by ? ` · recorded by ${by}` : ""}{m.anchor ? ` · ${m.anchor}` : ""}
          </p>
        ) : null}
        {record?.authority ? (
          <p>
            <span className="text-muted-foreground">Authority</span> · {record.authority.name}
            {record.approval ? ` · approved ${record.approval.at} ago` : " · not approved"}
          </p>
        ) : (
          <p className="text-muted-foreground">Authority not assigned</p>
        )}
        {record?.driver ? (
          <p><span className="text-muted-foreground">Driver</span> · {record.driver.name}</p>
        ) : (
          <p className="text-muted-foreground">Driver not assigned</p>
        )}
        {decision.activation_condition ? (
          <p><span className="text-muted-foreground">Counts as active when</span> · {decision.activation_condition}</p>
        ) : null}
        {activation ? (
          <p className="text-primary"><Check className="mr-1 inline size-3" />{activation.system} · {activation.external_id ?? activation.label}</p>
        ) : candidate ? (
          <p className="text-muted-foreground">Candidate evidence · {candidate.system} · {candidate.external_id ?? candidate.label}</p>
        ) : null}
        {changedEvidence ? (
          <p className="text-warn">Changed evidence · {changedEvidence.label}</p>
        ) : null}
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        {m.anchor && m.anchorId && onJump ? (
          <PopoverClose
            onClick={() => onJump(m.anchorId!)}
            className="inline-flex items-center gap-1 text-[13px] font-medium text-primary transition-opacity hover:opacity-80"
          >
            Go to {m.anchor} <ArrowUpRight className="size-3.5" />
          </PopoverClose>
        ) : null}
        <PopoverClose
          nativeButton={false}
          render={<Link href={`/decision/${decision.id}`} />}
          className="inline-flex items-center gap-1 text-[13px] font-medium text-primary transition-opacity hover:opacity-80"
        >
          Open decision <ArrowUpRight className="size-3.5" />
        </PopoverClose>
        {onAsk ? (
          <PopoverClose
            onClick={() => onAsk(decision)}
            className="inline-flex items-center gap-1 text-[13px] font-medium text-primary transition-opacity hover:opacity-80"
          >
            <Sparkles className="size-3.5" /> Ask this decision
          </PopoverClose>
        ) : null}
      </div>
    </div>
  );
}

// ——————————————————————————————————————————— the interactive-entity primitive
// The RULE: every named graph entity surfaced anywhere (person · artifact · collection · source) is click-to-peek
// via THIS, not a plain <span>. Wrap a Ref → a dotted-underline trigger that resolves the right peek card. Bare
// topics (the graph carries only a label) stay plain text.
export function PeekTrigger({ refObj, className }: { refObj: Ref; className?: string }) {
  const person = refObj.kind === "person" ? personById(refObj.id) : undefined;
  const peekable =
    refObj.kind === "artifact" ||
    refObj.kind === "collection" ||
    refObj.kind === "source" ||
    (refObj.kind === "person" && !!person);
  if (!peekable) return <span className={className}>{refObj.label}</span>;
  return (
    <Popover>
      {/* preview on HOVER (openOnHover also handles tap) — a linked field shows its card without a click */}
      <PopoverTrigger
        openOnHover
        delay={160}
        render={
          <button
            type="button"
            className={cn(
              "decoration-muted-foreground/40 underline decoration-dotted underline-offset-2 transition-colors hover:decoration-foreground",
              className,
            )}
          />
        }
      >
        {refObj.label}
      </PopoverTrigger>
      <PopoverContent side="top" align="start" sideOffset={8} className="w-64">
        {refObj.kind === "person" && person ? (
          <PersonPeek person={person} />
        ) : refObj.kind === "source" ? (
          <SourcePeek srcRef={refObj} />
        ) : (
          <LinkPeek linkRef={refObj} />
        )}
      </PopoverContent>
    </Popover>
  );
}

// linkify KNOWN person names inside a free-text string (a change row's rationale, a run result) → each becomes a
// PeekTrigger, so a name mentioned mid-sentence is as interactive as one in the title. Same peek-any-entity rule.
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export function PeekText({ text, className }: { text: string; className?: string }) {
  const people = listPeople();
  if (!text || !people.length) return <span className={className}>{text}</span>;
  const byName = new Map(people.map((p) => [p.name, p]));
  // longest names first so "Dan Lee" wins over a stray "Dan"
  const names = people.map((p) => p.name).sort((a, b) => b.length - a.length);
  const parts = text.split(new RegExp(`(${names.map(escapeRe).join("|")})`, "g"));
  return (
    <span className={className}>
      {parts.map((part, i) => {
        const person = byName.get(part);
        return person ? (
          <PeekTrigger key={i} refObj={{ id: person.id, label: person.name, kind: "person" }} className="text-foreground" />
        ) : (
          part
        );
      })}
    </span>
  );
}
