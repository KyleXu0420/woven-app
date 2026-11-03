"use client";

import { Button } from "@/components/ui/button";
import { PAGE_FRAME } from "@/lib/frame";

// The (app) error boundary: a page that throws keeps the sidebar and offers a retry, instead of taking the
// whole shell down. Kept inside the shell so the way out is the navigation the viewer already has.
export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className={PAGE_FRAME.focused}>
      <h1 className="text-2xl font-medium">This page could not load</h1>
      <p className="mt-2 text-base text-muted-foreground">Something went wrong while drawing it. Your work is not affected.</p>
      <div className="mt-6">
        <Button variant="outline" size="sm" onClick={() => reset()}>
          Try again
        </Button>
      </div>
    </div>
  );
}
