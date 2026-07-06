"use client";

import { useState } from "react";
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
import { COLLECTIONS, type CollectionMeta } from "@/lib/collections";
import { captureReviewCount, collectionCandidateCount, pendingCount } from "@/lib/api";
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
  { title: "Topics", icon: Hash, href: "/topics" },
  { title: "People", icon: Users, href: "/people" },
];

// collections color-code via the categorical data-id palette (--chart-*), never an icon
const collections = COLLECTIONS;

// spaces = KG subgraph boundaries (personal / team / org)
const spaces = [
  { mark: "P", name: "Personal", kind: "Private", tint: "bg-muted text-foreground" },
  { mark: "A", name: "Acme · Product", kind: "Team · 14", tint: "bg-primary text-primary-foreground", active: true },
  { mark: "A", name: "Acme · Growth", kind: "Team · 9", tint: "bg-muted text-foreground" },
  { mark: "A", name: "Acme", kind: "Org · 212", tint: "bg-muted text-foreground" },
];

export function AppSidebar() {
  const pathname = usePathname();
  useGraphVersion(); // re-render when the graph mutates (Inbox verify/dismiss) so the badge stays live
  const pending = pendingCount() + captureReviewCount() + collectionCandidateCount();
  const [created, setCreated] = useState<CollectionMeta[]>([]);
  const allCollections = [...collections, ...created];
  const workspaceNav: NavItem[] = [
    { title: "Today", icon: Home, href: "/today" },
    { title: "Library", icon: Library, href: "/library" },
    { title: "Inbox", icon: Inbox, href: "/inbox", badge: pending ? String(pending) : undefined },
    { title: "Team", icon: Network, href: "/team" },
  ];

  return (
    <Sidebar variant="inset" collapsible="icon">
      {/* space switcher + collapse toggle MERGED into one harmonious row */}
      <SidebarHeader>
        <div className="group/header flex h-11 items-center gap-1 group-data-[collapsible=icon]:justify-center">
          <DropdownMenu>
            <DropdownMenuTrigger className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1.5 py-1.5 text-left outline-none transition-colors hover:bg-sidebar-accent focus-visible:bg-sidebar-accent group-data-[collapsible=icon]:hidden">
            <span className="flex size-7 shrink-0 items-center justify-center">
              <span
                role="img"
                aria-label="Woven"
                className="size-6 bg-foreground"
                style={{
                  WebkitMaskImage: "url(/brand/logo-drop.svg)",
                  maskImage: "url(/brand/logo-drop.svg)",
                  WebkitMaskSize: "contain",
                  maskSize: "contain",
                  WebkitMaskRepeat: "no-repeat",
                  maskRepeat: "no-repeat",
                  WebkitMaskPosition: "center",
                  maskPosition: "center",
                }}
              />
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
              <DropdownMenuLabel className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                <WovenMark className="size-3" /> Woven · spaces
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
            onCreated={(m) => setCreated((x) => [...x, m])}
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
                <SidebarMenuItem key={c.name}>
                  <SidebarMenuButton
                    render={<Link href={`/collection/${c.slug}`} />}
                    isActive={pathname === `/collection/${c.slug}`}
                    tooltip={c.name}
                  >
                    <span
                      className="size-3.5 shrink-0 rounded-[4px]"
                      style={{ background: c.color }}
                    />
                    <span>{c.name}</span>
                  </SidebarMenuButton>
                  <SidebarMenuBadge>{c.count}</SidebarMenuBadge>
                </SidebarMenuItem>
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
