import { Section, SectionAction } from "@/components/today-ui";
import { DayLine } from "@/components/home/day-line";
import { ContinueHero } from "@/components/home/continue-hero";
import { Orient } from "@/components/home/orient";
import { NeedsYou } from "@/components/home/needs-you";
import { AskSuggestions } from "@/components/ask-suggestions";
import { PAGE_FRAME } from "@/lib/frame";
import { HOME_MEASURE } from "@/lib/home";

// /today is the daily page, and it now renders the Home: RESUME → ORIENT → DECIDE → ASK as four client
// islands, so every number on it is live and sourced once. What was wrong: this route still drew the older
// composition (a gradient hero card, a CatchUp digest, a filled Approve, a "date · N docs in flight" line, an
// h1 on the 44px display rung) while the rebuilt Home lived at the parallel /home. The sidebar's "Today", the
// ⌘K "Today" item, the root redirect and the 404 page all land HERE, so everyone was sent to the stale page.
// This is the composition of app/(app)/home/page.tsx as it stands today (the intent of
// home-2026-09-03/today-swap.patch, redone on the current tree), written out rather than re-exported so the
// parallel /home can be deleted, or turned into a redirect to /today, without breaking this route. Air and
// measure notes live with the Home: claude-woven-visual-review-2026-08-14/home-2026-09-03/HOME-SPEC.md.
export default function TodayPage() {
  return (
    <div className={PAGE_FRAME.focused}>
      <h1 className="text-2xl font-medium">Today</h1>
      <p className={`mt-2 text-base text-muted-foreground ${HOME_MEASURE}`}>
        <DayLine />
      </p>
      <Section label="Continue" action={<SectionAction href="/library">All in Library</SectionAction>}>
        <ContinueHero />
      </Section>
      <Orient />
      <NeedsYou />
      <AskSuggestions flush />
    </div>
  );
}
