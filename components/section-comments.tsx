"use client";

import * as React from "react";
import { MessageSquare, Send, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { IconButton } from "@/components/ui/icon-button";
import { Valve } from "./proposal";
import { PersonAvatar } from "./identity";
import {
  discussionsForBlock,
  addComment,
  resolveDiscussion,
  startDiscussion,
  personById,
} from "@/lib/api";
import type { Comment, Discussion, DiscussionTag } from "@/lib/types";
import { useGraphVersion } from "@/lib/use-graph-version";
import { notify } from "@/lib/notifications";

// Block-level DISCUSSIONS — the durable rebuild of per-block comments. Comments are no longer a flat,
// ephemeral list: each block hangs off zero or more Discussion threads (episodic, decision-owning). The
// marker stays a quiet margin affordance (a count when threads exist, fading in on section hover when
// none). The popover is the richer part: every thread with its tag, status, comments, and — the key move —
// a teammate's before/after SUGGESTION resolved through the SAME ✓/✕ valve as an agent's proposed edge.

const TAG: Record<DiscussionTag, string> = {
  decision: "bg-primary/10 text-primary",
  question: "bg-muted text-muted-foreground",
  todo: "bg-chart-2/15 text-chart-2",
};

// author is always the demo PM — the one confirming/replying in this session
const ME = "pe_maya";

// render a comment body, inking @mentions (any whitespace token starting with "@") in primary
function renderBody(text: string): React.ReactNode {
  return text.split(/(\s+)/).map((tok, i) =>
    tok.startsWith("@") && tok.length > 1 ? (
      <span key={i} className="font-medium text-primary">
        {tok}
      </span>
    ) : (
      <React.Fragment key={i}>{tok}</React.Fragment>
    ),
  );
}

function truncate(s: string, n: number): string {
  const t = s.trim();
  return t.length > n ? t.slice(0, n).trimEnd() + "…" : t;
}

// one input + send button — shared by a thread's reply and the empty-state "start a thread"
function Compose({
  value,
  onChange,
  onSubmit,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  placeholder: string;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="flex items-center gap-1.5"
    >
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 rounded-md bg-muted/40 px-2 py-1 text-[14px] outline-none transition-colors placeholder:text-muted-foreground focus:bg-muted/60"
      />
      <IconButton label="Send" variant="default" size="icon-sm" type="submit" disabled={!value.trim()}>
        <Send className="size-3.5" />
      </IconButton>
    </form>
  );
}

export function SectionComments({
  artifactId,
  blockId,
  onApplySuggestion,
}: {
  artifactId: string;
  blockId: string;
  onApplySuggestion?: (blockId: string, after: string) => void;
}) {
  useGraphVersion(); // re-render after add/resolve/start (each mutation bumpGraph()s)
  const list = discussionsForBlock(artifactId, blockId);
  const has = list.length > 0;
  const anyOpen = list.some((d) => d.status === "open");

  // per-thread reply drafts (keyed by discussion id) + the empty-state starter
  const [replies, setReplies] = React.useState<Record<string, string>>({});
  const [starter, setStarter] = React.useState("");

  function resolveThread(d: Discussion) {
    resolveDiscussion(d.id);
    notify.success("Discussion resolved");
  }

  // a teammate's suggestion resolves through the SAME valve as an agent's proposed edge:
  // ✓ applies the after-text to the block, then settles the thread; ✕ just settles it.
  function acceptSuggestion(d: Discussion, c: Comment) {
    if (c.suggestion) onApplySuggestion?.(c.suggestion.blockId, c.suggestion.after);
    resolveDiscussion(d.id);
    notify.success("Suggestion applied");
  }
  function dismissSuggestion(d: Discussion) {
    resolveDiscussion(d.id);
    notify.info("Suggestion dismissed");
  }

  function sendReply(d: Discussion) {
    const text = (replies[d.id] ?? "").trim();
    if (!text) return;
    addComment(d.id, { author: ME, text });
    setReplies((r) => ({ ...r, [d.id]: "" }));
    notify.success("Reply added");
  }

  function startThread() {
    const text = starter.trim();
    if (!text) return;
    const d = startDiscussion({ artifactId, blockId, title: truncate(text, 60), author: ME });
    addComment(d.id, { author: ME, text });
    setStarter("");
    notify.success("Thread started");
  }

  return (
    <Popover>
      <PopoverTrigger
        aria-label={has ? `${list.length} discussion${list.length > 1 ? "s" : ""}` : "Start a discussion"}
        className={cn(
          "inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[12px] font-medium transition-colors outline-none",
          has
            ? cn(
                "hover:bg-foreground/[0.06] hover:text-foreground data-[popup-open]:text-foreground",
                anyOpen ? "text-muted-foreground" : "text-muted-foreground/60",
              )
            : "text-transparent group-hover/sec:text-muted-foreground/70 hover:bg-foreground/[0.06] hover:!text-foreground data-[popup-open]:text-foreground",
        )}
      >
        <MessageSquare className="size-3.5" />
        {has ? list.length : null}
        {has && !anyOpen ? <Check className="size-3 text-primary/70" /> : null}
      </PopoverTrigger>

      <PopoverContent align="start" side="bottom" className="w-80 p-0">
        <div className="scrollbar-subtle max-h-[26rem] overflow-y-auto">
          {has ? (
            list.map((d, i) => (
              <div key={d.id}>
                {i > 0 ? <div className="mx-3 h-px bg-border" /> : null}
                <div className="p-3">
                  {/* header — tag pill · title · status/resolve */}
                  <div className="flex items-center gap-2">
                    {d.tag ? (
                      <span
                        className={cn(
                          "shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium capitalize",
                          TAG[d.tag],
                        )}
                      >
                        {d.tag}
                      </span>
                    ) : null}
                    <span className="min-w-0 flex-1 truncate text-[14px] font-medium">{d.title}</span>
                    {d.status === "resolved" ? (
                      <span className="inline-flex shrink-0 items-center gap-1 text-[12px] font-medium text-primary">
                        <Check className="size-3" /> Resolved
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => resolveThread(d)}
                        className="shrink-0 rounded-md px-1.5 py-0.5 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
                      >
                        Resolve
                      </button>
                    )}
                  </div>

                  {/* comments */}
                  <div className="mt-2.5 flex flex-col gap-3">
                    {d.comments.map((c) => {
                      const name = personById(c.author)?.name ?? c.author;
                      return (
                        <div key={c.id} className="flex gap-2">
                          <PersonAvatar seed={c.author} name={name} size="xs" className="mt-0.5" />
                          <div className="min-w-0 flex-1">
                            <p className="text-[13px] leading-tight">
                              <span className="font-medium">{name}</span>{" "}
                              <span className="font-mono text-[11px] text-muted-foreground">{c.at}</span>
                            </p>
                            <p className="mt-0.5 text-[14px] leading-snug text-foreground/85">
                              {renderBody(c.text)}
                            </p>

                            {/* a suggestion — a concrete before→after on the block, resolved via the valve */}
                            {c.kind === "suggestion" && c.suggestion ? (
                              <div className="mt-1.5">
                                <div className="flex flex-col gap-1 text-[13px] leading-snug">
                                  <span className="text-muted-foreground line-through">
                                    {c.suggestion.before}
                                  </span>
                                  <span className="rounded bg-primary/[0.06] px-1 py-0.5 text-foreground">
                                    {c.suggestion.after}
                                  </span>
                                </div>
                                <div className="mt-1.5 flex justify-end">
                                  <Valve
                                    size="icon-xs"
                                    confirmLabel="Accept"
                                    dismissLabel="Dismiss"
                                    onConfirm={() => acceptSuggestion(d, c)}
                                    onDismiss={() => dismissSuggestion(d)}
                                  />
                                </div>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* reply — allowed whether open or resolved */}
                  <div className="mt-3">
                    <Compose
                      value={replies[d.id] ?? ""}
                      onChange={(v) => setReplies((r) => ({ ...r, [d.id]: v }))}
                      onSubmit={() => sendReply(d)}
                      placeholder="Reply…"
                    />
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="flex flex-col gap-2.5 p-3">
              <p className="text-[13px] leading-snug text-muted-foreground">
                No discussion here yet. Start a thread to capture a decision, question, or to-do.
              </p>
              <Compose
                value={starter}
                onChange={setStarter}
                onSubmit={startThread}
                placeholder="Start a thread…"
              />
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
