"use client";

// ⌘K — Woven's single keyboard SHUTTLE into the collective brain. ONE adaptive input (no Ask/Find toggle,
// matching the edit-bar doctrine): a deterministic router reads each query and produces a RANKED UNION of
// four flat lanes — Navigate · Act · Find · Answer — rendered in the app's one row grammar. The classifier
// sets RANK, never VISIBILITY, so a misroute costs one ↓ (or Tab to re-route in place). The differentiated
// result is the Answer: a CITED, single-center evidence answer (askArtifact/askGraph — honest template
// output, NOT synthesis) whose cited pending edges are VERIFIABLE IN PLACE via the shared ✓/✕ valve.
//
// The takeover is FILLED, not shrunk (verdict 2026-10-02, problem 9; fork 5 kept the house rule "full-screen
// takeover, never a centred palette"). It used to be three objects that did not agree: a tinted band holding a
// 624px input pushed 24px left of centre by the close button, a 672px results column under it, and a full-bleed
// footer of seven chords in engineer words ("ask raw", "re-route", "prefixes"). Now input, results and footer
// share ONE 720px column on one centre (FRAME below), each result leads with the mark of its kind, groups sit
// on the house label-on-a-hairline, and the footer says three things in plain words about the row you are on.

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
  Users,
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
  ShieldAlert,
  CornerDownLeft,
  MessageCircleQuestionMark,
  Terminal,
  type LucideIcon,
} from "lucide-react";
import { AgentAvatar } from "./identity";
import { AgentMark } from "./agent-mark";
import { EPISODE_LABEL } from "./catch-up";
import { EntityProfile, NodeMark } from "./entity-profile";
import { SourcePeek, PersonPeek } from "./entity-peek";
import { FeedHead, undot } from "./inbox-agent-band";
import { Valve } from "./proposal";
import { Row, RowList } from "./today-ui";
import { IconButton } from "@/components/ui/icon-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { FOCUS_RING } from "@/components/classes";
import { useGraphVersion } from "@/lib/use-graph-version";
import {
  askSuggestions,
  addArtifactsToCollection,
  answerQuery,
  collectionById,
  collectionGraph,
  deriveOwners,
  getArtifact,
  listCollections,
  spaceById,
  listPending,
  personById,
  primaryCollection,
  publishArtifact,
  recentEpisodes,
  refOf,
  searchEntities,
  sourceById,
  verifyEdge,
  viewerRecents,
} from "@/lib/api";
import { EXPORT_FORMATS, buildExport, downloadFile } from "@/lib/export";
import type { AskCite, GraphNode, Person, Ref, RefKind } from "@/lib/types";

const VIEWER = "pe_maya";

// A result leads with the MARK of its kind — the alphabet the graph draws (artifact square in its collection's
// hue, topic hexagon, person disc, decision diamond, source ring, collection tile). It led with lucide icons
// (FileText, Hash, Users, Quote, Diamond), so the one surface people use to find things was the one surface
// that never showed Woven's own shape = kind; a hit in ⌘K and the same node on the map looked like strangers.
// 12px on the rows' 24px lead column, the size every list row in Inbox and Team uses. A restricted hit keeps
// its shape and loses its hue (the hint ink): the kind is known, the identity is not ours to show.
function KindMark({ id, kind, restricted = false, pending = false }: { id: string; kind: RefKind; restricted?: boolean; pending?: boolean }) {
  return <NodeMark node={{ id, kind }} className="size-3" pending={pending} fill={restricted ? "var(--foreground-hint)" : undefined} />;
}

// the pages ⌘K can jump to — the Navigate lane's fixed targets (entities are added dynamically). These keep
// their lucide glyphs: a page is chrome, and nav icons stay lucide (the chrome rule).
const PAGES: { label: string; href: string; icon: LucideIcon; tokens: string[] }[] = [
  { label: "Today", href: "/today", icon: Home, tokens: ["today", "home"] },
  { label: "Inbox", href: "/inbox", icon: Inbox, tokens: ["inbox", "verify", "queue", "decisions"] },
  { label: "Library", href: "/library", icon: Library, tokens: ["library", "docs", "artifacts", "files"] },
  { label: "Activity", href: "/activity", icon: Activity, tokens: ["activity", "updates", "feed"] },
  { label: "Team", href: "/team", icon: Network, tokens: ["team", "map", "graph"] },
  { label: "Topics", href: "/topics", icon: Hash, tokens: ["topics", "tags"] },
  { label: "People", href: "/people", icon: Users, tokens: ["people", "who"] },
];

// The space the palette searches, and the scopes its chip offers. Both were literals — the space's name in
// five places and the scope list as a fixed array of four names — while the code that RESOLVES a scope
// (scopeCol, below) matches against listCollections(). Add or rename a collection and the menu stopped
// agreeing with the data it filters. Now one id, and the list is read from the data when the menu renders.
const SPACE_ID = "sp_product";
const spaceName = () => spaceById(SPACE_ID)?.name ?? "Workspace";
const scopeOptions = () => ["All", spaceName(), ...listCollections().map((c) => c.name)];

