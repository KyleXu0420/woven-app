"use client";

import {
  FileText,
  PencilLine,
  AtSign,
  Link2,
  Check,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { PersonAvatar, AgentAvatar } from "./identity";
import { nodeTimeline, personById, type TimelineEvent } from "@/lib/api";
import type { GraphNode } from "@/lib/types";

const KIND_ICON: Record<TimelineEvent["kind"], LucideIcon> = {
  created: FileText,
  edited: PencilLine,
  mentioned: AtSign,
  linked: Link2,
  confirmed: Check,
  proposed: Sparkles,
};

// the dot on the rail — a person avatar when there's an actor, the agent mark for Woven's own
// actions, otherwise a quiet kind icon.
function EventLead({ ev }: { ev: TimelineEvent }) {
  if (ev.agent) return <AgentAvatar size="md" />;
  if (ev.actor) {
    const p = personById(ev.actor);
    return <PersonAvatar seed={ev.actor} name={p?.name ?? ev.actor} size="md" />;
  }
  const Icon = KIND_ICON[ev.kind] ?? FileText;
  return (
    <span className="flex size-7 items-center justify-center rounded-full bg-muted text-muted-foreground">
      <Icon className="size-3.5" />
    </span>
  );
}

// Timeline view — the focused entity's history as a vertical thread. The graph answers "what does it
// connect to"; this answers "what has it been through". Same entity, the time axis instead of links.
export function TimelineView({ center }: { center: GraphNode }) {
  const events = nodeTimeline(center.id);

  return (
    <div className="px-5 py-7 sm:px-10 sm:py-9">
      <p className="mb-7 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {center.label} · history
      </p>
      <ol className="space-y-0">
        {events.map((ev, i) => {
          const last = i === events.length - 1;
          return (
            <li key={ev.id} className="flex gap-3.5">
              {/* rail — the dot, with a hairline connector dropping toward the next event */}
              <div className="flex flex-col items-center">
                <EventLead ev={ev} />
                {!last ? <span className="mt-1 w-px flex-1 bg-border" /> : null}
              </div>
              {/* event */}
              <div className={last ? "pb-0" : "pb-7"}>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {ev.at}
                  </span>
                  {ev.agent ? (
                    <span className="rounded-full bg-primary/10 px-1.5 py-px text-[9px] font-medium uppercase tracking-wide text-primary">
                      Woven
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-sm leading-snug">{ev.text}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
