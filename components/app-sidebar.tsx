"use client";

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
import { useCapture } from "@/components/capture";
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
} from "@/components/ui/sidebar";
import { addArtifactsToCollection, collectionMembers, inboxBadgeCount, listCollections } from "@/lib/api";
import { bumpGraph } from "@/lib/store";
import { notify } from "@/lib/notifications";
import { cn } from "@/lib/utils";
import { useCollectionDrop } from "@/lib/artifact-drag";
import { IconButton } from "@/components/ui/icon-button";
import { PersonAvatar } from "@/components/identity";
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
  { mark: "P", name: "Personal", kind: "Private", tint: "bg-foreground/[0.06] text-foreground" },
  { mark: "A", name: "Acme Product", kind: "Team, 14", tint: "bg-foreground/[0.10] text-foreground", active: true },
  { mark: "A", name: "Acme Growth", kind: "Team, 9", tint: "bg-foreground/[0.06] text-foreground" },
  { mark: "A", name: "Acme", kind: "Org, 212", tint: "bg-foreground/[0.06] text-foreground" },
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
        className={cn(isOver && "bg-sidebar-accent ring-2 ring-primary ring-inset")}
      >
        <span className="size-3.5 shrink-0 rounded-sm" style={{ background: collection.color }} />
        <span>{collection.name}</span>
      </SidebarMenuButton>
      <SidebarMenuBadge>{collection.count}</SidebarMenuBadge>
    </SidebarMenuItem>
  );
}

// Drop and Search, one shell. They were two entry points on opposite sides of the screen — a hero
// button in the rail and a command bar centred in the topbar — and both answer the same question:
// "I want to get at something." Sharing a pill puts them where the eye already goes for the primary
// action, and it is what let the topbar go away entirely.
//
// Two BUTTONS inside one shell, not one button with two jobs: they do different things, so they stay
// separately labelled and separately focusable. Collapsed to the icon rail there is room for one, and
// the one that survives is Drop — search is a keyboard affordance first and Cmd-K still opens it.
// Two controls, two jobs. Creating and finding were fused into one pill behind a hairline, and
// seven independent reviews each read it as neither control. The primary action keeps the fill at
// the nav's own 32px pitch; search is its own quiet row with the shortcut it actually answers to.
function Launcher() {
  const openCapture = useCapture();
  const { openSearch } = useSearch();
  const FOCUS = "outline-none focus-visible:ring-3 focus-visible:ring-ring/50";
  return (
    // ONE ROW, TWO OBJECTS. They were two stacked 32px bars wearing each other's clothes: the create
    // action was a full-width near-white bordered well — the anatomy of a text input, left-aligned
    // label and all — while the thing that actually opens a text input was a transparent row with an
    // icon and a label, i.e. the anatomy of the nav rows 20px below it.
    //
    // Attio, the named reference, puts a wide field and a compact control side by side in one row and
    // has no create button in the sidebar at all; Linear puts two squares beside the workspace name.
    // Neither ships a wide "+ New <noun>" pill, which is the shape a generated SaaS sidebar reaches
    // for first. So: the palette takes the wide slot and is drawn as what it opens, and create becomes
    // a square beside it.
    //
    // This is NOT the fused pill that was tried and split: that failed because one closed outline said
    // "one control" while a hairline inside tried to say "two", and the outline wins that argument
    // every time. Here there are two closed outlines of different aspect, parted by a gap wider than
    // either one's padding, so the eye counts two objects before it reads a word.
    <div className="flex items-center gap-2 group-data-[collapsible=icon]:flex-col-reverse group-data-[collapsible=icon]:gap-1">
      <button
        type="button"
        onClick={() => openSearch()}
        aria-label="Search or ask"
        // Rests on --card, which is lighter than the rail in BOTH themes, so it reads as a well in
        // both. Hover moves the border and the ink, never the fill: the old button's hover replaced
        // its own bg-card with 3% ink over the rail, so the one raised thing on the rail went from
        // lighter-than-ground to darker-than-ground — it sank when it was touched.
        // Collapsed it loses the well and becomes a ghost circle, so there it takes the rail's own
        // hover fill instead — a bare glyph whose only answer to the pointer is an ink shift is not
        // enough to say "this is a button".
        className={`flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md border bg-card pr-2 pl-2.5 text-sm text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground ${FOCUS} group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:flex-none group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:border-transparent group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:hover:bg-sidebar-accent`}
      >
        <Search className="size-4 shrink-0" />
        {/* the palette answers questions as well as finding things, so the label says both */}
        <span className="min-w-0 flex-1 truncate text-left group-data-[collapsible=icon]:hidden">
          Search or ask
        </span>
        {/* bare, not a filled chip: the chip was the shadcn command-trigger scaffold, and it is the
            loudest thing in the rail for a hint nobody needs twice */}
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground/70 group-data-[collapsible=icon]:hidden">
          ⌘K
        </span>
      </button>
      {/* the one action: a square, the shape actions wear. Its label survives as the tooltip that
          IconButton requires, so icon-only never means label-less. */}
      <IconButton
        label="New artifact"
        side="right"
        variant="outline"
        onClick={() => openCapture()}
        // rounded-md, not the Button variant's pill. Measured, this rail is 12 boxes at 10px — nine
        // nav rows, the workspace switcher, the account row, the search field — against two pills.
        // A circle among them is a foreign object, and the ladder's rounded-full rung is for SHAPES,
        // which a 32px box sitting in a column of 32px boxes is not.
        className="shrink-0 rounded-md bg-card hover:border-foreground/20 hover:bg-card"
      >
        <Plus />
      </IconButton>
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
            <div className="flex min-w-0 flex-col group-data-[collapsible=icon]:hidden">
              <span className="truncate text-sm font-medium">
                Acme Product
              </span>
              <span className="truncate text-xs text-muted-foreground">
                14 members
              </span>
            </div>
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
          <SidebarTrigger className="shrink-0 rounded-md text-muted-foreground transition-colors hover:text-foreground" />
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* the hero CTA — opens the Capture flow (drop → processing → living); generous breathing room */}
        <div className="px-2 pt-2 pb-3 group-data-[collapsible=icon]:px-1.5">
          <Launcher />
        </div>

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {workspaceNav.map((i) => (
                <SidebarMenuItem key={i.title}>
                  <SidebarMenuButton
                    render={<Link href={i.href!} />}
                    isActive={pathname === i.href}
                    tooltip={i.title}
                  >
                    <i.icon />
                    <span>{i.title}</span>
                  </SidebarMenuButton>
                  {i.badge ? <SidebarMenuBadge>{i.badge}</SidebarMenuBadge> : null}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-2">
          <SidebarGroupLabel>Explore</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {exploreNav.map((i) => (
                <SidebarMenuItem key={i.title}>
                  <SidebarMenuButton
                    render={<Link href={i.href!} />}
                    isActive={pathname === i.href}
                    tooltip={i.title}
                  >
                    <i.icon />
                    <span>{i.title}</span>
                  </SidebarMenuButton>
                  {i.badge ? <SidebarMenuBadge>{i.badge}</SidebarMenuBadge> : null}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-2">
          <SidebarGroupLabel>Collections</SidebarGroupLabel>
          <NewCollectionPopover
            onCreated={() => {}}
            trigger={
              <SidebarGroupAction title="New collection">
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
