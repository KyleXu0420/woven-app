import { TooltipProvider } from "@/components/ui/tooltip";
import { WovenToaster } from "@/components/ui/toast";
import { SearchProvider } from "@/components/search";

// The focused-reader shell — just the providers the reader needs (tooltips + toasts), none of the (app)
// chrome. SearchProvider is included so ⌘K works ON a reader and, critically, opens with THAT artifact
// captured as the Act scope (Verify / Export / Add to collection / Publish on the doc you're reading) —
// the reader sits outside the (app) group, so it wouldn't otherwise inherit the search shell.
export default function ArtifactLayout({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider>
      <SearchProvider>
        {children}
        <WovenToaster />
      </SearchProvider>
    </TooltipProvider>
  );
}
