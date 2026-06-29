import { TooltipProvider } from "@/components/ui/tooltip";
import { WovenToaster } from "@/components/ui/toast";

// The focused-reader shell — just the providers the reader needs (tooltips + toasts),
// none of the (app) chrome. Keeps the artifact page distraction-free.
export default function ArtifactLayout({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider>
      {children}
      <WovenToaster />
    </TooltipProvider>
  );
}
