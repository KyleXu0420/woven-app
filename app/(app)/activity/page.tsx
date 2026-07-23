import { redirect } from "next/navigation";

// Activity folded into the Inbox. This page was an ORPHAN — no sidebar entry, reachable only from Today's
// "All activity →" — while the Inbox had grown its own Activity tense (the colleague monitor). Two surfaces
// named Activity, one unreachable. The route survives purely as a redirect so the old link lands correctly.
export default function ActivityPage() {
  redirect("/inbox?tab=activity");
}
