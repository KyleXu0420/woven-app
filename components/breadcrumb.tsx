"use client";

import { usePathname } from "next/navigation";

// The one persistent location indicator — derives the trailing crumb from the route instead of a
// hardcoded literal (which read "Product › Today" on every page). Space name stays "Product".
const LABELS: Record<string, string> = {
  today: "Today",
  library: "Library",
  inbox: "Inbox",
  topics: "Topics",
  people: "People",
  team: "Team",
  collection: "Collection",
  artifact: "Artifact",
};

export function Breadcrumb() {
  const pathname = usePathname();
  const seg = pathname.split("/").filter(Boolean)[0] ?? "today";
  const label = LABELS[seg] ?? seg.charAt(0).toUpperCase() + seg.slice(1);
  return (
    <span className="hidden text-sm text-muted-foreground sm:inline">
      Product › <b className="font-medium text-foreground">{label}</b>
    </span>
  );
}
