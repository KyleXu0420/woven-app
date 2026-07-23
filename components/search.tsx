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
  Terminal,
  type LucideIcon,
} from "lucide-react";
import { AgentAvatar, PersonAvatar } from "./identity";
import { EPISODE_LABEL } from "./catch-up";
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
  askSuggestions,
  addArtifactsToCollection,
  answerQuery,
  collectionById,
  collectionGraph,
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
// the leading glyph morphs with the route so the read-back is legible before you even read the word
const INTENT_ICON: Record<Intent, LucideIcon> = { answer: Sparkles, navigate: CornerDownLeft, act: Terminal, find: Search };

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
  sub?: React.ReactNode; // a muted second line — the row's context (why it's here / what it lands on)
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
  const gv = useGraphVersion(); // re-resolve the answer after a valve confirm/discard (prov flips → cite updates)
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
      // strip the "who owns …" frame + a leading article so the salient noun ("the launch" → "launch") resolves the topic
      const term = query.replace(RX_WHO_OWNS, "").replace(/[?.]/g, "").replace(/^\s*(the|a|an|our|my)\s+/i, "").trim();
      const topic = searchEntities(term || query, 3, { kinds: ["topic"], viewer: VIEWER })[0];
      // honor the collection scope: a topic outside the scoped collection doesn't answer here (falls through to
      // the scoped answerQuery, which hedges) — so "who owns onboarding?" under a Q4-only scope stays honest.
      const owners = topic && !topic.restricted && (!scopeIds || scopeIds.has(topic.id)) ? deriveOwners(topic.id) : [];
      if (owners.length) {
        return {
          mode: "owners" as const,
          centerId: topic!.id,
          centerLabel: topic!.label,
          centerKind: "topic" as RefKind,
          text: `${owners.map((o) => o.person.name).slice(0, 3).join(", ")} — derived from who authored and is mentioned across ${topic!.label}.`,
          owners,
        };
      }
    }
    const a = answerQuery(query, { docId, scopeId: scopeCol?.id, viewer: VIEWER });
    return { mode: a.mode, centerId: a.centerId, centerLabel: a.centerLabel, centerKind: a.centerKind, text: a.answer, cites: a.cites, hedged: a.hedged };
  }, [query, order, scope, gv, scopeCol, scopeIds]);

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
    // the Act OBJECT strips the leading imperative verb ("export plan" → act on "plan"); the shared `term` keeps it
    const actTerm = term.replace(RX_IMPERATIVE, "").trim().toLowerCase();
    const actFiltered =
      actTerm && baseIntent !== "act" ? actItems.filter((i) => String(i.label).toLowerCase().includes(actTerm)) : actItems;
    if (actFiltered.length && (baseIntent === "act" || !term || actFiltered.length < actItems.length))
      out.act.push({ title: scope.kind === "artifact" ? "On this artifact" : "Actions", items: actFiltered });

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
              return { key: `find-${h.id}`, icon: KIND_ICON[h.kind], label: <span className="text-muted-foreground">Restricted {h.kind}</span>, trailing: <span className="text-[12px] text-muted-foreground">request access</span>, activate: () => {} };
            const r: Ref = { id: h.id, label: h.label, kind: h.kind };
            const key = `find-${h.id}`;
            // source / decision have no standalone page — activating OPENS THE INLINE PEEK (they still → peek too),
            // rather than routing through focusEntity's `else close()` dead-end. The rest re-focus / deep-link.
            const activate =
              h.kind === "source" || h.kind === "decision"
                ? () => setPeekId((p) => (p === key ? null : key))
                : () => focusEntity({ ...r, depth: 0 } as GraphNode);
            return { key, icon: KIND_ICON[h.kind], label: h.label, ref: r, activate };
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
            icon: KIND_ICON[r.kind],
            label: r.label,
            sub: pend ? `${pend} proposed link${pend === 1 ? "" : "s"} to verify` : undefined,
            trailing: <span className="text-[12px] tabular-nums text-muted-foreground">{r.at}</span>,
            ref: refOf(r.id),
            activate: () => focusEntity({ ...refOf(r.id), depth: 0 } as GraphNode),
          };
        }),
      });
    }
    if (zero.away.length) {
      secs.push({
        key: "away",
        label: "While you were away",
        items: zero.away.map((e) => {
          const isAgent = e.actor === "agent";
          const who = isAgent ? "Woven" : personById(e.actor)?.name ?? e.actor;
          const lbl = EPISODE_LABEL[e.kind];
          return {
            key: `z-away-${e.id}`,
            marker: isAgent ? <AgentAvatar size="sm" /> : <PersonAvatar seed={e.actor} name={who} size="sm" />,
            label: (
              <span className="flex min-w-0 items-center gap-2">
                <span className={`shrink-0 rounded-[4px] bg-foreground/[0.06] px-1.5 py-0.5 text-[11px] font-medium leading-none ${lbl.cls}`}>{lbl.text}</span>
                <span className="min-w-0 truncate">
                  <span className="font-medium">{getArtifact(e.artifactId)?.title ?? "an artifact"}</span>
                  <span className="text-muted-foreground"> · {e.summary}</span>
                </span>
              </span>
            ),
            trailing: <span className="text-[12px] tabular-nums text-muted-foreground">{e.at}</span>,
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
        marker: <Sparkles className="size-4 text-primary" />,
        label: q,
        sub,
        trailing: <ArrowUpRight className="size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover/row:opacity-100" />,
        activate: () => setQ(q),
      })),
    });
    return secs;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zero]);

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
      let n = 0; // number only the SETTLED sources — a proposed link is not a numbered source yet
      for (let i = 0; i < answer.cites.length; i++) {
        const c = answer.cites[i];
        // a block cite (no href) opens the doc AT that section via the reader's #block hash target; only when
        // it's actually navigable (href, OR a block_id + a resolved center) do we render the "open" affordance.
        const navigable = !!(c.href || (c.block_id && answer.centerId));
        // a still-proposed link → the ✓/✕ valve (the one forest moment): confirm/dismiss it right on the answer.
        // It carries a sparkle + "Proposed" tag, not a source number — it reads as a call to make, not a settled source.
        items.push({
          key: `ans-cite-${i}`,
          marker: c.pending ? (
            <span className="flex size-5 items-center justify-center"><Sparkles className="size-3.5 text-muted-foreground" /></span>
          ) : (
            <span className="flex size-5 items-center justify-center rounded bg-foreground/[0.06] text-[11px] tabular-nums font-medium text-muted-foreground">{++n}</span>
          ),
          label: c.pending ? <span className="flex items-center gap-2">{c.label}<span className="rounded-[4px] bg-foreground/[0.06] px-1.5 py-0.5 text-[11px] font-medium leading-none text-muted-foreground">Proposed</span></span> : c.label,
          valveEdgeId: c.pending ? c.edge_id : undefined,
          trailing: navigable ? <ArrowUpRight className="size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover/row:opacity-100" /> : undefined,
          activate: () => (c.href ? go(c.href) : c.block_id && answer.centerId ? go(`/artifact/${answer.centerId}#${c.block_id}`) : undefined),
        });
      }
    }
    return items;
  }, [answer]);

  // "Branch into the graph" — route THROUGH the center to its focus page (reuses the ?focus deep-link), never a
  // bare /team. Shared by the AnswerBlock button and its flat cursor entry, so both do the same thing.
  const answerBranch = () => {
    if (answer && answer.centerId && answer.centerKind)
      focusEntity({ id: answer.centerId, label: answer.centerLabel ?? "", kind: answer.centerKind, depth: 0 } as GraphNode);
    else go("/team");
  };
  // the "Ask Woven about…" affordance as a first-class Item — reachable by the cursor, ⏎ forces the answer route
  // regardless of any leading prefix (a leading "?" is honored by classify first, ahead of > @ #).
  const askItem: Item = {
    key: ASK_KEY,
    marker: <Sparkles className="size-4 text-primary" />,
    label: <>Ask Woven about “{query}”</>,
    trailing: <kbd className="rounded-[5px] border px-1.5 font-mono text-[11px] text-muted-foreground">⌘⏎</kbd>,
    activate: () => setQ("?" + query.replace(/^[>?@#]\s*/, "")),
  };

  // the Act drill's option rows AS the active item set — when a picker is open it OWNS the keyboard cursor
  // (↑↓ highlight + ⏎ select the VISIBLE picker rows), fixing the arrows moving an invisible cursor.
  const drillItems = React.useMemo<Item[]>(() => {
    if (!drill) return [];
    if (drill.kind === "collection")
      return listCollections().map((c) => ({
        key: `drill-col-${c.id}`,
        marker: <span className="size-3 rounded-[3px]" style={{ background: c.color }} />,
        label: c.name,
        trailing: <RunHint />,
        activate: () => { addArtifactsToCollection(c.id, [drill.id]); close(); },
      }));
    if (drill.kind === "export")
      return EXPORT_FORMATS.map((f) => ({
        key: `drill-exp-${f.key}`,
        marker: <Download className="size-4 text-muted-foreground" />,
        label: f.label,
        trailing: <span className="text-[12px] text-muted-foreground">{f.hint}</span>,
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
      activate: () => { publishArtifact(drill.id, o.v); close(); },
    }));
  }, [drill, close]);

  const flat = React.useMemo(() => {
    if (drill) return drillItems; // the picker owns the cursor — ↑↓ + ⏎ act on its visible rows only
    const f: Item[] = [...answerItems];
    if (answer?.centerLabel) f.push({ key: BRANCH_KEY, label: "", activate: answerBranch }); // Branch, after the cites
    for (const l of lanes) f.push(...l.items);
    if (query && order[0] !== "answer") f.push(askItem); // the Ask affordance, after the lanes
    if (zeroSections.length) f.push(...docActs, ...zeroSections.flatMap((s) => s.items));
    return f;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drill, drillItems, answerItems, lanes, zeroSections, docActs, answer, query, order]);

  React.useEffect(() => setReroute(0), [q]); // a new/edited query starts from the classifier's own primary lane
  React.useEffect(() => setCursor(0), [q, reroute, drill]);
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
        if (!drill) setReroute((r) => r + 1); // no re-route while a drill picker owns the screen
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
        if (!drill && (e.metaKey || e.ctrlKey) && query) return setQ("?" + query.replace(/^[>?@#]\s*/, ""));
        flat[cursor]?.activate();
      } else if (e.key === "Backspace" && q === "" && drill) {
        setDrill(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flat, cursor, peekId, drill, q, query, close]);

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
      {/* header — one hero bar (rounded-lg, no pill morph, no mode toggle); read-back tone leads, scope trails */}
      <div className="shrink-0 animate-in slide-in-from-top-4 bg-secondary/50 px-6 py-6 duration-300">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <div className="flex flex-1 items-center gap-2.5 rounded-lg border bg-card py-2.5 pl-3 pr-3">
            <span className="inline-flex shrink-0 items-center gap-1.5 text-[12px] text-muted-foreground">
              <ToneIcon className="size-3.5" />
              {tone}
            </span>
            {query ? <span className="h-5 w-px shrink-0 bg-border" /> : null}
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search, ask a question, or run a command…"
              className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground"
            />
            <ScopeChip scope={scope} name={scopeName} setName={setScopeName} />
            {query ? (
              <kbd className="shrink-0 rounded-[5px] border px-1.5 font-mono text-[11px] text-muted-foreground">⏎</kbd>
            ) : null}
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
            <DrillView drill={drill} items={drillItems} activeKey={activeKey} onClose={() => setDrill(null)} />
          ) : (
            <>
              {answer ? (
                <AnswerBlock answer={answer} items={answerItems} activeKey={activeKey} peekId={peekId} setPeek={setPeekId} onBranch={answerBranch} />
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

              {/* Ask fallback — when Answer isn't the primary lane, one cursor-reachable row promotes the raw
                  query to Ask (⌘↵). When nothing else matched it IS the no-results state (one coherent path). */}
              {query && order[0] !== "answer" ? (
                <Section label={lanes.length === 0 ? "No matches — ask instead" : "Ask"} className="mt-6">
                  <RowList>
                    <ItemRow it={askItem} active={askItem.key === activeKey} peeked={false} setPeek={setPeekId} />
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
              {zeroSections.map((s, i) => (
                <Section key={s.key} label={s.label} className={i === 0 && docActs.length === 0 ? undefined : "mt-6"}>
                  <RowList>
                    {s.items.map((it) => (
                      <ItemRow key={it.key} it={it} active={it.key === activeKey} peeked={peekId === it.key} setPeek={setPeekId} />
                    ))}
                  </RowList>
                </Section>
              ))}
              {/* no standalone "No matches" line — the Ask affordance above already IS the coherent no-results path */}
            </>
          )}
        </div>
      </div>

      {/* footer — the keyboard model, Raycast/Linear muscle memory */}
      <div className="shrink-0 border-t bg-secondary/30 px-6 py-2.5">
        <div className="mx-auto flex max-w-2xl flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-muted-foreground">
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
      <kbd className="rounded-[5px] border px-1.5 font-mono">{k}</kbd> {l}
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

// a lane row with an optional inline peek beneath it. When it becomes the active (cursor) row it scrolls
// itself into view, so ↑↓ never drives the highlight below the fold in a long result set.
function ItemRow({ it, active, peeked, setPeek }: { it: Item; active: boolean; peeked: boolean; setPeek: (k: string | null) => void }) {
  const rowRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (active) rowRef.current?.scrollIntoView({ block: "nearest" });
  }, [active]);
  return (
    <div ref={rowRef}>
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
        {it.sub ? (
          <span className="block min-w-0">
            <span className="block truncate text-[15px]">{it.label}</span>
            <span className="mt-0.5 block truncate text-[12.5px] text-muted-foreground">{it.sub}</span>
          </span>
        ) : (
          <span className="truncate text-[15px]">{it.label}</span>
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
      <p className="mb-3 flex flex-wrap items-center gap-2 text-[12px] text-primary">
        <AgentAvatar size="xs" /> Woven · answering
        {answer.centerLabel ? (
          <>
            {" "}about
            <span className="inline-flex items-center gap-1 rounded-[5px] border px-1.5 py-px text-muted-foreground">
              {answer.centerLabel}
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
          className={cn(
            "group/branch mt-6 -mx-2 flex w-[calc(100%_+_1rem)] items-center gap-2.5 rounded-md px-2 py-2 text-left text-[15px] transition-colors",
            activeKey === BRANCH_KEY
              ? "bg-foreground/[0.05] text-foreground"
              : "text-muted-foreground hover:bg-foreground/[0.035] hover:text-foreground",
          )}
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
    centerId?: string;
    centerLabel?: string;
    centerKind?: RefKind;
    text: string;
    hedged?: boolean;
    cites?: { label: string; block_id?: string; href?: string }[];
    owners?: { person: Person; count: number }[];
  };
}


// ───────────────────────── Act drill — a shallow, walk-back-able picker (Esc/Backspace pops). Its option rows
// are the shared keyboard cursor's active set (drillItems), so ↑↓ highlight + ⏎ select the VISIBLE picker rows.
function DrillView({ drill, items, activeKey, onClose }: { drill: { kind: "collection" | "export" | "publish"; id: string; title: string }; items: Item[]; activeKey?: string; onClose: () => void }) {
  const title =
    drill.kind === "collection" ? `Add “${drill.title}” to a collection` : drill.kind === "export" ? `Export “${drill.title}”` : `Publish “${drill.title}”`;
  return (
    <div>
      <button type="button" onClick={onClose} className="mb-3 inline-flex items-center gap-1 text-[13px] text-muted-foreground transition-colors hover:text-foreground">
        <ChevronRight className="size-3.5 rotate-180" /> Back
      </button>
      <Section label={title}>
        <RowList>
          {items.map((it) => (
            <ItemRow key={it.key} it={it} active={it.key === activeKey} peeked={false} setPeek={() => {}} />
          ))}
        </RowList>
      </Section>
    </div>
  );
}
