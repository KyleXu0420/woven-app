"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  ChevronDown,
  Hash,
  ArrowUpRight,
  ArrowRight,
  X,
  Check,
  MessageSquare,
  FileText,
  Users,
  Folder,
  Quote,
  Diamond,
  type LucideIcon,
} from "lucide-react";
import { AgentAvatar } from "./identity";
import { TypeBadge } from "./artifact-ui";
import { EntityProfile } from "./entity-profile";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { collectionById, nodeTimeline, searchEntities } from "@/lib/api";
import type { GraphNode, RefKind } from "@/lib/types";

type Mode = "ask" | "find";

// ───────────────────────────── shared bits
const KIND_ICON: Record<RefKind, LucideIcon> = {
  artifact: FileText,
  collection: Folder,
  person: Users,
  topic: Hash,
  source: Quote,
  decision: Diamond,
};
const GROUPS: { kind: RefKind; label: string }[] = [
  { kind: "person", label: "People" },
  { kind: "topic", label: "Topics" },
  { kind: "collection", label: "Collections" },
  { kind: "artifact", label: "Artifacts" },
  { kind: "decision", label: "Decisions" },
  { kind: "source", label: "Sources" },
];
type Hit = { id: string; label: string; kind: RefKind };

const SCOPES = ["All", "Acme · Product", "Q4 Roadmap", "Growth", "Research"];
const ASK_SOURCES = [
  { n: 1, type: "HTML", title: "Notification Strategy v3", cite: "§ Channels · Open questions", href: "/artifact/a_notif" },
  { n: 2, type: "HTML", title: "Notification Strategy v3", cite: "§ Cadence", href: "/artifact/a_notif" },
  { n: 3, type: "DOC", title: "Q4 Roadmap", cite: "decision · Drop SMS for Q4", href: "/collection/q4-roadmap" },
];
const ASK_RELATED: { label: string; topic?: boolean }[] = [
  { label: "notifications", topic: true },
  { label: "q4-roadmap", topic: true },
  { label: "Maya Chen" },
];

function Cite({ n }: { n: number }) {
  return (
    <sup className="ml-0.5 rounded-[3px] bg-primary/10 px-1 py-0.5 align-super font-mono text-[9px] font-medium text-primary">
      {n}
    </sup>
  );
}

// ───────────────────────────── context — one search, opened in either intent, from anywhere
type Ctx = {
  open: boolean;
  openSearch: (mode?: Mode) => void;
  // an explorer page registers its re-center fn so "Find → Focus on this" re-centers it in place
  registerFocus: (fn: ((id: string) => void) | null) => void;
};
const SearchContext = React.createContext<Ctx | null>(null);

export function useSearch() {
  const c = React.useContext(SearchContext);
  if (!c) throw new Error("useSearch must be used within SearchProvider");
  return c;
}

export function SearchProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const [closing, setClosing] = React.useState(false);
  const [mode, setMode] = React.useState<Mode>("ask");
  const focusFn = React.useRef<((id: string) => void) | null>(null);

  const openSearch = React.useCallback((m: Mode = "ask") => {
    setMode(m);
    setClosing(false);
    setOpen(true);
  }, []);
  const close = React.useCallback(() => {
    setClosing(true);
    window.setTimeout(() => {
      setClosing(false);
      setOpen(false);
    }, 200);
  }, []);
  const registerFocus = React.useCallback((fn: ((id: string) => void) | null) => {
    focusFn.current = fn;
  }, []);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        openSearch("ask");
      } else if (e.key === "/" && !open && tag !== "INPUT" && tag !== "TEXTAREA") {
        e.preventDefault();
        openSearch("find");
      } else if (e.key === "Escape" && open) {
        close();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, openSearch, close]);

  return (
    <SearchContext.Provider value={{ open, openSearch, registerFocus }}>
      {children}
      {open ? (
        <SearchOverlay mode={mode} setMode={setMode} closing={closing} close={close} focusFn={focusFn} />
      ) : null}
    </SearchContext.Provider>
  );
}

// ───────────────────────────── the trigger bar (topbar = ask · explorer = find)
export function SearchBar({ mode, className = "" }: { mode: Mode; className?: string }) {
  const { openSearch } = useSearch();
  const ask = mode === "ask";
  return (
    <button
      type="button"
      onClick={() => openSearch(mode)}
      className={`flex w-full max-w-md items-center gap-2 rounded-lg border bg-card px-3 py-2 text-left outline-none transition-colors hover:border-ring/40 focus-visible:border-ring ${className}`}
    >
      <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground">All</span>
      <span className="flex flex-1 items-center gap-2 text-sm text-muted-foreground">
        <Search className="size-4" /> {ask ? "Ask the org…" : "Focus on anyone or anything…"}
      </span>
      <kbd className="rounded-[5px] border px-1.5 font-mono text-[11px] text-muted-foreground">
        {ask ? "⌘K" : "/"}
      </kbd>
    </button>
  );
}

