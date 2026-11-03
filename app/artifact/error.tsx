"use client";

import { SystemState } from "@/components/system-state";

// Refresh the server payload as well as clearing the boundary's captured error.
export default function ArtifactError({ unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  return <SystemState variant="error" scope="reader" action={{ onClick: unstable_retry, label: "Try again" }} />;
}
