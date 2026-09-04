import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppSidebar } from "@/components/app-sidebar";
import { SeenStamp } from "@/components/seen-stamp";
import { SearchProvider } from "@/components/search";
import { WovenToaster } from "@/components/ui/toast";
import { CaptureProvider } from "@/components/capture";
import { StoreHydrator } from "@/components/store-hydrator";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider>
      <CaptureProvider>
        <SearchProvider>
          <SidebarProvider>
            <StoreHydrator />
            <AppSidebar />
            {/* max-md:pt-14 reserves the band the trigger below sits in — here, where the trigger is declared,
                not in the page frame (the artifact reader uses the same frame and has no trigger) */}
            <SidebarInset className="max-md:pt-14">
              <SeenStamp />
              {/* No topbar. It held three things and every one of them had somewhere better to be:
                  search and the drop action merged into the sidebar Launcher, the theme toggle moved
                  to the account row, and the breadcrumb was the third and least specific statement of
                  "where am I" — after the sidebar's active item and the page's own title.
                  Every page gets those 60px back.
                  What is left is the one thing that cannot live inside the sidebar: the control that
                  OPENS the sidebar when it is closed on a small screen. */}
              <SidebarTrigger className="absolute top-1.5 left-1.5 z-20 size-11 text-muted-foreground md:hidden" aria-label="Open navigation" />
              {children}
            </SidebarInset>
          </SidebarProvider>
        </SearchProvider>
      </CaptureProvider>
      <WovenToaster />
    </TooltipProvider>
  );
}
