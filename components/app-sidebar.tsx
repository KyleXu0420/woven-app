"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useGraphVersion } from "@/lib/use-graph-version";
import {
  Library,
  Inbox,
  Hash,
  Orbit,
  Users,
  Settings,
  ChevronDown,
  Check,
  LogOut,
  UserPlus,
  Plus,
  Search,
  Moon,
  Sun,
  type LucideIcon,
} from "lucide-react";
import { CAPTURE_SHORTCUT, useCapture } from "@/components/capture-flow";
import { useSearch } from "@/components/search";
import { useTheme } from "@/components/theme-toggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { addArtifactsToCollection, collectionMembers, inboxBadgeCount, listCollections } from "@/lib/api";
import { bumpGraph } from "@/lib/store";
import { notify } from "@/lib/notifications";
import { cn } from "@/lib/utils";
import { useCollectionDrop } from "@/lib/artifact-drag";
import { PersonAvatar } from "@/components/identity";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { WovenMark } from "@/components/woven-mark";
import { NewCollectionPopover } from "@/components/new-collection-popover";

// zone 1 — workspace (always-there destinations); zone 2 — the knowledge graph (P1 views)
type NavItem = {
  title: string;
  icon: LucideIcon;
  href?: string;
  badge?: string;
};
const exploreNav: NavItem[] = [
  { title: "Team", icon: Orbit, href: "/team" },
  { title: "Topics", icon: Hash, href: "/topics" },
  { title: "People", icon: Users, href: "/people" },
];

// spaces = KG subgraph boundaries (personal / team / org)
const spaces = [
  { mark: "P", name: "Personal", kind: "Private", tint: "bg-tint-1 text-foreground" },
  { mark: "A", name: "Acme Product", kind: "Team, 14", tint: "bg-tint-2 text-foreground", active: true },
  { mark: "A", name: "Acme Growth", kind: "Team, 9", tint: "bg-tint-1 text-foreground" },
  { mark: "A", name: "Acme", kind: "Org, 212", tint: "bg-tint-1 text-foreground" },
];

// a sidebar collection row that doubles as a drop target — drag Library artifacts (or a desktop file)
// onto it to file them here. Highlights on drag-over; the ring sits inside the button's own radius.
function CollectionNavItem({
  collection,
  active,
}: {
  collection: { id: string; slug: string; name: string; color: string; count: number };
  active: boolean;
}) {
  const { isOver, dropProps } = useCollectionDrop({
    onArtifacts: (ids) => {
      addArtifactsToCollection(collection.id, ids);
      bumpGraph(); // addArtifactsToCollection only persists — bump so the sidebar counts refresh live
      notify.success(`Added to ${collection.name}`, {
        description: `${ids.length} artifact${ids.length > 1 ? "s" : ""} filed.`,
      });
    },
    fileDest: collection.name,
  });
  return (
    <SidebarMenuItem {...dropProps}>
      <SidebarMenuButton
        render={<Link href={`/collection/${collection.slug}`} />}
        isActive={active}
        tooltip={collection.name}
        className={cn(isOver && "bg-wash ring-2 ring-primary ring-inset")}
      >
        <span className="size-3.5 shrink-0 rounded-sm" style={{ background: collection.color }} />
        <span>{collection.name}</span>
      </SidebarMenuButton>
      <SidebarMenuBadge kind="inventory">{collection.count}</SidebarMenuBadge>
    </SidebarMenuItem>
  );
}

