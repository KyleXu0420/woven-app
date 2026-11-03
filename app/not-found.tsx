import { SystemState } from "@/components/system-state";

// The app catch-all retains the sidebar for unknown internal routes. A public leaf's notFound()
// reaches this neutral boundary instead, without exposing whether a private artifact exists.
export default function RootNotFound() {
  return <SystemState variant="not-found" scope="public" action={{ href: "/", label: "Go to Woven" }} />;
}
