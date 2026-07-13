"use client";

// ⌘K — Woven's single keyboard SHUTTLE into the collective brain. ONE adaptive input (no Ask/Find toggle,
// matching the edit-bar doctrine): a deterministic router reads each query and produces a RANKED UNION of
// four flat lanes — Navigate · Act · Find · Answer — rendered in the app's one row grammar. The classifier
// sets RANK, never VISIBILITY, so a misroute costs one ↓ (or Tab to re-route in place). The differentiated
// result is the Answer: a CITED, single-center evidence answer (askArtifact/askGraph — honest template
// output, NOT synthesis) whose cited pending edges are VERIFIABLE IN PLACE via the shared ✓/✕ valve.

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  Search,
  ChevronDown,
  ChevronRight,
  Hash,
  ArrowUpRight,
  ArrowRight,
  X,
  Check,
  FileText,
  Users,
  Folder,
  Quote,
  Diamond,
  Sparkles,
  Home,
  Inbox,
  Library,
  Activity,
  Network,
  GitBranch,
  Download,
  FolderPlus,
  Send,
  ShieldCheck,
  CornerDownLeft,
  type LucideIcon,
} from "lucide-react";
import { AgentAvatar } from "./identity";
import { EntityProfile } from "./entity-profile";
import { SourcePeek, PersonPeek } from "./entity-peek";
import { Section, Row, RowList } from "./today-ui";
import { IconButton } from "@/components/ui/icon-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useGraphVersion } from "@/lib/use-graph-version";
import {
  addArtifactsToCollection,
  answerQuery,
  canView,
  collectionById,
  deriveOwners,
  getArtifact,
  listCollections,
  listPending,
  personById,
  publishArtifact,
  recentEpisodes,
  refOf,
  searchEntities,
  sourceById,
  topicById,
  verifyEdge,
  viewerRecents,
} from "@/lib/api";
import { EXPORT_FORMATS, buildExport, downloadFile } from "@/lib/export";
import type { GraphNode, Person, Ref, RefKind } from "@/lib/types";

const VIEWER = "pe_maya";

const KIND_ICON: Record<RefKind, LucideIcon> = {
  artifact: FileText,
  collection: Folder,
  person: Users,
  topic: Hash,
  source: Quote,
  decision: Diamond,
};

// the pages ⌘K can jump to — the Navigate lane's fixed targets (entities are added dynamically)
const PAGES: { label: string; href: string; icon: LucideIcon; tokens: string[] }[] = [
  { label: "Today", href: "/today", icon: Home, tokens: ["today", "home"] },
  { label: "Inbox", href: "/inbox", icon: Inbox, tokens: ["inbox", "verify", "queue", "decisions"] },
  { label: "Library", href: "/library", icon: Library, tokens: ["library", "docs", "artifacts", "files"] },
  { label: "Activity", href: "/activity", icon: Activity, tokens: ["activity", "updates", "feed"] },
  { label: "Team", href: "/team", icon: Network, tokens: ["team", "map", "graph"] },
  { label: "Topics", href: "/topics", icon: Hash, tokens: ["topics", "tags"] },
  { label: "People", href: "/people", icon: Users, tokens: ["people", "who"] },
];

const SCOPES = ["All", "Acme · Product", "Q4 Roadmap", "Growth", "Research"];

// ───────────────────────── deterministic router (no LLM in the prototype — rule-based, honest)
type Intent = "answer" | "navigate" | "act" | "find";
const RX_WH = /^(who|what|when|where|why|how|which|whose|is|are|does|do|can|should|could|will)\b/i;
const RX_IMPERATIVE = /^(verify|export|add|publish|open|share|archive|new|create|remove|delete)\b/i;
const RX_WHO_OWNS = /\bwho\s+(owns?|leads?|knows?|runs?|manages?|owns)\b/i;

