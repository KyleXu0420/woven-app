"use client";

import { SystemState } from "@/components/system-state";

// The (app) error boundary: a page that throws keeps the sidebar and offers a retry, instead of taking the
// whole shell down. Kept inside the shell so the way out is the navigation the viewer already has.
// Use Next's refresh + reset retry so a failed server payload is actually fetched again.
export default function AppError({ unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  return (
    <SystemState variant="error" scope="app" action={{ onClick: unstable_retry, label: "Try again" }} />
  );
}