// ───────────────────────────── the overlay
function SearchOverlay({
  mode,
  setMode,
  closing,
  close,
  focusFn,
}: {
  mode: Mode;
  setMode: (m: Mode) => void;
  closing: boolean;
  close: () => void;
  focusFn: React.MutableRefObject<((id: string) => void) | null>;
}) {
  const router = useRouter();
  const [askQ, setAskQ] = React.useState("How are we handling Q4 notifications?");
  const [findQ, setFindQ] = React.useState("");
  const [scope, setScope] = React.useState("All");
  const [hover, setHover] = React.useState<Hit | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    inputRef.current?.focus();
  }, [mode]);

  const findQuery = findQ.trim();
  const suggested = React.useMemo<Hit[]>(() => searchEntities("", 8), []);
  const results = React.useMemo<Hit[]>(() => (findQuery ? searchEntities(findQ, 60) : []), [findQ, findQuery]);
  const groups = React.useMemo(
    () => GROUPS.map((g) => ({ ...g, items: results.filter((r) => r.kind === g.kind) })).filter((g) => g.items.length),
    [results],
  );
  React.useEffect(() => {
    if (mode === "find") setHover((findQuery ? results[0] : suggested[0]) ?? null);
  }, [mode, findQuery, results, suggested]);

  function goOpen(href: string) {
    router.push(href);
    close();
  }
  // Find → Focus: re-center the explorer in place if one is mounted; otherwise go where the entity lives
  function focusEntity(n: GraphNode) {
    if (focusFn.current) {
      focusFn.current(n.id);
      close();
      return;
    }
    if (n.kind === "artifact") goOpen(`/artifact/${n.id}`);
    else if (n.kind === "collection") {
      const slug = collectionById(n.id)?.slug;
      goOpen(slug ? `/collection/${slug}` : "/library");
    } else if (n.kind === "person") goOpen("/people");
    else if (n.kind === "topic") goOpen("/topics");
    else close();
  }
  function openEntity(n: GraphNode) {
    if (n.kind === "artifact") goOpen(`/artifact/${n.id}`);
    else if (n.kind === "collection") {
      const slug = collectionById(n.id)?.slug;
      if (slug) goOpen(`/collection/${slug}`);
    }
  }
  // the bridge — jump straight to a question about whatever you're previewing
  function askAbout(label: string) {
    setAskQ(`Tell me about ${label}.`);
    setMode("ask");
  }

  const renderRow = (r: Hit) => {
    const Icon = KIND_ICON[r.kind];
    const active = hover?.id === r.id;
    return (
      <button
        key={r.id}
        onMouseEnter={() => setHover(r)}
        onClick={() => focusEntity({ id: r.id, label: r.label, kind: r.kind, depth: 0 })}
        className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${
          active ? "bg-foreground/[0.05]" : "hover:bg-foreground/[0.03]"
        }`}
      >
        <Icon className="size-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate">{r.label}</span>
      </button>
    );
  };

  const previewNode: GraphNode | null = hover
    ? ({ id: hover.id, label: hover.label, kind: hover.kind, depth: 0 } as GraphNode)
    : null;

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col bg-background duration-200 ${
        closing ? "animate-out fade-out-0" : "animate-in fade-in-0"
      }`}
      role="dialog"
      aria-modal="true"
    >
      {/* header band — intent toggle over the search bar */}
      <div className="relative shrink-0 animate-in slide-in-from-top-4 bg-secondary/50 px-6 pt-7 pb-8 duration-300">
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="absolute top-5 right-5 flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
        >
          <X className="size-5" />
        </button>

        {/* intent toggle — one search, two ways to use it */}
        <div className="mx-auto mb-3 flex w-fit items-center gap-0.5 rounded-full border bg-card p-0.5">
          {([["ask", "Ask"], ["find", "Find"]] as [Mode, string][]).map(([m, label]) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded-full px-4 py-1 text-xs font-medium transition-colors ${
                mode === m ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mx-auto flex max-w-2xl items-center gap-2.5 rounded-full border bg-card px-5 py-3.5">
          {mode === "ask" ? (
            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex shrink-0 items-center gap-1 rounded-md bg-secondary px-2 py-1 text-xs font-medium text-muted-foreground outline-none transition-colors hover:text-foreground data-[popup-open]:text-foreground">
                {scope} <ChevronDown className="size-3" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" sideOffset={6} className="w-48">
                {SCOPES.map((s) => (
                  <DropdownMenuItem key={s} onClick={() => setScope(s)} className="gap-2">
                    <Check className={`size-3.5 text-primary ${scope === s ? "opacity-100" : "opacity-0"}`} />
                    {s}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
          <Search className="size-5 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={mode === "ask" ? askQ : findQ}
            onChange={(e) => (mode === "ask" ? setAskQ(e.target.value) : setFindQ(e.target.value))}
            placeholder={mode === "ask" ? "Ask the org…" : "Find anyone or anything…"}
            className="flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
          />
          <kbd className="shrink-0 rounded-[5px] border px-1.5 font-mono text-[10px] text-muted-foreground">
            {mode === "ask" ? "⏎" : "esc"}
          </kbd>
        </div>
      </div>

      {/* body */}
      {mode === "ask" ? (
        <div className="scrollbar-subtle flex-1 overflow-y-auto">
          <div className="mx-auto max-w-2xl px-6 py-8">
            <p className="mb-3 flex items-center gap-2 font-mono text-[11px] text-primary">
              <AgentAvatar size="xs" /> Woven · synthesized from 3 sources in{" "}
              {scope === "All" ? "the workspace" : scope}
            </p>
            <p className="text-base leading-relaxed text-foreground/90">
              Across the Q4 plan, notifications run on three channels — push for time-sensitive nudges,
              email for the weekly digest, and in-app for everything contextual.
              <Cite n={1} /> Cadence is capped at two pushes a day, with quiet hours per workspace.
              <Cite n={2} /> SMS was dropped for Q4.<Cite n={3} /> Still open: whether the agent may send
              its own nudge when it finishes weaving a long artifact.
              <Cite n={1} />
            </p>

            <p className="mt-7 mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Sources
            </p>
            <div className="flex flex-col gap-1">
              {ASK_SOURCES.map((s) => (
                <button
                  key={s.n}
                  onClick={() => goOpen(s.href)}
                  className="group flex items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-foreground/[0.04]"
                >
                  <span className="flex size-5 shrink-0 items-center justify-center rounded bg-primary/10 font-mono text-[10px] font-medium text-primary">
                    {s.n}
                  </span>
                  <TypeBadge type={s.type} />
                  <span className="truncate text-sm font-medium">{s.title}</span>
                  <span className="ml-auto hidden shrink-0 truncate font-mono text-[11px] text-muted-foreground sm:block">
                    {s.cite}
                  </span>
                  <ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </button>
              ))}
            </div>

            {/* discovery — each related entity hands you to Find, focused on it (answer → explore) */}
            <div className="mt-8 flex flex-wrap items-center gap-2 border-t pt-5 text-xs text-muted-foreground">
              <span className="font-mono text-[11px]">related</span>
              {ASK_RELATED.map((r) => (
                <button
                  key={r.label}
                  onClick={() => {
                    setFindQ(r.label);
                    setMode("find");
                  }}
                  className="inline-flex cursor-pointer items-center gap-1 rounded-full border bg-card px-2.5 py-0.5 transition-colors hover:border-ring/40 hover:text-foreground"
                >
                  {r.topic ? <Hash className="size-3" /> : null}
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1">
          {/* left — results */}
          <div className="scrollbar-subtle w-full shrink-0 overflow-y-auto border-r px-3 py-5 sm:w-[26rem] sm:px-5">
            {findQuery ? (
              groups.length ? (
                groups.map((g) => (
                  <div key={g.kind} className="mb-5 last:mb-0">
                    <p className="mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      {g.label}
                    </p>
                    {g.items.map(renderRow)}
                  </div>
                ))
              ) : (
                <p className="px-2 py-12 text-center text-sm text-muted-foreground">No matches for “{findQ}”.</p>
              )
            ) : (
              <div className="mb-5">
                <p className="mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Suggested
                </p>
                {suggested.map(renderRow)}
              </div>
            )}
          </div>

          {/* right — full preview: profile · recent activity · onward actions */}
          <div className="scrollbar-subtle hidden flex-1 overflow-y-auto p-8 sm:block">
            {previewNode ? (
              <div className="mx-auto flex min-h-full max-w-lg flex-col">
                <EntityProfile node={previewNode} placement="inline" />

                <div className="mt-7">
                  <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Recent activity
                  </p>
                  <ol className="flex flex-col gap-3">
                    {nodeTimeline(previewNode.id)
                      .slice(0, 4)
                      .map((ev) => (
                        <li key={ev.id} className="flex gap-2.5">
                          <span className="mt-[5px] size-1.5 shrink-0 rounded-full bg-primary/45" />
                          <p className="min-w-0 flex-1 text-[13px] leading-snug text-foreground/85">
                            {ev.text}
                            <span className="ml-1.5 font-mono text-[11px] text-muted-foreground">· {ev.at}</span>
                          </p>
                        </li>
                      ))}
                  </ol>
                </div>

                <div className="mt-auto flex flex-wrap items-center gap-2 border-t pt-5">
                  <button
                    type="button"
                    onClick={() => focusEntity(previewNode)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-[var(--primary-hover)]"
                  >
                    Focus on this <ArrowRight className="size-4" />
                  </button>
                  {previewNode.kind === "artifact" || previewNode.kind === "collection" ? (
                    <button
                      type="button"
                      onClick={() => openEntity(previewNode)}
                      className="inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-foreground/[0.04] hover:text-foreground"
                    >
                      Open <ArrowUpRight className="size-4" />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => askAbout(previewNode.label)}
                    className="inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-foreground/[0.04] hover:text-foreground"
                  >
                    <MessageSquare className="size-4" /> Ask about this
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Hover a result to preview it.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