function classify(q: string): Intent {
  const s = q.trim();
  if (!s) return "navigate";
  if (s.startsWith(">")) return "act";
  if (s.startsWith("?")) return "answer";
  if (s.startsWith("@") || s.startsWith("#")) return "find";
  if (RX_WH.test(s) || s.endsWith("?")) return "answer";
  if (RX_IMPERATIVE.test(s)) return "act";
  if (PAGES.some((p) => p.tokens.some((t) => t === s.toLowerCase() || t.startsWith(s.toLowerCase())))) return "navigate";
  return "find";
}
// strip a leading prefix key/verb so the rest is the real query
function stripPrefix(q: string): string {
  return q.replace(/^[>?@#]\s*/, "").replace(RX_IMPERATIVE, "").trim() || q.replace(/^[>?@#]\s*/, "").trim();
}
const INTENT_TONE: Record<Intent, string> = { answer: "answer", navigate: "go to", act: "run", find: "find" };

// ───────────────────────── context — one search, opened from anywhere, no mode
type Scope = { kind: "artifact"; id: string; title: string } | { kind: "space"; label: string };
type Ctx = {
  open: boolean;
  openSearch: (query?: string) => void; // seed the line; the router classifies it exactly like typed text
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
  const [seed, setSeed] = React.useState("");
  const [scope, setScope] = React.useState<Scope>({ kind: "space", label: "Acme · Product" });
  const focusFn = React.useRef<((id: string) => void) | null>(null);
  const pathname = usePathname();
  const pathRef = React.useRef(pathname);
  pathRef.current = pathname;

  const openSearch = React.useCallback((query = "") => {
    // capture the scope AT OPEN — the full-screen overlay hides the underlying view, so the chip is the only
    // carrier of act-context. An artifact page → that artifact is the scope; otherwise the space.
    const m = pathRef.current?.match(/\/artifact\/([^/?#]+)/);
    if (m) {
      const a = getArtifact(m[1]);
      setScope(a ? { kind: "artifact", id: a.id, title: a.title } : { kind: "space", label: "Acme · Product" });
    } else {
      setScope({ kind: "space", label: "Acme · Product" });
    }
    setSeed(query);
    setClosing(false);
    setOpen(true);
  }, []);
  const close = React.useCallback(() => {
    setClosing(true);
    window.setTimeout(() => {
      setClosing(false);
      setOpen(false);
    }, 180);
  }, []);
  const registerFocus = React.useCallback((fn: ((id: string) => void) | null) => {
    focusFn.current = fn;
  }, []);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        openSearch();
      } else if (e.key === "/" && !open && tag !== "INPUT" && tag !== "TEXTAREA") {
        e.preventDefault();
        openSearch();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, openSearch]);

  return (
    <SearchContext.Provider value={{ open, openSearch, registerFocus }}>
      {children}
      {open ? (
        <SearchOverlay key={seed} seed={seed} scope={scope} closing={closing} close={close} focusFn={focusFn} />
      ) : null}
    </SearchContext.Provider>
  );
}

// ───────────────────────── the trigger bar (topbar) — no mode; it just opens the shuttle
export function SearchBar({ className = "" }: { mode?: string; className?: string }) {
  const { openSearch } = useSearch();
  return (
    <button
      type="button"
      onClick={() => openSearch()}
      className={cn(
        "flex w-full max-w-md items-center gap-2 rounded-lg border bg-card px-3 py-2 text-left outline-none transition-colors hover:border-ring/40 focus-visible:border-ring",
        className,
      )}
    >
      <span className="flex flex-1 items-center gap-2 text-[15px] text-muted-foreground">
        <Search className="size-4" /> Search or run a command…
      </span>
      <kbd className="rounded-[5px] border px-1.5 font-mono text-[12px] text-muted-foreground">⌘K</kbd>
    </button>
  );
}

// ───────────────────────── one activatable item in a lane (the flat cursor moves across these)
type Item = {
  key: string;
  icon?: LucideIcon;
  marker?: React.ReactNode;
  label: React.ReactNode;
  trailing?: React.ReactNode;
  ref?: Ref; // enables the → peek
  activate: () => void;
  valveEdgeId?: string; // a pending edge → the ✓/✕ valve (the one forest moment)
};
type Lane = { title: string; count?: number; items: Item[] };

// ───────────────────────── the overlay
function SearchOverlay({
  seed,
  scope,
  closing,
  close,
  focusFn,
}: {
  seed: string;
  scope: Scope;
  closing: boolean;
  close: () => void;
  focusFn: React.MutableRefObject<((id: string) => void) | null>;
}) {
  const router = useRouter();
  useGraphVersion();
  const [q, setQ] = React.useState(seed);
  const [scopeName, setScopeName] = React.useState(scope.kind === "space" ? scope.label : "Acme · Product");
  const [cursor, setCursor] = React.useState(0);
  const [peekId, setPeekId] = React.useState<string | null>(null);
  const [drill, setDrill] = React.useState<null | { kind: "collection" | "export" | "publish"; id: string; title: string }>(null);
  const [reroute, setReroute] = React.useState(0); // Tab cycles the primary lane to the next
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => inputRef.current?.focus(), []);

  const query = q.trim();
  const baseIntent = classify(q);
  // Tab re-routes: rotate the lane order without changing the query
  const order: Intent[] = React.useMemo(() => {
    const all: Intent[] = ["answer", "navigate", "act", "find"];
    const primary = all[(all.indexOf(baseIntent) + reroute) % all.length];
    return [primary, ...all.filter((i) => i !== primary)];
  }, [baseIntent, reroute]);

  function go(href: string) {
    router.push(href);
    close();
  }
  function focusEntity(n: GraphNode) {
    if (focusFn.current) {
      focusFn.current(n.id);
      close();
      return;
    }
    if (n.kind === "artifact") go(`/artifact/${n.id}`);
    else if (n.kind === "collection") {
      const slug = collectionById(n.id)?.slug;
      go(slug ? `/collection/${slug}` : "/library");
    } else if (n.kind === "person") go(`/people?focus=${n.id}`);
    else if (n.kind === "topic") go(`/topics?focus=${n.id}`);
    else close();
  }

  // the Act verbs for the captured artifact scope — reused by the Act lane (typed) AND surfaced at the top
  // of the zero-state (you opened ⌘K ON a doc → acting on it is a first-class option, no typing required)
  const docActs = React.useMemo<Item[]>(() => {
    if (scope.kind !== "artifact") return [];
    const t = scope.title;
    return [
      { key: "act-verify", icon: ShieldCheck, label: `Verify pending links`, trailing: <RunHint />, activate: () => go(`/artifact/${scope.id}`) },
      { key: "act-export", icon: Download, label: `Export`, trailing: <RunHint />, activate: () => setDrill({ kind: "export", id: scope.id, title: t }) },
      { key: "act-add", icon: FolderPlus, label: `Add to a collection`, trailing: <RunHint />, activate: () => setDrill({ kind: "collection", id: scope.id, title: t }) },
      { key: "act-pub", icon: Send, label: `Publish`, trailing: <RunHint />, activate: () => setDrill({ kind: "publish", id: scope.id, title: t }) },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);

  // ── the honest answer (single-center, cited) — who-owns is routed to deriveOwners, never answerQuery ──
  const answer = React.useMemo(() => {
    if (!query || !order.includes("answer") || order[0] !== "answer") return null;
    const docId = scope.kind === "artifact" ? scope.id : undefined;
    if (RX_WHO_OWNS.test(query)) {
      // strip the "who owns …" frame so the salient noun ("onboarding") resolves the topic
      const term = query.replace(RX_WHO_OWNS, "").replace(/[?.]/g, "").trim();
      const topic = searchEntities(term || query, 3, { kinds: ["topic"], viewer: VIEWER })[0];
      const owners = topic && !topic.restricted ? deriveOwners(topic.id) : [];
      if (owners.length) {
        return {
          mode: "owners" as const,
          centerLabel: topic!.label,
          centerKind: "topic" as RefKind,
          text: `${owners.map((o) => o.person.name).slice(0, 3).join(", ")} — derived from who authored and is mentioned across ${topic!.label}.`,
          owners,
        };
      }
    }
    const a = answerQuery(query, { docId, viewer: VIEWER });
    return { mode: a.mode, centerLabel: a.centerLabel, centerKind: a.centerKind, text: a.answer, cites: a.cites, hedged: a.hedged };
  }, [query, order, scope]);

  // ── build the lanes (ranked union) ──
  const lanes = React.useMemo<Lane[]>(() => {
    if (!q.trim()) return []; // empty → the zero-state orient owns the screen, not a page list
    const out: Record<Intent, Lane[]> = { answer: [], navigate: [], act: [], find: [] };
    const term = stripPrefix(q);

    // NAVIGATE — page tokens + the single strongest entity
    const navItems: Item[] = [];
    for (const p of PAGES) {
      if (!term || p.label.toLowerCase().includes(term.toLowerCase()) || p.tokens.some((t) => t.startsWith(term.toLowerCase()))) {
        navItems.push({ key: `nav-${p.href}`, icon: p.icon, label: p.label, trailing: <GoHint />, activate: () => go(p.href) });
      }
    }
    // Navigate = pages only; named entities live in Find (its top result + ⏎ is the "jump straight there"),
    // so we don't echo the same entity in two lanes.
    if (navItems.length) out.navigate.push({ title: "Navigate", items: navItems.slice(0, 7) });

    // ACT — verbs scoped to what was captured at open (artifact scope reuses docActs)
    const actItems: Item[] =
      scope.kind === "artifact"
        ? docActs
        : [{ key: "act-queue", icon: ShieldCheck, label: "Open the verify queue", trailing: <RunHint />, activate: () => go("/inbox") }];
    const actTerm = term.toLowerCase();
    const actFiltered =
      actTerm && baseIntent !== "act" ? actItems.filter((i) => String(i.label).toLowerCase().includes(actTerm)) : actItems;
    if (actFiltered.length && (baseIntent === "act" || !term || actFiltered.length < actItems.length))
      out.act.push({ title: scope.kind === "artifact" ? "On this artifact" : "Actions", items: actFiltered });

    // FIND — entities grouped by kind + any pending edges that match
    if (term) {
      const hits = searchEntities(term, 40, { viewer: VIEWER, includeRestricted: true });
      const GROUPS: { kind: RefKind; label: string }[] = [
        { kind: "person", label: "People" },
        { kind: "topic", label: "Topics" },
        { kind: "collection", label: "Collections" },
        { kind: "artifact", label: "Artifacts" },
        { kind: "decision", label: "Decisions" },
        { kind: "source", label: "Sources" },
      ];
      for (const g of GROUPS) {
        const items: Item[] = hits
          .filter((h) => h.kind === g.kind)
          .slice(0, 6)
          .map((h) => {
            if (h.restricted)
              return { key: `find-${h.id}`, icon: KIND_ICON[h.kind], label: <span className="text-muted-foreground">Restricted {h.kind}</span>, trailing: <span className="text-[12px] text-muted-foreground">request access</span>, activate: () => {} };
            const r: Ref = { id: h.id, label: h.label, kind: h.kind };
            return { key: `find-${h.id}`, icon: KIND_ICON[h.kind], label: h.label, ref: r, activate: () => focusEntity({ ...r, depth: 0 } as GraphNode) };
          });
        if (items.length) out.find.push({ title: g.label, items });
      }
    }

    // ANSWER lane placeholder — the rich answer block renders separately; its Sources + Branch are items
    // (built in render). Here we only need the "Ask Woven" fallback row when Answer isn't primary.

    // assemble in ranked order
    const result: Lane[] = [];
    for (const intent of order) result.push(...out[intent]);
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, order, scope, baseIntent, docActs]);

  // ── zero-state (orient) ──
  const zero = React.useMemo(() => {
    if (query) return null;
    const recents = viewerRecents(VIEWER, 5);
    const away = recentEpisodes(4, VIEWER);
    const pending = listPending().slice(0, 3);
    return { recents, away, pending };
  }, [query]);

  // ── flatten every activatable item for the keyboard cursor ──
  const answerItems: Item[] = React.useMemo(() => {
    if (!answer) return [];
    const items: Item[] = [];
    if (answer.mode === "owners" && "owners" in answer && answer.owners) {
      for (const o of answer.owners) {
        const r: Ref = { id: o.person.id, label: o.person.name, kind: "person" };
        items.push({ key: `ans-owner-${o.person.id}`, marker: <AgentDot kind="person" />, icon: Users, label: o.person.name, trailing: <span className="text-[12px] text-muted-foreground">{o.person.role}</span>, ref: r, activate: () => focusEntity({ ...r, depth: 0 } as GraphNode) });
      }
    } else if ("cites" in answer && answer.cites) {
      for (let i = 0; i < answer.cites.length; i++) {
        const c = answer.cites[i];
        items.push({
          key: `ans-cite-${i}`,
          marker: <span className="flex size-5 items-center justify-center rounded bg-foreground/[0.06] font-mono text-[11px] font-medium text-muted-foreground">{i + 1}</span>,
          label: c.label,
          trailing: c.block_id || c.href ? <ArrowUpRight className="size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover/row:opacity-100" /> : undefined,
          activate: () => (c.href ? go(c.href) : answer.centerLabel ? undefined : undefined),
        });
      }
    }
    return items;
  }, [answer]);

  const flat = React.useMemo(() => {
    const f: Item[] = [...answerItems];
    for (const l of lanes) f.push(...l.items);
    if (zero) {
      f.push(
        ...docActs,
        ...zero.recents.map((r): Item => ({ key: `z-rec-${r.id}`, icon: KIND_ICON[r.kind], label: r.label, trailing: <span className="text-[12px] tabular-nums text-muted-foreground">{r.at}</span>, ref: refOf(r.id), activate: () => focusEntity({ ...refOf(r.id), depth: 0 } as GraphNode) })),
        ...zero.away.map((e): Item => ({ key: `z-away-${e.id}`, icon: FileText, label: getArtifact(e.artifactId)?.title ?? "an artifact", trailing: <span className="text-[12px] tabular-nums text-muted-foreground">{e.at}</span>, activate: () => go(`/artifact/${e.artifactId}`) })),
        ...zero.pending.map((p): Item => ({ key: `z-pend-${p.edge_id}`, icon: KIND_ICON[p.toKind], label: p.toLabel, valveEdgeId: p.edge_id, activate: () => go(`/artifact/${p.fromKind === "artifact" ? p.fromId : p.toId}`) })),
        ...QUESTIONS.map((qq): Item => ({ key: `z-ask-${qq}`, marker: <Sparkles className="size-4 text-primary" />, label: qq, trailing: <ArrowUpRight className="size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover/row:opacity-100" />, activate: () => setQ(qq) })),
      );
    }
    return f;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answerItems, lanes, zero, docActs]);

  React.useEffect(() => setCursor(0), [q, reroute]);
  const activeKey = flat[cursor]?.key;

  // ── keyboard ──
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        if (peekId) return setPeekId(null);
        if (drill) return setDrill(null);
        return close();
      }
      if (e.key === "Tab") {
        e.preventDefault();
        setReroute((r) => r + 1);
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setPeekId(null);
        setCursor((c) => Math.min(c + 1, flat.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setPeekId(null);
        setCursor((c) => Math.max(c - 1, 0));
      } else if (e.key === "ArrowRight") {
        const it = flat[cursor];
        if (it?.ref) {
          e.preventDefault();
          setPeekId((p) => (p === it.key ? null : it.key));
        }
      } else if (e.key === "Enter") {
        e.preventDefault();
        if ((e.metaKey || e.ctrlKey) && query) return setQ(query.endsWith("?") ? query : `${query}?`); // ⌘↵ = ask raw
        flat[cursor]?.activate();
      } else if (e.key === "Backspace" && q === "" && drill) {
        setDrill(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flat, cursor, peekId, drill, q, query, close]);

  const tone = query ? INTENT_TONE[order[0]] : "ready";

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex flex-col bg-background duration-200",
        closing ? "animate-out fade-out-0" : "animate-in fade-in-0",
      )}
      role="dialog"
      aria-modal="true"
    >
      {/* header — one hero bar (rounded-lg, no pill morph, no mode toggle); read-back tone leads, scope trails */}
      <div className="shrink-0 animate-in slide-in-from-top-4 bg-secondary/50 px-6 py-6 duration-300">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <div className="flex flex-1 items-center gap-2.5 rounded-lg border bg-card py-2.5 pl-3 pr-3">
            <span className="inline-flex shrink-0 items-center gap-1.5 font-mono text-[12px] text-muted-foreground">
              {tone === "answer" ? <Sparkles className="size-3.5" /> : <Search className="size-3.5" />}
              {tone}
            </span>
            <span className="h-5 w-px shrink-0 bg-border" />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search, ask a question, or run a command…"
              className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
            />
            <ScopeChip scope={scope} name={scopeName} setName={setScopeName} />
            <kbd className="shrink-0 rounded-[5px] border px-1.5 font-mono text-[11px] text-muted-foreground">
              {query ? "⏎" : "esc"}
            </kbd>
          </div>
          <IconButton label="Close" size="icon-lg" onClick={close}>
            <X className="size-5" />
          </IconButton>
        </div>
      </div>

      {/* body — one 2xl spine, flat Row Sections; no two-pane, peek is inline-on-demand */}
      <div className="scrollbar-subtle flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-6 py-7">
          {drill ? (
            <DrillView drill={drill} onClose={() => setDrill(null)} afterRun={close} />
          ) : (
            <>
              {answer ? (
                <AnswerBlock answer={answer} items={answerItems} activeKey={activeKey} peekId={peekId} setPeek={setPeekId} onBranch={() => (answer.centerLabel ? go("/team") : undefined)} />
              ) : null}

              {lanes.map((lane) => (
                <Section key={lane.title} label={lane.title} className={answer ? "mt-6" : undefined}>
                  <RowList>
                    {lane.items.map((it) => (
                      <ItemRow key={it.key} it={it} active={it.key === activeKey} peeked={peekId === it.key} setPeek={setPeekId} />
                    ))}
                  </RowList>
                </Section>
              ))}

              {/* Ask fallback — when Answer isn't the primary lane, one row promotes the raw query to Ask (⌘↵) */}
              {query && order[0] !== "answer" ? (
                <Section label="Ask" className="mt-6">
                  <RowList>
                    <Row marker={<Sparkles className="size-4 text-primary" />} onClick={() => setQ(query.endsWith("?") ? query : `${query}?`)} trailing={<kbd className="rounded-[5px] border px-1.5 font-mono text-[11px] text-muted-foreground">⌘⏎</kbd>}>
                      <span className="text-[14px]">Ask Woven about “{query}”</span>
                    </Row>
                  </RowList>
                </Section>
              ) : null}

              {zero && docActs.length ? (
                <Section label="On this artifact">
                  <RowList>
                    {docActs.map((it) => (
                      <ItemRow key={it.key} it={it} active={it.key === activeKey} peeked={false} setPeek={setPeekId} />
                    ))}
                  </RowList>
                </Section>
              ) : null}
              {zero ? (
                <ZeroState zero={zero} first={docActs.length === 0} activeKey={activeKey} peekId={peekId} setPeek={setPeekId} onEntity={(r) => focusEntity({ ...r, depth: 0 } as GraphNode)} onArtifact={(id) => go(`/artifact/${id}`)} onAsk={(qq) => setQ(qq)} />
              ) : null}

              {query && flat.length === 0 ? (
                <p className="px-2 py-16 text-center text-[15px] text-muted-foreground">No matches for “{query}”. Press ⌘⏎ to ask Woven.</p>
              ) : null}
            </>
          )}
        </div>
      </div>

      {/* footer — the keyboard model, Raycast/Linear muscle memory */}
      <div className="shrink-0 border-t bg-secondary/30 px-6 py-2.5">
        <div className="mx-auto flex max-w-2xl flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[12px] text-muted-foreground">
          <Hint k="↑↓" l="move" />
          <Hint k="⏎" l="open" />
          <Hint k="⌘⏎" l="ask raw" />
          <Hint k="→" l="peek" />
          <Hint k="Tab" l="re-route" />
          <Hint k="> @ # ?" l="prefixes" />
          <Hint k="esc" l="close" />
        </div>
      </div>
    </div>
  );
}

const QUESTIONS = ["What changed across Q4 planning this week?", "Who owns onboarding?", "What's blocking the launch?"];

// ───────────────────────── small pieces
function GoHint() {
  return <span className="hidden items-center gap-1 text-[12px] text-muted-foreground group-hover/row:flex">Go to <CornerDownLeft className="size-3" /></span>;
}
function RunHint() {
  return <ChevronRight className="size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover/row:opacity-100" />;
}
function Hint({ k, l }: { k: string; l: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <kbd className="rounded-[4px] border px-1 py-px">{k}</kbd> {l}
    </span>
  );
}
function AgentDot({ kind }: { kind: RefKind }) {
  const Icon = KIND_ICON[kind];
  return <Icon className="size-4 text-muted-foreground" />;
}

function ScopeChip({ scope, name, setName }: { scope: Scope; name: string; setName: (s: string) => void }) {
  if (scope.kind === "artifact") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-secondary px-2 py-1 text-[12px] font-medium text-muted-foreground">
        <FileText className="size-3" /> {scope.title.length > 22 ? scope.title.slice(0, 22) + "…" : scope.title}
      </span>
    );
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[12px] font-medium text-muted-foreground outline-none transition-colors hover:bg-secondary hover:text-foreground data-[popup-open]:bg-secondary data-[popup-open]:text-foreground">
        {name} <ChevronDown className="size-3" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={6} className="w-48">
        {SCOPES.map((s) => (
          <DropdownMenuItem key={s} onClick={() => setName(s)} className="gap-2">
            <Check className={cn("size-3.5 text-primary", name === s ? "opacity-100" : "opacity-0")} /> {s}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// a lane row with an optional inline peek beneath it
function ItemRow({ it, active, peeked, setPeek }: { it: Item; active: boolean; peeked: boolean; setPeek: (k: string | null) => void }) {
  return (
    <div>
      <Row
        active={active}
        marker={it.marker ?? (it.icon ? <it.icon className="size-4 text-muted-foreground" /> : undefined)}
        onClick={it.activate}
        interactiveTrailing={!!(it.valveEdgeId || it.ref)}
        trailing={
          it.valveEdgeId ? (
            <Valve edgeId={it.valveEdgeId} />
          ) : (
            <span className="flex items-center gap-2">
              {it.trailing}
              {it.ref ? (
                <button type="button" onClick={(e) => { e.stopPropagation(); setPeek(peeked ? null : it.key); }} className="text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover/row:opacity-100" aria-label="Preview">
                  <ChevronRight className={cn("size-4 transition-transform", peeked && "rotate-90")} />
                </button>
              ) : null}
            </span>
          )
        }
      >
        <span className="truncate text-[14px]">{it.label}</span>
      </Row>
      {peeked && it.ref ? <PeekPanel refItem={it.ref} /> : null}
    </div>
  );
}

// inline peek — EntityProfile for artifact/topic/collection/decision; entity-peek variants for source/person
function PeekPanel({ refItem }: { refItem: Ref }) {
  let body: React.ReactNode;
  if (refItem.kind === "source") {
    body = sourceById(refItem.id) ? <SourcePeek srcRef={refItem} /> : null;
  } else if (refItem.kind === "person") {
    const p = personById(refItem.id) as Person | undefined;
    body = p ? <PersonPeek person={p} /> : null;
  } else {
    body = <EntityProfile node={{ id: refItem.id, label: refItem.label, kind: refItem.kind, depth: 0 } as GraphNode} placement="inline" />;
  }
  return <div className="mb-1 ml-8 mr-1 rounded-lg border bg-card px-3.5 py-3">{body}</div>;
}

function Valve({ edgeId }: { edgeId: string }) {
  return (
    <span className="flex items-center gap-1">
      <button type="button" onClick={() => verifyEdge(edgeId, "confirm", VIEWER)} className="flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-[var(--primary-hover)]" aria-label="Confirm" title="Confirm">
        <Check className="size-3.5" />
      </button>
      <button type="button" onClick={() => verifyEdge(edgeId, "discard", VIEWER)} className="flex size-6 items-center justify-center rounded-full border text-muted-foreground transition-colors hover:bg-foreground/[0.05] hover:text-foreground" aria-label="Discard" title="Discard">
        <X className="size-3.5" />
      </button>
    </span>
  );
}

// the cited evidence answer — honest single-center, neutral cites, verify-in-place
function AnswerBlock({
  answer,
  items,
  activeKey,
  peekId,
  setPeek,
  onBranch,
}: {
  answer: NonNullable<ReturnType<typeof buildAnswerType>>;
  items: Item[];
  activeKey?: string;
  peekId: string | null;
  setPeek: (k: string | null) => void;
  onBranch: () => void;
}) {
  return (
    <div>
      <p className="mb-3 flex flex-wrap items-center gap-2 font-mono text-[12px] text-primary">
        <AgentAvatar size="xs" /> Woven · answering
        {answer.centerLabel ? (
          <>
            {" "}about
            <span className="inline-flex items-center gap-1 rounded-[5px] border px-1.5 py-px font-sans text-muted-foreground">
              {answer.centerLabel} <ChevronDown className="size-3" />
            </span>
          </>
        ) : null}
        <span className="text-muted-foreground">· cited evidence, not synthesis</span>
      </p>
      <p className={cn("text-base leading-relaxed", answer.hedged ? "text-muted-foreground" : "text-foreground/90")}>{answer.text}</p>

      {items.length ? (
        <Section label={answer.mode === "owners" ? "People" : "Sources"} className="mt-6">
          <RowList>
            {items.map((it) => (
              <ItemRow key={it.key} it={it} active={it.key === activeKey} peeked={peekId === it.key} setPeek={setPeek} />
            ))}
          </RowList>
        </Section>
      ) : null}

      {answer.centerLabel ? (
        <button
          type="button"
          onClick={onBranch}
          className="group/branch mt-6 -mx-2 flex w-[calc(100%_+_1rem)] items-center gap-2.5 rounded-md px-2 py-2 text-left text-[14px] text-muted-foreground transition-colors hover:bg-foreground/[0.035] hover:text-foreground"
        >
          <GitBranch className="size-4 shrink-0" />
          <span className="flex-1">
            Branch into the graph around <span className="text-foreground">{answer.centerLabel}</span>
          </span>
          <ArrowRight className="size-3.5 shrink-0 opacity-0 transition-opacity group-hover/branch:opacity-100" />
        </button>
      ) : null}
    </div>
  );
}
// type helper so AnswerBlock can name the answer shape without a circular import
function buildAnswerType() {
  return null as null | {
    mode: "artifact" | "graph" | "none" | "owners";
    centerLabel?: string;
    centerKind?: RefKind;
    text: string;
    hedged?: boolean;
    cites?: { label: string; block_id?: string; href?: string }[];
    owners?: { person: Person; count: number }[];
  };
}

function ZeroState({
  zero,
  first = true,
  activeKey,
  peekId,
  setPeek,
  onEntity,
  onArtifact,
  onAsk,
}: {
  zero: { recents: { id: string; label: string; kind: RefKind; at: string }[]; away: ReturnType<typeof recentEpisodes>; pending: ReturnType<typeof listPending> };
  first?: boolean; // false when an "On this artifact" section precedes it → give the first section top margin
  activeKey?: string;
  peekId: string | null;
  setPeek: (k: string | null) => void;
  onEntity: (r: Ref) => void;
  onArtifact: (id: string) => void;
  onAsk: (q: string) => void;
}) {
  return (
    <>
      {zero.recents.length ? (
        <Section label="Jump back in" className={first ? undefined : "mt-6"}>
          <RowList>
            {zero.recents.map((r) => {
              const it: Item = { key: `z-rec-${r.id}`, icon: KIND_ICON[r.kind], label: r.label, trailing: <span className="text-[12px] tabular-nums text-muted-foreground">{r.at}</span>, ref: refOf(r.id), activate: () => onEntity(refOf(r.id)) };
              return <ItemRow key={it.key} it={it} active={it.key === activeKey} peeked={peekId === it.key} setPeek={setPeek} />;
            })}
          </RowList>
        </Section>
      ) : null}
      {zero.away.length ? (
        <Section label="While you were away" className="mt-6">
          <RowList>
            {zero.away.map((e) => {
              const it: Item = { key: `z-away-${e.id}`, icon: FileText, label: getArtifact(e.artifactId)?.title ?? "an artifact", trailing: <span className="text-[12px] tabular-nums text-muted-foreground">{e.at}</span>, activate: () => onArtifact(e.artifactId) };
              return <ItemRow key={it.key} it={it} active={it.key === activeKey} peeked={false} setPeek={setPeek} />;
            })}
          </RowList>
        </Section>
      ) : null}
      {zero.pending.length ? (
        <Section label="Suggested" count={zero.pending.length} className="mt-6">
          <RowList>
            {zero.pending.map((p) => {
              const it: Item = { key: `z-pend-${p.edge_id}`, icon: KIND_ICON[p.toKind], label: p.toLabel, valveEdgeId: p.edge_id, activate: () => onArtifact(p.fromKind === "artifact" ? p.fromId : p.toId) };
              return <ItemRow key={it.key} it={it} active={it.key === activeKey} peeked={false} setPeek={setPeek} />;
            })}
          </RowList>
        </Section>
      ) : null}
      <Section label="Ask your collective brain" className="mt-6">
        <RowList>
          {QUESTIONS.map((qq) => {
            const it: Item = { key: `z-ask-${qq}`, marker: <Sparkles className="size-4 text-primary" />, label: qq, trailing: <ArrowUpRight className="size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover/row:opacity-100" />, activate: () => onAsk(qq) };
            return <ItemRow key={it.key} it={it} active={it.key === activeKey} peeked={false} setPeek={setPeek} />;
          })}
        </RowList>
      </Section>
    </>
  );
}

// ───────────────────────── Act drill — a shallow, walk-back-able picker (Esc/Backspace pops)
function DrillView({ drill, onClose, afterRun }: { drill: { kind: "collection" | "export" | "publish"; id: string; title: string }; onClose: () => void; afterRun: () => void }) {
  const title =
    drill.kind === "collection" ? `Add “${drill.title}” to a collection` : drill.kind === "export" ? `Export “${drill.title}”` : `Publish “${drill.title}”`;
  return (
    <div>
      <button type="button" onClick={onClose} className="mb-3 inline-flex items-center gap-1 text-[13px] text-muted-foreground transition-colors hover:text-foreground">
        <ChevronRight className="size-3.5 rotate-180" /> Back
      </button>
      <Section label={title}>
        <RowList>
          {drill.kind === "collection"
            ? listCollections().map((c) => (
                <Row key={c.id} marker={<span className="size-3 rounded-[3px]" style={{ background: c.color }} />} onClick={() => { addArtifactsToCollection(c.id, [drill.id]); afterRun(); }} trailing={<RunHint />}>
                  <span className="text-[14px]">{c.name}</span>
                </Row>
              ))
            : drill.kind === "export"
              ? EXPORT_FORMATS.map((f) => (
                  <Row key={f.key} marker={<Download className="size-4 text-muted-foreground" />} onClick={() => { downloadFile(buildExport([drill.id], f.key)); afterRun(); }} trailing={<span className="text-[12px] text-muted-foreground">{f.hint}</span>}>
                    <span className="text-[14px]">{f.label}</span>
                  </Row>
                ))
              : ([
                  { v: "workspace", l: "Anyone in the workspace" },
                  { v: "link", l: "Anyone with the link" },
                  { v: "public", l: "Public on the web" },
                ] as const).map((o) => (
                  <Row key={o.v} marker={<Send className="size-4 text-muted-foreground" />} onClick={() => { publishArtifact(drill.id, o.v); afterRun(); }} trailing={<RunHint />}>
                    <span className="text-[14px]">{o.l}</span>
                  </Row>
                ))}
        </RowList>
      </Section>
    </div>
  );
}