// The top of the rail: the search well and, under it, the rail's one verb — two controls in one
// material. The verb opens the capture sheet (the house Dialog); it does not become a field in place.
// Eight rounds of a blind judge loop tried that (the row morphing into the composer, the queue as rail
// rows): in a 224px rail a title truncates at twelve characters and every queued row shoves the nav,
// which is what the judge then scored. Kyle settled it 2026-09-14: this row from round 8, round 1's sheet.
//
// The verb's own register: a verb dressed as a destination (round 7's nav row, icon + label + a bare N
// in the count column) read as a fourth noun, and its hover wash, tint-1, was one rung off Library's
// selected tint-2 — in a still, the same grey. So Capture wears the search well's material instead: a
// flat paper box on the rail's ground, the + and the word in full ink at 500, its key in a tint keycap
// (an object at rest takes tint-1; on paper a kbd is a tint chip, and a count on the ground is bare —
// a key and a count no longer read as the same thing). Two paper boxes are the rail's two CONTROLS,
// where you type and where you add; the ground rows are its destinations, and only where you are wears
// a wash. Hover on paper is the well's own grammar, a hairline (line-hover) — a tint over paper would
// sink the box to the ground's value in light — and press is tint-1 over the paper. Neither is a wash
// a nav row wears, so hovered Capture and selected Library are never the same grey. It writes nothing,
// so it stays neutral by rule.
//
// ONE ROW, two boxes (Kyle, 2026-09-14, after Attio's rail: a wide "Quick actions ⌘K" beside a compact
// "🔍 /"): the search well takes the words and the capture button is a compact box at its right, its +
// and its key. Not a split button — a split joins the variants of one action, and these are two jobs
// (find/ask, add); joined, the + would read as a mode of the palette. Two boxes in one 32px row give the
// rail a row back, and the compact box still reads as a control with a shortcut, not a bare glyph,
// because it prints its keycap the way the well prints ⌘K. The word lives in the tooltip and the name.
//
// The row sits 8px over the nav (the rail's unit); the block's pb-2 meets the nav group's p-2 for the
// rail's one 16px seam above Today, the same seam that parts Inbox from Explore.
//
// Collapsed to the icon rail each box is a 32px ghost square with its glyph alone (the name and key in
// a tooltip).
const BOX = "flex h-8 w-full min-w-0 items-center gap-2 rounded-md border border-transparent bg-card pr-1.5 pl-2.5 text-sm transition-colors";
const BOX_COLLAPSED =
  "group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:hover:border-transparent group-data-[collapsible=icon]:hover:bg-tint-1";
const FOCUS = "outline-none focus-visible:ring-2 focus-visible:ring-focus";

// A key printed on a control: a <kbd> in a tint-1 chip on the MARK radius, the muted ink, tabular, on
// the badge's 20px line so it ends on the column's edge (pr-1.5: 6px from the box, where a nav row's
// count ends). Bare, the key was a letter in the count column, the register Inbox's 13 wears.
function Keycap({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd className={cn("flex h-5 min-w-5 shrink-0 items-center justify-center rounded-sm bg-tint-1 px-1 font-sans text-xs tabular-nums text-muted-foreground", className)}>
      {children}
    </kbd>
  );
}