// stable keys for the two affordances that live OUTSIDE the lanes but must still be reachable by the ↑↓ cursor
const BRANCH_KEY = "answer-branch"; // the answer's "Branch into the graph"
const ASK_KEY = "ask-fallback"; // the "Ask Woven about…" fallback / no-results path

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
// strip only the leading prefix SYMBOL — the rest is the shared term for Navigate + Find (so "export plan"
// keeps "export"). The Act lane strips its own leading imperative verb where it computes its object.
function stripPrefix(q: string): string {
  return q.replace(/^[>?@#]\s*/, "").trim();
}
const INTENT_TONE: Record<Intent, string> = { answer: "answer", navigate: "go to", act: "run", find: "find" };
// the leading glyph morphs with the route so the read-back is legible before you even read the word. The
// answer route wore Sparkles; the sparkle is never the agent (AgentMark is), and the answer below already
// credits the agent once in its byline, so the read-back takes a plain question glyph.
const INTENT_ICON: Record<Intent, LucideIcon> = { answer: MessageCircleQuestionMark, navigate: CornerDownLeft, act: Terminal, find: Search };

// "who owns the launch?" → the topic it asks about. Strips the "who owns …" frame + a leading article so the
// salient noun ("the launch" → "launch") resolves. Shared by the answer and by an Ask row's lead mark, so the
// mark is the thing the answer will actually be about.
function whoOwnsTopic(query: string) {
  const term = query.replace(RX_WHO_OWNS, "").replace(/[?.]/g, "").replace(/^\s*(the|a|an|our|my)\s+/i, "").trim();
  return searchEntities(term || query, 3, { kinds: ["topic"], viewer: VIEWER })[0];
}
// What an Ask would be ABOUT — the center the answer resolves to. An Ask row led with Sparkles (three of them
// in the zero state, a fourth on the fallback): the agent's flourish used as a bullet. It leads with the mark
// of its subject now, like every other row; the words ("Ask Woven…") already name who answers.
function askCenter(question: string, opts: { docId?: string; centerId?: string; scopeId?: string } = {}): { id: string; kind: RefKind } | null {
  const q = stripPrefix(question);
  if (!q) return null;
  if (RX_WHO_OWNS.test(q)) {
    const t = whoOwnsTopic(q);
    if (t && !t.restricted) return { id: t.id, kind: "topic" };
  }
  const a = answerQuery(q, { ...opts, viewer: VIEWER });
  return a.centerId && a.centerKind ? { id: a.centerId, kind: a.centerKind } : null;
}
// No center (a query that names nothing in the graph) → the agent's seal at the 16px of the row icons beside it,
// the one place this screen credits the agent; at the avatar's 24px it was the loudest object in the list.
const askMarker = (c: { id: string; kind: RefKind } | null) =>
  c ? <KindMark id={c.id} kind={c.kind} /> : <AgentMark size={16} state="still" className="size-4 text-primary" />;

// ───────────────────────── context — one search, opened from anywhere, no mode
export type SearchScope =
  | { kind: "artifact"; id: string; title: string }
  | { kind: "decision"; id: string; title: string }
  | { kind: "space"; label: string };
type Ctx = {
  open: boolean;
  openSearch: (query?: string, scopeOverride?: SearchScope) => void; // seed + optional derived-review scope
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
  const [scope, setScope] = React.useState<SearchScope>({ kind: "space", label: spaceName() });
  const focusFn = React.useRef<((id: string) => void) | null>(null);
  const pathname = usePathname();
  const pathRef = React.useRef(pathname);
  React.useEffect(() => {
    pathRef.current = pathname;
  }, [pathname]);

  const openSearch = React.useCallback((query = "", scopeOverride?: SearchScope) => {
    if (scopeOverride) {
      setScope(scopeOverride);
      setSeed(query);
      setClosing(false);
      setOpen(true);
      return;
    }
    // capture the scope AT OPEN — the full-screen overlay hides the underlying view, so the chip is the only
    // carrier of act-context. An artifact page → that artifact is the scope; otherwise the space.
    const m = pathRef.current?.match(/\/artifact\/([^/?#]+)/);
    if (m) {
      const a = getArtifact(m[1]);
      setScope(a ? { kind: "artifact", id: a.id, title: a.title } : { kind: "space", label: spaceName() });
    } else {
      setScope({ kind: "space", label: spaceName() });
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

// A key printed in the palette: the sidebar launcher's keycap (a tint-1 chip on the MARK radius, muted ink,
// sans, tabular). The palette drew its own: a 1px outline box in Geist Mono at three sizes (11, 12, inherited),
// and mono is the agent's voice — a keycap is chrome.
const KEYCAP = "inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-sm bg-tint-1 px-1 font-sans text-xs tabular-nums text-muted-foreground";
function Keycap({ children, className }: { children: React.ReactNode; className?: string }) {
  return <kbd className={cn(KEYCAP, className)}>{children}</kbd>;
}

// ───────────────────────── the trigger bar (topbar) — no mode; it just opens the shuttle
export function SearchBar({ className = "" }: { mode?: string; className?: string }) {
  const { openSearch } = useSearch();
  return (
    <button
      type="button"
      onClick={() => openSearch()}
      className={cn(
        "flex w-full max-w-md items-center gap-2 rounded-md border bg-card px-3 py-2 text-left outline-none transition-colors hover:border-line-hover focus-visible:border-ring",
        className,
      )}
    >
      <span className="flex flex-1 items-center gap-2 text-base text-muted-foreground">
        <Search className="size-4" /> Search or run a command…
      </span>
      <Keycap>⌘K</Keycap>
    </button>
  );
}

// ───────────────────────── one activatable item in a lane (the flat cursor moves across these)
type Item = {
  key: string;
  icon?: LucideIcon; // a page or a command (chrome) — an ENTITY never takes an icon, it takes its mark
  marker?: React.ReactNode;
  label: React.ReactNode;
  sub?: React.ReactNode; // a muted second line — the row's context (why it's here / what it lands on)
  trailing?: React.ReactNode;
  ref?: Ref; // enables the → peek
  verb?: string; // what ↵ does here, in a word — the footer's first hint reads it ("↵ Open", "↵ Ask")
  activate: () => void;
  valveEdgeId?: string; // a pending edge → the ✓/✕ valve (the one forest moment)
};
type Lane = { title: string; count?: number; items: Item[] };

// The takeover's ONE column. Header, results and footer each lay out on this same three-track grid, so the
// input and the rows share a width (720px) and a centre at every width from md up; below md the column is the
// viewport less a 16px gutter and the close button sits in the header's row. The side tracks have a 48px
// floor, which is where the close button lives at md+ — it used to share the input's own max-width and push
// the field 24px left of the results' centre.
const FRAME = "px-4 md:grid md:grid-cols-[minmax(3rem,1fr)_minmax(0,45rem)_minmax(3rem,1fr)] md:gap-0 md:px-0";
const COL = "min-w-0 md:col-start-2";

// Every chord the palette answers to, in words — the "?" behind the footer's three hints. These were the
// footer itself: seven chips, four of them engineer words ("ask raw", "re-route", "prefixes").
const ALL_KEYS: { k: string; words: string }[] = [
  { k: "↑↓", words: "Move through the results" },
  { k: "↵", words: "Open the highlighted result" },
  { k: "→", words: "Peek at it without leaving" },
  { k: "⌘↵", words: "Ask Woven instead of searching" },
  { k: "Tab", words: "Put a different kind of result first" },
  { k: "> @ # ?", words: "Start with > for a command, @ for people, # for collections, ? to ask" },
  { k: "esc", words: "Close, or step back" },
];

// ───────────────────────── the overlay
function SearchOverlay({
  seed,
  scope,
  closing,
  close,
  focusFn,
}: {
  seed: string;
  scope: SearchScope;
  closing: boolean;
  close: () => void;
  focusFn: React.MutableRefObject<((id: string) => void) | null>;
}) {
  const router = useRouter();
  const gv = useGraphVersion(); // re-resolve the answer after a valve confirm/discard (prov flips → cite updates)
  const [q, setQ] = React.useState(seed);
  const [scopeName, setScopeName] = React.useState(scope.kind === "space" ? scope.label : spaceName());
  const [cursor, setCursor] = React.useState(0);
  const [peekId, setPeekId] = React.useState<string | null>(null);
  const [drill, setDrill] = React.useState<null | { kind: "collection" | "export" | "publish"; id: string; title: string }>(null);
  const [reroute, setReroute] = React.useState(0); // Tab cycles the primary lane to the next
  const [showKeys, setShowKeys] = React.useState(false); // the "?" list of every chord
  const inputRef = React.useRef<HTMLInputElement>(null);

  const changeQuery = React.useCallback((next: string) => {
    setQ(next);
    setReroute(0);
    setCursor(0);
    setPeekId(null);
  }, []);
  const changeDrill = React.useCallback((next: typeof drill) => {
    setDrill(next);
    setCursor(0);
    setPeekId(null);
  }, []);

  React.useEffect(() => inputRef.current?.focus(), []);

  const query = q.trim();
  const baseIntent = classify(q);
  // Tab re-routes: rotate the lane order without changing the query
  const order: Intent[] = React.useMemo(() => {
    const all: Intent[] = ["answer", "navigate", "act", "find"];
    const primary = all[(all.indexOf(baseIntent) + reroute) % all.length];
    return [primary, ...all.filter((i) => i !== primary)];
  }, [baseIntent, reroute]);

  const go = React.useCallback((href: string) => {
    router.push(href);
    close();
  }, [router, close]);
  const focusEntity = React.useCallback((n: GraphNode) => {
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
    else if (n.kind === "decision") go(`/decision/${n.id}`);
    else close();
  }, [go, close, focusFn]);

  // the Space scope chip is a REAL filter: a collection scope narrows Find to that collection's neighborhood
  // (its members + the people/topics they touch, via collectionGraph). "All"/the space name → null → no filter.
  // Only shown for a space scope (an artifact scope renders a static chip), so this is inert on a doc.
  // the collection the chip narrows to (a real collection name → that collection; "All"/the space name → none).
  // Shared by Find (node-set filter) AND the answer (center resolution + who-owns), so both scope identically.
  const scopeCol = React.useMemo(
    () => (scope.kind === "space" ? listCollections().find((c) => c.name === scopeName) ?? null : null),
    [scope.kind, scopeName],
  );
  const scopeIds = React.useMemo<Set<string> | null>(
    () => (scopeCol ? new Set(collectionGraph(scopeCol.slug).nodes.map((n) => n.id)) : null),
    [scopeCol],
  );
  // the same scope the answer resolves under — an Ask row's mark must name what THAT answer would be about
  const askOpts = React.useMemo(
    () => ({
      docId: scope.kind === "artifact" ? scope.id : undefined,
      centerId: scope.kind === "decision" ? scope.id : undefined,
      scopeId: scopeCol?.id,
    }),
    [scope, scopeCol],
  );

  // the Act verbs for the captured artifact scope — reused by the Act lane (typed) AND surfaced at the top
  // of the zero-state (you opened ⌘K ON a doc → acting on it is a first-class option, no typing required)
  const docActs = React.useMemo<Item[]>(() => {
    if (scope.kind !== "artifact") return [];
    const t = scope.title;
    return [
      { key: "act-verify", icon: ShieldCheck, label: `Verify pending links`, trailing: <RunHint />, verb: "Open", activate: () => go(`/artifact/${scope.id}`) },
      { key: "act-export", icon: Download, label: `Export`, trailing: <RunHint />, verb: "Export", activate: () => changeDrill({ kind: "export", id: scope.id, title: t }) },
      { key: "act-add", icon: FolderPlus, label: `Add to a collection`, trailing: <RunHint />, verb: "Add", activate: () => changeDrill({ kind: "collection", id: scope.id, title: t }) },
      { key: "act-pub", icon: Send, label: `Publish`, trailing: <RunHint />, verb: "Publish", activate: () => changeDrill({ kind: "publish", id: scope.id, title: t }) },
    ];
  }, [scope, changeDrill, go]);

  // ── the honest answer (single-center, cited) — who-owns is routed to deriveOwners, never answerQuery ──
  const answer = React.useMemo(() => {
    void gv;
    if (!query || !order.includes("answer") || order[0] !== "answer") return null;
    if (scope.kind !== "decision" && RX_WHO_OWNS.test(query)) {
      const topic = whoOwnsTopic(query);
      // honor the collection scope: a topic outside the scoped collection doesn't answer here (falls through to
      // the scoped answerQuery, which hedges) — so "who owns onboarding?" under a Q4-only scope stays honest.
      const owners = topic && !topic.restricted && (!scopeIds || scopeIds.has(topic.id)) ? deriveOwners(topic.id) : [];
      if (owners.length) {
        return {
          mode: "owners" as const,
          centerId: topic!.id,
          centerLabel: topic!.label,
          centerKind: "topic" as RefKind,
          // a full stop, not an em dash: the screen's one dash is spent on nothing, and two claims read as two
          text: `${owners.map((o) => o.person.name).slice(0, 3).join(", ")}. Derived from who wrote and is mentioned across ${topic!.label}.`,
          owners,
        };
      }
    }
    const a = answerQuery(query, { ...askOpts, viewer: VIEWER });
    return { mode: a.mode, centerId: a.centerId, centerLabel: a.centerLabel, centerKind: a.centerKind, text: a.answer, cites: a.cites, hedged: a.hedged };
  }, [query, order, scope.kind, gv, askOpts, scopeIds]);

  // ── build the lanes (ranked union) ──
  const lanes = React.useMemo<Lane[]>(() => {
    if (!q.trim()) return []; // empty → the zero-state orient owns the screen, not a page list
    const out: Record<Intent, Lane[]> = { answer: [], navigate: [], act: [], find: [] };
    const term = stripPrefix(q);

    // NAVIGATE — page tokens + the single strongest entity
    const navItems: Item[] = [];
    for (const p of PAGES) {
      if (!term || p.label.toLowerCase().includes(term.toLowerCase()) || p.tokens.some((t) => t.startsWith(term.toLowerCase()))) {
        navItems.push({ key: `nav-${p.href}`, icon: p.icon, label: p.label, trailing: <GoHint />, verb: "Open", activate: () => go(p.href) });
      }
    }
    // Navigate = pages only; named entities live in Find (its top result + ⏎ is the "jump straight there"),
    // so we don't echo the same entity in two lanes.
    if (navItems.length) out.navigate.push({ title: "Navigate", items: navItems.slice(0, 7) });

    // ACT — verbs scoped to what was captured at open (artifact scope reuses docActs). The decision scope's
    // one act opens the decision, so it leads with the decision's diamond, not a lucide Diamond.
    const actItems: Item[] =
      scope.kind === "artifact"
        ? docActs
        : scope.kind === "decision"
          ? [{ key: "act-review", marker: <KindMark id={scope.id} kind="decision" />, label: "Open decision detail", trailing: <RunHint />, verb: "Open", activate: () => go(`/decision/${scope.id}`) }]
          : [{ key: "act-queue", icon: ShieldCheck, label: "Open the verify queue", trailing: <RunHint />, verb: "Open", activate: () => go("/inbox") }];
    // the Act OBJECT strips the leading imperative verb ("export plan" → act on "plan"); the shared `term` keeps it
    const actTerm = term.replace(RX_IMPERATIVE, "").trim().toLowerCase();
    const actFiltered =
      actTerm && baseIntent !== "act" ? actItems.filter((i) => String(i.label).toLowerCase().includes(actTerm)) : actItems;
    if (actFiltered.length && (baseIntent === "act" || !term || actFiltered.length < actItems.length))
      out.act.push({ title: scope.kind === "artifact" ? "On this artifact" : scope.kind === "decision" ? "On this decision" : "Actions", items: actFiltered });

    // FIND — entities grouped by kind + any pending edges that match
    if (term) {
      // @ scopes the search to people, # to collections — read the RAW prefix so the entity search + the
      // rendered groups both narrow to that kind (a kind-scoped Find, not a generic all-kinds one).
      const pfx = q.trim()[0];
      const kinds: RefKind[] | undefined = pfx === "@" ? ["person"] : pfx === "#" ? ["collection"] : undefined;
      let hits = searchEntities(term, 40, { viewer: VIEWER, includeRestricted: true, kinds });
      // the Space scope chip narrows Find to the selected collection's neighborhood (fix: the chip does something)
      if (scopeIds) hits = hits.filter((h) => scopeIds.has(h.id));
      const GROUPS: { kind: RefKind; label: string }[] = (
        [
          { kind: "person", label: "People" },
          { kind: "topic", label: "Topics" },
          { kind: "collection", label: "Collections" },
          { kind: "artifact", label: "Artifacts" },
          { kind: "decision", label: "Decisions" },
          { kind: "source", label: "Sources" },
        ] as { kind: RefKind; label: string }[]
      ).filter((g) => !kinds || kinds.includes(g.kind));
      for (const g of GROUPS) {
        const items: Item[] = hits
          .filter((h) => h.kind === g.kind)
          .slice(0, 6)
          .map((h) => {
            if (h.restricted)
              return { key: `find-${h.id}`, marker: <KindMark id={h.id} kind={h.kind} restricted />, label: <span className="text-muted-foreground">Restricted {h.kind}</span>, trailing: <span className="text-xs text-muted-foreground">request access</span>, activate: () => {} };
            const r: Ref = { id: h.id, label: h.label, kind: h.kind };
            const key = `find-${h.id}`;
            // source / decision have no standalone page — activating OPENS THE INLINE PEEK (they still → peek too),
            // rather than routing through focusEntity's `else close()` dead-end. The rest re-focus / deep-link.
            const peekOnly = h.kind === "source" || h.kind === "decision";
            const activate = peekOnly ? () => setPeekId((p) => (p === key ? null : key)) : () => focusEntity({ ...r, depth: 0 } as GraphNode);
            // One fact at the row's far edge, the one that tells two same-named things apart: a document's
            // collection (the name its mark's hue stands for) and a person's role. The rows were a title
            // hugging the left of a 672px column with nothing after it.
            const fact = h.kind === "artifact" ? primaryCollection(h.id)?.name : h.kind === "person" ? personById(h.id)?.role : undefined;
            return {
              key,
              marker: <KindMark id={h.id} kind={h.kind} pending={h.kind === "artifact" && getArtifact(h.id)?.state === "processing"} />,
              label: undot(h.label),
              trailing: fact ? <span className="max-w-48 truncate text-sm text-muted-foreground">{undot(fact)}</span> : undefined,
              ref: r,
              verb: peekOnly ? "Peek" : "Open",
              activate,
            };
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
  }, [q, order, scope, baseIntent, docActs, scopeIds]);

  // ── zero-state (orient) ──
  const zero = React.useMemo(() => {
    if (query) return null;
    return { recents: viewerRecents(VIEWER, 5), away: recentEpisodes(4, VIEWER) };
  }, [query]);

  // the zero-state, built ONCE (both the visual render and the keyboard `flat` mirror consume this — no drift).
  // Every row carries CONTEXT: a recent shows what's waiting on it, an away-episode shows who did what, and an
  // Ask shows what it lands on. (The old context-free "Suggested" verify list is gone — verify now lives where
  // the decision has its context: inside an answer, on the doc, in the Inbox.)
  const zeroSections = React.useMemo<{ key: string; label: string; items: Item[] }[]>(() => {
    if (!zero) return [];
    const secs: { key: string; label: string; items: Item[] }[] = [];
    if (zero.recents.length) {
      secs.push({
        key: "recents",
        label: "Jump back in",
        items: zero.recents.map((r) => {
          const pend = listPending().filter((p) => p.fromId === r.id || p.toId === r.id).length;
          return {
            key: `z-rec-${r.id}`,
            marker: <KindMark id={r.id} kind={r.kind} />,
            label: undot(r.label),
            sub: pend ? `${pend} proposed link${pend === 1 ? "" : "s"} to verify` : undefined,
            trailing: <span className="text-xs tabular-nums text-muted-foreground">{r.at}</span>,
            ref: refOf(r.id),
            verb: "Open",
            activate: () => focusEntity({ ...refOf(r.id), depth: 0 } as GraphNode),
          };
        }),
      });
    }
    if (zero.away.length) {
      // An away row is ABOUT a document, so it leads with that document's mark — the actor's avatar led it,
      // which made the bullet a face and the thing that changed a word in the middle of the line. Who did it
      // moves into the second line beside what kind of change it was (the Activity tab's status grammar:
      // the kind word, a vertical hairline, then the fact), and the time takes the far edge like every row.
      secs.push({
        key: "away",
        label: "While you were away",
        items: zero.away.map((e) => {
          const who = e.actor === "agent" ? "Woven" : personById(e.actor)?.name ?? e.actor;
          const lbl = EPISODE_LABEL[e.kind];
          return {
            key: `z-away-${e.id}`,
            marker: <KindMark id={e.artifactId} kind="artifact" />,
            label: undot(getArtifact(e.artifactId)?.title ?? "an artifact"),
            sub: (
              <span className="flex min-w-0 items-center gap-2">
                <span className={cn("shrink-0 font-medium", lbl.cls)}>{lbl.text}</span>
                <span aria-hidden="true" className="h-3 w-px shrink-0 bg-border" />
                <span className="min-w-0 truncate">
                  {who}: {undot(e.summary)}
                </span>
              </span>
            ),
            trailing: <span className="text-xs tabular-nums text-muted-foreground">{e.at}</span>,
            verb: "Open",
            activate: () => go(`/artifact/${e.artifactId}`),
          };
        }),
      });
    }
    secs.push({
      key: "ask",
      label: "Ask your collective brain",
      items: askSuggestions().map(({ q, sub }) => ({
        key: `z-ask-${q}`,
        marker: askMarker(askCenter(q, askOpts)),
        label: q,
        sub: undot(sub),
        trailing: <ArrowUpRight className="size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover/row:opacity-100" />,
        verb: "Ask",
        activate: () => changeQuery(q),
      })),
    });
    return secs;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zero, askOpts]);

  // ── flatten every activatable item for the keyboard cursor ──
  const answerItems: Item[] = React.useMemo(() => {
    if (!answer) return [];
    const items: Item[] = [];
    if (answer.mode === "owners" && "owners" in answer && answer.owners) {
      for (const o of answer.owners) {
        const r: Ref = { id: o.person.id, label: o.person.name, kind: "person" };
        items.push({ key: `ans-owner-${o.person.id}`, marker: <KindMark id={o.person.id} kind="person" />, label: o.person.name, trailing: <span className="max-w-48 truncate text-sm text-muted-foreground">{undot(o.person.role)}</span>, ref: r, verb: "Open", activate: () => focusEntity({ ...r, depth: 0 } as GraphNode) });
      }
    } else if ("cites" in answer && answer.cites) {
      let n = 0; // number only the SETTLED sources — a proposed link is not a numbered source yet
      for (let i = 0; i < answer.cites.length; i++) {
        const c = answer.cites[i];
        // a block cite (no href) opens the doc AT that section via the reader's #block hash target; only when
        // it's actually navigable (href, OR a block_id + a resolved center) do we render the "open" affordance.
        const navigable = !!(c.href || (c.block_id && answer.centerId));
        const candidate = c.trust === "candidate";
        const unavailable = c.trust === "unavailable";
        // a still-proposed link → the ✓/✕ valve (the one forest moment): confirm/dismiss it right on the answer.
        // It leads with the line alphabet's PROPOSED mark — a short dash, forest for a pending link, hint ink for
        // an unverified candidate — not a source number (it is a call to make, not a settled source). It wore
        // Sparkles, the agent's flourish, which said "AI" where it needed to say "not yet confirmed".
        items.push({
          key: `ans-cite-${i}`,
          marker: c.pending || candidate || unavailable ? (
            <span className="flex size-5 items-center justify-center">
              {unavailable ? (
                <ShieldAlert className="size-3.5 text-warn" />
              ) : (
                // the graph's own proposed stroke (1.5 wide, dashed 4/4), so the row and the map draw one thing
                <svg aria-hidden="true" viewBox="0 0 16 2" className={cn("h-0.5 w-4", c.pending ? "text-primary" : "text-foreground-hint")}>
                  <line x1="0" y1="1" x2="16" y2="1" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 4" />
                </svg>
              )}
            </span>
          ) : (
            <span className="flex size-5 items-center justify-center rounded-sm bg-tint-1 text-xs font-medium tabular-nums text-muted-foreground">{++n}</span>
          ),
          label: c.pending || candidate || unavailable ? (
            <span className="flex items-center gap-2">
              {undot(c.label)}
              <span className="rounded-sm bg-tint-1 px-1.5 py-0.5 text-xs font-medium leading-none text-muted-foreground">
                {c.pending ? "Proposed" : candidate ? "Candidate" : "Unavailable"}
              </span>
            </span>
          ) : undot(c.label),
          valveEdgeId: c.pending ? c.edge_id : undefined,
          trailing: navigable ? <ArrowUpRight className="size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover/row:opacity-100" /> : undefined,
          verb: navigable ? "Open" : undefined,
          activate: () => (c.href ? go(c.href) : c.block_id && answer.centerId ? go(`/artifact/${answer.centerId}#${c.block_id}`) : undefined),
        });
      }
    }
    return items;
  }, [answer, focusEntity, go]);

  // "Branch into the graph" — route THROUGH the center to its focus page (reuses the ?focus deep-link), never a
  // bare /team. Shared by the AnswerBlock button and its flat cursor entry, so both do the same thing.
  const answerBranch = () => {
    if (answer && answer.centerId && answer.centerKind)
      focusEntity({ id: answer.centerId, label: answer.centerLabel ?? "", kind: answer.centerKind, depth: 0 } as GraphNode);
    else go("/team");
  };
  // the "Ask Woven about…" affordance as a first-class Item — reachable by the cursor, ⏎ forces the answer route
  // regardless of any leading prefix (a leading "?" is honored by classify first, ahead of > @ #).
  const askLead = React.useMemo(() => (query ? askMarker(askCenter(query, askOpts)) : null), [query, askOpts]);
  const askItem: Item = {
    key: ASK_KEY,
    marker: askLead,
    label: <>Ask Woven about “{query}”</>,
    trailing: <Keycap className="max-sm:hidden">⌘↵</Keycap>, // a chord, on a phone with no keyboard, is noise
    verb: "Ask",
    activate: () => changeQuery("?" + query.replace(/^[>?@#]\s*/, "")),
  };

  // the Act drill's option rows AS the active item set — when a picker is open it OWNS the keyboard cursor
  // (↑↓ highlight + ⏎ select the VISIBLE picker rows), fixing the arrows moving an invisible cursor.
  const drillItems = React.useMemo<Item[]>(() => {
    if (!drill) return [];
    if (drill.kind === "collection")
      return listCollections().map((c) => ({
        key: `drill-col-${c.id}`,
        // the collection's own mark (its tile in its hue), not a hand-drawn 3px-radius square
        marker: <KindMark id={c.id} kind="collection" />,
        label: c.name,
        trailing: <RunHint />,
        verb: "Add",
        activate: () => { addArtifactsToCollection(c.id, [drill.id]); close(); },
      }));
    if (drill.kind === "export")
      return EXPORT_FORMATS.map((f) => ({
        key: `drill-exp-${f.key}`,
        marker: <Download className="size-4 text-muted-foreground" />,
        label: f.label,
        trailing: <span className="text-xs text-muted-foreground">{f.hint}</span>,
        verb: "Download",
        activate: () => { downloadFile(buildExport([drill.id], f.key)); close(); },
      }));
    return (
      [
        { v: "workspace", l: "Anyone in the workspace" },
        { v: "link", l: "Anyone with the link" },
        { v: "public", l: "Public on the web" },
      ] as const
    ).map((o) => ({
      key: `drill-pub-${o.v}`,
      marker: <Send className="size-4 text-muted-foreground" />,
      label: o.l,
      trailing: <RunHint />,
      verb: "Publish",
      activate: () => { publishArtifact(drill.id, o.v); close(); },
    }));
  }, [drill, close]);

  const flat = React.useMemo(() => {
    if (drill) return drillItems; // the picker owns the cursor — ↑↓ + ⏎ act on its visible rows only
    const f: Item[] = [...answerItems];
    if (answer?.centerLabel) f.push({ key: BRANCH_KEY, label: "", verb: "Open", activate: answerBranch }); // Branch, after the cites
    for (const l of lanes) f.push(...l.items);
    if (query && order[0] !== "answer") f.push(askItem); // the Ask affordance, after the lanes
    if (zeroSections.length) f.push(...docActs, ...zeroSections.flatMap((s) => s.items));
    return f;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drill, drillItems, answerItems, lanes, zeroSections, docActs, answer, query, order, askLead]);

  const activeKey = flat[cursor]?.key;

  // ── keyboard ──
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        if (showKeys) return setShowKeys(false);
        if (peekId) return setPeekId(null);
        if (drill) return changeDrill(null);
        return close();
      }
      if (e.key === "Tab") {
        e.preventDefault();
        if (!drill) {
          setReroute((r) => r + 1);
          setCursor(0);
        } // no re-route while a drill picker owns the screen
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
        // ⌘↵ = ask raw: force the ANSWER route regardless of any leading > @ # prefix (classify honors "?" first).
        // Suppressed inside a drill, where ⏎ selects the highlighted picker row instead.
        if (!drill && (e.metaKey || e.ctrlKey) && query) return changeQuery("?" + query.replace(/^[>?@#]\s*/, ""));
        flat[cursor]?.activate();
      } else if (e.key === "Backspace" && q === "" && drill) {
        changeDrill(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flat, cursor, peekId, drill, q, query, close, changeDrill, changeQuery, showKeys]);

  // The footer's three hints, about the row the cursor is on: what ↵ does HERE, the next most useful key, and
  // what esc does now. Seven fixed chords said the same thing on every row and named the mechanism ("ask raw",
  // "re-route", "prefixes"), not the outcome; the full list is one "?" away.
  const hints = React.useMemo<[string, string][]>(() => {
    const it = flat[cursor];
    const peeked = !!it && peekId === it.key;
    const c: [string, string][] = [];
    if (it?.verb) c.push(["↵", it.verb]);
    if (it?.ref && !peeked && it.verb !== "Peek") c.push(["→", "Peek"]);
    c.push(["↑↓", "Move"]);
    if (query && !drill && order[0] !== "answer") c.push(["⌘↵", "Ask Woven"]);
    // a row with nothing to open (a graph cite, a restricted hit) under an answer still gets a second key:
    // Tab, which puts the other kinds of result first
    if (query && !drill) c.push(["Tab", "Other results"]);
    const out = c.slice(0, 2);
    out.push(["esc", showKeys ? "Hide keys" : peekId ? "Close peek" : drill ? "Back" : "Close"]);
    return out;
  }, [flat, cursor, peekId, drill, query, order, showKeys]);

  const tone = query ? INTENT_TONE[order[0]] : ""; // the route reads back only when typing — no idle "ready" filler
  const ToneIcon = query ? INTENT_ICON[order[0]] : Search;

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex flex-col bg-background duration-200",
        closing ? "animate-out fade-out-0" : "animate-in fade-in-0",
      )}
      role="dialog"
      aria-modal="true"
    >
      {/* header — the input on the column, on the takeover's own paper. It sat in a full-width band of
          secondary at 50% (a hand-written alpha, and the grey band the whole-product panel read as a slab);
          the field's card on the ground is the only object the header needs. The input steps up to the lg
          rung at md+: in a takeover the query is the page's title. */}
      <div className={cn(FRAME, "flex shrink-0 animate-in items-center gap-2 pt-3 pb-1 duration-300 slide-in-from-top-4 md:pt-12 md:pb-2")}>
        <div className={cn(COL, "flex flex-1 items-center gap-2.5 rounded-lg border bg-card py-2.5 pr-2.5 pl-3.5")}>
          <span className="hidden shrink-0 items-center gap-1.5 text-xs text-muted-foreground sm:inline-flex">
            <ToneIcon className="size-3.5" />
            {tone}
          </span>
          {query ? <span aria-hidden="true" className="hidden h-5 w-px shrink-0 bg-border sm:block" /> : null}
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => changeQuery(e.target.value)}
            placeholder="Search, ask a question, or run a command…"
            aria-label="Search, ask a question, or run a command"
            className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground md:text-lg"
          />
          <ScopeChip scope={scope} name={scopeName} setName={setScopeName} />
          {query ? <Keycap className="max-sm:hidden">↵</Keycap> : null}
        </div>
        <IconButton label="Close" size="icon-lg" onClick={close} className="md:col-start-3 md:mr-3 md:justify-self-end">
          <X className="size-5" />
        </IconButton>
      </div>

      {/* body — the same column, flat groups of open rows on hairlines; no two-pane, peek is inline-on-demand */}
      <div className="scrollbar-subtle flex-1 overflow-y-auto">
        <div className={cn(FRAME, "pt-2 pb-10")}>
          <div className={COL}>
            {drill ? (
              <DrillView drill={drill} items={drillItems} activeKey={activeKey} onClose={() => changeDrill(null)} />
            ) : (
              <>
                {answer ? (
                  <AnswerBlock
                    answer={answer}
                    items={answerItems}
                    activeKey={activeKey}
                    peekId={peekId}
                    setPeek={setPeekId}
                    onBranch={answerBranch}
                    branchLabel={answer.centerKind === "decision" ? "Open decision detail" : undefined}
                  />
                ) : null}

                {lanes.map((lane) => (
                  <Group key={lane.title} label={lane.title}>
                    {lane.items.map((it) => (
                      <ItemRow key={it.key} it={it} active={it.key === activeKey} peeked={peekId === it.key} setPeek={setPeekId} />
                    ))}
                  </Group>
                ))}

                {/* Ask fallback — when Answer isn't the primary lane, one cursor-reachable row promotes the raw
                    query to Ask (⌘↵). When nothing else matched it IS the no-results state (one coherent path). */}
                {query && order[0] !== "answer" ? (
                  <Group label={lanes.length === 0 ? "No matches, ask Woven instead" : "Ask"}>
                    <ItemRow it={askItem} active={askItem.key === activeKey} peeked={false} setPeek={setPeekId} />
                  </Group>
                ) : null}

                {zero && docActs.length ? (
                  <Group label="On this artifact">
                    {docActs.map((it) => (
                      <ItemRow key={it.key} it={it} active={it.key === activeKey} peeked={false} setPeek={setPeekId} />
                    ))}
                  </Group>
                ) : null}
                {zeroSections.map((s) => (
                  <Group key={s.key} label={s.label}>
                    {s.items.map((it) => (
                      <ItemRow key={it.key} it={it} active={it.key === activeKey} peeked={peekId === it.key} setPeek={setPeekId} />
                    ))}
                  </Group>
                ))}
                {/* no standalone "No matches" line — the Ask affordance above already IS the coherent no-results path */}
              </>
            )}
          </div>
        </div>
      </div>

      {/* footer — three hints for the focused row on the column's own hairline, the rest behind "?". Hidden on a
          phone: there is no keyboard to hint at, and the close button is in the header. */}
      <div className={cn(FRAME, "shrink-0 max-sm:hidden")}>
        <div className={cn(COL, "border-t")}>
          {showKeys ? (
            <dl id="search-keys" className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 pt-3 pb-1 text-sm">
              {ALL_KEYS.map((k) => (
                <React.Fragment key={k.k}>
                  <dt>
                    <Keycap>{k.k}</Keycap>
                  </dt>
                  <dd className="text-muted-foreground">{k.words}</dd>
                </React.Fragment>
              ))}
            </dl>
          ) : null}
          <div className="flex items-center gap-x-5 py-2.5 text-xs text-muted-foreground">
            {hints.map(([k, l]) => (
              <Hint key={k + l} k={k} l={l} />
            ))}
            <button
              type="button"
              aria-label="All keyboard shortcuts"
              title="All keyboard shortcuts"
              aria-expanded={showKeys}
              aria-controls="search-keys"
              onClick={() => {
                setShowKeys((s) => !s);
                inputRef.current?.focus(); // the field keeps the caret: the keys are read, not operated
              }}
              className={cn(KEYCAP, "ml-auto transition-colors hover:bg-tint-2 hover:text-foreground aria-expanded:bg-tint-2 aria-expanded:text-foreground", FOCUS_RING)}
            >
              ?
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ───────────────────────── small pieces
function GoHint() {
  return <span className="hidden items-center gap-1 text-xs text-muted-foreground group-hover/row:flex">Go to <CornerDownLeft className="size-3" /></span>;
}
function RunHint() {
  return <ChevronRight className="size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover/row:opacity-100" />;
}
function Hint({ k, l }: { k: string; l: string }) {
  return (
    <span data-hint="" className="inline-flex items-center gap-1.5">
      <Keycap>{k}</Keycap> {l}
    </span>
  );
}

// A result group: the house grouped-list header (FeedHead — a 12/500 muted label on a hairline, flush to the
// column, its label on the rows' mark edge) over open rows. It was Section's 15/500 full-ink heading, the
// weight of a page section, four of them stacked over five rows on a "launch" search: the headers outweighed
// the results they sort.
function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section>
      <FeedHead flush>{label}</FeedHead>
      {/* flush: the rows' dividers run the column's width, the same span as the header's rule (FeedHead flush).
          Inset (DIVIDED) they stopped 12px short of it at both ends — two line lengths in one group. */}
      <RowList flush>{children}</RowList>
    </section>
  );
}

// The three faces of ONE slot: what this search is scoped to. Two are facts (the artifact or the decision
// you came from) and one is a choice (the space or a collection), so they share a chip and the choice adds
// a chevron and the states a control owes. They shared nothing: the two FACTS wore a filled chip and the
// only PRESSABLE one wore no ground at all, so the ink said "static" on the control and "control" on the
// statics — and the chooser's hover ground was the statics' RESTING ground, so touching it made it look
// like becoming one of them. A control takes a fill (control surfaces); hover deepens one rung.
const SCOPE_CHIP = "inline-flex shrink-0 items-center gap-1.5 rounded-md bg-tint-1 px-2 py-1 text-xs font-medium text-muted-foreground";

// The space's name carries a middle dot in the record ("Acme · Product"); the house prints no middle dot in
// copy, and the rail and the explorer's h1 already render it without. Display only — every comparison in
// this file still runs on the stored name.
const scopeLabel = (s: string) => s.replace(/ \u00b7 /g, " ");

function ScopeChip({ scope, name, setName }: { scope: SearchScope; name: string; setName: (s: string) => void }) {
  // the two fact faces lead with the mark of what they are (the doc's square, the decision's diamond) — they
  // wore lucide FileText / Diamond, the last two kind icons in the palette
  if (scope.kind === "artifact") {
    return (
      <span className={SCOPE_CHIP}>
        <NodeMark node={{ id: scope.id, kind: "artifact" }} className="size-2.5" /> {scope.title.length > 22 ? scope.title.slice(0, 22) + "…" : scope.title}
      </span>
    );
  }
  if (scope.kind === "decision") {
    return (
      <span className={cn(SCOPE_CHIP, "max-w-36")}>
        <NodeMark node={{ id: scope.id, kind: "decision" }} className="size-2.5" /> <span className="truncate">{scope.title}</span>
      </span>
    );
  }
  return (
    <DropdownMenu>
      {/* the one of the three you can change. Its accessible name says what the value IS: a reader hearing
          "Acme Product, menu" beside a search field cannot tell a scope from a place. */}
      <DropdownMenuTrigger
        aria-label={`Search scope: ${scopeLabel(name)}`}
        className={cn(
          SCOPE_CHIP,
          "gap-1 outline-none transition-colors hover:bg-tint-2 hover:text-foreground data-[popup-open]:bg-tint-2 data-[popup-open]:text-foreground",
          FOCUS_RING,
        )}
      >
        {scopeLabel(name)} <ChevronDown className="size-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={6} className="w-48">
        {scopeOptions().map((s) => (
          <DropdownMenuItem key={s} onClick={() => setName(s)} className="gap-2">
            <Check className={cn("size-3.5 text-primary", name === s ? "opacity-100" : "opacity-0")} /> {scopeLabel(s)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// a lane row with an optional inline peek beneath it. When it becomes the active (cursor) row it scrolls
// itself into view, so ↑↓ never drives the highlight below the fold in a long result set.
function ItemRow({ it, active, peeked, setPeek }: { it: Item; active: boolean; peeked: boolean; setPeek: (k: string | null) => void }) {
  const rowRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (active) rowRef.current?.scrollIntoView({ block: "nearest" });
  }, [active]);
  return (
    // flex-col so the row STRETCHES: a <button> Row is shrink-to-fit inside a block div, so every row without a
    // peek (pages, commands, Ask) ended its wash at its text and its trailing hint sat against the label
    // instead of on the column's far edge. A stretched flex child keeps Row's -mx-2 overhang.
    <div ref={rowRef} className="flex flex-col">
      <Row
        active={active}
        marker={it.marker ?? (it.icon ? <it.icon className="size-4 text-muted-foreground" /> : undefined)}
        onClick={it.activate}
        interactiveTrailing={!!(it.valveEdgeId || it.ref)}
        trailing={
          it.valveEdgeId ? (
            // the shared valve (✓ on the confirm wash, ✕ ghost) — this file drew its own, a filled forest disc
            // beside an outlined ✕, the full-strength confirm the forest-action-weight rule retired for lists
            <Valve
              size="icon-xs"
              dismissLabel="Discard"
              onConfirm={() => verifyEdge(it.valveEdgeId!, "confirm", VIEWER)}
              onDismiss={() => verifyEdge(it.valveEdgeId!, "discard", VIEWER)}
            />
          ) : (
            <span className="flex items-center gap-2">
              {it.trailing}
              {it.ref ? (
                <button type="button" onClick={(e) => { e.stopPropagation(); setPeek(peeked ? null : it.key); }} className="text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover/row:opacity-100" aria-label="Preview">
                  <ChevronRight className={cn("size-4 transition-transform", peeked && "rotate-90")} />
                </button>
              ) : (
                // the peek chevron's slot, held on rows that have no peek: the hidden chevron still takes 16px,
                // so a time on a recent ended 24px short of the time on an away row below it
                <span aria-hidden="true" className="size-4" />
              )}
            </span>
          )
        }
      >
        {it.sub ? (
          <span className="block min-w-0">
            <span className="block truncate text-base">{it.label}</span>
            <span className="mt-0.5 block truncate text-sm text-muted-foreground">{it.sub}</span>
          </span>
        ) : (
          <span className="block truncate text-base">{it.label}</span>
        )}
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
  return <div className="mb-1 ml-9 mr-1 rounded-lg border bg-card px-3.5 py-3">{body}</div>;
}

// the cited evidence answer — honest single-center, neutral cites, verify-in-place
type SearchAnswer = {
  mode: "artifact" | "decision" | "graph" | "none" | "owners";
  centerId?: string;
  centerLabel?: string;
  centerKind?: RefKind;
  text: string;
  hedged?: boolean;
  cites?: AskCite[];
  owners?: { person: Person; count: number }[];
};

function AnswerBlock({
  answer,
  items,
  activeKey,
  peekId,
  setPeek,
  onBranch,
  branchLabel,
}: {
  answer: SearchAnswer;
  items: Item[];
  activeKey?: string;
  peekId: string | null;
  setPeek: (k: string | null) => void;
  onBranch: () => void;
  branchLabel?: string;
}) {
  return (
    <div className="pt-6">
      {/* the agent, credited ONCE on this surface: its seal and name, then what it is answering about (the
          subject's own mark in the scope chip's grammar), then — past a hairline — what kind of answer this is.
          It read "Woven · answering about … · cited evidence, not synthesis": two middle dots on one line. */}
      <p className="mb-3 flex flex-wrap items-center gap-2 text-xs text-primary">
        <AgentAvatar size="xs" /> Woven, answering
        {answer.centerLabel ? (
          <>
            {" "}about
            <span className="inline-flex items-center gap-1.5 rounded-sm bg-tint-1 px-1.5 py-0.5 font-medium text-muted-foreground">
              {answer.centerId && answer.centerKind ? <NodeMark node={{ id: answer.centerId, kind: answer.centerKind }} className="size-2.5" /> : null}
              {undot(answer.centerLabel)}
            </span>
          </>
        ) : null}
        <span aria-hidden="true" className="h-3 w-px bg-border" />
        <span className="text-muted-foreground">cited evidence, not synthesis</span>
      </p>
      <p className={cn("text-base leading-relaxed text-pretty", answer.hedged ? "text-muted-foreground" : "text-foreground-prose")}>{answer.text}</p>

      {items.length ? (
        <Group label={answer.mode === "owners" ? "People" : "Sources"}>
          {items.map((it) => (
            <ItemRow key={it.key} it={it} active={it.key === activeKey} peeked={peekId === it.key} setPeek={setPeek} />
          ))}
        </Group>
      ) : null}

      {answer.centerLabel ? (
        <button
          type="button"
          onClick={onBranch}
          className={cn(
            // the rows' lead column (w-6, gap-3), so the branch's words start on the rows' text edge; its glyph
            // sat flush on the column edge with the words 10px left of every row above it
            "group/branch mt-6 -mx-2 flex w-[calc(100%_+_1rem)] items-center gap-3 rounded-md px-2 py-2.5 text-left text-base transition-colors",
            FOCUS_RING,
            activeKey === BRANCH_KEY ? "bg-tint-2 text-foreground" : "text-muted-foreground hover:bg-tint-1 hover:text-foreground",
          )}
        >
          <span className="flex w-6 shrink-0 justify-center">
            <GitBranch className="size-4" />
          </span>
          <span className="flex-1">
            {branchLabel ?? <>Branch into the graph around <span className="text-foreground">{undot(answer.centerLabel)}</span></>}
          </span>
          <ArrowRight className="size-3.5 shrink-0 opacity-0 transition-opacity group-hover/branch:opacity-100" />
        </button>
      ) : null}
    </div>
  );
}
// ───────────────────────── Act drill — a shallow, walk-back-able picker (Esc/Backspace pops). Its option rows
// are the shared keyboard cursor's active set (drillItems), so ↑↓ highlight + ⏎ select the VISIBLE picker rows.
function DrillView({ drill, items, activeKey, onClose }: { drill: { kind: "collection" | "export" | "publish"; id: string; title: string }; items: Item[]; activeKey?: string; onClose: () => void }) {
  const title =
    drill.kind === "collection" ? `Add “${drill.title}” to a collection` : drill.kind === "export" ? `Export “${drill.title}”` : `Publish “${drill.title}”`;
  return (
    <div className="pt-4">
      <button type="button" onClick={onClose} className={cn("inline-flex items-center gap-1 rounded-sm text-sm text-muted-foreground transition-colors hover:text-foreground", FOCUS_RING)}>
        <ChevronRight className="size-3.5 rotate-180" /> Back
      </button>
      <Group label={title}>
        {items.map((it) => (
          <ItemRow key={it.key} it={it} active={it.key === activeKey} peeked={false} setPeek={() => {}} />
        ))}
      </Group>
    </div>
  );
}
