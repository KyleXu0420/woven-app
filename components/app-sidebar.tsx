"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useGraphVersion } from "@/lib/use-graph-version";
import {
  Home,
  Library,
  Inbox,
  Hash,
  Network,
  Users,
  Settings,
  ChevronsUpDown,
  Check,
  LogOut,
  UserPlus,
  Plus,
  type LucideIcon,
} from "lucide-react";
import { DropButton } from "@/components/capture";
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
  { title: "Team", icon: Network, href: "/team" },
  { title: "Topics", icon: Hash, href: "/topics" },
  { title: "People", icon: Users, href: "/people" },
];

// spaces = KG subgraph boundaries (personal / team / org)
const spaces = [
  { mark: "P", name: "Personal", kind: "Private", tint: "bg-muted text-foreground" },
  { mark: "A", name: "Acme · Product", kind: "Team · 14", tint: "bg-primary text-primary-foreground", active: true },
  { mark: "A", name: "Acme · Growth", kind: "Team · 9", tint: "bg-muted text-foreground" },
  { mark: "A", name: "Acme", kind: "Org · 212", tint: "bg-muted text-foreground" },
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
        <span className="size-3.5 shrink-0 rounded-[4px]" style={{ background: collection.color }} />
        <span>{collection.name}</span>
      </SidebarMenuButton>
      <SidebarMenuBadge>{collection.count}</SidebarMenuBadge>
    </SidebarMenuItem>
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
    { title: "Today", icon: Home, href: "/today" },
    { title: "Library", icon: Library, href: "/library" },
    { title: "Inbox", icon: Inbox, href: "/inbox", badge: pending ? String(pending) : undefined },
  ];

  return (
    <Sidebar variant="inset" collapsible="icon">
      {/* space switcher + collapse toggle MERGED into one harmonious row */}
      <SidebarHeader>
        <div className="group/header flex h-11 items-center gap-1 group-data-[collapsible=icon]:justify-center">
          <DropdownMenu>
            <DropdownMenuTrigger className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1.5 py-1.5 text-left outline-none transition-colors hover:bg-sidebar-accent focus-visible:bg-sidebar-accent group-data-[collapsible=icon]:hidden">
            <span className="flex h-7 shrink-0 items-center justify-center px-0.5" role="img" aria-label="Woven">
              <WovenMark className="h-4 w-auto" />
            </span>
            <div className="flex min-w-0 flex-1 flex-col group-data-[collapsible=icon]:hidden">
              <span className="truncate text-sm font-medium leading-tight">
                Acme · Product
              </span>
              <span className="truncate text-[11px] leading-tight text-muted-foreground">
                Team space · 14
              </span>
            </div>
            <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground group-data-[collapsible=icon]:hidden" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" sideOffset={6} className="w-60">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground">
                <WovenMark className="h-2.5 w-auto" /> Woven · spaces
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            {spaces.map((s) => (
              <DropdownMenuItem key={s.name} disabled={!s.active} className="gap-2">
                <span className={`flex size-5 shrink-0 items-center justify-center rounded text-[10px] font-medium ${s.tint}`}>
                  {s.mark}
                </span>
                <span className="flex-1 truncate">{s.name}</span>
                <span className="text-[11px] text-muted-foreground">{s.active ? s.kind : "soon"}</span>
                {s.active ? <Check className="size-3.5 text-primary" /> : null}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled className="gap-2 text-muted-foreground">
              Browse all spaces…
              <span className="ml-auto text-[10px]">soon</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
          </DropdownMenu>
          <SidebarTrigger className="shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/header:opacity-100 focus-visible:opacity-100 group-data-[collapsible=icon]:opacity-100" />
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* the hero CTA — opens the Capture flow (drop → processing → living); generous breathing room */}
        <div className="px-2 pt-2 pb-3 group-data-[collapsible=icon]:px-1.5">
          <DropButton />
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
        {/* account = "who I am"; Settings + account actions live one step in (2nd step) */}
        <DropdownMenu>
          <DropdownMenuTrigger className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1.5 text-left outline-none transition-colors hover:bg-sidebar-accent focus-visible:bg-sidebar-accent group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
            <PersonAvatar seed="pe_maya" name="Maya Chen" size="sm" />
            <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
              <div className="truncate text-xs font-medium leading-tight">Maya Chen</div>
              <div className="truncate text-[11px] leading-tight text-muted-foreground">
                PM · Acme
              </div>
            </div>
            <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground group-data-[collapsible=icon]:hidden" />
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" sideOffset={6} className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="flex items-center gap-2.5 font-normal">
                <PersonAvatar seed="pe_maya" name="Maya Chen" size="sm" />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium text-foreground">Maya Chen</span>
                  <span className="truncate text-[11px] text-muted-foreground">maya@acme.com</span>
                </span>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem disabled className="gap-2">
                <Settings className="size-4 text-muted-foreground" /> Settings
                <span className="ml-auto text-[10px] text-muted-foreground">soon</span>
              </DropdownMenuItem>
              <DropdownMenuItem disabled className="gap-2">
                <UserPlus className="size-4 text-muted-foreground" /> Invite teammates
                <span className="ml-auto text-[10px] text-muted-foreground">soon</span>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" disabled className="gap-2">
              <LogOut className="size-4" /> Log out
              <span className="ml-auto text-[10px] opacity-70">soon</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>

    </Sidebar>
  );
}
