import { TooltipProvider } from "@/components/ui/tooltip";
import { WovenToaster } from "@/components/ui/toast";
import { SearchProvider } from "@/components/search";

export default function DecisionLayout({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider>
      <SearchProvider>
        {children}
        <WovenToaster />
      </SearchProvider>
    </TooltipProvider>
  );
}
