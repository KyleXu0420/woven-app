import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppSidebar } from "@/components/app-sidebar";
import { SearchProvider, SearchBar } from "@/components/search";
import { ThemeToggle } from "@/components/theme-toggle";
import { WovenToaster } from "@/components/ui/toast";
import { CaptureProvider } from "@/components/capture";
import { Breadcrumb } from "@/components/breadcrumb";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider>
      <CaptureProvider>
        <SearchProvider>
          <SidebarProvider>
            <AppSidebar />
            <SidebarInset>
              {/* topbar: breadcrumb · Search (center) · theme toggle */}
              <header className="flex h-[60px] shrink-0 items-center gap-4 border-b px-5">
                <Breadcrumb />
                <SearchBar mode="ask" className="mx-auto" />
                <div className="ml-auto flex items-center gap-3">
                  <ThemeToggle />
                </div>
              </header>
              {children}
            </SidebarInset>
          </SidebarProvider>
        </SearchProvider>
      </CaptureProvider>
      <WovenToaster />
    </TooltipProvider>
  );
}