function Launcher() {
  const openCapture = useCapture();
  const { openSearch } = useSearch();
  const { state, isMobile } = useSidebar();
  return (
    <div
      className="flex gap-2 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:gap-1"
      data-capture-row=""
    >
      <button
        type="button"
        onClick={() => openSearch()}
        aria-label="Search or ask"
        // Rests on --card, which is lighter than the rail in BOTH themes, so it reads as a well in
        // both, and as a FILL, not an outline: the hairline it wore at rest is gone (a control needs a
        // fill, not a border). Hover moves the border and the ink, never the fill: a tint over its own
        // paper would take it to the ground's value in light — it sank when it was touched.
        className={cn(BOX, "min-w-0 flex-1 text-muted-foreground hover:border-line-hover hover:text-foreground", FOCUS, BOX_COLLAPSED)}
      >
        <Search className="size-4 shrink-0" />
        {/* the palette answers questions as well as finding things, so the label says both */}
        <span className="min-w-0 flex-1 truncate text-left group-data-[collapsible=icon]:hidden">
          Search or ask
        </span>
        <Keycap className="group-data-[collapsible=icon]:hidden">⌘K</Keycap>
      </button>
      <Tooltip>
        <TooltipTrigger
          render={<button type="button" />}
          onClick={() => openCapture()}
          // the accessible name keeps the visible word first (a voice user says what they see)
          // and the noun the flow has always been filed under; the key is bound in CaptureProvider.
          // data-capture-launcher: the board's hook, and the element focus returns to on close.
          aria-label="Capture, new artifact"
          aria-keyshortcuts={CAPTURE_SHORTCUT}
          data-capture-launcher=""
          // w-auto, not w-full: the compact box is as wide as its + and its key — 6 · 16 · 4 · 20 · 4 = 50,
          // which leaves the well the 166 that "Search or ask" and its ⌘K need at 13px (at 58 the label
          // truncated by 8px)
          // INK-FILLED (Kyle, 2026-09-14): the one dark object in the rail, the way in. Not forest — it
          // opens and writes nothing, and forest is the agent's and the commit's — but the inverted
          // material the tooltip already wears (bg-foreground / text-background), so on charcoal it is
          // the oat box with charcoal ink. Hover steps to the prose rung of the same ink (one rung, by
          // token, in both themes); the keycap takes the on-ink chip and ink the tooltip's keycap uses.
          className={cn(BOX, "w-auto shrink-0 gap-1 pr-1 pl-1.5 font-medium bg-foreground text-background hover:bg-foreground-prose", FOCUS, BOX_COLLAPSED, "group-data-[collapsible=icon]:bg-foreground group-data-[collapsible=icon]:hover:bg-foreground-prose")}
        >
          <Plus className="size-4 shrink-0" />
          <Keycap className="bg-tint-on-ink text-muted-on-ink group-data-[collapsible=icon]:hidden">{CAPTURE_SHORTCUT}</Keycap>
        </TooltipTrigger>
        {/* the word is not printed on the box, so the tooltip names it — expanded and collapsed alike */}
        <TooltipContent side={state === "collapsed" ? "right" : "bottom"} hidden={isMobile}>
          Capture
          <kbd data-slot="kbd" className="inline-flex h-4 min-w-4 items-center justify-center rounded-sm bg-tint-on-ink px-1 font-sans text-muted-on-ink">
            {CAPTURE_SHORTCUT}
          </kbd>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

// The theme is a preference about the shell, so it lives with the account — not as a bare glyph
// beside the account row, where it read as a second unrelated control.
function ThemeMenuItem() {
  const { dark, toggle } = useTheme();
  return (
    <DropdownMenuItem onClick={toggle} className="gap-2">
      {dark ? <Sun className="size-4 text-muted-foreground" /> : <Moon className="size-4 text-muted-foreground" />}
      {dark ? "Light theme" : "Dark theme"}
    </DropdownMenuItem>
  );
}

export function AppSidebar() {
  const pathname = usePathname();
  useGraphVersion(); // re-render when the graph mutates (Inbox verify/dismiss) so the badge stays live
  const pending = inboxBadgeCount(); // whole console: Decisions rows you own + agent runs you're blocking (Activity needs_you)
  // collections read live from the store (color-coded via --chart-*, never an icon) so freshly created /
  // persisted ones appear here too — useGraphVersion() re-renders on any mutation
  const allCollections = listCollections().map((c) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    color: c.color,
    count: collectionMembers(c.slug).length,
  }));
  const workspaceNav: NavItem[] = [
    { title: "Today", icon: Sun, href: "/today" },
    { title: "Library", icon: Library, href: "/library" },
    { title: "Inbox", icon: Inbox, href: "/inbox", badge: pending ? String(pending) : undefined },
  ];

  return (
    <Sidebar variant="inset" collapsible="icon">
      {/* space switcher + collapse toggle MERGED into one harmonious row */}
      <SidebarHeader>
        <div className="group/header flex h-11 items-center gap-1 group-data-[collapsible=icon]:justify-center">
          <DropdownMenu>
            <DropdownMenuTrigger className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 py-1.5 text-left outline-none transition-colors hover:bg-sidebar-accent focus-visible:bg-sidebar-accent group-data-[collapsible=icon]:hidden">
            <span className="flex h-7 shrink-0 items-center justify-center px-0.5" role="img" aria-label="Woven">
              <WovenMark className="h-4 w-auto" />
            </span>
            {/* the workspace's name alone. "14 members" sat under it as a second line, a description
                under a title in the rail, restating a count People already owns and the switcher's
                menu already prints ("Team, 14"). On the 15 rung: it is the rail's title, and at 13/500
                it sat level with Capture and the active row — the workspace, the verb and the page all
                at one size and weight. Three rungs now: 15/500 the workspace, 13 the rows (500 only
                for the verb and where you are), 12 muted the section label. */}
            <span className="min-w-0 flex-1 truncate text-base font-medium group-data-[collapsible=icon]:hidden">
              Acme Product
            </span>
            <ChevronDown className="size-3.5 shrink-0 text-muted-foreground group-data-[collapsible=icon]:hidden" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" sideOffset={6} className="w-60">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <WovenMark className="h-2.5 w-auto" /> Woven spaces
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            {spaces.map((s) => (
              <DropdownMenuItem key={s.name} disabled={!s.active} className="gap-2">
                {/* the space's tint MARK — a glyph sized against its square, like identity.tsx's
                    monogram, so it sits off the type ladder on purpose (see the note there) */}
                <span className={`flex size-5 shrink-0 items-center justify-center rounded-sm text-[10px] font-medium ${s.tint}`}>
                  {s.mark}
                </span>
                <span className="flex-1 truncate">{s.name}</span>
                <span className="text-xs text-muted-foreground">{s.active ? s.kind : "soon"}</span>
                {s.active ? <Check className="size-3.5 text-primary" /> : null}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled className="gap-2 text-muted-foreground">
              Browse all spaces…
              <span className="ml-auto text-xs">soon</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
          </DropdownMenu>
          {/* The collapse control shows when the pointer is on the rail (and to the keyboard, and at rest
              on the icon rail, where it is the way back). Drawn at rest it sat beside the switcher's
              chevron as a second chevron-like glyph at the same weight, and the mark, the name, the
              chevron and the collapse all competed in one row; the header is the mark and the name. */}
          <SidebarTrigger className="shrink-0 rounded-md text-muted-foreground transition-[color,opacity] hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 group-data-[collapsible=icon]:opacity-100 md:opacity-0" />
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* the one field and the rail's verb; the capture composer stands in the field's box when open */}
        <div className="px-2 pt-2 pb-2 group-data-[collapsible=icon]:px-1.5">
          <Launcher />
        </div>

        {/* Zone 1 in full ink; zone 2 (Explore) keeps the rail's muted ink. Every row wore icon and
            label at the one muted ink, so the always-there destinations and the graph views read
            at one weight with only the active fill to part them; the section label alone was doing
            the ranking. Ink says it now: the workspace trio is what the rail is for. */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {workspaceNav.map((i) => (
                <SidebarMenuItem key={i.title}>
                  <SidebarMenuButton
                    render={<Link href={i.href!} aria-label={i.badge ? `${i.title}, ${i.badge} waiting` : undefined} />}
                    isActive={pathname === i.href}
                    tooltip={i.badge ? `${i.title}, ${i.badge} waiting` : i.title}
                    className="text-foreground"
                  >
                    <i.icon />
                    <span>{i.title}</span>
                  </SidebarMenuButton>
                  {i.badge ? <SidebarMenuBadge kind="demand">{i.badge}</SidebarMenuBadge> : null}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Explore rows wear their glyphs again. Round 3 took them away so the trio would outrank the
            graph views, and indented the words to the trio's text edge; what that drew was a column
            of empty icon slots — a phantom gutter under three labels. Ink already does the ranking
            (the trio in full ink, these in the rail's muted ink), so the glyph can come back at the
            row's ink and the rail has one grid: every row is glyph, gap, word.
            No mt-2 on the group: the groups' own p-2 meets the previous group's p-2, 16px, the rail's
            one unit doubled — the extra 8 put Inbox→Explore off the scale everything else is on. */}
        <SidebarGroup>
          <SidebarGroupLabel>Explore</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {exploreNav.map((i) => (
                <SidebarMenuItem key={i.title}>
                  <SidebarMenuButton
                    render={<Link href={i.href!} aria-label={i.badge ? `${i.title}, ${i.badge} waiting` : undefined} />}
                    isActive={pathname === i.href}
                    tooltip={i.badge ? `${i.title}, ${i.badge} waiting` : i.title}
                  >
                    <i.icon />
                    <span>{i.title}</span>
                  </SidebarMenuButton>
                  {i.badge ? <SidebarMenuBadge kind="demand">{i.badge}</SidebarMenuBadge> : null}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* The section's + shows on hover, focus and while its popover is open (and at rest on a
            phone, where there is no hover): drawn at rest it was a second + in the rail, at the
            Capture row's own glyph, meaning something else. The row-action reveal the Library's rows
            use, on the group. */}
        <SidebarGroup className="group/section">
          <SidebarGroupLabel>Collections</SidebarGroupLabel>
          <NewCollectionPopover
            onCreated={() => {}}
            trigger={
              <SidebarGroupAction
                title="New collection"
                className="transition-opacity md:opacity-0 group-focus-within/section:opacity-100 group-hover/section:opacity-100 aria-expanded:opacity-100 focus-visible:opacity-100"
              >
                <Plus />
                <span className="sr-only">New collection</span>
              </SidebarGroupAction>
            }
          />
          <SidebarGroupContent>
            <SidebarMenu>
              {allCollections.map((c) => (
                <CollectionNavItem
                  key={c.slug}
                  collection={c}
                  active={pathname === `/collection/${c.slug}`}
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        {/* account = "who I am"; Settings + account actions live one step in (2nd step).
            The theme toggle sits on this row because the topbar it used to live in is gone — it is a
            preference about the shell, so it belongs with the account, not with the content. */}
        <DropdownMenu>
          <DropdownMenuTrigger className="flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left outline-none transition-colors hover:bg-sidebar-accent focus-visible:bg-sidebar-accent group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
            <PersonAvatar seed="pe_maya" name="Maya Chen" size="sm" />
            <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
              <div className="truncate text-sm font-medium">Maya Chen</div>
              <div className="truncate text-xs text-muted-foreground">
                PM, Acme
              </div>
            </div>
            <ChevronDown className="size-3.5 shrink-0 text-muted-foreground group-data-[collapsible=icon]:hidden" />
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" sideOffset={6} className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="flex items-center gap-2.5 font-normal">
                <PersonAvatar seed="pe_maya" name="Maya Chen" size="sm" />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium text-foreground">Maya Chen</span>
                  <span className="truncate text-xs text-muted-foreground">maya@acme.com</span>
                </span>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem disabled className="gap-2">
                <Settings className="size-4 text-muted-foreground" /> Settings
                <span className="ml-auto text-xs text-muted-foreground">soon</span>
              </DropdownMenuItem>
              <DropdownMenuItem disabled className="gap-2">
                <UserPlus className="size-4 text-muted-foreground" /> Invite teammates
                <span className="ml-auto text-xs text-muted-foreground">soon</span>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <ThemeMenuItem />
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" disabled className="gap-2">
              <LogOut className="size-4" /> Log out
              <span className="ml-auto text-xs opacity-70">soon</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>

    </Sidebar>
  );
}
