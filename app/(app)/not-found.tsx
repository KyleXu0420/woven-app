import { SystemState } from "@/components/system-state";

// A missing route keeps the shell: sidebar intact, one sentence, one way back. Next's stock 404 dropped the
// viewer out of the product with no navigation.
export default function NotFound() {
  return (
    <SystemState
      variant="not-found"
      scope="app"
      title="Nothing here"
      body="This page has moved or never existed."
      action={{ href: "/today", label: "Back to Today" }}
    />
  );
}
