"use client";

import { SystemState } from "@/components/system-state";

// Public leaves have no app/reader boundary. Keep the root layout (fonts and theme) while they retry.
// Next 16.2's retry refreshes the server payload and resets the boundary together; reset alone
// would render the same failed RSC payload again after a server-side failure.
export default function RootError({ unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  return <SystemState variant="error" scope="public" action={{ onClick: unstable_retry, label: "Try again" }} />;
}
